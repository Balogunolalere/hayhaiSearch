from typing import Dict, List, Optional, Union
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.gzip import GZipMiddleware
import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field
from mirascope.core import prompt_template
from mirascope.core.groq import groq_call
from mirascope.core.gemini import gemini_call
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi
import re
import time
from collections import deque
import random
from datetime import datetime, timedelta
import asyncio
from cachetools import TTLCache
from functools import lru_cache
import aiohttp
from typing import Dict, List
import os

# Initialize caches
SEARCH_CACHE = TTLCache(maxsize=100, ttl=3600)  # 1 hour TTL
CONTENT_CACHE = TTLCache(maxsize=500, ttl=7200)  # 2 hours TTL

load_dotenv()

app = FastAPI(
    title="HayhaiSearch API",
    description="An intelligent search API that combines Qwant search with AI processing",
    version="1.0.0"
)

# Add compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request and Response Models
class SearchRequest(BaseModel):
    question: str = Field(..., description="The search query or question to be answered")
    max_results: int = Field(default=6, description="Maximum number of search results to process")

class SearchType(BaseModel):
    search_type: str = Field(..., description="The type of search to perform (web, news, images, videos)")
    reasoning: str = Field(..., description="The reasoning behind the search type selection")

class SearchResponse(BaseModel):
    answer: str = Field(..., description="The answer to the question")
    sources: List[str] = Field(..., description="The sources used to generate the answer")
    search_type: str = Field(..., description="The type of search that was performed")

class RateLimiter:
    def __init__(self, rpm_limit: int = 15, tpm_limit: int = 1_000_000):
        self.rpm_limit = rpm_limit
        self.tpm_limit = tpm_limit
        self.requests = deque()
        self.tokens = deque()
        self.window = 60
        self._lock = asyncio.Lock()
    
    async def _clean_old_entries(self, queue: deque, current_time: float):
        while queue and current_time - queue[0] >= self.window:
            queue.popleft()
    
    async def can_make_request(self, tokens: int = 0) -> bool:
        async with self._lock:
            current_time = time.time()
            await self._clean_old_entries(self.requests, current_time)
            await self._clean_old_entries(self.tokens, current_time)
            
            return (len(self.requests) < self.rpm_limit and 
                    len(self.tokens) + tokens <= self.tpm_limit)
    
    async def add_request(self, tokens: int = 0):
        async with self._lock:
            current_time = time.time()
            self.requests.append(current_time)
            if tokens > 0:
                for _ in range(tokens):
                    self.tokens.append(current_time)

# Create a global rate limiter instance
gemini_rate_limiter = RateLimiter()

def with_retries(func):
    """Decorator to add retry logic with exponential backoff"""
    async def wrapper(*args, **kwargs):
        max_retries = 5
        base_delay = 1
        
        for attempt in range(max_retries):
            try:
                if not await gemini_rate_limiter.can_make_request():
                    wait_time = 60 - (time.time() - gemini_rate_limiter.requests[0])
                    await asyncio.sleep(wait_time)
                
                result = await func(*args, **kwargs)
                await gemini_rate_limiter.add_request()
                return result
                
            except Exception as e:
                if "429" in str(e):
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    await asyncio.sleep(delay)
                    continue
                raise HTTPException(status_code=500, detail=str(e))
        
        raise HTTPException(status_code=429, detail="Max retries exceeded")
    return wrapper

class QwantApi:
    BASE_URL = "https://api.qwant.com/v3"
    MAX_RETRIES = 3
    RETRY_DELAY = 5
    
    def __init__(self):
        self.cookies = {
            'didomi_token': 'eyJ1c2VyX2lkIjoiMTkyNzY2ZTItMTUwYS02ZjVlLThkMzMtMjcxMDA4MzZlNGRiIiwiY3JlYXRlZCI6IjIwMjQtMTAtMTBUMTI6MzY6MjEuOTY4WiIsInVwZGF0ZWQiOiIyMDI0LTEwLTEwVDEyOjM2OjQ0LjY4NloiLCJ2ZW5kb3JzIjp7ImRpc2FibGVkIjpbImM6cXdhbnQtM01LS0paZHkiLCJjOnBpd2lrcHJvLWVBclpESFdEIiwiYzptc2NsYXJpdHktTU1ycFJKcnAiXX0sInZlbmRvcnNfbGkiOnsiZGlzYWJsZWQiOlsiYzpxd2FudC0zTUtLSlpkeSIsImM6cGl3aWtwcm8tZUFyWkRIV0QiXX0sInZlcnNpb24iOjJ9',
            'euconsent-v2': 'CQGRvoAQGRvoAAHABBENBKFgAAAAAAAAAAqIAAAAAAAA.YAAAAAAAAAAA',
            'datadome': 'Hu02p1l32WwzSk4_NJ26axGqTjiJPVbwW1pJBmB0Mjk3unmfjHeYPuYlJE9iZGX9pRFqHBhJCNR_punKCS4eaLpZogx~IU78SsLMuZAyBbT0GgugWOUs2XUVDca3h6RD',
        }
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.qwant.com/',
            'Origin': 'https://www.qwant.com',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'DNT': '1',
            'Sec-GPC': '1',
            'Priority': 'u=4',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
        }
        # Create connection pool
        self.client_session = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self.client_session is None or self.client_session.closed:
            self.client_session = aiohttp.ClientSession(
                headers=self.headers,
                cookies=self.cookies,
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self.client_session

    @lru_cache(maxsize=100)
    async def search(self, q: str, search_type: str = 'web', locale: str = 'en_GB', 
                    offset: int = 0, safesearch: int = 1) -> Optional[Dict]:
        """
        Perform a search using the Qwant API with error handling and caching
        """
        cache_key = f"{q}:{search_type}:{locale}:{offset}:{safesearch}"
        if cache_key in SEARCH_CACHE:
            return SEARCH_CACHE[cache_key]

        params = {
            'q': q,
            'count': '10',
            'locale': locale,
            'offset': offset,
            'device': 'desktop',
            'tgp': '3',
            'safesearch': safesearch,
            'displayed': 'true',
            'llm': 'true',
        }
        
        url = f"{self.BASE_URL}/search/{search_type}"
        session = await self.get_session()
        
        for attempt in range(self.MAX_RETRIES):
            try:
                async with session.get(url, params=params) as response:
                    response.raise_for_status()
                    result = await response.json()
                    SEARCH_CACHE[cache_key] = result
                    return result
                    
            except Exception as e:
                if attempt == self.MAX_RETRIES - 1:
                    raise HTTPException(
                        status_code=503,
                        detail=f"Failed to connect to Qwant API: {str(e)}"
                    )
                await asyncio.sleep(self.RETRY_DELAY)

        raise HTTPException(
            status_code=503,
            detail="Max retries exceeded while connecting to Qwant API"
        )

# Core search functionality
@with_retries
@gemini_call("gemini-2.0-flash-exp", response_model=SearchType, json_mode=True)
@prompt_template(
"""
SYSTEM:
You are an expert at identifying the most accurate Qwant search type: web, news, images, or videos.
Follow these strict guidelines:
1. If the question explicitly or strongly suggests the need for general web information, set 'web'.
2. If the question is about recent or time-sensitive events and breaking news, set 'news'.
3. If the question is specifically about images or visual content, set 'images'.
4. If the question is specifically about videos or video content, set 'videos'.
5. If uncertain, default to 'web'.

Return a concise answer as valid JSON with two fields:
- search_type
- reasoning

USER:
Determine the most appropriate search type for the following question:
{question}

ASSISTANT:
I will choose the correct search type and justify it briefly based on the guidelines.
"""
)
async def determine_search_type(question: str) -> SearchType:
    """
    Decide the most appropriate Qwant search type for a given query.
    """
    ...

def is_video_query(question: str, search_type: str) -> bool:
    """Check if the query is video-related."""
    video_keywords = ['video', 'youtube', 'watch', 'clip', 'footage']
    return (
        search_type == 'videos' or
        any(keyword in question.lower() for keyword in video_keywords)
    )

async def qwant_search(query: str, search_type: str, max_results: int = 6) -> Dict[str, str]:
    """
    Use Qwant to get information about the query using parallel processing
    """
    print(f"Searching Qwant for '{query}' using {search_type} search...")
    search_results = {}
    urls = []
    qwant = QwantApi()
    
    results = await qwant.search(query, search_type=search_type)
    
    if (search_type == 'news' and 
        (not results or 
         not results.get('data') or 
         not results['data'].get('result') or 
         not results['data']['result'].get('items'))):
        print("No news results found, falling back to web search...")
        search_type = 'web'
        results = await qwant.search(query, search_type='web')
    
    is_video_search = is_video_query(query, search_type)
    
    if results and 'data' in results and 'result' in results['data'] and 'items' in results['data']['result']:
        items = results['data']['result']['items']
        if isinstance(items, dict) and 'mainline' in items:
            items = items['mainline']
        
        # Collect all URLs first
        all_urls = []
        count = 0
        for item in items:
            if 'url' in item:
                url = item['url']
                if not is_video_search and ('youtube.com' in url or 'youtu.be' in url):
                    continue
                all_urls.append(url)
                count += 1
            elif isinstance(item, dict) and 'items' in item:
                for subitem in item['items']:
                    if 'url' in subitem:
                        url = subitem['url']
                        if not is_video_search and ('youtube.com' in url or 'youtu.be' in url):
                            continue
                        all_urls.append(url)
                        count += 1
            if count >= max_results:
                break
        
        # Fetch content in parallel
        async def fetch_url_content(url):
            content = await get_content(url, is_video_search)
            if content:
                return url, content
            return None

        tasks = [fetch_url_content(url) for url in all_urls[:max_results]]
        results = await asyncio.gather(*tasks)
        
        # Filter out None results and add to search_results
        for result in results:
            if result:
                url, content = result
                search_results[url] = content
                urls.append(url)

    search_results['_urls'] = urls
    return search_results

def extract_youtube_id(url: str) -> Union[str, None]:
    """Extract YouTube video ID from URL."""
    try:
        pattern = r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)'
        match = re.search(pattern, url)
        if match:
            return match.group(1)
        return None
    except Exception as e:
        print(f"Error extracting YouTube ID: {e}")
        return None

async def get_youtube_transcript(video_id: str) -> str:
    """Get English transcript for a YouTube video."""
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        try:
            transcript = transcript_list.find_transcript(['en'])
        except:
            try:
                # If English isn't available, try to get any transcript and translate it
                transcript = transcript_list.find_transcript(transcript_list.transcript_data.keys())
                transcript = transcript.translate('en')
            except Exception as e:
                print(f"Translation error: {e}")
                return ""
        
        transcript_data = transcript.fetch()
        # Clean and format transcript text to avoid JSON issues
        cleaned_text = " ".join([
            entry['text'].replace('"', "'").replace('\n', ' ').strip()
            for entry in transcript_data
        ])
        return f"[Transcript] {cleaned_text}"
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return ""

async def get_content(url: str, is_video_search: bool = False) -> str:
    """
    Fetch and parse content from a URL with caching
    """
    cache_key = f"{url}:{is_video_search}"
    if cache_key in CONTENT_CACHE:
        return CONTENT_CACHE[cache_key]

    data = []
    try:
        video_id = extract_youtube_id(url)
        if video_id and is_video_search:
            transcript = await get_youtube_transcript(video_id)
            if transcript:
                cleaned_transcript = transcript.replace('"', "'").replace('\\', '').strip()
                data.append(cleaned_transcript)
                content = " ".join(data) if data else ""
                CONTENT_CACHE[cache_key] = content
                return content

        if video_id and not is_video_search:
            return ""

        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                content = await response.text()
                soup = BeautifulSoup(content, "html.parser")
                paragraphs = soup.find_all("p")
                for paragraph in paragraphs:
                    cleaned_text = paragraph.text.replace('"', "'").replace('\\', '').strip()
                    if cleaned_text:
                        data.append(cleaned_text)

    except Exception as e:
        print(f"Error fetching content from {url}: {e}")
    
    content = " ".join(data)
    CONTENT_CACHE[cache_key] = content
    return content

@with_retries
@gemini_call("gemini-2.0-flash-exp")
@prompt_template(
"""
SYSTEM:
You are a highly knowledgeable research assistant with expertise in analyzing and synthesizing information.
Your goal is to provide comprehensive, well-researched answers using the search results.

Guidelines for analysis:
1. Thoroughly examine all provided sources
2. Cross-reference information between sources
3. Consider multiple perspectives and viewpoints
4. Identify key facts, statistics, and expert opinions
5. Look for recent and historical context
6. Evaluate the credibility of sources

Search results:
{search_results}

USER:
Analyze the following question and provide a detailed response:
{question}

Include in your analysis:
- Main findings and key points
- Supporting evidence and data
- Expert opinions and quotes
- Historical or contextual background
- Different perspectives if applicable
- Limitations or uncertainties in the information
"""
)
async def search(question: str, search_results: Dict[str, str]) -> str:
    ...

@with_retries
@gemini_call("gemini-2.0-flash-exp", response_model=SearchResponse, json_mode=True)
@prompt_template(
"""
SYSTEM:
You are a professional content curator specializing in creating comprehensive, well-structured answers.
Your task is to synthesize information from multiple sources into a cohesive, detailed response.
Pay special attention to YouTube transcripts when available, as they may contain valuable spoken content.

Guidelines for response:
1. Start with a clear, concise summary of the main points
2. Structure the answer in logical sections with clear headings when appropriate
3. Include relevant quotes, statistics, and facts
4. For YouTube content, include relevant spoken content
5. Provide context and background information
6. Address multiple aspects of the question
7. End with a conclusion or summary of key takeaways

Format requirements:
- Keep responses concise and well-structured
- Use simple formatting to avoid JSON parsing issues
- Include direct quotes sparingly and with proper escaping
- Organize information in clear paragraphs
- Highlight key points without complex formatting

Search results:
{results}

USER:
{question}

Provide a clear, structured answer following the guidelines above.
"""
)
async def extract(question: str, results: Dict[str, str]) -> SearchResponse:
    ...

def clean_text(text: str) -> str:
    """
    Clean the text data for better formatting and readability.
    """
    # Removing extra spaces and special characters
    return re.sub(r'\s+', ' ', text).strip()

@app.post("/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest, response: Response):
    """
    Process a search request and return an AI-enhanced answer with compression
    """
    try:
        search_type_result = await determine_search_type(request.question)
        search_results = await qwant_search(request.question, search_type_result.search_type, request.max_results)
        
        if not search_results:
            raise HTTPException(status_code=404, detail="No results found")
        
        result = await extract(request.question, search_results)
        
        # Enable response caching
        response.headers["Cache-Control"] = "public, max-age=3600"
        
        return SearchResponse(
            answer=clean_text(result.answer),
            sources=result.sources or search_results.get('_urls', []),
            search_type=search_type_result.search_type
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """
    Simple health check endpoint
    """
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
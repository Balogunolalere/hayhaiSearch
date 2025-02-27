from typing import Dict, List, Optional, Union, Any
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.gzip import GZipMiddleware
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
from datetime import datetime
import asyncio
from cachetools import TTLCache
from functools import lru_cache
import aiohttp
from typing import Dict, List
import os
import json

# Load environment variables from .env file
load_dotenv()

# Get and export the API key
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY environment variable is not set")

# Export the API key to environment
os.environ["GOOGLE_API_KEY"] = api_key

# Initialize caches
SEARCH_CACHE = TTLCache(maxsize=100, ttl=3600)  # 1 hour TTL
CONTENT_CACHE = TTLCache(maxsize=500, ttl=7200)  # 2 hours TTL
QUERY_CACHE = TTLCache(maxsize=100, ttl=3600)   # 1 hour TTL
SOURCE_EVAL_CACHE = TTLCache(maxsize=200, ttl=7200)  # 2 hours TTL

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

class QueryInterpretRequest(BaseModel):
    question: str = Field(..., description="The original search query to be analyzed and enhanced")

class SourceEvaluationRequest(BaseModel):
    sources: List[str] = Field(..., description="List of source URLs to evaluate")
    question: str = Field(..., description="The original search query for context")

class SearchType(BaseModel):
    search_type: str = Field(..., description="The type of search to perform (web, news, images, videos)")
    reasoning: str = Field(..., description="The reasoning behind the search type selection")

class SearchResponse(BaseModel):
    answer: str = Field(..., description="The answer to the question")
    sources: List[str] = Field(..., description="The sources used to generate the answer")
    search_type: str = Field(..., description="The type of search that was performed")

class QueryInterpretation(BaseModel):
    original_query: str = Field(..., description="The original query provided by the user")
    enhanced_query: str = Field(..., description="The enhanced query with additional context and terms")
    keywords: List[str] = Field(..., description="Important keywords extracted from the query")
    intent: str = Field(..., description="The inferred intent behind the user's query")
    context: str = Field(..., description="Additional contextual information about the query")

class SourceEvaluation(BaseModel):
    source_url: str = Field(..., description="The URL of the evaluated source")
    credibility_score: float = Field(..., description="Credibility score from 0-1")
    relevance_score: float = Field(..., description="Relevance score from 0-1")
    site_type: str = Field(..., description="Type of site (e.g., news, academic, blog, corporate)")
    last_updated: Optional[str] = Field(None, description="When the content was last updated if available")
    author_expertise: Optional[str] = Field(None, description="Author expertise level if available")
    bias_assessment: str = Field(..., description="Assessment of potential bias in the source")
    key_insights: List[str] = Field(..., description="Key insights from this source related to the query")

class SourceEvaluationResponse(BaseModel):
    evaluations: List[SourceEvaluation] = Field(..., description="Evaluations of each source")
    overall_quality: float = Field(..., description="Overall quality score of the sources")
    recommended_sources: List[str] = Field(..., description="URLs of the most reliable and relevant sources")
    improvement_suggestions: Optional[str] = Field(None, description="Suggestions for better source selection")

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
                    offset: int = 0, safesearch: int = 5) -> Optional[Dict]:
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
    Use Qwant to get information about the query with optimized parallel processing
    """
    print(f"Searching Qwant for '{query}' using {search_type} search...")
    search_results = {}
    urls = []
    qwant = QwantApi()
    
    # Perform multiple search types in parallel for comprehensive results
    parallel_searches = []
    results = None
    secondary_results = None
    
    try:
        if (search_type == 'web'):
            # For web searches, also fetch news in parallel for better coverage
            parallel_searches = [
                qwant.search(query, search_type='web'),
                qwant.search(query, search_type='news')
            ]
            results_list = await asyncio.gather(*parallel_searches, return_exceptions=True)
            
            # Handle potential errors in parallel searches
            results = results_list[0] if not isinstance(results_list[0], Exception) else None
            secondary_results = results_list[1] if not isinstance(results_list[1], Exception) else None
            
            # If web search failed, try news as primary
            if not results and secondary_results:
                results = secondary_results
                secondary_results = None
        else:
            # For non-web searches, just use the requested type
            try:
                results = await qwant.search(query, search_type=search_type)
            except Exception as e:
                print(f"Error in primary search: {str(e)}")
                # Fall back to web search if the primary search type fails
                try:
                    results = await qwant.search(query, search_type='web')
                except Exception as e:
                    print(f"Error in fallback search: {str(e)}")
                    results = None
    
    except Exception as e:
        print(f"Error in search process: {str(e)}")
        return {"_urls": [], "error": str(e)}

    is_video_search = is_video_query(query, search_type)
    
    def extract_urls_from_items(items_data, url_list, count):
        """Helper function to extract URLs from Qwant result items"""
        if not items_data:
            return count
            
        if isinstance(items_data, dict) and 'mainline' in items_data:
            items_data = items_data['mainline']
            
        for item in items_data:
            if count >= max_results:
                break
                
            if 'url' in item:
                url = item['url']
                # Skip YouTube URLs if not a video search
                if not is_video_search and ('youtube.com' in url or 'youtu.be' in url):
                    continue
                # Skip duplicate URLs
                if url not in url_list:
                    url_list.append(url)
                    count += 1
            elif isinstance(item, dict) and 'items' in item:
                for subitem in item['items']:
                    if count >= max_results:
                        break
                    if 'url' in subitem:
                        url = subitem['url']
                        if not is_video_search and ('youtube.com' in url or 'youtu.be' in url):
                            continue
                        if url not in url_list:
                            url_list.append(url)
                            count += 1
        return count
    
    # Extract URLs from primary results
    all_urls = []
    count = 0
    
    if results and 'data' in results and 'result' in results['data'] and 'items' in results['data']['result']:
        count = extract_urls_from_items(results['data']['result']['items'], all_urls, count)
    
    # If we have secondary results and need more URLs, extract from there too
    if secondary_results and count < max_results:
        if ('data' in secondary_results and 
            'result' in secondary_results['data'] and 
            'items' in secondary_results['data']['result']):
            count = extract_urls_from_items(
                secondary_results['data']['result']['items'], 
                all_urls, 
                count
            )
    
    # Fetch content in parallel with improved error handling
    if all_urls:
        semaphore = asyncio.Semaphore(8)  # Limit concurrent requests
        
        async def fetch_url_with_semaphore(url):
            async with semaphore:
                try:
                    content = await get_content(url, is_video_search)
                    if content and content.strip():
                        return url, content
                    
                    # If content fetch fails, try alternative URLs
                    if 'github.com' in url:
                        # Try raw content URL for GitHub
                        raw_url = url.replace('github.com', 'raw.githubusercontent.com')
                        raw_url = raw_url.replace('/blob/', '/')
                        content = await get_content(raw_url, is_video_search)
                        if content and content.strip():
                            return url, content
                            
                    elif 'docs.' in url:
                        # Try alternative doc URLs
                        alt_urls = [
                            url.replace('docs.', 'www.'),
                            url.replace('docs.', '')
                        ]
                        for alt_url in alt_urls:
                            content = await get_content(alt_url, is_video_search)
                            if content and content.strip():
                                return url, content
                                
                except Exception as e:
                    print(f"Error fetching {url}: {str(e)}")
                return None
        
        tasks = [fetch_url_with_semaphore(url) for url in all_urls[:max_results]]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out None results and exceptions, add to search_results
        for result in results:
            if result and not isinstance(result, Exception):
                url, content = result
                if content.strip():
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
    Fetch and parse content from a URL with caching, improved error handling and retry mechanism
    """
    cache_key = f"{url}:{is_video_search}"
    if cache_key in CONTENT_CACHE:
        return CONTENT_CACHE[cache_key]

    data = []
    max_retries = 3
    base_delay = 1

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

        # More aggressive timeout settings
        timeout = aiohttp.ClientTimeout(
            total=10,    # Total timeout
            connect=5,   # Connection timeout
            sock_read=5  # Socket read timeout
        )

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        }

        for attempt in range(max_retries):
            try:
                async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
                    async with session.get(url, allow_redirects=True, verify_ssl=False) as response:
                        if response.status != 200:
                            if attempt == max_retries - 1:
                                print(f"Failed to fetch {url} after {max_retries} attempts. Status: {response.status}")
                                return ""
                            await asyncio.sleep(base_delay * (2 ** attempt))
                            continue

                        # Try to detect content type and encoding
                        content_type = response.headers.get('Content-Type', '').lower()
                        if 'application/pdf' in content_type or 'image/' in content_type:
                            return ""  # Skip binary content

                        try:
                            content = await response.text()
                        except UnicodeDecodeError:
                            content = await response.read()
                            try:
                                content = content.decode('utf-8', errors='replace')
                            except:
                                return ""

                        # Use html.parser as it's more forgiving with malformed HTML
                        soup = BeautifulSoup(content, "html.parser", from_encoding='utf-8')

                        # Remove unwanted elements
                        for element in soup.find_all(['script', 'style', 'nav', 'footer', 'iframe']):
                            element.decompose()

                        # Extract content with priority
                        if article := soup.find('article'):
                            for elem in article.find_all(['h1', 'h2', 'h3', 'h4', 'p']):
                                text = elem.get_text(strip=True)
                                if text and len(text) > 20:
                                    data.append(text)

                        if main := soup.find('main'):
                            for elem in main.find_all(['h1', 'h2', 'h3', 'h4', 'p']):
                                text = elem.get_text(strip=True)
                                if text and len(text) > 20 and text not in data:
                                    data.append(text)

                        # Fallback to regular content if needed
                        if len(data) < 3:
                            for elem in soup.find_all(['h1', 'h2', 'h3', 'p']):
                                text = elem.get_text(strip=True)
                                if text and len(text) > 30 and text not in data:
                                    data.append(text)

                        break  # Success, exit retry loop

            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt == max_retries - 1:
                    print(f"Error fetching {url} after {max_retries} attempts: {str(e)}")
                    return ""
                await asyncio.sleep(base_delay * (2 ** attempt))
                continue

    except Exception as e:
        print(f"Unexpected error processing {url}: {str(e)}")
        return ""

    # Join the data and limit content size
    content = " ".join(data)
    if len(content) > 10000:
        content = content[:10000] + "..."

    # Only cache if we actually got content
    if content.strip():
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

Guidelines for response formatting:
1. Start with a clear overview paragraph (2-3 sentences)
2. Use "## " prefix for main sections, organize content logically
3. Format lists properly:
   - Use "1. " for numbered steps
   - Use "• " for bullet points
   - Indent sub-items with spaces
4. Code blocks:
   - Use triple backticks with language name
   - Include brief comments
   - Proper indentation
5. Tables:
   - Use | for columns
   - Include header row
   - Use alignment separator row
6. Spacing:
   - Empty line before and after headings
   - Empty line between paragraphs
   - Empty line before and after lists/code blocks
7. Citations:
   - Add [Source X] at the end of statements
   - Group related citations together

Example format:

Brief overview explaining the topic and its significance [Source 1]

## Key Concepts

• First concept explained clearly [Source 2]
• Second concept with details [Source 3]

## Technical Details

1. First step with explanation
2. Second step with `inline code`

```python
# Example code with comment
def example():
    return "result"
```

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Value 1  |
| Data 2   | Value 2  |

Search results:
{results}

USER:
{question}

Provide a clear, structured answer following the formatting guidelines above.
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

# New function for AI query interpretation
@with_retries
@gemini_call("gemini-2.0-flash-exp", response_model=QueryInterpretation, json_mode=True)
@prompt_template(
"""
SYSTEM:
You are an expert search query analyzer and enhancer. Your task is to interpret user queries, 
understand their underlying intent, and enhance them with relevant keywords and context.

Guidelines for analyzing queries:
1. Identify key concepts and entities in the query
2. Determine the underlying intent (e.g., informational, navigational, transactional)
3. Recognize ambiguous terms that could have multiple meanings
4. Identify missing context that would improve search results
5. Add synonyms and related terms that could improve search relevance

For your response, provide the following as a valid JSON object:
- original_query: The user's original query
- enhanced_query: An improved version with additional context and terms
- keywords: A list of 3-7 important keywords extracted from the query
- intent: The inferred intent behind the user's query
- context: Additional contextual information about the query

USER:
Analyze and enhance the following search query: {query}

ASSISTANT:
I'll analyze this search query and provide an enhanced version with additional context.
"""
)
async def interpret_query(query: str) -> QueryInterpretation:
    """
    Analyze and enhance a user query to improve search results.
    """
    ...

# New function for evaluating source credibility and relevance
@with_retries
@gemini_call("gemini-2.0-flash-exp", response_model=SourceEvaluationResponse, json_mode=True)
@prompt_template(
"""
SYSTEM:
You are an expert at evaluating the credibility and relevance of information sources. 
Your task is to assess the quality of each provided source in relation to the user's query.

For each source URL, analyze the following factors:
1. Domain reputation and reliability
2. Content recency and relevance to the query
3. Author expertise and credentials (if available)
4. Presence of citations or references
5. Potential bias or conflicts of interest
6. Factual accuracy based on cross-reference with other sources
7. Overall information quality

For your response, provide the following as a valid JSON object:
- evaluations: A list of evaluations, one for each source URL
- overall_quality: A score between 0-1 representing the overall quality of all sources
- recommended_sources: A list of the most reliable and relevant source URLs
- improvement_suggestions: Optional suggestions for better source selection

For each source evaluation, include:
- source_url: The URL being evaluated
- credibility_score: Score from 0-1
- relevance_score: Score from 0-1
- site_type: Type of the site (academic, news, blog, etc.)
- last_updated: When the content was last updated (if available)
- author_expertise: Assessment of author expertise (if available)
- bias_assessment: Potential bias in the source
- key_insights: Key insights from this source related to the query

USER:
Evaluate the credibility and relevance of the following sources in relation to this query:

Query: {question}

Sources to evaluate:
{sources}

ASSISTANT:
I'll evaluate each source for credibility and relevance to the query.
"""
)
async def evaluate_sources(question: str, sources: List[str]) -> SourceEvaluationResponse:
    """
    Evaluate the credibility and relevance of each source.
    """
    ...

@app.post("/query/interpret", response_model=QueryInterpretation)
async def interpret_query_endpoint(request: QueryInterpretRequest, response: Response):
    """
    Process a query to enhance it with AI interpretation
    """
    try:
        # Check cache first
        cache_key = request.question.strip().lower()
        if cache_key in QUERY_CACHE:
            return QUERY_CACHE[cache_key]
        
        # Generate new interpretation
        result = await interpret_query(request.question)
        
        # Cache the result
        QUERY_CACHE[cache_key] = result
        
        # Enable response caching
        response.headers["Cache-Control"] = "public, max-age=3600"
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sources/evaluate", response_model=SourceEvaluationResponse)
async def evaluate_sources_endpoint(request: SourceEvaluationRequest, response: Response):
    """
    Evaluate the credibility and relevance of provided sources
    """
    try:
        # Generate cache key from sorted sources and question
        sources_key = "-".join(sorted(request.sources))
        cache_key = f"{request.question.strip().lower()}:{sources_key}"
        
        # Check cache first
        if cache_key in SOURCE_EVAL_CACHE:
            return SOURCE_EVAL_CACHE[cache_key]
        
        # Get evaluation result
        result = await evaluate_sources(request.question, request.sources)
        
        # Cache the result
        SOURCE_EVAL_CACHE[cache_key] = result
        
        # Enable response caching
        response.headers["Cache-Control"] = "public, max-age=7200"
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
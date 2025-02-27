import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const question = searchParams.get('question');
    const maxResults = searchParams.get('maxResults') || '6';
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question parameter is required' },
        { status: 400 }
      );
    }

    // Prepare the request to the backend API
    const apiUrl = process.env.API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${apiUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        max_results: parseInt(maxResults, 10)
      }),
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', errorText);
      
      return NextResponse.json(
        { error: 'Failed to fetch search results' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Set cache headers for better performance
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=600'); // Cache for 10 minutes
    
    return NextResponse.json(data, { 
      headers,
      status: 200 
    });
    
  } catch (error) {
    console.error('Search error:', error);
    
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
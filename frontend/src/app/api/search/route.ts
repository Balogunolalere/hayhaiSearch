import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const question = searchParams.get('question');

  if (!question) {
    return new Response(
      JSON.stringify({
        error: 'Question is required',
        code: 'MISSING_QUERY'
      }), 
      { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }

  try {
    const response = await fetch('http://localhost:8000/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Search request failed', {
        cause: response.status,
      });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: error instanceof Error && error.cause ? error.cause : 'INTERNAL_ERROR'
      }),
      { 
        status: error instanceof Error && error.cause ? Number(error.cause) : 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}
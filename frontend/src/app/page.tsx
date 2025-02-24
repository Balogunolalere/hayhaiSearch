'use client';

import { useState } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { SearchResults } from '@/components/ui/SearchResults';
import { Button } from '@/components/ui/Button';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const { data, isLoading, error } = useSWR(
    submittedQuery ? `/api/search?question=${encodeURIComponent(submittedQuery)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false
    }
  );

  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      setSubmittedQuery(inputValue.trim());
    }
  };

  // If we have a fatal error, throw it to trigger the error boundary
  if (error?.status === 500) {
    throw new Error('Search failed', { cause: error });
  }

  return (
    <main className="min-h-screen bg-brutalist-white">
      <div className="fixed top-0 left-0 w-full bg-accent border-b-4 border-brutalist-black z-10 md:relative md:bg-transparent md:border-0">
        <div className="max-w-4xl mx-auto px-4 py-3 md:px-6 md:py-12">
          <h1 className="font-mono text-2xl md:text-6xl font-bold text-brutalist-black md:mb-4 truncate">
            HayhaiSearch
          </h1>
          <p className="hidden md:block font-mono text-brutalist-black text-lg md:text-xl">
            Your AI search assistant
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-20 pb-6 md:px-6 md:py-6 space-y-8">
        <div className="space-y-6">
          <SearchInput
            placeholder="Ask me anything..."
            onSearch={handleInputChange}
            onSubmit={handleSubmit}
            value={inputValue}
            className="md:mt-8"
          />

          {error && (
            <div className="border-brutal bg-primary p-6 space-y-4">
              <div className="font-mono text-[32px] select-none">
                {`>:(`}
              </div>
              <div>
                <p className="font-mono text-brutalist-black font-bold mb-2">
                  {error.status === 400 ? 'Invalid Search' : 'Search Error'}
                </p>
                <p className="font-mono text-sm text-brutalist-black">
                  {error.data?.error || 'Something went wrong. Please try again.'}
                </p>
              </div>
            </div>
          )}

          {(isLoading || data) && (
            <SearchResults
              result={data}
              isLoading={isLoading}
              className="mt-6"
            />
          )}

          {!isLoading && !data && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <div className="border-brutal bg-secondary p-6">
                <h3 className="font-mono text-lg font-bold mb-3">Quick Tips</h3>
                <ul className="space-y-2 font-mono text-sm">
                  <li>• Ask specific questions</li>
                  <li>• Include relevant context</li>
                  <li>• Try different phrasings</li>
                </ul>
              </div>
              <div className="border-brutal bg-primary p-6">
                <h3 className="font-mono text-lg font-bold mb-3">Features</h3>
                <ul className="space-y-2 font-mono text-sm">
                  <li>• Web, news, and video search</li>
                  <li>• AI-powered answers</li>
                  <li>• Source citations</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-12 border-t-4 border-brutalist-black pt-6">
          <p className="font-mono text-sm text-center">
            Built with Next.js and FastAPI • By Doombuggy
          </p>
        </footer>
      </div>
    </main>
  );
}

'use client';

import { useState, useCallback, useTransition, useEffect } from 'react';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { SearchInput } from '@/components/ui/SearchInput';
import { SearchResults } from '@/components/ui/SearchResults';
import { Button } from '@/components/ui/Button';
import { ClockIcon, TrashIcon } from '@radix-ui/react-icons';

// Enhanced fetcher with timeout and improved error handling
const fetcher = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const error: any = new Error(errorData.error || 'An error occurred while fetching data');
      error.status = res.status;
      error.info = errorData;
      throw error;
    }
    
    return res.json();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
};

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Load search history from localStorage on initial render
  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed.slice(0, 5));
        }
      } catch (e) {
        console.error('Error parsing search history', e);
      }
    }
  }, []);

  // Save search history to localStorage whenever it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    }
  }, [searchHistory]);

  const { data, isLoading, error } = useSWR(
    submittedQuery ? `/api/search?question=${encodeURIComponent(submittedQuery)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      dedupingInterval: 10000 // Dedupe identical requests within 10 seconds
    }
  );

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSubmit = () => {
    if (!inputValue.trim() || isLoading) return;
    
    // Use startTransition to avoid blocking UI
    startTransition(() => {
      // Add to search history if not already there
      if (!searchHistory.includes(inputValue.trim())) {
        setSearchHistory(prev => [inputValue.trim(), ...prev].slice(0, 5));
      } else {
        // If it exists, move it to the top
        setSearchHistory(prev => [
          inputValue.trim(),
          ...prev.filter(item => item !== inputValue.trim())
        ].slice(0, 5));
      }
      setSubmittedQuery(inputValue.trim());
    });
  };

  const handleHistoryClick = (query: string) => {
    setInputValue(query);
    // Use setTimeout to allow input to update before submitting
    setTimeout(() => {
      setSubmittedQuery(query);
    }, 0);
  };

  const clearHistory = () => {
    if (window.confirm('Clear all search history?')) {
      setSearchHistory([]);
      localStorage.removeItem('searchHistory');
    }
  };

  const handleDeleteHistoryItem = (queryToDelete: string) => {
    if (window.confirm(`Remove "${queryToDelete}" from search history?`)) {
      setSearchHistory(prev => prev.filter(query => query !== queryToDelete));
      // Update localStorage with the new history
      const newHistory = searchHistory.filter(query => query !== queryToDelete);
      if (newHistory.length > 0) {
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));
      } else {
        localStorage.removeItem('searchHistory');
      }
    }
  };

  // If we have a fatal error, throw it to trigger the error boundary
  if (error?.status === 500) {
    throw new Error('Search failed', { cause: error });
  }

  const hasSearched = isLoading || data || error;

  return (
    <main className="min-h-screen bg-brutalist-white">
      <Header minimal={hasSearched} />

      <div className={cn(
        "max-w-4xl mx-auto px-4 pb-6 md:px-6 md:py-6 space-y-8",
        hasSearched ? "pt-20" : "pt-32 md:pt-36"
      )}>
        {!hasSearched && (
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-4xl md:text-6xl font-mono font-bold text-brutalist-black relative inline-block">
              Find answers,
              <br />
              not just results
              <span className="absolute -bottom-2 right-0 h-3 w-3 bg-accent rounded-full"></span>
            </h2>
            <p className="max-w-xl mx-auto font-mono text-lg md:text-xl text-brutalist-black/80 mt-4">
              Your AI-powered search assistant that delivers comprehensive answers
            </p>
          </div>
        )}

        <div className="space-y-6 animate-fade-in">
          <SearchInput
            placeholder="Ask me anything..."
            onSearch={handleInputChange}
            onSubmit={handleSubmit}
            value={inputValue}
            className="md:mt-8"
          />
          
          {searchHistory.length > 0 && (
            <div className="flex flex-col gap-2 mt-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center font-mono text-sm text-brutalist-black/80 bg-brutalist-black/5 px-2 py-1 rounded-sm border border-brutalist-black/10">
                  <ClockIcon className="mr-1.5 h-3.5 w-3.5" />
                  Recent searches
                </span>
                {searchHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-300 hover:border-red-600 rounded-sm transition-all duration-150"
                    title="Clear all history"
                    aria-label="Clear all search history"
                  >
                    <TrashIcon className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {searchHistory.map((query, index) => (
                  <div
                    key={query}
                    className="flex items-center bg-brutalist-white border-2 border-brutalist-black/60 rounded-sm shadow-sm group transform transition-all duration-150 hover:border-brutalist-black hover:shadow-md hover:-translate-y-0.5"
                  >
                    <button
                      onClick={() => handleHistoryClick(query)}
                      className="px-3 py-1.5 font-mono text-sm hover:bg-accent/20 transition-colors"
                    >
                      {query}
                    </button>
                    <button
                      onClick={() => handleDeleteHistoryItem(query)}
                      className="px-1.5 py-1.5 border-l-2 border-brutalist-black/60 group-hover:border-brutalist-black text-brutalist-black/60 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title={`Remove "${query}" from search history`}
                      aria-label={`Remove "${query}" from search history`}
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && error.status !== 500 && (
            <div className="border-brutal bg-primary p-6 space-y-4">
              <h3 className="font-mono text-lg font-bold">Search Error</h3>
              <p className="font-mono">{error.info?.error || error.message || 'Something went wrong with your search'}</p>
              <Button 
                onClick={() => {
                  setSubmittedQuery(inputValue);
                }} 
                variant="accent"
              >
                Try Again
              </Button>
            </div>
          )}

          {(isLoading || data) && (
            <SearchResults
              result={data}
              isLoading={isLoading}
              className="mt-6"
            />
          )}
        </div>

        <Footer />
      </div>
    </main>
  );
}

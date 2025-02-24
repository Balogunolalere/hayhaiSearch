import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLinkIcon } from '@radix-ui/react-icons';

interface SearchResult {
  answer: string;
  sources: string[];
  search_type: string;
}

interface SearchResultsProps {
  result?: SearchResult;
  isLoading?: boolean;
  className?: string;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  result,
  isLoading,
  className,
}) => {
  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        <div className="border-brutal bg-brutalist-white p-4 md:p-6">
          <div className="flex items-center space-x-3">
            <div className="h-4 w-4 bg-primary animate-pulse rounded-full" />
            <div className="font-mono text-sm text-brutalist-black">Searching...</div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="mt-4 space-y-3"
            >
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div
      className={cn(
        'relative w-full bg-brutalist-white border-4 border-brutalist-black shadow-brutal-lg',
        'before:absolute before:top-0 before:left-0 before:right-0 before:h-2 before:bg-[url("/torn-paper-top.svg")]',
        'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-2 after:bg-[url("/torn-paper.svg")]',
        className
      )}
    >
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 bg-accent border-2 border-brutalist-black font-mono text-sm">
            {result.search_type}
          </span>
        </div>

        <div className="prose prose-brutalist max-w-none">
          <p className="font-mono text-base md:text-lg text-brutalist-black whitespace-pre-line">
            {result.answer}
          </p>
        </div>
        
        {result.sources.length > 0 && (
          <div className="border-t-4 border-brutalist-black pt-4 mt-6">
            <h3 className="font-mono text-sm text-brutalist-black mb-2">Sources:</h3>
            <ul className="space-y-2">
              {result.sources.map((source, index) => (
                <li 
                  key={index} 
                  className="font-mono text-xs md:text-sm text-brutalist-black flex items-start gap-2"
                >
                  <ExternalLinkIcon className="flex-shrink-0 mt-1" />
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary transition-colors break-all"
                  >
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export { SearchResults };
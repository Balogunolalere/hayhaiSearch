import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch: (value: string) => void;
  onSubmit: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onSearch, onSubmit, ...props }, ref) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      onSearch(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    };

    return (
      <div className="relative w-full">
        <div className="absolute inset-0 bg-brutalist-white border-4 border-brutalist-black shadow-brutal transform translate-x-1 translate-y-1" />
        <div className="relative flex gap-4">
          <input
            type="text"
            className={cn(
              'relative w-full h-16 px-6 py-4 bg-brutalist-white border-4 border-brutalist-black font-mono text-lg focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none shadow-brutal transition-all',
              'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-2 after:bg-[url("/torn-paper.svg")]',
              className
            )}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            ref={ref}
            {...props}
          />
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            variant="accent"
            size="icon"
            className="flex-shrink-0"
          >
            <MagnifyingGlassIcon className="h-6 w-6" />
          </Button>
        </div>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { SearchInput };
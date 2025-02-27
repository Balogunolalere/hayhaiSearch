import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { Button } from './Button';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch: (value: string) => void;
  onSubmit: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onSearch, onSubmit, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    
    // Use the passed ref or create our own
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(inputRef.current);
      } else if (ref) {
        ref.current = inputRef.current;
      }
    }, [ref]);
    
    // Focus the input on mount
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    };

    return (
      <div className={cn(
        "relative",
        className
      )}>
        <div className="border-brutal bg-brutalist-white flex overflow-hidden shadow-brutal hover:shadow-brutal-hover transition-transform duration-200 transform hover:-translate-y-0.5">
          <div className="relative flex-grow">
            <input
              type="text"
              ref={inputRef}
              className="flex-grow font-mono text-lg px-4 py-3.5 outline-none w-full border-r-4 border-brutalist-black transition-colors focus:bg-brutalist-white/90"
              placeholder="Ask me anything..."
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              {...props}
            />
            {props.value && props.value.toString().length > 0 && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-accent animate-pulse"></div>
            )}
          </div>
          <Button 
            onClick={onSubmit}
            className="px-6 rounded-none transition-all duration-200"
            variant="accent"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </div>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { SearchInput };
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';

interface HeaderProps {
  minimal?: boolean;
}

export function Header({ minimal = false }: HeaderProps) {
  return (
    <header className={cn(
      "fixed w-full top-0 z-10 bg-brutalist-white border-b-4 border-brutalist-black transition-all duration-300",
      minimal ? "py-2" : "py-5"
    )}>
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
        <Link href="/" passHref className="flex items-center group">
          <div className={cn(
            "flex items-center transition-all duration-300",
            minimal ? "gap-1" : "gap-2"
          )}>
            <div className={cn(
              "bg-accent rounded-full flex items-center justify-center transition-all", 
              minimal ? "w-7 h-7" : "w-9 h-9"
            )}>
              <MagnifyingGlassIcon className={cn(
                "text-brutalist-black transition-all",
                minimal ? "h-4 w-4" : "h-5 w-5"
              )} />
            </div>
            <h1 className={cn(
              "font-mono font-bold text-brutalist-black transition-all group-hover:translate-x-0.5",
              minimal ? "text-xl" : "text-2xl"
            )}>
              Hayhai<span className="text-primary">Search</span>
            </h1>
          </div>
        </Link>
        
        <nav className="flex space-x-4">
          {/* Add navigation links here if needed */}
        </nav>
      </div>
    </header>
  );
}
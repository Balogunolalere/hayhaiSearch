import React from 'react';
import { HeartIcon } from '@radix-ui/react-icons';

export function Footer() {
  return (
    <footer className="mt-12 py-6 border-t-4 border-brutalist-black">
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center gap-2 mb-2 md:mb-0">
          <p className="font-mono text-sm text-brutalist-black/70">
            &copy; {new Date().getFullYear()} HayhaiSearch
          </p>
          <span className="inline-flex items-center font-mono text-xs bg-brutalist-black/5 px-2 py-0.5 rounded-full border border-brutalist-black/10">
            v1.0
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm text-brutalist-black/70">
            Made with <HeartIcon className="h-3 w-3 inline text-primary" /> using Qwant &amp; Gemini AI
          </p>
        </div>
      </div>
    </footer>
  );
}
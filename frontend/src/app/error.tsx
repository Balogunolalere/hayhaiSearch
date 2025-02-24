'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-brutalist-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="border-brutal bg-accent p-8 md:p-12 space-y-6">
          <div className="font-mono text-[120px] leading-none select-none">
            {`>:(`}
          </div>
          <h1 className="font-mono text-2xl md:text-4xl font-bold">
            Oops! Something went wrong
          </h1>
          <p className="font-mono text-base md:text-lg">
            Error code: {error.digest || 'Unknown'}
          </p>
          <div className="pt-4">
            <Button
              onClick={reset}
              variant="default"
              className="text-lg"
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
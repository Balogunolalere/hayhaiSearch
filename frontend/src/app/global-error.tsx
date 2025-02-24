'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <main className="min-h-screen bg-brutalist-white flex items-center justify-center p-4">
          <div className="max-w-2xl w-full text-center space-y-8">
            <div className="border-brutal bg-primary p-8 md:p-12 space-y-6">
              <div className="font-mono text-[150px] leading-none select-none rotate-90">
                {`:(`}
              </div>
              <h1 className="font-mono text-2xl md:text-4xl font-bold">
                Fatal Error
              </h1>
              <p className="font-mono text-base md:text-lg">
                Error code: {error.digest || 'Unknown'}
              </p>
              <div className="pt-4">
                <button
                  onClick={reset}
                  className="relative inline-flex items-center justify-center rounded-none border-4 border-brutalist-black font-mono text-base font-bold transition-all h-12 px-6 py-2 bg-accent text-brutalist-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-brutal"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Optionally log the error to an error reporting service like Sentry or Datadog
        console.error('Library Dashboard ErrorBoundary caught:', error);
    }, [error]);

    return (
        <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
            <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong!</h2>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
                We encountered an unexpected error while trying to load your dashboard. Don&apos;t worry, your data is safe.
            </p>
            <button
                // Attempt to recover by trying to re-render the segment
                onClick={() => reset()}
                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                Try again
            </button>
        </div>
    );
}

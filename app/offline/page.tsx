export default function OfflineFallback() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
            <div className="text-center max-w-lg p-8 bg-white rounded-xl shadow-md border border-gray-100">
                <svg className="w-16 h-16 text-indigo-500 mx-auto mb-6 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">You are currently offline</h1>
                <p className="text-gray-600 mb-6">
                    We can&apos;t connect to the server right now. Some features may be unavailable until you reconnect to the internet.
                </p>
                <a
                    href="/dashboard"
                    className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                >
                    Return to Library
                </a>
            </div>
        </div>
    );
}

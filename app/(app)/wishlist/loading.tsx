export default function Loading() {
    return (
        <div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                <div className="h-10 w-48 bg-gray-300 dark:bg-gray-700 rounded mb-6 animate-pulse"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mt-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-gray-300 dark:bg-gray-700 aspect-[2/3] rounded"></div>
                    ))}
                </div>
            </div>
        </div>
    );
}

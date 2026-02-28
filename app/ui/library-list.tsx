import dbConnect from '@/app/lib/mongoose';
import Movie from '@/app/models/movie';
import { auth } from '@/auth';
import { Types } from 'mongoose';

export default async function LibraryList() {
    const session = await auth();

    if (!session?.user?.id) {
        return <div>Please log in to view your library.</div>;
    }

    await dbConnect();

    // Fetch movies for the current user and sort by newest first
    const userMovies = await Movie.find({ userId: new Types.ObjectId(session.user.id) })
        .sort({ addedAt: -1 })
        .lean();

    if (!userMovies || userMovies.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto my-8 p-8 bg-white rounded-lg shadow text-center">
                <h3 className="text-xl font-medium text-gray-700">Your library is empty</h3>
                <p className="text-gray-500 mt-2">Search for movies above to add them to your collection.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto my-8">
            <h2 className="text-2xl font-bold mb-6 px-4">Your Movie Library</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                {userMovies.map((movie: any) => (
                    <div key={movie.tmdbId} className="flex flex-col bg-white rounded-lg shadow overflow-hidden transition-transform hover:scale-105">
                        {movie.poster ? (
                            <img
                                src={`https://image.tmdb.org/t/p/w500${movie.poster}`}
                                alt={`${movie.title} poster`}
                                className="w-full h-80 object-cover"
                            />
                        ) : (
                            <div className="w-full h-80 bg-gray-200 flex items-center justify-center text-gray-500">
                                No Poster Available
                            </div>
                        )}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-lg leading-tight mb-1">{movie.title}</h3>
                                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                                    <span className="bg-gray-100 px-2 py-1 rounded">{movie.quality}</span>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-4">
                                Added: {new Date(movie.addedAt).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

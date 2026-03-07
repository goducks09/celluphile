import dbConnect from '@/app/lib/mongoose';
import Movie from '@/app/models/movie';
import { auth } from '@/auth';
import { Types } from 'mongoose';
import LibraryFilterAndList from './library-filter-and-list';

export default async function LibraryList() {
    const session = await auth();

    if (!session?.user?.id) {
        return <div className="text-center p-8 mt-4 bg-white rounded shadow text-gray-600">Please log in to view your library.</div>;
    }

    await dbConnect();

    // Fetch initial movies for the current user (sorted by newest, max 50 to match action threshold)
    const initialMoviesRaw = await Movie.find({ userId: new Types.ObjectId(session.user.id) })
        .sort({ addedAt: -1 })
        .lean();

    // Serialize _id and userId specifically to pass server data crossing the network boundary to client
    const serializedInitialMovies = initialMoviesRaw.map((movie: any) => ({
        ...movie,
        _id: movie._id.toString(),
        userId: movie.userId.toString()
    }));

    if (!serializedInitialMovies || serializedInitialMovies.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto my-8 p-8 bg-white rounded-lg shadow text-center">
                <h3 className="text-xl font-medium text-gray-700">Your library is empty</h3>
                <p className="text-gray-500 mt-2">Search for movies above to add them to your collection.</p>
            </div>
        );
    }

    // Pass the initial server-fetched dataset into the Client Component for interactivity
    return <LibraryFilterAndList initialMovies={serializedInitialMovies as any} />;
}

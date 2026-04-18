import { notFound, redirect } from 'next/navigation';
import { getMovieByTmdbId } from '@/app/lib/actions';
import ItemDetail from '@/app/ui/item-detail';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Movie Details | Celluphile',
};

export default async function Page({ params }: { params: Promise<{ tmdbId: string }> }) {
    const { tmdbId: rawId } = await params;
    const tmdbId = parseInt(rawId, 10);

    if (isNaN(tmdbId)) {
        notFound();
    }

    const result = await getMovieByTmdbId(tmdbId);

    if (!result.success || !result.movie) {
        // Either not found or does not belong to the user
        redirect('/dashboard/library');
    }

    return <ItemDetail movie={result.movie} />;
}

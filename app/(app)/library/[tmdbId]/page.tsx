import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getMovieByTmdbId } from '@/app/lib/data';
import ItemDetail from '@/app/ui/item-detail';
import ItemDetailSkeleton from '@/app/ui/item-detail-skeleton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Movie Details | Celluphile',
};

export const instant = {
    unstable_samples: [{ params: { tmdbId: '550' } }],
};

export async function MovieDetailContent({ params }: { params: Promise<{ tmdbId: string }> }) {
    const { tmdbId: rawId } = await params;
    const tmdbId = parseInt(rawId, 10);

    if (isNaN(tmdbId)) {
        notFound();
    }

    const result = await getMovieByTmdbId(tmdbId);

    if (!result.success || !result.movie) {
        redirect('/library');
    }

    return <ItemDetail movie={result.movie} />;
}

export default function Page({ params }: { params: Promise<{ tmdbId: string }> }) {
    return (
        <Suspense fallback={<ItemDetailSkeleton />}>
            <MovieDetailContent params={params} />
        </Suspense>
    );
}

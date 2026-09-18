import { notFound, redirect } from 'next/navigation';
import { getMovieByTmdbId } from '@/app/lib/data';
import ItemDetail from '@/app/ui/item-detail';
import type { Metadata } from 'next';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

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
        redirect('/library');
    }

    return <ItemDetail movie={result.movie} />;
}

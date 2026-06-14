import { notFound, redirect } from 'next/navigation';
import { getMovieFromCatalog } from '@/app/lib/data';
import ItemDetail from '@/app/ui/item-detail';
import RecommendationDetailActions from '@/app/ui/recommendation-detail-actions';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Recommendation Details | Celluphile',
};

export default async function RecommendationDetailPage({
    params,
}: {
    params: Promise<{ tmdbId: string }>;
}) {
    const { tmdbId: rawId } = await params;
    const tmdbId = parseInt(rawId, 10);

    if (isNaN(tmdbId)) {
        notFound();
    }

    const result = await getMovieFromCatalog(tmdbId);

    if (!result.success || !result.movie) {
        redirect('/recommendations');
    }

    return (
        <ItemDetail movie={result.movie} mode="recommendation">
            <RecommendationDetailActions movie={result.movie} />
        </ItemDetail>
    );
}

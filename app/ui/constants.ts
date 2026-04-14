import type { Quality } from '@/app/lib/schemas';

/**
 * Maps each quality value to a Tailwind background-color class
 * for rendering quality badges on movie cards.
 */
export const QUALITY_COLORS: Record<Quality, string> = {
    '4K': 'bg-amber-600',
    'Blu-ray': 'bg-sky-600',
    'Digital': 'bg-red-500',
    'DVD': 'bg-violet-600',
};

import { z } from 'zod';

// ============================================================
// Zod schemas — extracted from actions.ts for testability
// ============================================================

export const qualityEnum = z.enum(['Digital', 'Blu-ray', '4K', 'DVD']);

/** Union type derived from the Zod enum — the single source of truth for quality values. */
export type Quality = z.infer<typeof qualityEnum>;

/** Ordered array of every quality value. Use this to render selects, filters, etc. */
export const QUALITIES: Quality[] = qualityEnum.options;

export const personSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
});

export const addMovieSchema = z.object({
  tmdbId: z.number().int().positive(),
  quality: qualityEnum,
  customNotes: z.string().max(500, 'Custom notes cannot exceed 500 characters').optional(),
});

// Internal schema — validates TMDB API response before upserting catalog
export const movieCatalogSchema = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string().min(1).max(255),
  poster: z.string(),
  genre: z.array(z.string()),
  actors: z.array(personSchema).default([]),
  directors: z.array(personSchema).default([]),
  releaseDate: z.string().optional(),
  runtime: z.number().int().nonnegative().optional(),
});

export const movieIdSchema = z.number().int().positive();

export const pushSubscriptionSchema = z.object({
    endpoint: z.url(),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
    }),
});

export const searchFiltersSchema = z.object({
    genre: z.array(z.string()).optional(),
    quality: z.array(qualityEnum).optional(),
}).optional();

export const sendNotificationSchema = z.string().min(1, 'Notification message cannot be empty');

export const searchQuerySchema = z.string();

export const searchSortSchema = z.object({
    field: z.enum(['title', 'addedAt', 'release_date']),
    order: z.union([z.literal(1), z.literal(-1)]),
}).optional();

export const searchPaginationSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
}).default({ page: 1, limit: 20 });

export const updateMovieSchema = z.object({
    quality: qualityEnum.optional(),
    customNotes: z.string().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided to update.' }
);

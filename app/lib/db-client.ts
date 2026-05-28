import Dexie, { type EntityTable } from 'dexie';
import type { Quality } from '@/app/lib/schemas';

export interface LocalMovie {
    // userId is intentionally excluded — IndexedDB is scoped to the active user
    tmdbId: number;
    title: string;
    poster: string;
    genres: string[];
    quality: Quality;
    customNotes?: string;
    addedAt: Date;
    actors: { firstName: string; lastName: string; fullName: string }[];
    directors: { firstName: string; lastName: string; fullName: string }[];
    releaseDate?: string;
    runtime?: number;
    overview?: string;
    keywords?: string[];
    voteAverage?: number;
    voteCount?: number;
    popularity?: number;
}

export interface LocalWishlistMovie {
    tmdbId: number;
    title: string;
    poster: string;
    genres: string[];
    addedAt: Date;
    releaseDate?: string;
}

type SyncPayload =
    | { action: 'add'; payload: LocalMovie }
    | { action: 'remove'; payload: { tmdbId: number } }
    | { action: 'update'; payload: { tmdbId: number; updateData: { quality?: Quality; customNotes?: string } } }
    | { action: 'wishlist-add'; payload: { tmdbId: number } }
    | { action: 'wishlist-remove'; payload: { tmdbId: number } };

export type SyncOperation = SyncPayload & {
    id?: number;
    timestamp: number;
    retryCount?: number;
};

const db = new Dexie('CelluphileDB') as Dexie & {
    movies: EntityTable<LocalMovie, 'tmdbId'>;
    wishlist: EntityTable<LocalWishlistMovie, 'tmdbId'>;
    syncQueue: EntityTable<SyncOperation, 'id'>;
};

db.version(1).stores({
    movies: 'tmdbId, title, addedAt',
    wishlist: 'tmdbId, title, addedAt',
    syncQueue: '++id, timestamp, retryCount'
});

export { db };

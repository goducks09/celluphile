import Dexie, { type EntityTable } from 'dexie';

export interface LocalMovie {
    // userId is intentionally excluded — IndexedDB is scoped to the active user
    tmdbId: number;
    title: string;
    poster: string;
    genre: string[];
    quality: 'Digital' | 'Blu-ray' | '4K' | 'DVD';
    customNotes?: string;
    addedAt: Date;
}

type SyncPayload =
    | { action: 'add'; payload: LocalMovie }
    | { action: 'remove'; payload: { tmdbId: number } }
    | { action: 'update'; payload: { tmdbId: number; updateData: { quality?: 'Digital' | 'Blu-ray' | '4K' | 'DVD'; customNotes?: string } } };

export type SyncOperation = SyncPayload & {
    id?: number;
    timestamp: number;
    retryCount?: number;
};

const db = new Dexie('CelluphileDB') as Dexie & {
    movies: EntityTable<LocalMovie, 'tmdbId'>;
    syncQueue: EntityTable<SyncOperation, 'id'>;
};

db.version(1).stores({
    movies: 'tmdbId, title, addedAt',
    syncQueue: '++id, timestamp, retryCount'
});

export { db };

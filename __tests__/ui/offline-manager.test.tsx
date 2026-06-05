import { render, screen, act } from '@testing-library/react';
import OfflineManager from '@/app/ui/offline-manager';
import { db } from '@/app/lib/db-client';
import { addMovieToWishlist, removeMovieFromWishlist } from '@/app/lib/actions';
import { useLiveQuery } from 'dexie-react-hooks';

jest.mock('@/app/lib/db-client', () => ({
    db: {
        syncQueue: {
            count: jest.fn(),
            orderBy: jest.fn().mockReturnThis(),
            toArray: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
        }
    }
}));

jest.mock('@/app/lib/actions', () => ({
    addMovieToLibrary: jest.fn(),
    removeMovieFromLibrary: jest.fn(),
    updateMovieInLibrary: jest.fn(),
    addMovieToWishlist: jest.fn(),
    removeMovieFromWishlist: jest.fn(),
}));

jest.mock('dexie-react-hooks', () => ({
    useLiveQuery: jest.fn(),
}));

describe('OfflineManager Sync Queue', () => {
    let mockOnLine: boolean;

    beforeAll(() => {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            get: () => mockOnLine,
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockOnLine = true;
        (useLiveQuery as jest.Mock).mockReturnValue(2);
    });

    it('processes wishlist-add and wishlist-remove operations', async () => {
        const mockQueue = [
            { id: 1, action: 'wishlist-add', payload: { tmdbId: 100 }, timestamp: 1 },
            { id: 2, action: 'wishlist-remove', payload: { tmdbId: 200 }, timestamp: 2 },
        ];
        
        (db.syncQueue.orderBy('timestamp').toArray as jest.Mock).mockResolvedValue(mockQueue);
        
        render(<OfflineManager />);
        
        // Because useEffect handles sync queue asynchronously on mount, we delay a bit
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        
        expect(addMovieToWishlist).toHaveBeenCalledWith(100);
        expect(removeMovieFromWishlist).toHaveBeenCalledWith(200);
        
        // Should delete operations after processing
        expect(db.syncQueue.delete).toHaveBeenCalledWith(1);
        expect(db.syncQueue.delete).toHaveBeenCalledWith(2);
    });
});

import {
  addMovieSchema,
  movieIdSchema,
  pushSubscriptionSchema,
  searchFiltersSchema,
  searchSortSchema,
  searchPaginationSchema,
  updateMovieSchema,
} from '@/app/lib/schemas';

describe('addMovieSchema', () => {
  const validMovie = {
    tmdbId: 550,
    quality: ['Blu-ray'] as const,
  };

  it('valid input passes', () => {
    const result = addMovieSchema.safeParse(validMovie);
    expect(result.success).toBe(true);
  });

  it('valid input with customNotes passes', () => {
    const result = addMovieSchema.safeParse({
      ...validMovie,
      customNotes: 'Great movie!',
    });
    expect(result.success).toBe(true);
  });

  it('invalid quality is rejected', () => {
    const result = addMovieSchema.safeParse({ ...validMovie, quality: ['VHS'] });
    expect(result.success).toBe(false);
  });

  it('tmdbId must be positive int', () => {
    expect(addMovieSchema.safeParse({ ...validMovie, tmdbId: 0 }).success).toBe(false);
    expect(addMovieSchema.safeParse({ ...validMovie, tmdbId: -1 }).success).toBe(false);
    expect(addMovieSchema.safeParse({ ...validMovie, tmdbId: 1.5 }).success).toBe(false);
  });

  it('customNotes max 500 chars', () => {
    const longNotes = 'a'.repeat(501);
    const result = addMovieSchema.safeParse({ ...validMovie, customNotes: longNotes });
    expect(result.success).toBe(false);

    const okNotes = 'a'.repeat(500);
    const result2 = addMovieSchema.safeParse({ ...validMovie, customNotes: okNotes });
    expect(result2.success).toBe(true);
  });
});

describe('movieIdSchema', () => {
  it('positive int passes', () => {
    expect(movieIdSchema.safeParse(1).success).toBe(true);
    expect(movieIdSchema.safeParse(999).success).toBe(true);
  });

  it('zero is rejected', () => {
    expect(movieIdSchema.safeParse(0).success).toBe(false);
  });

  it('negative is rejected', () => {
    expect(movieIdSchema.safeParse(-1).success).toBe(false);
  });

  it('float is rejected', () => {
    expect(movieIdSchema.safeParse(1.5).success).toBe(false);
  });
});

describe('pushSubscriptionSchema', () => {
  const validSub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: {
      p256dh: 'BPK5OAx_some_key_value',
      auth: 'some_auth_value',
    },
  };

  it('valid subscription passes', () => {
    const result = pushSubscriptionSchema.safeParse(validSub);
    expect(result.success).toBe(true);
  });

  it('invalid URL is rejected', () => {
    const result = pushSubscriptionSchema.safeParse({
      ...validSub,
      endpoint: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('missing keys is rejected', () => {
    const { keys, ...noKeys } = validSub;
    const result = pushSubscriptionSchema.safeParse(noKeys);
    expect(result.success).toBe(false);
  });

  it('empty auth key is rejected', () => {
    const result = pushSubscriptionSchema.safeParse({
      ...validSub,
      keys: { ...validSub.keys, auth: '' },
    });
    expect(result.success).toBe(false);
  });
});

describe('searchFiltersSchema', () => {
  it('undefined passes (schema is optional)', () => {
    const result = searchFiltersSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('valid genres and quality arrays pass', () => {
    const result = searchFiltersSchema.safeParse({
      genres: ['Action', 'Drama'],
      quality: ['Blu-ray', '4K'],
    });
    expect(result.success).toBe(true);
  });

  it('invalid quality value is rejected', () => {
    const result = searchFiltersSchema.safeParse({
      quality: ['VHS'],
    });
    expect(result.success).toBe(false);
  });
});

describe('searchSortSchema', () => {
  it('valid field and order passes', () => {
    const result = searchSortSchema.safeParse({ field: 'title', order: 1 });
    expect(result.success).toBe(true);
  });

  it('all valid fields accepted', () => {
    expect(searchSortSchema.safeParse({ field: 'addedAt', order: -1 }).success).toBe(true);
    expect(searchSortSchema.safeParse({ field: 'release_date', order: 1 }).success).toBe(true);
  });

  it('invalid field is rejected', () => {
    const result = searchSortSchema.safeParse({ field: 'rating', order: 1 });
    expect(result.success).toBe(false);
  });

  it('order must be 1 or -1', () => {
    expect(searchSortSchema.safeParse({ field: 'title', order: 2 }).success).toBe(false);
    expect(searchSortSchema.safeParse({ field: 'title', order: 0 }).success).toBe(false);
  });
});

describe('searchPaginationSchema', () => {
  it('defaults are applied when no input given', () => {
    const result = searchPaginationSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('limit max 100 is enforced', () => {
    const result = searchPaginationSchema.safeParse({ page: 1, limit: 101 });
    expect(result.success).toBe(false);

    const result2 = searchPaginationSchema.safeParse({ page: 1, limit: 100 });
    expect(result2.success).toBe(true);
  });

  it('page must be positive', () => {
    expect(searchPaginationSchema.safeParse({ page: 0, limit: 20 }).success).toBe(false);
    expect(searchPaginationSchema.safeParse({ page: -1, limit: 20 }).success).toBe(false);
  });
});

describe('updateMovieSchema', () => {
  it('valid quality update passes', () => {
    const result = updateMovieSchema.safeParse({ quality: ['DVD'] });
    expect(result.success).toBe(true);
  });

  it('valid customNotes update passes', () => {
    const result = updateMovieSchema.safeParse({ customNotes: 'My notes' });
    expect(result.success).toBe(true);
  });

  it('both fields together passes', () => {
    const result = updateMovieSchema.safeParse({ quality: ['4K'], customNotes: 'Upgraded!' });
    expect(result.success).toBe(true);
  });

  it('empty object is rejected', () => {
    const result = updateMovieSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('invalid quality is rejected', () => {
    const result = updateMovieSchema.safeParse({ quality: ['VHS'] });
    expect(result.success).toBe(false);
  });
});

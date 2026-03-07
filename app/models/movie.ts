import { Schema, model, models, Types, type HydratedDocument } from 'mongoose';

export interface IMovie {
  userId: Types.ObjectId;
  tmdbId: number;
  title: string;
  poster: string;
  genre: string[];
  quality: 'Digital' | 'Blu-ray' | '4K' | 'DVD';
  addedAt: Date;
  customNotes?: string;
}

export type IMovieDocument = HydratedDocument<IMovie>;

const MovieSchema = new Schema<IMovie>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tmdbId: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
  },
  poster: {
    type: String,
    default: '',
  },
  genre: {
    type: [String],
    default: [],
  },
  quality: {
    type: String,
    enum: ['Digital', 'Blu-ray', '4K', 'DVD'],
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  customNotes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
});

// Ensures a user cannot add the same movie to their library twice
MovieSchema.index({ userId: 1, tmdbId: 1 }, { unique: true });

// Add text indexing for efficient local library search by title
MovieSchema.index({ title: 'text' });

// Compound indexes for optimal performance in searchUserLibrary
// 1. Default sort: Most recent movies by user
MovieSchema.index({ userId: 1, addedAt: -1 });

// 2. Filter sort: Quality filter + newest sort
MovieSchema.index({ userId: 1, quality: 1, addedAt: -1 });

const Movie = models.Movie || model<IMovie>('Movie', MovieSchema);

export default Movie;

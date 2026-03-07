import { Schema, model, models, Document, Types } from 'mongoose';

export interface IMovie extends Document {
  userId: Types.ObjectId;
  tmdbId: number;
  title: string;
  poster: string;
  genre: string[];
  quality: 'Digital' | 'Blu-ray' | '4K' | 'DVD';
  addedAt: Date;
  customNotes?: string;
}

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
  },
  poster: {
    type: String,
    required: true,
  },
  genre: {
    type: [String],
    required: true,
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
  },
});

// Ensures a user cannot add the same movie to their library twice
MovieSchema.index({ userId: 1, tmdbId: 1 }, { unique: true });

// Add text indexing for efficient local library search by title
MovieSchema.index({ title: 'text' });

const Movie = models.Movie || model<IMovie>('Movie', MovieSchema);

export default Movie;

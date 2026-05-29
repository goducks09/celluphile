import 'server-only';
import { Schema, model, models, type HydratedDocument } from 'mongoose';

export interface IActor {
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface IDirector {
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface IMovie {
  tmdbId: number;
  actors: IActor[];
  directors: IDirector[];
  embedding?: number[];
  genres: string[];
  keywords: string[];
  lastFetched: Date;
  overview: string;
  popularity?: number;
  poster: string;
  releaseDate?: string;
  runtime?: number;
  title: string;
  voteAverage?: number;
  voteCount?: number;
}

export type IMovieDocument = HydratedDocument<IMovie>;

const MovieSchema = new Schema<IMovie>({
  tmdbId: {
    type: Number,
    required: true,
    unique: true,
  },
  actors: {
    type: [{ firstName: String, lastName: String, fullName: String, _id: false }],
    default: [],
  },
  directors: {
    type: [{ firstName: String, lastName: String, fullName: String, _id: false }],
    default: [],
  },
  embedding: {
    type: [Number],
    default: null,
  },
  genres: {
    type: [String],
    default: [],
  },
  keywords: {
    type: [String],
    default: [],
  },
  lastFetched: {
    type: Date,
    default: Date.now,
  },
  overview: {
    type: String,
    default: '',
  },
  popularity: { type: Number },
  poster: {
    type: String,
    default: '',
  },
  releaseDate: { type: String },
  runtime: { type: Number },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
  },
  voteAverage: { type: Number },
  voteCount: { type: Number },
});

// Add text indexing for efficient local library search by title
MovieSchema.index({ title: 'text' });

const Movie = models.Movie || model<IMovie>('Movie', MovieSchema);

export default Movie;

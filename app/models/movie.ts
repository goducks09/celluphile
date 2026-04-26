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
  title: string;
  poster: string;
  overview: string;
  genre: string[];
  keywords: string[];
  actors: IActor[];
  directors: IDirector[];
  releaseDate?: string;
  runtime?: number;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  embedding?: number[];
  lastFetched: Date;
}

export type IMovieDocument = HydratedDocument<IMovie>;

const MovieSchema = new Schema<IMovie>({
  tmdbId: {
    type: Number,
    required: true,
    unique: true,
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
  overview: {
    type: String,
    default: '',
  },
  genre: {
    type: [String],
    default: [],
  },
  keywords: {
    type: [String],
    default: [],
  },
  actors: {
    type: [{ firstName: String, lastName: String, fullName: String, _id: false }],
    default: [],
  },
  directors: {
    type: [{ firstName: String, lastName: String, fullName: String, _id: false }],
    default: [],
  },
  releaseDate: { type: String },
  runtime: { type: Number },
  voteAverage: { type: Number },
  voteCount: { type: Number },
  popularity: { type: Number },
  embedding: {
    type: [Number],
    default: null,
  },
  lastFetched: {
    type: Date,
    default: Date.now,
  },
});

// Add text indexing for efficient local library search by title
MovieSchema.index({ title: 'text' });

const Movie = models.Movie || model<IMovie>('Movie', MovieSchema);

export default Movie;

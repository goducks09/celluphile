import 'server-only';
import { Schema, model, models, Types, type HydratedDocument } from 'mongoose';
import { QUALITIES, type Quality } from '@/app/lib/schemas';

export interface IUserMovie {
  userId: Types.ObjectId;
  tmdbId: number;
  quality: Quality;
  addedAt: Date;
  customNotes?: string;
}

export type IUserMovieDocument = HydratedDocument<IUserMovie>;

const UserMovieSchema = new Schema<IUserMovie>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tmdbId: { type: Number, required: true },
  quality: { type: String, enum: QUALITIES, required: true },
  addedAt: { type: Date, default: Date.now },
  customNotes: { type: String, trim: true, maxlength: 500 },
});

// Ensures a user cannot add the same movie to their library twice
UserMovieSchema.index({ userId: 1, tmdbId: 1 }, { unique: true });

// Compound indexes for optimal performance in searchUserLibrary
// 1. Default sort: Most recent movies by user
UserMovieSchema.index({ userId: 1, addedAt: -1 });

// 2. Filter sort: Quality filter + newest sort
UserMovieSchema.index({ userId: 1, quality: 1, addedAt: -1 });

const UserMovie = models.UserMovie || model<IUserMovie>('UserMovie', UserMovieSchema);
export default UserMovie;

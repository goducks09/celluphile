import { Schema, model, models, type HydratedDocument, Types } from 'mongoose';

export interface IUserEvent {
  userId: Types.ObjectId;
  tmdbId: number;
  event: 'added' | 'removed' | 'rated' | 'watched' | 'watchlisted';
  rating?: number | null;
  timestamp: Date;
  sessionId?: string;
}

export type IUserEventDocument = HydratedDocument<IUserEvent>;

const UserEventSchema = new Schema<IUserEvent>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tmdbId: {
    type: Number,
    required: true,
  },
  event: {
    type: String,
    enum: ['added', 'removed', 'rated', 'watched', 'watchlisted'],
    required: true,
  },
  rating: {
    type: Number,
    min: 1,
    max: 10,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  sessionId: {
    type: String,
  },
});

// Index for future collaborative filtering lookups
UserEventSchema.index({ userId: 1, tmdbId: 1 });

const UserEvent = models.UserEvent || model<IUserEvent>('UserEvent', UserEventSchema);

export default UserEvent;

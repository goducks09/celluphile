import { Schema, model, models, Types, type HydratedDocument } from 'mongoose';

export interface IUserWishlist {
  userId: Types.ObjectId;
  tmdbId: number;
  addedAt: Date;
}

export type IUserWishlistDocument = HydratedDocument<IUserWishlist>;

const UserWishlistSchema = new Schema<IUserWishlist>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tmdbId: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now },
});

UserWishlistSchema.index({ userId: 1, tmdbId: 1 }, { unique: true });
UserWishlistSchema.index({ userId: 1, addedAt: -1 });

const UserWishlist = models.UserWishlist || model<IUserWishlist>('UserWishlist', UserWishlistSchema);
export default UserWishlist;

import { Schema, model, models } from 'mongoose';

const NotificationLogSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    sentAt: {
        type: Date,
        default: Date.now,
        expires: 2592000 // 30 days
    },
    tmdbId: {
        type: Number,
    },
    metadata: {
        type: Object,
        default: {}
    }
});

// Sparse unique index for atomic milestone deduplication
NotificationLogSchema.index(
    { userId: 1, type: 1, 'metadata.milestone': 1 },
    { unique: true, sparse: true }
);

// Compound index for efficient cooldown queries
NotificationLogSchema.index({ userId: 1, type: 1, sentAt: -1 });

const NotificationLog = models.NotificationLog || model('NotificationLog', NotificationLogSchema);

export default NotificationLog;

import { Schema, model, models } from 'mongoose';

const UserSchema = new Schema({
  email: {
    type: String,
    unique: [true, 'Email already exists!'],
    required: [true, 'Email is required!'],
  },
  password: {
    type: String,
    required: [true, 'Password is required!'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  mfaSecret: {
    type: String,
  },
  webPushSubscriptions: {
    type: [Object],
    default: []
  },
  notificationPreferences: {
    recommendations: { type: Boolean, default: true },
    trending:        { type: Boolean, default: true },
    milestone:       { type: Boolean, default: true },
    rewatch:         { type: Boolean, default: true },
    backgroundTask:  { type: Boolean, default: true }
  }
});

const User = models.User || model('User', UserSchema);

export default User;

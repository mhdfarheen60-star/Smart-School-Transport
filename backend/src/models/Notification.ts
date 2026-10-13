import { Schema, model } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'info',
  'request',
  'assignment',
  'attendance',
  'complaint',
  'problem',
  'delay',
  'holiday',
  'route_change',
] as const;

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'info' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = model('Notification', notificationSchema);

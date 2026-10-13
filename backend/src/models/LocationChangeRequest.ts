import { Schema, model } from 'mongoose';

const snapshot = new Schema(
  {
    address: { type: String, required: true, trim: true, maxlength: 300 },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    placeId: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * A student's proposal to move their pickup or drop-off point.
 * The live transport request/assignment is only changed when an administrator approves it.
 */
const locationChangeSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    transportRequest: { type: Schema.Types.ObjectId, ref: 'TransportRequest', required: true },
    target: { type: String, enum: ['pickup', 'drop'], required: true },
    previous: { type: snapshot, required: true },
    proposed: {
      type: new Schema(
        {
          address: { type: String, required: true, trim: true, maxlength: 300 },
          latitude: { type: Number, required: true, min: -90, max: 90 },
          longitude: { type: Number, required: true, min: -180, max: 180 },
          placeId: { type: String, trim: true },
        },
        { _id: false }
      ),
      required: true,
    },
    reason: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

locationChangeSchema.index({ student: 1, target: 1, status: 1 });

export const LocationChangeRequest = model('LocationChangeRequest', locationChangeSchema);

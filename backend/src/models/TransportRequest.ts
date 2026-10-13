import { Schema, model } from 'mongoose';

/** Coordinates saved next to the (kept) address string, so legacy requests stay valid. */
export const geoSchema = new Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    placeId: { type: String, trim: true },
  },
  { _id: false }
);

const requestSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    pickupLocation: { type: String, required: true, trim: true, maxlength: 300 },
    dropLocation: { type: String, required: true, trim: true, maxlength: 300 },
    pickupGeo: { type: geoSchema },
    dropGeo: { type: geoSchema },
    // Legacy: no longer collected. Kept so existing records are not altered; the API ignores it.
    preferredStop: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    remarks: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    assignment: { type: Schema.Types.ObjectId, ref: 'TransportAssignment' },
  },
  { timestamps: true }
);

export const TransportRequest = model('TransportRequest', requestSchema);

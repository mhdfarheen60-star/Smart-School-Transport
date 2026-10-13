import { Schema, model } from 'mongoose';

export const PROBLEM_TYPES = ['breakdown', 'traffic_delay', 'accident', 'mechanical_issue', 'other'] as const;

const problemSchema = new Schema(
  {
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: PROBLEM_TYPES, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    delayMinutes: { type: Number, min: 0, max: 600 },
    status: {
      type: String,
      enum: ['reported', 'in_review', 'resolved', 'dismissed'],
      default: 'reported',
      index: true,
    },
    adminNotes: { type: String, trim: true, maxlength: 1000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

export const VehicleProblemReport = model('VehicleProblemReport', problemSchema);

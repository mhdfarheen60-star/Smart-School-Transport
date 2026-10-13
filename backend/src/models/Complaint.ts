import { Schema, model } from 'mongoose';

const complaintSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['student', 'driver'], required: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: {
      type: String,
      enum: ['driver', 'vehicle', 'route', 'timing', 'safety', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'rejected'],
      default: 'open',
      index: true,
    },
    adminResponse: { type: String, trim: true, maxlength: 1000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

export const Complaint = model('Complaint', complaintSchema);

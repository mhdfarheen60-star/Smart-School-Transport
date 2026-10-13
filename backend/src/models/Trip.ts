import { Schema, model } from 'mongoose';

// vehicle/driver/route are copied onto the trip so history survives later reassignments.
const tripSchema = new Schema(
  {
    assignment: { type: Schema.Types.ObjectId, ref: 'TransportAssignment', required: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    route: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

tripSchema.index({ assignment: 1, date: 1 }, { unique: true });

export const Trip = model('Trip', tripSchema);

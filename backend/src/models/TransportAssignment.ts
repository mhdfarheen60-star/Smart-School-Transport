import { Schema, model } from 'mongoose';

const riderSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    stop: { type: String, trim: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * A bus-level assignment: one vehicle + one driver + one route, carrying a list of riders.
 * Ended assignments are kept (status "ended") so historical trips/attendance stay resolvable.
 */
const assignmentSchema = new Schema(
  {
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    route: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
    riders: { type: [riderSchema], default: [] },
    status: { type: String, enum: ['active', 'ended'], default: 'active', index: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
  },
  { timestamps: true }
);

// A vehicle or a driver can only have one ACTIVE assignment at a time.
assignmentSchema.index(
  { vehicle: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
assignmentSchema.index(
  { driver: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
assignmentSchema.index({ 'riders.student': 1, status: 1 });

export const TransportAssignment = model('TransportAssignment', assignmentSchema);

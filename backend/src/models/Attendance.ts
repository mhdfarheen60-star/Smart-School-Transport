import { Schema, model } from 'mongoose';

export const PICKUP_STATUS = ['pending', 'picked_up', 'absent', 'not_available'] as const;
export const DROP_STATUS = ['pending', 'dropped'] as const;

const attendanceSchema = new Schema(
  {
    trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    route: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
    date: { type: String, required: true, index: true },
    stop: { type: String },
    pickupStatus: { type: String, enum: PICKUP_STATUS, default: 'pending' },
    pickupAt: Date,
    dropStatus: { type: String, enum: DROP_STATUS, default: 'pending' },
    dropAt: Date,
    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSchema.index({ trip: 1, student: 1 }, { unique: true });

export const Attendance = model('Attendance', attendanceSchema);

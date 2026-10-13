import { Schema, model } from 'mongoose';

const driverSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true }
);

export const Driver = model('Driver', driverSchema);

import { Schema, model } from 'mongoose';

const stopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sequence: { type: Number, required: true, min: 1 },
    pickupTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    dropTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

const routeSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    stops: {
      type: [stopSchema],
      validate: [(v: unknown[]) => v.length >= 1, 'A route needs at least one stop'],
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true }
);

export const Route = model('Route', routeSchema);

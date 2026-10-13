import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

export const ROLES = ['student', 'driver', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type IUser = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<IUser>;
export const User = model('User', userSchema);

import { Schema, model } from 'mongoose';

const studentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    studentId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    division: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    phone: { type: String, required: true, trim: true },
    parentName: { type: String, trim: true },
    parentPhone: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true }
);

studentSchema.index({ className: 1, division: 1 });
studentSchema.index({ name: 'text' });

export const Student = model('Student', studentSchema);

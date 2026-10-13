import { Schema, model } from 'mongoose';

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: String,
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: String },
    meta: { type: Schema.Types.Mixed },
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = model('AuditLog', auditSchema);

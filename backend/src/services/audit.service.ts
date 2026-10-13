import { Request } from 'express';
import { AuditLog } from '../models';

export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId?: unknown,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await AuditLog.create({
      actor: req.user?.id,
      actorRole: req.user?.role,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      meta,
      ip: req.ip,
    });
  } catch (e) {
    console.error('Audit log failed', e);
  }
}

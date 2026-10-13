import { Request, Response } from 'express';
import { Complaint } from '../models';
import { audit } from '../services/audit.service';
import { notifyAdmins, notifyUsers } from '../services/notification.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const role = req.user!.role === 'driver' ? 'driver' : 'student';
  const c = await Complaint.create({ ...req.body, user: req.user!.id, role });
  await notifyAdmins({
    title: 'New complaint',
    message: `${req.user!.name} (${role}) submitted: ${c.subject}`,
    type: 'complaint',
  });
  ok(res, c, undefined, 201);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = q.category;
  if (req.user!.role !== 'admin') filter.user = req.user!.id;
  else if (q.role) filter.role = q.role;
  const { items, meta } = await paginate(Complaint, filter, q, {
    populate: [{ path: 'user', select: 'name email phone' }],
    sortable: ['status', 'category', 'subject'],
    searchFields: ['subject', 'description'],
  });
  ok(res, items, meta);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const c = await Complaint.findById(req.params.id);
  if (!c) throw new ApiError(404, 'Complaint not found');
  c.status = req.body.status;
  if (req.body.adminResponse !== undefined) c.adminResponse = req.body.adminResponse;
  if (c.status === 'resolved' || c.status === 'rejected') {
    c.resolvedBy = req.user!.id as any;
    c.resolvedAt = new Date();
  }
  await c.save();
  await notifyUsers([c.user], {
    title: 'Complaint update',
    message: `Your complaint "${c.subject}" is now ${c.status.replace('_', ' ')}.${c.adminResponse ? ` Response: ${c.adminResponse}` : ''}`,
    type: 'complaint',
  });
  await audit(req, 'update', 'Complaint', c.id, { status: c.status });
  ok(res, c);
});

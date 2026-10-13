import { Request, Response } from 'express';
import { Notification, User } from '../models';
import { audit } from '../services/audit.service';
import { notifyUsers } from '../services/notification.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = { user: req.user!.id };
  if (q.unread === 'true') filter.read = false;
  const { items, meta } = await paginate(Notification, filter, q, {
    searchFields: ['title', 'message'],
    defaultSort: '-createdAt',
  });
  const unread = await Notification.countDocuments({ user: req.user!.id, read: false });
  ok(res, items, { ...meta, unread });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user!.id },
    { read: true },
    { new: true }
  );
  if (!n) throw new ApiError(404, 'Notification not found');
  ok(res, n);
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const r = await Notification.updateMany({ user: req.user!.id, read: false }, { read: true });
  ok(res, { updated: r.modifiedCount });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const r = await Notification.deleteOne({ _id: req.params.id, user: req.user!.id });
  if (!r.deletedCount) throw new ApiError(404, 'Notification not found');
  ok(res, { deleted: true });
});

/** Admin broadcast: delays, holidays, route changes... */
export const broadcast = asyncHandler(async (req: Request, res: Response) => {
  const { title, message, type, audience, user } = req.body;
  let ids: unknown[] = [];
  if (audience === 'user') {
    if (!user) throw new ApiError(422, 'Select a user');
    ids = [user];
  } else {
    const roleFilter =
      audience === 'students' ? { role: 'student' } : audience === 'drivers' ? { role: 'driver' } : { role: { $in: ['student', 'driver'] } };
    ids = (await User.find({ ...roleFilter, isActive: true }).select('_id')).map((u) => u._id);
  }
  await notifyUsers(ids as any, { title, message, type });
  await audit(req, 'broadcast', 'Notification', undefined, { audience, recipients: ids.length });
  ok(res, { sent: ids.length }, undefined, 201);
});

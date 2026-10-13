import { Types } from 'mongoose';
import { Notification, NOTIFICATION_TYPES, User } from '../models';

type NType = (typeof NOTIFICATION_TYPES)[number];
type Id = string | Types.ObjectId;

export async function notifyUsers(
  userIds: Id[],
  payload: { title: string; message: string; type?: NType }
): Promise<void> {
  const unique = [...new Set(userIds.map(String))];
  if (!unique.length) return;
  await Notification.insertMany(
    unique.map((user) => ({ user, type: 'info', ...payload }))
  );
}

export async function notifyAdmins(payload: { title: string; message: string; type?: NType }) {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await notifyUsers(
    admins.map((a) => a._id),
    payload
  );
}

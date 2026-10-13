import { Request, Response } from 'express';
import { Attendance, Driver, Student, Trip } from '../models';
import { audit } from '../services/audit.service';
import { notifyUsers } from '../services/notification.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

const populate = [
  { path: 'student', select: 'name studentId className division user' },
  { path: 'vehicle', select: 'registrationNumber busNumber' },
  { path: 'driver', select: 'name' },
  { path: 'route', select: 'name' },
];

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.date) filter.date = q.date;
  else if (q.from || q.to) {
    filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  }
  if (q.pickupStatus) filter.pickupStatus = q.pickupStatus;
  if (q.dropStatus) filter.dropStatus = q.dropStatus;
  if (q.vehicle) filter.vehicle = q.vehicle;
  if (q.student) filter.student = q.student;
  if (req.user!.role === 'student') {
    const s = await Student.findOne({ user: req.user!.id });
    if (!s) throw new ApiError(404, 'Student profile not found');
    filter.student = s._id;
  } else if (req.user!.role === 'driver') {
    const d = await Driver.findOne({ user: req.user!.id });
    if (!d) throw new ApiError(404, 'Driver profile not found');
    filter.driver = d._id;
  }
  const { items, meta } = await paginate(Attendance, filter, q, {
    populate,
    sortable: ['date', 'pickupStatus', 'dropStatus'],
    defaultSort: '-date',
  });
  ok(res, items, meta);
});

async function loadForDriver(req: Request) {
  const driver = await Driver.findOne({ user: req.user!.id });
  if (!driver) throw new ApiError(404, 'Driver profile not found');
  const rec = await Attendance.findById(req.params.id);
  if (!rec) throw new ApiError(404, 'Attendance record not found');
  if (String(rec.driver) !== String(driver._id)) throw new ApiError(403, 'Not your trip');
  const trip = await Trip.findById(rec.trip);
  if (!trip || trip.status === 'completed' || trip.status === 'cancelled') {
    throw new ApiError(409, 'This trip is closed; attendance can no longer be changed');
  }
  return { rec, trip };
}

async function notifyStudent(studentId: unknown, title: string, message: string) {
  const s = await Student.findById(studentId).select('user');
  if (s) await notifyUsers([s.user], { title, message, type: 'attendance' });
}

export const markPickup = asyncHandler(async (req: Request, res: Response) => {
  const { rec, trip } = await loadForDriver(req);
  const status = req.body.status as 'picked_up' | 'absent' | 'not_available';
  rec.pickupStatus = status;
  rec.pickupAt = new Date();
  rec.markedBy = req.user!.id as any;
  if (status !== 'picked_up') {
    rec.dropStatus = 'pending';
    rec.dropAt = undefined;
  }
  await rec.save();
  if (trip.status === 'scheduled') {
    trip.status = 'in_progress';
    trip.startedAt = new Date();
    await trip.save();
  }
  const label = { picked_up: 'picked up', absent: 'marked absent', not_available: 'marked not available' }[status];
  await notifyStudent(rec.student, 'Pickup update', `You were ${label} on ${rec.date}.`);
  ok(res, rec);
});

export const markDrop = asyncHandler(async (req: Request, res: Response) => {
  const { rec } = await loadForDriver(req);
  if (rec.pickupStatus !== 'picked_up') {
    throw new ApiError(409, 'Student must be picked up before they can be dropped');
  }
  rec.dropStatus = 'dropped';
  rec.dropAt = new Date();
  rec.markedBy = req.user!.id as any;
  await rec.save();
  await notifyStudent(rec.student, 'Drop-off update', `You were dropped off on ${rec.date}.`);
  ok(res, rec);
});

/** Admin correction of a record. */
export const adminUpdate = asyncHandler(async (req: Request, res: Response) => {
  const rec = await Attendance.findById(req.params.id);
  if (!rec) throw new ApiError(404, 'Attendance record not found');
  const { pickupStatus, dropStatus } = req.body;
  if (pickupStatus) {
    rec.pickupStatus = pickupStatus;
    rec.pickupAt = pickupStatus === 'pending' ? undefined : new Date();
  }
  if (dropStatus) {
    rec.dropStatus = dropStatus;
    rec.dropAt = dropStatus === 'pending' ? undefined : new Date();
  }
  rec.markedBy = req.user!.id as any;
  await rec.save();
  await audit(req, 'update', 'Attendance', rec.id, req.body);
  ok(res, rec);
});

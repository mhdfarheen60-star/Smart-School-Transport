import { Request, Response } from 'express';
import { Attendance, Driver, TransportAssignment, Trip } from '../models';
import { audit } from '../services/audit.service';
import { notifyUsers } from '../services/notification.service';
import { ApiError, asyncHandler, ok, todayStr } from '../utils/http';
import { paginate } from '../utils/paginate';

const tripPopulate = [
  { path: 'vehicle', select: 'registrationNumber busNumber capacity' },
  { path: 'driver', select: 'name phone' },
  { path: 'route', select: 'name stops' },
];

async function currentDriver(req: Request) {
  const d = await Driver.findOne({ user: req.user!.id });
  if (!d) throw new ApiError(404, 'Driver profile not found');
  return d;
}

/** Create (if needed) the trip for an assignment+date and make sure every rider has an attendance row. */
async function ensureTrip(assignmentId: string, date: string) {
  const a = await TransportAssignment.findById(assignmentId);
  if (!a || a.status !== 'active') throw new ApiError(404, 'Active assignment not found');
  const trip = await Trip.findOneAndUpdate(
    { assignment: a._id, date },
    { $setOnInsert: { vehicle: a.vehicle, driver: a.driver, route: a.route, status: 'scheduled' } },
    { upsert: true, new: true }
  );
  const existing = await Attendance.find({ trip: trip._id }).select('student');
  const have = new Set(existing.map((e) => String(e.student)));
  const missing = a.riders.filter((r) => !have.has(String(r.student)));
  if (missing.length) {
    await Attendance.insertMany(
      missing.map((r) => ({
        trip: trip._id,
        student: r.student,
        vehicle: a.vehicle,
        driver: a.driver,
        route: a.route,
        date,
        stop: r.stop,
      })),
      { ordered: false }
    ).catch((e) => {
      if (e?.code !== 11000 && !e?.writeErrors) throw e; // concurrent open; duplicates are fine
    });
  }
  return trip;
}

async function tripWithAttendance(tripId: unknown) {
  const trip = await Trip.findById(tripId).populate(tripPopulate as any).lean();
  if (!trip) throw new ApiError(404, 'Trip not found');
  const attendance = await Attendance.find({ trip: trip._id })
    .populate('student', 'name studentId className division phone parentPhone address')
    .sort('stop')
    .lean();
  return { ...trip, attendance };
}

/** Driver: open today's trip. */
export const openToday = asyncHandler(async (req: Request, res: Response) => {
  const driver = await currentDriver(req);
  const a = await TransportAssignment.findOne({ driver: driver._id, status: 'active' });
  if (!a) throw new ApiError(404, 'You have no active bus assignment');
  const trip = await ensureTrip(a.id, todayStr());
  ok(res, await tripWithAttendance(trip._id));
});

/** Driver: today's trip if it already exists (does not create one). */
export const getToday = asyncHandler(async (req: Request, res: Response) => {
  const driver = await currentDriver(req);
  const a = await TransportAssignment.findOne({ driver: driver._id, status: 'active' });
  if (!a) return ok(res, null);
  const trip = await Trip.findOne({ assignment: a._id, date: todayStr() });
  ok(res, trip ? await tripWithAttendance(trip._id) : null);
});

/** Admin: create a trip for any assignment/date. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const trip = await ensureTrip(req.body.assignment, req.body.date);
  await audit(req, 'create', 'Trip', trip.id);
  ok(res, await tripWithAttendance(trip._id), undefined, 201);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.date) filter.date = q.date;
  else if (q.from || q.to) {
    filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  }
  if (q.vehicle) filter.vehicle = q.vehicle;
  if (req.user!.role === 'driver') filter.driver = (await currentDriver(req))._id;
  const { items, meta } = await paginate(Trip, filter, q, {
    populate: tripPopulate,
    sortable: ['date', 'status'],
    defaultSort: '-date',
  });
  const counts = await Attendance.aggregate([
    { $match: { trip: { $in: items.map((t: any) => t._id) } } },
    {
      $group: {
        _id: '$trip',
        total: { $sum: 1 },
        pickedUp: { $sum: { $cond: [{ $eq: ['$pickupStatus', 'picked_up'] }, 1, 0] } },
        dropped: { $sum: { $cond: [{ $eq: ['$dropStatus', 'dropped'] }, 1, 0] } },
      },
    },
  ]);
  const cm = new Map(counts.map((c) => [String(c._id), c]));
  ok(
    res,
    items.map((t: any) => ({ ...t, summary: cm.get(String(t._id)) || { total: 0, pickedUp: 0, dropped: 0 } })),
    meta
  );
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const t = await tripWithAttendance(req.params.id);
  if (req.user!.role === 'driver') {
    const d = await currentDriver(req);
    if (String((t.driver as any)._id) !== String(d._id)) throw new ApiError(403, 'Not your trip');
  }
  ok(res, t);
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw new ApiError(404, 'Trip not found');
  if (req.user!.role === 'driver') {
    const d = await currentDriver(req);
    if (String(trip.driver) !== String(d._id)) throw new ApiError(403, 'Not your trip');
  }
  const next = req.body.status as 'in_progress' | 'completed' | 'cancelled';
  if (trip.status === 'completed' || trip.status === 'cancelled') {
    throw new ApiError(409, `Trip already ${trip.status}`);
  }
  if (next === 'in_progress') trip.startedAt = new Date();
  if (next === 'completed') trip.completedAt = new Date();
  trip.status = next;
  await trip.save();
  if (next === 'in_progress') {
    const att = await Attendance.find({ trip: trip._id }).populate('student', 'user');
    await notifyUsers(
      att.map((x: any) => x.student?.user).filter(Boolean),
      { title: 'Bus is on the way', message: 'Your school bus has started its trip.', type: 'info' }
    );
  }
  await audit(req, `trip_${next}`, 'Trip', trip.id);
  ok(res, trip);
});

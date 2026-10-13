import { Request, Response } from 'express';
import {
  Attendance,
  AuditLog,
  Complaint,
  Driver,
  Notification,
  Student,
  TransportAssignment,
  TransportRequest,
  Trip,
  Vehicle,
  VehicleProblemReport,
} from '../models';
import { ApiError, asyncHandler, ok, todayStr } from '../utils/http';
import { paginate } from '../utils/paginate';

export const admin = asyncHandler(async (_req: Request, res: Response) => {
  const today = todayStr();
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceStr = todayStr(since);

  const [
    students,
    drivers,
    vehicles,
    availableVehicles,
    pendingRequests,
    openComplaints,
    openProblems,
    todayAgg,
    weekAgg,
    requestAgg,
    assignments,
    todaysTrips,
  ] = await Promise.all([
    Student.countDocuments({ status: 'active' }),
    Driver.countDocuments({ status: 'active' }),
    Vehicle.countDocuments(),
    Vehicle.countDocuments({ status: 'available' }),
    TransportRequest.countDocuments({ status: 'pending' }),
    Complaint.countDocuments({ status: { $in: ['open', 'in_review'] } }),
    VehicleProblemReport.countDocuments({ status: { $in: ['reported', 'in_review'] } }),
    Attendance.aggregate([
      { $match: { date: today } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pickedUp: { $sum: { $cond: [{ $eq: ['$pickupStatus', 'picked_up'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$pickupStatus', 'absent'] }, 1, 0] } },
          notAvailable: { $sum: { $cond: [{ $eq: ['$pickupStatus', 'not_available'] }, 1, 0] } },
          dropped: { $sum: { $cond: [{ $eq: ['$dropStatus', 'dropped'] }, 1, 0] } },
        },
      },
    ]),
    Attendance.aggregate([
      { $match: { date: { $gte: sinceStr, $lte: today } } },
      {
        $group: {
          _id: '$date',
          pickedUp: { $sum: { $cond: [{ $eq: ['$pickupStatus', 'picked_up'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $in: ['$pickupStatus', ['absent', 'not_available']] }, 1, 0] } },
          dropped: { $sum: { $cond: [{ $eq: ['$dropStatus', 'dropped'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    TransportRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    TransportAssignment.find({ status: 'active' }).populate('vehicle', 'busNumber capacity').lean(),
    Trip.countDocuments({ date: today }),
  ]);

  const t = todayAgg[0] || { total: 0, pickedUp: 0, absent: 0, notAvailable: 0, dropped: 0 };
  const week: { date: string; pickedUp: number; absent: number; dropped: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayStr(d);
    const f = weekAgg.find((w) => w._id === key);
    week.push({ date: key, pickedUp: f?.pickedUp || 0, absent: f?.absent || 0, dropped: f?.dropped || 0 });
  }
  ok(res, {
    totals: { students, drivers, vehicles, availableVehicles, pendingRequests, openComplaints, openProblems, todaysTrips },
    todayAttendance: {
      total: t.total,
      pickedUp: t.pickedUp,
      absent: t.absent + t.notAvailable,
      dropped: t.dropped,
      pending: Math.max(0, t.total - t.pickedUp - t.absent - t.notAvailable),
    },
    weekly: week,
    requestStatus: requestAgg.map((r) => ({ status: r._id, count: r.count })),
    utilization: assignments.map((a: any) => ({
      bus: a.vehicle?.busNumber,
      students: a.riders.length,
      capacity: a.vehicle?.capacity || 0,
    })),
  });
});

export const student = asyncHandler(async (req: Request, res: Response) => {
  const s = await Student.findOne({ user: req.user!.id });
  if (!s) throw new ApiError(404, 'Student profile not found');
  const [assignment, pendingRequest, lastRequest, unread, notifications, att, openComplaints] = await Promise.all([
    TransportAssignment.findOne({ status: 'active', 'riders.student': s._id })
      .populate('vehicle', 'busNumber registrationNumber')
      .populate('driver', 'name phone')
      .populate('route', 'name stops')
      .lean(),
    TransportRequest.findOne({ student: s._id, status: 'pending' }).lean(),
    TransportRequest.findOne({ student: s._id }).sort('-createdAt').lean(),
    Notification.countDocuments({ user: req.user!.id, read: false }),
    Notification.find({ user: req.user!.id }).sort('-createdAt').limit(5).lean(),
    Attendance.aggregate([
      { $match: { student: s._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pickedUp: { $sum: { $cond: [{ $eq: ['$pickupStatus', 'picked_up'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $in: ['$pickupStatus', ['absent', 'not_available']] }, 1, 0] } },
          dropped: { $sum: { $cond: [{ $eq: ['$dropStatus', 'dropped'] }, 1, 0] } },
        },
      },
    ]),
    Complaint.countDocuments({ user: req.user!.id, status: { $in: ['open', 'in_review'] } }),
  ]);
  let transport = null;
  if (assignment) {
    const a: any = assignment;
    const rider = a.riders.find((r: any) => String(r.student) === String(s._id));
    const stop = a.route.stops.find((x: any) => x.name === rider?.stop);
    transport = {
      vehicle: a.vehicle,
      driver: a.driver,
      route: a.route.name,
      stop: rider?.stop,
      pickupTime: stop?.pickupTime,
    };
  }
  ok(res, {
    student: s,
    transport,
    pendingRequest,
    lastRequest,
    unreadNotifications: unread,
    notifications,
    openComplaints,
    attendance: att[0] || { total: 0, pickedUp: 0, absent: 0, dropped: 0 },
  });
});

export const driver = asyncHandler(async (req: Request, res: Response) => {
  const d = await Driver.findOne({ user: req.user!.id });
  if (!d) throw new ApiError(404, 'Driver profile not found');
  const today = todayStr();
  const assignment: any = await TransportAssignment.findOne({ status: 'active', driver: d._id })
    .populate('vehicle', 'busNumber registrationNumber capacity status model')
    .populate('route', 'name stops')
    .lean();
  const [trip, unread, openProblems] = await Promise.all([
    assignment ? Trip.findOne({ assignment: assignment._id, date: today }).lean() : null,
    Notification.countDocuments({ user: req.user!.id, read: false }),
    VehicleProblemReport.countDocuments({ driver: d._id, status: { $in: ['reported', 'in_review'] } }),
  ]);
  let progress = { total: 0, pickedUp: 0, absent: 0, dropped: 0 };
  if (trip) {
    const rows = await Attendance.find({ trip: trip._id }).select('pickupStatus dropStatus').lean();
    progress = {
      total: rows.length,
      pickedUp: rows.filter((r) => r.pickupStatus === 'picked_up').length,
      absent: rows.filter((r) => ['absent', 'not_available'].includes(r.pickupStatus)).length,
      dropped: rows.filter((r) => r.dropStatus === 'dropped').length,
    };
  }
  ok(res, {
    driver: d,
    assignment: assignment
      ? {
          _id: assignment._id,
          vehicle: assignment.vehicle,
          route: assignment.route,
          studentCount: assignment.riders.length,
        }
      : null,
    trip,
    progress,
    unreadNotifications: unread,
    openProblems,
    date: today,
  });
});

export const auditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await paginate(AuditLog, {}, req.query as Record<string, unknown>, {
    populate: [{ path: 'actor', select: 'name role' }],
    searchFields: ['action', 'entity'],
    defaultSort: '-createdAt',
  });
  ok(res, items, meta);
});

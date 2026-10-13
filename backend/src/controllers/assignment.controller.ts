import { Request, Response } from 'express';
import { Driver, Route, Student, TransportAssignment, Vehicle } from '../models';
import { audit } from '../services/audit.service';
import { currentLocations } from '../services/location.service';
import { enrollStudent } from '../services/assignment.service';
import { notifyUsers } from '../services/notification.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

const populate = [
  { path: 'vehicle', select: 'registrationNumber busNumber capacity status model' },
  { path: 'driver', select: 'name phone licenseNumber user' },
  { path: 'route', select: 'name stops status' },
  { path: 'riders.student', select: 'name studentId className division phone parentPhone user' },
];

async function validateParts(vehicleId: string, driverId: string, routeId: string, excludeId?: string) {
  const [vehicle, driver, route] = await Promise.all([
    Vehicle.findById(vehicleId),
    Driver.findById(driverId),
    Route.findById(routeId),
  ]);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  if (!driver) throw new ApiError(404, 'Driver not found');
  if (!route) throw new ApiError(404, 'Route not found');
  if (vehicle.status !== 'available') {
    throw new ApiError(409, `Vehicle ${vehicle.registrationNumber} is ${vehicle.status} and cannot be assigned`);
  }
  if (driver.status !== 'active') throw new ApiError(409, 'Driver is inactive');
  if (route.status !== 'active') throw new ApiError(409, 'Route is inactive');
  const ne = excludeId ? { _id: { $ne: excludeId } } : {};
  if (await TransportAssignment.exists({ vehicle: vehicle._id, status: 'active', ...ne })) {
    throw new ApiError(409, 'Vehicle already has an active assignment');
  }
  if (await TransportAssignment.exists({ driver: driver._id, status: 'active', ...ne })) {
    throw new ApiError(409, 'Driver is already assigned to another bus');
  }
  return { vehicle, driver, route };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  const { items, meta } = await paginate(TransportAssignment, filter, q, {
    populate,
    sortable: ['status', 'startDate'],
    defaultSort: '-createdAt',
  });
  ok(res, items, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const a = await TransportAssignment.findById(req.params.id).populate(populate as any).lean();
  if (!a) throw new ApiError(404, 'Assignment not found');
  ok(res, a);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { vehicle, driver, route } = req.body;
  const parts = await validateParts(vehicle, driver, route);
  const a = await TransportAssignment.create({ vehicle, driver, route });
  await notifyUsers([parts.driver.user], {
    title: 'New bus assignment',
    message: `You have been assigned to bus ${parts.vehicle.busNumber} (${parts.vehicle.registrationNumber}) on route "${parts.route.name}".`,
    type: 'assignment',
  });
  await audit(req, 'create', 'TransportAssignment', a.id);
  ok(res, await a.populate(populate as any), undefined, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const a = await TransportAssignment.findById(req.params.id);
  if (!a) throw new ApiError(404, 'Assignment not found');
  if (a.status !== 'active') throw new ApiError(409, 'Ended assignments cannot be modified');
  const vehicleId = req.body.vehicle || String(a.vehicle);
  const driverId = req.body.driver || String(a.driver);
  const routeId = req.body.route || String(a.route);
  const parts = await validateParts(vehicleId, driverId, routeId, a.id);
  if (parts.vehicle.capacity < a.riders.length) {
    throw new ApiError(409, `Vehicle capacity (${parts.vehicle.capacity}) is lower than assigned students (${a.riders.length})`);
  }
  const driverChanged = String(a.driver) !== driverId;
  const routeChanged = String(a.route) !== routeId;
  a.vehicle = parts.vehicle._id;
  a.driver = parts.driver._id;
  a.route = parts.route._id;
  await a.save();
  // Past trips keep their own vehicle/driver/route copies, so history is untouched.
  if (driverChanged) {
    await notifyUsers([parts.driver.user], {
      title: 'New bus assignment',
      message: `You have been assigned to bus ${parts.vehicle.busNumber} on route "${parts.route.name}".`,
      type: 'assignment',
    });
  }
  if (routeChanged || driverChanged) {
    const students = await Student.find({ _id: { $in: a.riders.map((r) => r.student) } }).select('user');
    await notifyUsers(students.map((s) => s.user), {
      title: 'Route / driver updated',
      message: `Your transport details changed. Driver: ${parts.driver.name}, route: ${parts.route.name}.`,
      type: 'route_change',
    });
  }
  await audit(req, 'update', 'TransportAssignment', a.id);
  ok(res, await a.populate(populate as any));
});

export const end = asyncHandler(async (req: Request, res: Response) => {
  const a = await TransportAssignment.findById(req.params.id);
  if (!a) throw new ApiError(404, 'Assignment not found');
  if (a.status === 'ended') throw new ApiError(409, 'Assignment already ended');
  a.status = 'ended';
  a.endDate = new Date();
  await a.save();
  await audit(req, 'end', 'TransportAssignment', a.id);
  ok(res, a);
});

export const addRider = asyncHandler(async (req: Request, res: Response) => {
  const a = await enrollStudent(req.params.id, req.body.student, req.body.stop);
  await audit(req, 'add_rider', 'TransportAssignment', a.id, { student: req.body.student });
  ok(res, await a.populate(populate as any));
});

export const removeRider = asyncHandler(async (req: Request, res: Response) => {
  const a = await TransportAssignment.findById(req.params.id);
  if (!a) throw new ApiError(404, 'Assignment not found');
  const before = a.riders.length;
  a.riders = a.riders.filter((r) => String(r.student) !== req.params.studentId) as any;
  if (a.riders.length === before) throw new ApiError(404, 'Student is not on this bus');
  await a.save();
  const s = await Student.findById(req.params.studentId).select('user');
  if (s) {
    await notifyUsers([s.user], {
      title: 'Transport removed',
      message: 'You have been removed from your bus assignment. Contact the school office for details.',
      type: 'assignment',
    });
  }
  await audit(req, 'remove_rider', 'TransportAssignment', a.id, { student: req.params.studentId });
  ok(res, await a.populate(populate as any));
});

/** Assignment visible to the logged-in student or driver. */
export const mine = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role === 'student') {
    const s = await Student.findOne({ user: req.user!.id });
    if (!s) throw new ApiError(404, 'Student profile not found');
    const a: any = await TransportAssignment.findOne({ status: 'active', 'riders.student': s._id })
      .populate('vehicle', 'registrationNumber busNumber model capacity')
      .populate('driver', 'name phone')
      .populate('route', 'name stops')
      .lean();
    if (!a) return ok(res, null);
    const locations = (await currentLocations([s._id])).get(String(s._id)) || null;
    const rider = a.riders.find((r: any) => String(r.student) === String(s._id));
    const stop = a.route.stops.find((x: any) => x.name === rider?.stop);
    ok(res, {
      _id: a._id,
      vehicle: a.vehicle,
      driver: a.driver,
      route: a.route,
      stop: rider?.stop,
      pickupTime: stop?.pickupTime,
      dropTime: stop?.dropTime,
      locations,
    });
  } else {
    const d = await Driver.findOne({ user: req.user!.id });
    if (!d) throw new ApiError(404, 'Driver profile not found');
    const a = await TransportAssignment.findOne({ status: 'active', driver: d._id })
      .populate('vehicle', 'registrationNumber busNumber model capacity status')
      .populate('route', 'name stops')
      .populate('riders.student', 'name studentId className division phone parentPhone address')
      .lean();
    if (!a) return ok(res, null);
    // Locations come only from this driver's own active assignment — never from other buses.
    const locs = await currentLocations(a.riders.map((r: any) => r.student._id));
    ok(res, {
      ...a,
      riders: a.riders.map((r: any) => ({ ...r, locations: locs.get(String(r.student._id)) || null })),
    });
  }
});

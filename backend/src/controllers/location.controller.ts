import { Request, Response } from 'express';
import { Driver, LocationChangeRequest, Student, TransportAssignment, TransportRequest } from '../models';
import { audit } from '../services/audit.service';
import { currentLocations, serializeRequest } from '../services/location.service';
import { notifyAdmins, notifyUsers } from '../services/notification.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

async function currentStudent(req: Request) {
  const s = await Student.findOne({ user: req.user!.id });
  if (!s) throw new ApiError(404, 'Student profile not found');
  return s;
}

/** Student: the locations on their latest approved request. */
export const mine = asyncHandler(async (req: Request, res: Response) => {
  const s = await currentStudent(req);
  const loc = (await currentLocations([s._id])).get(String(s._id));
  ok(res, loc || null);
});

/** Student: propose a new pickup/drop point. Nothing live changes until an admin approves. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const student = await currentStudent(req);
  const { target, location, reason } = req.body;
  const base = await TransportRequest.findOne({ student: student._id, status: 'approved' }).sort('-createdAt');
  if (!base) {
    throw new ApiError(409, 'You need an approved transport request before you can change a location');
  }
  if (await LocationChangeRequest.exists({ student: student._id, target, status: 'pending' })) {
    throw new ApiError(409, `You already have a pending ${target} location change`);
  }
  const current = serializeRequest(base)[target === 'pickup' ? 'pickup' : 'drop'];
  const unchanged =
    current.latitude !== undefined &&
    current.longitude !== undefined &&
    Math.abs(current.latitude - location.latitude) < 1e-6 &&
    Math.abs(current.longitude - location.longitude) < 1e-6;
  if (unchanged) throw new ApiError(422, 'The selected location is the same as your current one');

  const change = await LocationChangeRequest.create({
    student: student._id,
    transportRequest: base._id,
    target,
    previous: {
      address: current.address,
      latitude: current.latitude,
      longitude: current.longitude,
      placeId: current.placeId,
    },
    proposed: location,
    reason,
  });
  await notifyAdmins({
    title: 'Location change requested',
    message: `${student.name} (${student.studentId}) asked to change their ${target} location.`,
    type: 'request',
  });
  ok(res, change, undefined, 201);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (req.user!.role === 'student') filter.student = (await currentStudent(req))._id;
  const { items, meta } = await paginate(LocationChangeRequest, filter, q, {
    populate: [
      { path: 'student', select: 'name studentId className division' },
      { path: 'reviewedBy', select: 'name' },
    ],
    sortable: ['status', 'createdAt', 'target'],
    defaultSort: '-createdAt',
  });
  ok(res, items, meta);
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const student = await currentStudent(req);
  const c = await LocationChangeRequest.findOne({ _id: req.params.id, student: student._id });
  if (!c) throw new ApiError(404, 'Location change not found');
  if (c.status !== 'pending') throw new ApiError(409, 'Only pending changes can be cancelled');
  c.status = 'cancelled';
  await c.save();
  ok(res, c);
});

/** Admin: approve (applies the change) or reject. */
export const review = asyncHandler(async (req: Request, res: Response) => {
  const c = await LocationChangeRequest.findById(req.params.id);
  if (!c) throw new ApiError(404, 'Location change not found');
  if (c.status !== 'pending') throw new ApiError(409, `Change is already ${c.status}`);
  const { decision, rejectionReason, stop } = req.body;
  const student = await Student.findById(c.student);
  if (!student) throw new ApiError(404, 'Student not found');

  const assignment = await TransportAssignment.findOne({ status: 'active', 'riders.student': student._id });

  if (decision === 'approved') {
    const base = await TransportRequest.findById(c.transportRequest);
    if (!base) throw new ApiError(404, 'Original transport request no longer exists');
    const p = c.proposed;
    const geo = { latitude: p.latitude, longitude: p.longitude, placeId: p.placeId };
    if (c.target === 'pickup') {
      base.pickupLocation = p.address;
      base.pickupGeo = geo as any;
    } else {
      base.dropLocation = p.address;
      base.dropGeo = geo as any;
    }
    await base.save();

    // Keep the bus assignment consistent: the admin may move the student to a different stop.
    if (assignment && stop) {
      const rider = assignment.riders.find((r) => String(r.student) === String(student._id));
      if (rider) {
        rider.stop = stop;
        await assignment.save();
      }
    }
  }

  c.status = decision;
  c.rejectionReason = decision === 'rejected' ? rejectionReason : undefined;
  c.reviewedBy = req.user!.id as any;
  c.reviewedAt = new Date();
  await c.save();

  await notifyUsers([student.user], {
    title: decision === 'approved' ? 'Location change approved' : 'Location change rejected',
    message:
      decision === 'approved'
        ? `Your new ${c.target} location was approved: ${c.proposed.address}`
        : `Your ${c.target} location change was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    type: 'route_change',
  });
  if (decision === 'approved' && assignment) {
    const driver = await Driver.findById(assignment.driver).select('user');
    if (driver) {
      await notifyUsers([driver.user], {
        title: 'Student location updated',
        message: `${student.name} (${student.studentId}) has a new ${c.target} location: ${c.proposed.address}`,
        type: 'route_change',
      });
    }
  }
  await audit(req, `location_${decision}`, 'LocationChangeRequest', c.id, { target: c.target });
  ok(res, c);
});

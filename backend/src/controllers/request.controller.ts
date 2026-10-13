import { Request, Response } from 'express';
import { Student, TransportRequest } from '../models';
import { audit } from '../services/audit.service';
import { enrollStudent } from '../services/assignment.service';
import { serializeRequest } from '../services/location.service';
import { notifyAdmins, notifyUsers } from '../services/notification.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

async function currentStudent(req: Request) {
  const s = await Student.findOne({ user: req.user!.id });
  if (!s) throw new ApiError(404, 'Student profile not found');
  return s;
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const student = await currentStudent(req);
  if (student.status !== 'active') throw new ApiError(403, 'Your student account is inactive');
  if (await TransportRequest.exists({ student: student._id, status: 'pending' })) {
    throw new ApiError(409, 'You already have a pending transport request');
  }
  const { pickupLocation, dropLocation, notes } = req.body;
  const r = await TransportRequest.create({
    student: student._id,
    pickupLocation: pickupLocation.address,
    pickupGeo: { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude, placeId: pickupLocation.placeId },
    dropLocation: dropLocation.address,
    dropGeo: { latitude: dropLocation.latitude, longitude: dropLocation.longitude, placeId: dropLocation.placeId },
    notes,
  });
  await notifyAdmins({
    title: 'New transport request',
    message: `${student.name} (${student.studentId}) requested school transport.`,
    type: 'request',
  });
  ok(res, serializeRequest(r), undefined, 201);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (req.user!.role === 'student') {
    filter.student = (await currentStudent(req))._id;
  }
  const { items, meta } = await paginate(TransportRequest, filter, q, {
    populate: [
      { path: 'student', select: 'name studentId className division address phone' },
      { path: 'reviewedBy', select: 'name' },
    ],
    sortable: ['status', 'createdAt'],
    searchFields: ['pickupLocation', 'dropLocation'],
  });
  ok(res, items.map(serializeRequest), meta);
});

export const review = asyncHandler(async (req: Request, res: Response) => {
  const r = await TransportRequest.findById(req.params.id).populate('student');
  if (!r) throw new ApiError(404, 'Request not found');
  if (r.status !== 'pending') throw new ApiError(409, `Request is already ${r.status}`);
  const { decision, remarks, assignment, stop } = req.body;
  const student: any = r.student;

  if (decision === 'approved' && assignment) {
    // capacity / availability validated here; throws before anything is changed
    await enrollStudent(assignment, student._id, stop || undefined);
    r.assignment = assignment;
  }
  r.status = decision;
  r.remarks = remarks;
  r.reviewedBy = req.user!.id as any;
  r.reviewedAt = new Date();
  await r.save();

  await notifyUsers([student.user], {
    title: decision === 'approved' ? 'Transport request approved' : 'Transport request rejected',
    message:
      decision === 'approved'
        ? `Your transport request was approved.${assignment ? ' A bus has been assigned.' : ' A bus will be assigned shortly.'}${remarks ? ` Note: ${remarks}` : ''}`
        : `Your transport request was rejected.${remarks ? ` Reason: ${remarks}` : ''}`,
    type: 'request',
  });
  await audit(req, decision, 'TransportRequest', r.id);
  ok(res, serializeRequest(r));
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const student = await currentStudent(req);
  const r = await TransportRequest.findOne({ _id: req.params.id, student: student._id });
  if (!r) throw new ApiError(404, 'Request not found');
  if (r.status !== 'pending') throw new ApiError(409, 'Only pending requests can be cancelled');
  r.status = 'cancelled';
  await r.save();
  ok(res, serializeRequest(r));
});

/** A student may correct their own request until an administrator has reviewed it. */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const student = await currentStudent(req);
  const r = await TransportRequest.findOne({ _id: req.params.id, student: student._id });
  if (!r) throw new ApiError(404, 'Request not found');
  if (r.status !== 'pending') {
    throw new ApiError(409, 'Only pending requests can be edited. Use a location change request instead.');
  }
  const { pickupLocation, dropLocation, notes } = req.body;
  if (pickupLocation) {
    r.pickupLocation = pickupLocation.address;
    r.pickupGeo = { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude, placeId: pickupLocation.placeId } as any;
  }
  if (dropLocation) {
    r.dropLocation = dropLocation.address;
    r.dropGeo = { latitude: dropLocation.latitude, longitude: dropLocation.longitude, placeId: dropLocation.placeId } as any;
  }
  if (notes !== undefined) r.notes = notes;
  await r.save();
  ok(res, serializeRequest(r));
});

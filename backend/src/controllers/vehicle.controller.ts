import { Request, Response } from 'express';
import { Trip, TransportAssignment, Vehicle, VehicleProblemReport } from '../models';
import { audit } from '../services/audit.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  const { items, meta } = await paginate(Vehicle, filter, q, {
    sortable: ['registrationNumber', 'busNumber', 'capacity', 'status', 'insuranceExpiry'],
    searchFields: ['registrationNumber', 'busNumber', 'model'],
  });
  const assignments = await TransportAssignment.find({
    status: 'active',
    vehicle: { $in: items.map((v: any) => v._id) },
  })
    .populate('driver', 'name phone')
    .populate('route', 'name')
    .lean();
  const map = new Map(assignments.map((a) => [String(a.vehicle), a]));
  ok(
    res,
    items.map((v: any) => {
      const a = map.get(String(v._id));
      return {
        ...v,
        assignment: a
          ? { _id: a._id, driver: a.driver, route: a.route, students: a.riders.length }
          : null,
      };
    }),
    meta
  );
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const v = await Vehicle.findById(req.params.id).lean();
  if (!v) throw new ApiError(404, 'Vehicle not found');
  ok(res, v);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const v = await Vehicle.create(req.body);
  await audit(req, 'create', 'Vehicle', v.id);
  ok(res, v, undefined, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const v = await Vehicle.findById(req.params.id);
  if (!v) throw new ApiError(404, 'Vehicle not found');
  if (req.body.capacity !== undefined) {
    const a = await TransportAssignment.findOne({ vehicle: v._id, status: 'active' });
    if (a && a.riders.length > req.body.capacity) {
      throw new ApiError(409, `Capacity cannot be lower than the ${a.riders.length} students assigned`);
    }
  }
  v.set(req.body);
  await v.save();
  await audit(req, 'update', 'Vehicle', v.id);
  ok(res, v);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const v = await Vehicle.findById(req.params.id);
  if (!v) throw new ApiError(404, 'Vehicle not found');
  if (await TransportAssignment.exists({ vehicle: v._id, status: 'active' })) {
    throw new ApiError(409, 'Vehicle has an active assignment. End the assignment first.');
  }
  if (
    (await Trip.exists({ vehicle: v._id })) ||
    (await VehicleProblemReport.exists({ vehicle: v._id })) ||
    (await TransportAssignment.exists({ vehicle: v._id }))
  ) {
    throw new ApiError(
      409,
      'Vehicle has trip history and cannot be deleted. Mark it as unavailable instead.'
    );
  }
  await v.deleteOne();
  await audit(req, 'delete', 'Vehicle', v.id);
  ok(res, { deleted: true });
});

import { Request, Response } from 'express';
import { Route, Trip, TransportAssignment } from '../models';
import { audit } from '../services/audit.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

function normaliseStops(stops: any[]) {
  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  const seen = new Set<number>();
  for (const s of sorted) {
    if (seen.has(s.sequence)) throw new ApiError(422, `Duplicate stop sequence ${s.sequence}`);
    seen.add(s.sequence);
  }
  return sorted.map((s) => ({
    name: s.name,
    sequence: s.sequence,
    pickupTime: s.pickupTime || undefined,
    dropTime: s.dropTime || undefined,
  }));
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  const { items, meta } = await paginate(Route, filter, q, {
    sortable: ['name', 'status'],
    searchFields: ['name', 'description', 'stops.name'],
  });
  ok(res, items, meta);
});

/** Unpaginated list of active routes, used by dropdowns. */
export const options = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await Route.find({ status: 'active' }).sort('name').lean());
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const r = await Route.findById(req.params.id).lean();
  if (!r) throw new ApiError(404, 'Route not found');
  ok(res, r);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const r = await Route.create({ ...req.body, stops: normaliseStops(req.body.stops) });
  await audit(req, 'create', 'Route', r.id);
  ok(res, r, undefined, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const r = await Route.findById(req.params.id);
  if (!r) throw new ApiError(404, 'Route not found');
  const body = { ...req.body };
  if (body.stops) body.stops = normaliseStops(body.stops);
  r.set(body);
  await r.save();
  await audit(req, 'update', 'Route', r.id);
  ok(res, r);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const r = await Route.findById(req.params.id);
  if (!r) throw new ApiError(404, 'Route not found');
  if (await TransportAssignment.exists({ route: r._id, status: 'active' })) {
    throw new ApiError(409, 'Route is used by an active assignment');
  }
  if ((await Trip.exists({ route: r._id })) || (await TransportAssignment.exists({ route: r._id }))) {
    throw new ApiError(409, 'Route has trip history and cannot be deleted. Mark it inactive instead.');
  }
  await r.deleteOne();
  await audit(req, 'delete', 'Route', r.id);
  ok(res, { deleted: true });
});

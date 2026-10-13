import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { Driver, Trip, TransportAssignment, User } from '../models';
import { audit } from '../services/audit.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  const { items, meta } = await paginate(Driver, filter, q, {
    populate: [{ path: 'user', select: 'email isActive' }],
    sortable: ['name', 'licenseNumber', 'status'],
    searchFields: ['name', 'licenseNumber', 'phone'],
  });
  const assignments = await TransportAssignment.find({
    status: 'active',
    driver: { $in: items.map((d: any) => d._id) },
  })
    .populate('vehicle', 'registrationNumber busNumber')
    .populate('route', 'name')
    .lean();
  const map = new Map(assignments.map((a) => [String(a.driver), a]));
  ok(
    res,
    items.map((d: any) => {
      const a = map.get(String(d._id));
      return {
        ...d,
        assignment: a
          ? { _id: a._id, vehicle: a.vehicle, route: a.route, students: a.riders.length }
          : null,
      };
    }),
    meta
  );
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const d = await Driver.findById(req.params.id).populate('user', 'email isActive').lean();
  if (!d) throw new ApiError(404, 'Driver not found');
  ok(res, d);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const b = req.body;
  if (await User.exists({ email: b.email })) throw new ApiError(409, 'Email is already registered');
  if (await Driver.exists({ licenseNumber: b.licenseNumber.toUpperCase() })) {
    throw new ApiError(409, 'A driver with this license number already exists');
  }
  const user = await User.create({
    name: b.name,
    email: b.email,
    phone: b.phone,
    role: 'driver',
    password: await bcrypt.hash(b.password, 12),
  });
  try {
    const driver = await Driver.create({
      user: user._id,
      name: b.name,
      licenseNumber: b.licenseNumber,
      phone: b.phone,
      address: b.address,
      status: b.status,
    });
    await audit(req, 'create', 'Driver', driver.id);
    ok(res, driver, undefined, 201);
  } catch (e) {
    await User.findByIdAndDelete(user._id);
    throw e;
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) throw new ApiError(404, 'Driver not found');
  const b = req.body;
  if (b.licenseNumber && b.licenseNumber.toUpperCase() !== driver.licenseNumber) {
    if (await Driver.exists({ licenseNumber: b.licenseNumber.toUpperCase(), _id: { $ne: driver._id } })) {
      throw new ApiError(409, 'A driver with this license number already exists');
    }
  }
  const user = await User.findById(driver.user).select('+password');
  if (user) {
    if (b.email && b.email !== user.email) {
      if (await User.exists({ email: b.email, _id: { $ne: user._id } })) {
        throw new ApiError(409, 'Email is already registered');
      }
      user.email = b.email;
    }
    if (b.name) user.name = b.name;
    if (b.phone) user.phone = b.phone;
    if (b.password) user.password = await bcrypt.hash(b.password, 12);
    if (b.status) user.isActive = b.status === 'active';
    await user.save();
  }
  for (const k of ['name', 'licenseNumber', 'phone', 'address', 'status']) {
    if (b[k] !== undefined) (driver as any)[k] = b[k];
  }
  await driver.save();
  await audit(req, 'update', 'Driver', driver.id);
  ok(res, driver);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) throw new ApiError(404, 'Driver not found');
  if (await TransportAssignment.exists({ driver: driver._id, status: 'active' })) {
    throw new ApiError(409, 'Driver has an active bus assignment. End the assignment first.');
  }
  if (await Trip.exists({ driver: driver._id })) {
    driver.status = 'inactive';
    await driver.save();
    await User.findByIdAndUpdate(driver.user, { isActive: false });
    await audit(req, 'deactivate', 'Driver', driver.id);
    return ok(res, { deleted: false, deactivated: true, message: 'Driver has trip history and was deactivated' });
  }
  await User.findByIdAndDelete(driver.user);
  await driver.deleteOne();
  await audit(req, 'delete', 'Driver', driver.id);
  ok(res, { deleted: true });
});

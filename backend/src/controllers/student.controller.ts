import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import {
  Attendance,
  Student,
  TransportAssignment,
  TransportRequest,
  User,
} from '../models';
import { audit } from '../services/audit.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { paginate } from '../utils/paginate';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (q.className) filter.className = q.className;
  if (q.division) filter.division = q.division.toUpperCase();
  if (q.status) filter.status = q.status;
  const { items, meta } = await paginate(Student, filter, q, {
    populate: [{ path: 'user', select: 'email isActive' }],
    sortable: ['name', 'studentId', 'className', 'division', 'status'],
    searchFields: ['name', 'studentId', 'phone', 'parentPhone', 'className'],
  });
  // attach current transport so the admin can see who is unassigned
  const ids = items.map((s: any) => s._id);
  const assignments = await TransportAssignment.find({ status: 'active', 'riders.student': { $in: ids } })
    .populate('vehicle', 'registrationNumber busNumber')
    .populate('route', 'name')
    .lean();
  const map = new Map<string, any>();
  for (const a of assignments) for (const r of a.riders) map.set(String(r.student), a);
  const data = items.map((s: any) => {
    const a = map.get(String(s._id));
    return { ...s, transport: a ? { vehicle: a.vehicle, route: a.route, assignment: a._id } : null };
  });
  ok(res, data, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const s = await Student.findById(req.params.id).populate('user', 'email isActive').lean();
  if (!s) throw new ApiError(404, 'Student not found');
  ok(res, s);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const b = req.body;
  if (await User.exists({ email: b.email })) throw new ApiError(409, 'Email is already registered');
  if (await Student.exists({ studentId: b.studentId.toUpperCase() })) {
    throw new ApiError(409, 'A student with this Student ID already exists');
  }
  const user = await User.create({
    name: b.name,
    email: b.email,
    phone: b.phone,
    role: 'student',
    password: await bcrypt.hash(b.password, 12),
  });
  try {
    const student = await Student.create({
      user: user._id,
      studentId: b.studentId,
      name: b.name,
      className: b.className,
      division: b.division,
      address: b.address,
      phone: b.phone,
      parentName: b.parentName,
      parentPhone: b.parentPhone,
      status: b.status,
    });
    await audit(req, 'create', 'Student', student.id);
    ok(res, student, undefined, 201);
  } catch (e) {
    await User.findByIdAndDelete(user._id);
    throw e;
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw new ApiError(404, 'Student not found');
  const b = req.body;
  if (b.studentId && b.studentId.toUpperCase() !== student.studentId) {
    if (await Student.exists({ studentId: b.studentId.toUpperCase(), _id: { $ne: student._id } })) {
      throw new ApiError(409, 'A student with this Student ID already exists');
    }
  }
  const user = await User.findById(student.user).select('+password');
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
  for (const k of ['studentId', 'name', 'className', 'division', 'address', 'phone', 'parentName', 'parentPhone', 'status']) {
    if (b[k] !== undefined) (student as any)[k] = b[k];
  }
  await student.save();
  await audit(req, 'update', 'Student', student.id);
  ok(res, student);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw new ApiError(404, 'Student not found');
  await TransportAssignment.updateMany(
    { status: 'active', 'riders.student': student._id },
    { $pull: { riders: { student: student._id } } }
  );
  const hasHistory =
    (await Attendance.exists({ student: student._id })) ||
    (await TransportRequest.exists({ student: student._id }));
  if (hasHistory) {
    // Keep historical trip/attendance/request data intact: deactivate instead of deleting.
    student.status = 'inactive';
    await student.save();
    await User.findByIdAndUpdate(student.user, { isActive: false });
    await audit(req, 'deactivate', 'Student', student.id);
    return ok(res, { deleted: false, deactivated: true, message: 'Student has history and was deactivated' });
  }
  await User.findByIdAndDelete(student.user);
  await student.deleteOne();
  await audit(req, 'delete', 'Student', student.id);
  ok(res, { deleted: true });
});

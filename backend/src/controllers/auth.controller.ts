import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { signToken } from '../middleware/auth';
import { Driver, Student, User } from '../models';
import { audit } from '../services/audit.service';
import { notifyAdmins } from '../services/notification.service';
import { ApiError, asyncHandler, ok } from '../utils/http';

async function profileFor(userId: string, role: string) {
  if (role === 'student') return Student.findOne({ user: userId }).lean();
  if (role === 'driver') return Driver.findOne({ user: userId }).lean();
  return null;
}

export const register = asyncHandler(async (req: Request, res: Response) => {
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
    });
    await notifyAdmins({
      title: 'New student registered',
      message: `${b.name} (${student.studentId}) registered for the transport system.`,
      type: 'info',
    });
    return ok(
      res,
      {
        token: signToken(user.id, 'student'),
        user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
        profile: student.toObject(),
      },
      undefined,
      201
    );
  } catch (e) {
    await User.findByIdAndDelete(user._id); // keep User/Student consistent
    throw e;
  }
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  // Same message for unknown email / wrong password to avoid user enumeration.
  const valid = user && (await bcrypt.compare(password, user.password));
  if (!user || !valid) throw new ApiError(401, 'Invalid email or password');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');
  await audit({ ...req, user: { id: user.id, role: user.role, name: user.name } } as Request, 'login', 'User', user.id);
  ok(res, {
    token: signToken(user.id, user.role),
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    profile: await profileFor(user.id, user.role),
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new ApiError(404, 'User not found');
  ok(res, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    profile: await profileFor(user.id, user.role),
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const b = req.body;
  const user = await User.findById(req.user!.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (b.name) user.name = b.name;
  if (b.phone) user.phone = b.phone;
  await user.save();
  let profile: any = null;
  if (user.role === 'student') {
    const set: Record<string, unknown> = {};
    for (const k of ['name', 'phone', 'address', 'parentName', 'parentPhone']) if (b[k] !== undefined) set[k] = b[k];
    profile = await Student.findOneAndUpdate({ user: user._id }, set, { new: true, runValidators: true });
  } else if (user.role === 'driver') {
    const set: Record<string, unknown> = {};
    for (const k of ['name', 'phone', 'address']) if (b[k] !== undefined) set[k] = b[k];
    profile = await Driver.findOneAndUpdate({ user: user._id }, set, { new: true, runValidators: true });
  }
  ok(res, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    profile,
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await bcrypt.compare(req.body.currentPassword, user.password))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  user.password = await bcrypt.hash(req.body.newPassword, 12);
  await user.save();
  await audit(req, 'change_password', 'User', user.id);
  ok(res, { message: 'Password updated' });
});

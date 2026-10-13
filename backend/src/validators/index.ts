import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const phone = z.string().trim().regex(/^[0-9+\-\s()]{7,15}$/, 'Enter a valid phone number');
const name = z.string().trim().min(2).max(100);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a number');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const email = z.string().trim().toLowerCase().email();

const studentFields = {
  name,
  studentId: z.string().trim().min(2).max(30),
  className: z.string().trim().min(1).max(20),
  division: z.string().trim().min(1).max(5),
  address: z.string().trim().min(5).max(300),
  phone,
  parentName: z.string().trim().max(100).optional(),
  parentPhone: phone,
};

export const registerSchema = z.object({ ...studentFields, email, password });
export const loginSchema = z.object({ email, password: z.string().min(1) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});
export const profileSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  address: z.string().trim().min(5).max(300).optional(),
  parentName: z.string().trim().max(100).optional(),
  parentPhone: phone.optional(),
});

export const studentCreateSchema = z.object({
  ...studentFields,
  email,
  password,
  status: z.enum(['active', 'inactive']).optional(),
});
export const studentUpdateSchema = z.object({
  ...studentFields,
  email,
  password: password.optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional(),
}).partial();

export const driverCreateSchema = z.object({
  name,
  email,
  password,
  phone,
  licenseNumber: z.string().trim().min(4).max(30),
  address: z.string().trim().max(300).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export const driverUpdateSchema = driverCreateSchema
  .omit({ password: true })
  .extend({ password: password.optional().or(z.literal('')) })
  .partial();

export const vehicleSchema = z.object({
  registrationNumber: z.string().trim().min(4).max(20),
  busNumber: z.string().trim().min(1).max(20),
  model: z.string().trim().max(50).optional(),
  capacity: z.coerce.number().int().min(1).max(200),
  insuranceNumber: z.string().trim().max(50).optional(),
  insuranceExpiry: z.coerce.date().optional(),
  status: z.enum(['available', 'unavailable', 'maintenance']).optional(),
});
export const vehicleUpdateSchema = vehicleSchema.partial();

export const routeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  stops: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        sequence: z.coerce.number().int().min(1),
        pickupTime: time.optional().or(z.literal('')),
        dropTime: time.optional().or(z.literal('')),
      })
    )
    .min(1, 'Add at least one stop'),
  status: z.enum(['active', 'inactive']).optional(),
});
export const routeUpdateSchema = routeSchema.partial();

/** A map-selected place: readable address + validated coordinates. */
export const geoPointSchema = z.object({
  address: z.string().trim().min(3, 'Address is required').max(300),
  latitude: z.coerce.number().finite().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce.number().finite().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  placeId: z.string().trim().max(300).optional(),
});

export const requestCreateSchema = z.object({
  pickupLocation: geoPointSchema,
  dropLocation: geoPointSchema,
  notes: z.string().trim().max(500).optional(),
});
export const requestUpdateSchema = requestCreateSchema.partial();

export const locationChangeCreateSchema = z.object({
  target: z.enum(['pickup', 'drop']),
  location: geoPointSchema,
  reason: z.string().trim().max(500).optional(),
});
export const locationChangeReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().max(500).optional(),
  stop: z.string().trim().max(100).optional(),
});
export const requestReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  remarks: z.string().trim().max(500).optional(),
  assignment: objectId.optional(),
  stop: z.string().trim().max(100).optional(),
});

export const assignmentCreateSchema = z.object({
  vehicle: objectId,
  driver: objectId,
  route: objectId,
});
export const assignmentUpdateSchema = assignmentCreateSchema.partial();
export const riderSchema = z.object({ student: objectId, stop: z.string().trim().max(100).optional() });

export const tripCreateSchema = z.object({
  assignment: objectId,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const tripStatusSchema = z.object({ status: z.enum(['in_progress', 'completed', 'cancelled']) });

export const pickupSchema = z.object({ status: z.enum(['picked_up', 'absent', 'not_available']) });
export const dropSchema = z.object({ status: z.literal('dropped') });
export const attendanceAdminSchema = z.object({
  pickupStatus: z.enum(['pending', 'picked_up', 'absent', 'not_available']).optional(),
  dropStatus: z.enum(['pending', 'dropped']).optional(),
});

export const notificationCreateSchema = z.object({
  title: z.string().trim().min(2).max(150),
  message: z.string().trim().min(2).max(1000),
  type: z.enum(['info', 'delay', 'holiday', 'route_change']).default('info'),
  audience: z.enum(['all', 'students', 'drivers', 'user']).default('all'),
  user: objectId.optional(),
});

export const complaintCreateSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(2000),
  category: z.enum(['driver', 'vehicle', 'route', 'timing', 'safety', 'other']).default('other'),
});
export const complaintUpdateSchema = z.object({
  status: z.enum(['open', 'in_review', 'resolved', 'rejected']),
  adminResponse: z.string().trim().max(1000).optional(),
});

export const problemCreateSchema = z.object({
  type: z.enum(['breakdown', 'traffic_delay', 'accident', 'mechanical_issue', 'other']),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  description: z.string().trim().min(5).max(1000),
  delayMinutes: z.coerce.number().int().min(0).max(600).optional(),
});
export const problemUpdateSchema = z.object({
  status: z.enum(['reported', 'in_review', 'resolved', 'dismissed']),
  adminNotes: z.string().trim().max(1000).optional(),
  vehicleAction: z.enum(['none', 'mark_unavailable', 'mark_available']).default('none'),
});

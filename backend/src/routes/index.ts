import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as V from '../validators';
import * as auth from '../controllers/auth.controller';
import * as student from '../controllers/student.controller';
import * as driver from '../controllers/driver.controller';
import * as vehicle from '../controllers/vehicle.controller';
import * as route from '../controllers/route.controller';
import * as request from '../controllers/request.controller';
import * as assignment from '../controllers/assignment.controller';
import * as trip from '../controllers/trip.controller';
import * as attendance from '../controllers/attendance.controller';
import * as notification from '../controllers/notification.controller';
import * as complaint from '../controllers/complaint.controller';
import * as problem from '../controllers/problem.controller';
import * as report from '../controllers/report.controller';
import * as dashboard from '../controllers/dashboard.controller';
import * as location from '../controllers/location.controller';

const api = Router();
const admin = authorize('admin');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

// ---- auth
const authR = Router();
authR.post('/register', authLimiter, validate(V.registerSchema), auth.register);
authR.post('/login', authLimiter, validate(V.loginSchema), auth.login);
authR.get('/me', authenticate, auth.me);
authR.patch('/profile', authenticate, validate(V.profileSchema), auth.updateProfile);
authR.post('/change-password', authenticate, validate(V.changePasswordSchema), auth.changePassword);
api.use('/auth', authR);

// everything below needs a session
api.use(authenticate);

const students = Router();
students.use(admin);
students.get('/', student.list);
students.post('/', validate(V.studentCreateSchema), student.create);
students.get('/:id', student.getOne);
students.patch('/:id', validate(V.studentUpdateSchema), student.update);
students.delete('/:id', student.remove);
api.use('/students', students);

const drivers = Router();
drivers.use(admin);
drivers.get('/', driver.list);
drivers.post('/', validate(V.driverCreateSchema), driver.create);
drivers.get('/:id', driver.getOne);
drivers.patch('/:id', validate(V.driverUpdateSchema), driver.update);
drivers.delete('/:id', driver.remove);
api.use('/drivers', drivers);

const vehicles = Router();
vehicles.use(admin);
vehicles.get('/', vehicle.list);
vehicles.post('/', validate(V.vehicleSchema), vehicle.create);
vehicles.get('/:id', vehicle.getOne);
vehicles.patch('/:id', validate(V.vehicleUpdateSchema), vehicle.update);
vehicles.delete('/:id', vehicle.remove);
api.use('/vehicles', vehicles);

const routes = Router();
routes.get('/options', route.options); // any signed-in role (stop pickers)
routes.get('/', admin, route.list);
routes.post('/', admin, validate(V.routeSchema), route.create);
routes.get('/:id', admin, route.getOne);
routes.patch('/:id', admin, validate(V.routeUpdateSchema), route.update);
routes.delete('/:id', admin, route.remove);
api.use('/routes', routes);

const requests = Router();
requests.post('/', authorize('student'), validate(V.requestCreateSchema), request.create);
requests.get('/', authorize('student', 'admin'), request.list);
requests.patch('/:id/review', admin, validate(V.requestReviewSchema), request.review);
requests.patch('/:id', authorize('student'), validate(V.requestUpdateSchema), request.update);
requests.patch('/:id/cancel', authorize('student'), request.cancel);
api.use('/transport-requests', requests);

const locationChanges = Router();
locationChanges.get('/current', authorize('student'), location.mine);
locationChanges.post('/', authorize('student'), validate(V.locationChangeCreateSchema), location.create);
locationChanges.get('/', authorize('student', 'admin'), location.list);
locationChanges.patch('/:id/cancel', authorize('student'), location.cancel);
locationChanges.patch('/:id/review', admin, validate(V.locationChangeReviewSchema), location.review);
api.use('/location-changes', locationChanges);

const assignments = Router();
assignments.get('/mine', authorize('student', 'driver'), assignment.mine);
assignments.get('/', admin, assignment.list);
assignments.post('/', admin, validate(V.assignmentCreateSchema), assignment.create);
assignments.get('/:id', admin, assignment.getOne);
assignments.patch('/:id', admin, validate(V.assignmentUpdateSchema), assignment.update);
assignments.post('/:id/end', admin, assignment.end);
assignments.post('/:id/riders', admin, validate(V.riderSchema), assignment.addRider);
assignments.delete('/:id/riders/:studentId', admin, assignment.removeRider);
api.use('/assignments', assignments);

const trips = Router();
trips.post('/today', authorize('driver'), trip.openToday);
trips.get('/today', authorize('driver'), trip.getToday);
trips.get('/', authorize('admin', 'driver'), trip.list);
trips.post('/', admin, validate(V.tripCreateSchema), trip.create);
trips.get('/:id', authorize('admin', 'driver'), trip.getOne);
trips.patch('/:id/status', authorize('admin', 'driver'), validate(V.tripStatusSchema), trip.setStatus);
api.use('/trips', trips);

const att = Router();
att.get('/', attendance.list); // scoped by role inside controller
att.patch('/:id/pickup', authorize('driver'), validate(V.pickupSchema), attendance.markPickup);
att.patch('/:id/drop', authorize('driver'), validate(V.dropSchema), attendance.markDrop);
att.patch('/:id', admin, validate(V.attendanceAdminSchema), attendance.adminUpdate);
api.use('/attendance', att);

const notifications = Router();
notifications.get('/', notification.list);
notifications.patch('/read-all', notification.markAllRead);
notifications.post('/', admin, validate(V.notificationCreateSchema), notification.broadcast);
notifications.patch('/:id/read', notification.markRead);
notifications.delete('/:id', notification.remove);
api.use('/notifications', notifications);

const complaints = Router();
complaints.post('/', authorize('student', 'driver'), validate(V.complaintCreateSchema), complaint.create);
complaints.get('/', complaint.list);
complaints.patch('/:id', admin, validate(V.complaintUpdateSchema), complaint.update);
api.use('/complaints', complaints);

const problems = Router();
problems.post('/', authorize('driver'), validate(V.problemCreateSchema), problem.create);
problems.get('/', authorize('admin', 'driver'), problem.list);
problems.patch('/:id', admin, validate(V.problemUpdateSchema), problem.update);
api.use('/vehicle-problems', problems);

api.get('/reports', admin, (_req, res) => res.json({ success: true, data: report.types }));
api.get('/reports/:type', admin, report.generate);

const dash = Router();
dash.get('/admin', admin, dashboard.admin);
dash.get('/student', authorize('student'), dashboard.student);
dash.get('/driver', authorize('driver'), dashboard.driver);
dash.get('/audit-logs', admin, dashboard.auditLogs);
api.use('/dashboard', dash);

export default api;

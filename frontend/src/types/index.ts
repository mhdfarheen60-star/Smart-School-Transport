export type Role = 'student' | 'driver' | 'admin';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  unread?: number;
}

export interface Stop {
  name: string;
  sequence: number;
  pickupTime?: string;
  dropTime?: string;
}

export interface StudentProfile {
  _id: string;
  studentId: string;
  name: string;
  className: string;
  division: string;
  address: string;
  phone: string;
  parentName?: string;
  parentPhone: string;
  status: 'active' | 'inactive';
  user?: { email: string; isActive: boolean };
  transport?: { vehicle: { busNumber: string; registrationNumber: string }; route: { name: string } } | null;
}

export interface DriverProfile {
  _id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  address?: string;
  status: 'active' | 'inactive';
  user?: { email: string; isActive: boolean };
  assignment?: { _id: string; vehicle: { busNumber: string; registrationNumber: string }; route: { name: string }; students: number } | null;
}

export interface Vehicle {
  _id: string;
  registrationNumber: string;
  busNumber: string;
  model?: string;
  capacity: number;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  status: 'available' | 'unavailable' | 'maintenance';
  assignment?: { _id: string; driver: { name: string }; route: { name: string }; students: number } | null;
}

export interface RouteDoc {
  _id: string;
  name: string;
  description?: string;
  stops: Stop[];
  status: 'active' | 'inactive';
}

export interface GeoPoint {
  address: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

export interface StudentLocations {
  requestId: string;
  pickup: GeoPoint;
  drop: GeoPoint;
}

export interface Rider {
  student: StudentProfile;
  stop?: string;
  locations?: StudentLocations | null;
}

export interface LocationChange {
  _id: string;
  student?: { _id: string; name: string; studentId: string; className: string; division: string };
  target: 'pickup' | 'drop';
  previous: GeoPoint;
  proposed: GeoPoint;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejectionReason?: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
  createdAt: string;
}

export interface Assignment {
  _id: string;
  vehicle: Vehicle;
  driver: DriverProfile;
  route: RouteDoc;
  riders: Rider[];
  status: 'active' | 'ended';
  startDate: string;
  endDate?: string;
}

export interface TransportRequest {
  _id: string;
  student: StudentProfile;
  pickupLocation: string;
  dropLocation: string;
  pickup: GeoPoint;
  drop: GeoPoint;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  remarks?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  _id: string;
  date: string;
  stop?: string;
  student: StudentProfile;
  vehicle?: { busNumber: string; registrationNumber: string };
  driver?: { name: string };
  route?: { name: string };
  pickupStatus: 'pending' | 'picked_up' | 'absent' | 'not_available';
  pickupAt?: string;
  dropStatus: 'pending' | 'dropped';
  dropAt?: string;
}

export interface Trip {
  _id: string;
  date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  vehicle: { busNumber: string; registrationNumber: string };
  driver: { name: string; phone?: string };
  route: { name: string; stops: Stop[] };
  attendance?: AttendanceRecord[];
  summary?: { total: number; pickedUp: number; dropped: number };
  startedAt?: string;
  completedAt?: string;
}

export interface NotificationDoc {
  _id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface Complaint {
  _id: string;
  subject: string;
  description: string;
  category: string;
  role: 'student' | 'driver';
  status: 'open' | 'in_review' | 'resolved' | 'rejected';
  adminResponse?: string;
  user?: { name: string; email: string };
  createdAt: string;
}

export interface Problem {
  _id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  delayMinutes?: number;
  status: 'reported' | 'in_review' | 'resolved' | 'dismissed';
  adminNotes?: string;
  vehicle: { _id: string; busNumber: string; registrationNumber: string; status: string };
  driver: { name: string; phone?: string };
  createdAt: string;
}

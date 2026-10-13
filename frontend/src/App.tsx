import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BackgroundVideo, NoiseFilters } from './components/brand';
import Landing from './pages/Landing';
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute';
import { homeFor, useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import { LoginPage, RegisterPage } from './pages/auth/AuthPages';
import { AdminDashboard, AdminDrivers, AdminRoutes, AdminStudents, AdminVehicles } from './pages/admin/AdminMasterPages';
import {
  AdminAssignments,
  AdminAttendance,
  AdminComplaints,
  AdminProblems,
  AdminReports,
  AdminRequests,
  AdminSettings,
  AdminTrips,
} from './pages/admin/AdminOpsPages';
import { DriverDashboard, DriverProblemsPage, DriverRoutePage, TodayTripPage } from './pages/driver/DriverPages';
import DriverStudentsPage from './pages/driver/DriverStudentsPage';
import NotificationsPage from './pages/shared/NotificationsPage';
import ProfilePage from './pages/shared/ProfilePage';
import {
  ComplaintsPage,
  MyTransportPage,
  StudentAttendancePage,
  StudentDashboard,
  TransportRequestPage,
} from './pages/student/StudentPages';

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={homeFor(user.role)} replace /> : <Landing />;
}

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : '/'} replace />;
}

export default function App() {
  const { pathname } = useLocation();
  // video is fully visible on the landing page and dimmed behind data-heavy screens
  const inApp = ['/student', '/driver', '/admin'].some(
    (p) => (pathname === p || pathname.startsWith(`${p}/`)) && !pathname.endsWith('/login')
  );
  const dim = pathname === '/' ? 0 : inApp ? 0.82 : 0.45;
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0c0c0c] text-white">
      <NoiseFilters />
      <BackgroundVideo dim={dim} />
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage portal="student" />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/driver/login" element={<LoginPage portal="driver" />} />
        <Route path="/admin/login" element={<LoginPage portal="admin" />} />
      </Route>

      <Route element={<ProtectedRoute roles={['student']} />}>
        <Route path="/student" element={<DashboardLayout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="request" element={<TransportRequestPage />} />
          <Route path="transport" element={<MyTransportPage />} />
          <Route path="attendance" element={<StudentAttendancePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="complaints" element={<ComplaintsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['driver']} />}>
        <Route path="/driver" element={<DashboardLayout />}>
          <Route index element={<DriverDashboard />} />
          <Route path="trip" element={<TodayTripPage />} />
          <Route path="students" element={<DriverStudentsPage />} />
          <Route path="route" element={<DriverRoutePage />} />
          <Route path="problems" element={<DriverProblemsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<DashboardLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="drivers" element={<AdminDrivers />} />
          <Route path="vehicles" element={<AdminVehicles />} />
          <Route path="routes" element={<AdminRoutes />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="assignments" element={<AdminAssignments />} />
          <Route path="trips" element={<AdminTrips />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="problems" element={<AdminProblems />} />
          <Route path="notifications" element={<NotificationsPage canBroadcast />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="/" element={<Home />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
    </div>
  );
}

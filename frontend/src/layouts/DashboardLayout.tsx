import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Bus,
  CalendarCheck,
  ClipboardList,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareWarning,
  Route as RouteIcon,
  Settings,
  UserCog,
  UserRound,
  Users,
  Wrench,
  X,
  Send,
  Truck,
  Navigation,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { LogoMark } from '../components/brand';
import type { Role } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/request', label: 'Transport Request', icon: Send },
    { to: '/student/transport', label: 'My Transport', icon: Bus },
    { to: '/student/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/student/notifications', label: 'Notifications', icon: Bell },
    { to: '/student/complaints', label: 'Complaints', icon: MessageSquareWarning },
    { to: '/student/profile', label: 'Profile', icon: UserRound },
  ],
  driver: [
    { to: '/driver', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/driver/trip', label: "Today's Trip", icon: Navigation },
    { to: '/driver/students', label: 'Assigned Students', icon: Users },
    { to: '/driver/route', label: 'Route & Vehicle', icon: MapPinned },
    { to: '/driver/problems', label: 'Report Problem', icon: AlertTriangle },
    { to: '/driver/notifications', label: 'Notifications', icon: Bell },
    { to: '/driver/profile', label: 'Profile', icon: UserRound },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/drivers', label: 'Drivers', icon: UserCog },
    { to: '/admin/vehicles', label: 'Vehicles', icon: Truck },
    { to: '/admin/routes', label: 'Routes', icon: RouteIcon },
    { to: '/admin/requests', label: 'Transport Requests', icon: ClipboardList },
    { to: '/admin/assignments', label: 'Assignments', icon: Bus },
    { to: '/admin/trips', label: 'Trips', icon: Navigation },
    { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/admin/complaints', label: 'Complaints', icon: MessageSquareWarning },
    { to: '/admin/problems', label: 'Vehicle Problems', icon: Wrench },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell },
    { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const reduce = useReducedMotion();
  const items = NAV[user!.role];
  const { meta } = useFetch<unknown[]>('/notifications', { unread: 'true', limit: 1 }, { interval: 30000 });
  const unread = meta?.unread || 0;

  useEffect(() => setOpen(false), [loc.pathname]);

  const sidebar = (
    <div className="flex h-full w-64 flex-col border-r border-white/10 bg-black/50 text-slate-200 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center">
          <LogoMark className="h-7 w-7" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Smart School</div>
          <div className="text-xs text-slate-400">Transport · {user!.role}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
            {label === 'Notifications' && unread > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{unread}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 px-2">
          <div className="truncate text-sm font-medium text-white">{user!.name}</div>
          <div className="truncate text-xs text-slate-400">{user!.email}</div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative z-10 flex h-screen">
      <aside className="hidden lg:block">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'tween', duration: 0.2 }}
            >
              {sidebar}
            </motion.div>
            <button className="flex-1 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md sm:px-6">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">
            Welcome back, <span className="font-medium text-navy-800">{user!.name}</span>
          </div>
          <Link
            to={`/${user!.role}/notifications`}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label={`Notifications (${unread} unread)`}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={loc.pathname}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="mx-auto max-w-7xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

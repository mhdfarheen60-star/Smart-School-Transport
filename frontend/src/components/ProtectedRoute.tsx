import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';
import type { Role } from '../types';

export function FullScreenLoader() {
  return (
    <div className="flex h-full items-center justify-center" aria-busy="true">
      <Loader2 className="h-8 w-8 animate-spin text-navy-600" />
    </div>
  );
}

export function ProtectedRoute({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

/** Login/register pages bounce signed-in users to their own dashboard. */
export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

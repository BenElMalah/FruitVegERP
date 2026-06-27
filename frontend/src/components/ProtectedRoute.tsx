import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ReactNode } from 'react';

export function ProtectedRoute({ roles, children }: { roles?: string[]; children?: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="d-flex justify-content-center mt-5"><div className="spinner-border" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children ? <>{children}</> : <Outlet />;
}

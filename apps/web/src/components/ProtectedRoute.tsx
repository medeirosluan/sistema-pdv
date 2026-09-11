import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

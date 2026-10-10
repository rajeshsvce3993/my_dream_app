import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { hasSession } from '../api/client';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!hasSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

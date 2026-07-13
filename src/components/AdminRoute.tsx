import { Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import type { ReactNode } from "react";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center animate-pulse">Cargando...</div>;
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

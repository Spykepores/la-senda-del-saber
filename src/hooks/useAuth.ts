import { useState, useEffect, useCallback } from "react";

interface User {
  id: number;
  name: string | null;
  email?: string | null;
  avatar?: string | null;
  role: string;
  phone?: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for local auth token
    const token = localStorage.getItem("senda_token");
    const localUser = localStorage.getItem("senda_user");

    if (localUser) {
      try {
        const parsed = JSON.parse(localUser);
        setUser({
          id: parsed.id || 0,
          name: parsed.name || "Usuario",
          email: parsed.email,
          role: parsed.role || "user",
          phone: parsed.phone,
        });
      } catch {
        setUser(null);
      }
    }

    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("senda_token");
    localStorage.removeItem("senda_user");
    setUser(null);
    window.location.href = "/";
  }, []);

  return { user, isLoading, logout };
}

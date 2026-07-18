import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft, LogOut, User } from "lucide-react";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  showLogout?: boolean;
  rightContent?: React.ReactNode;
}

export default function PageHeader({ title, showBack = true, showLogout = true, rightContent }: PageHeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="bg-indigo-900/50 border-b border-white/10 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Back button */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-white/60 hover:text-white transition text-sm p-1 rounded-lg hover:bg-white/5 flex-shrink-0"
              title="Atras"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Atras</span>
            </button>
          )}
        </div>

        {/* Title */}
        <h1 className="font-bold text-sm text-center flex-shrink-0 truncate max-w-[50%]">
          {title}
        </h1>

        {/* Right side: user info + logout */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          {rightContent}
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 hidden sm:flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{user.name}</span>
              </span>
              {showLogout && (
                <button
                  onClick={logout}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition"
                  title="Cerrar Sesion"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

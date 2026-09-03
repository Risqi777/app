import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { CalendarDays, Users, FileText, Settings as SettingsIcon, LogOut, LayoutDashboard, ClipboardList } from "lucide-react";
import { cn } from "../lib/utils";

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.role === "admin";

  const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
    { to: "/schedule", label: "Jadwal Shift", icon: CalendarDays, testId: "nav-schedule" },
    { to: "/requests", label: "Pengajuan", icon: ClipboardList, testId: "nav-requests" },
    ...(isAdmin ? [
      { to: "/personil", label: "Personil", icon: Users, testId: "nav-personil" },
      { to: "/settings", label: "Pengaturan", icon: SettingsIcon, testId: "nav-settings" },
    ] : []),
  ];

  const handleLogout = () => { logout(); nav("/login"); };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden md:flex w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-heading font-bold text-sm text-slate-900 dark:text-slate-50">Shift Scheduler</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Personil 16</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              data-testid={l.testId}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name}</div>
            <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
            <div className="mt-1 inline-flex items-center gap-1">
              <span data-testid="role-switcher-badge" className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                isAdmin ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
              )}>{user?.role}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout} data-testid="logout-button">
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-bold text-sm">Shift Scheduler</span>
        </div>
        <Button size="sm" variant="ghost" onClick={handleLogout} data-testid="logout-button-mobile"><LogOut className="w-4 h-4" /></Button>
      </div>
      <nav className="md:hidden sticky top-14 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-max">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"}
              className={({ isActive }) => cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap",
                isActive ? "bg-sky-600 text-white" : "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800",
              )}>
              <l.icon className="w-3.5 h-3.5" /> {l.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="md:pl-64">
        <div className="max-w-[1400px] mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";
import { Button } from "./ui/button";
import { CalendarDays, Users, Settings as SettingsIcon, LogOut, LayoutDashboard, ClipboardList, BarChart3, Zap } from "lucide-react";
import { cn } from "../lib/utils";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const nav = useNavigate();
  const isAdmin = user?.role === "admin";

  const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
    { to: "/schedule", label: "Jadwal Shift", icon: CalendarDays, testId: "nav-schedule" },
    { to: "/summary", label: "Ringkasan", icon: BarChart3, testId: "nav-summary" },
    { to: "/requests", label: "Pengajuan", icon: ClipboardList, testId: "nav-requests" },
    ...(isAdmin ? [
      { to: "/personil", label: "Personil", icon: Users, testId: "nav-personil" },
      { to: "/settings", label: "Pengaturan", icon: SettingsIcon, testId: "nav-settings" },
    ] : []),
  ];

  const handleLogout = () => { logout(); nav("/login"); };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <aside className="fixed inset-y-0 left-0 hidden md:flex w-64 flex-col z-30 moonblue-panel text-white">
        <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
        <div className="relative h-16 px-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            {branding.logo ? (
              <img src={branding.logo} alt="logo" className="w-9 h-9 rounded-lg object-cover border border-white/10" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center">
                <CalendarDays className="w-4.5 h-4.5 text-cyan-300" />
              </div>
            )}
            <div>
              <div className="font-heading font-bold text-sm text-white leading-tight">{branding.app_name || "Shift Scheduler"}</div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-cyan-300/80">Command Center</div>
            </div>
          </div>
          <NotificationBell darkContext />
        </div>

        <nav className="relative flex-1 p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              data-testid={l.testId}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border border-transparent",
                isActive
                  ? "bg-cyan-400/12 text-cyan-200 border-cyan-400/30 electric-ring"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative p-3 border-t border-white/10 space-y-2">
          <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
            <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
            <div className="mt-1.5 inline-flex items-center gap-1">
              <span data-testid="role-switcher-badge" className={cn(
                "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                isAdmin
                  ? "bg-cyan-400/20 text-cyan-200 border border-cyan-400/30"
                  : "bg-white/10 text-slate-200 border border-white/15",
              )}>{user?.role}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white" onClick={handleLogout} data-testid="logout-button">
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 moonblue-panel text-white border-b border-white/10 flex items-center justify-between px-4 h-14 relative">
        <div className="absolute inset-0 grid-pattern opacity-25 pointer-events-none" />
        <div className="relative flex items-center gap-2">
          {branding.logo ? (
            <img src={branding.logo} alt="logo" className="w-8 h-8 rounded-lg object-cover border border-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-cyan-300" />
            </div>
          )}
          <span className="font-heading font-bold text-sm">{branding.app_name || "Shift Scheduler"}</span>
        </div>
        <div className="relative flex items-center gap-1">
          <NotificationBell darkContext />
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={handleLogout} data-testid="logout-button-mobile"><LogOut className="w-4 h-4" /></Button>
        </div>
      </div>
      <nav className="md:hidden sticky top-14 z-20 bg-white border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-max">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"}
              className={({ isActive }) => cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap",
                isActive ? "electric-btn" : "text-slate-600 bg-slate-100",
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

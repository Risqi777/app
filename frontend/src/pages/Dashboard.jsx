import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";
import { Card } from "../components/ui/card";
import { Users, ClipboardList, CheckCircle2, Sun, Sunset, Moon, Coffee, Zap } from "lucide-react";

const cards = [
  { key: "Pagi", label: "Shift Pagi", icon: Sun, cls: "text-amber-600 bg-amber-50" },
  { key: "Siang", label: "Shift Siang", icon: Sunset, cls: "text-sky-600 bg-sky-50" },
  { key: "Malam", label: "Shift Malam", icon: Moon, cls: "text-indigo-600 bg-indigo-50" },
  { key: "Libur", label: "Libur", icon: Coffee, cls: "text-emerald-600 bg-emerald-50" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { branding } = useBranding();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6" data-testid="dashboard-root">
      {/* Custom banner (editable via Settings) */}
      <div className="relative overflow-hidden rounded-2xl moonblue-panel text-white p-6 md:p-8 electric-ring">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(0,163,255,0.4),transparent_60%)]" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-400/15 border border-cyan-400/30 text-cyan-200 text-[11px] font-bold uppercase tracking-widest mb-3">
              <Zap className="w-3 h-3" /> {today}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {branding.dashboard_banner_title || `Halo, ${user?.name?.split(" ")[0] || "Pengguna"} 👋`}
            </h1>
            <p className="mt-2 text-cyan-100/80 max-w-2xl">{branding.dashboard_banner_message}</p>
          </div>
          {branding.dashboard_banner_image && (
            <img
              src={branding.dashboard_banner_image}
              alt="banner"
              className="w-full md:w-56 h-32 md:h-36 object-cover rounded-xl border border-white/10 electric-ring"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-electric p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total Personil</div>
              <div className="font-heading text-3xl font-bold mt-2 text-slate-900">{stats?.total_personil ?? "—"}</div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="card-electric p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Pengajuan Menunggu</div>
              <div className="font-heading text-3xl font-bold mt-2 text-slate-900">{stats?.pending_requests ?? "—"}</div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="card-electric p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Disetujui</div>
              <div className="font-heading text-3xl font-bold mt-2 text-slate-900">{stats?.approved_requests ?? "—"}</div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="card-electric p-5">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Role Anda</div>
          <div className="font-heading text-2xl font-bold mt-2 uppercase text-slate-900">{user?.role}</div>
          <div className="text-xs text-slate-500 mt-1 font-mono-alt">NIK: {user?.nik}</div>
        </Card>
      </div>

      <Card className="p-6 border-slate-200">
        <h2 className="font-heading text-lg font-bold text-slate-900 mb-1">Distribusi Shift Hari Ini</h2>
        <p className="text-sm text-slate-500 mb-5">Ringkasan jumlah personil per shift untuk tanggal hari ini.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.key} className={`rounded-xl border border-slate-200 p-4 ${c.cls}`}>
              <c.icon className="w-5 h-5 mb-2" />
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{c.label}</div>
              <div className="font-heading text-2xl font-bold mt-1">{stats?.today_counts?.[c.key] ?? 0}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

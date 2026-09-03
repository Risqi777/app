import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Users, ClipboardList, CheckCircle2, Sun, Sunset, Moon, Coffee } from "lucide-react";

const cards = [
  { key: "Pagi", label: "Shift Pagi", icon: Sun, cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  { key: "Siang", label: "Shift Siang", icon: Sunset, cls: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  { key: "Malam", label: "Shift Malam", icon: Moon, cls: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  { key: "Libur", label: "Libur", icon: Coffee, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6" data-testid="dashboard-root">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
          Halo, {user?.name?.split(" ")[0] || "Pengguna"} 👋
        </h1>
        <p className="text-slate-500 mt-1">{today}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total Personil</div>
              <div className="font-heading text-3xl font-bold mt-2">{stats?.total_personil ?? "—"}</div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Pengajuan Menunggu</div>
              <div className="font-heading text-3xl font-bold mt-2">{stats?.pending_requests ?? "—"}</div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Disetujui</div>
              <div className="font-heading text-3xl font-bold mt-2">{stats?.approved_requests ?? "—"}</div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Role Anda</div>
          <div className="font-heading text-2xl font-bold mt-2 uppercase">{user?.role}</div>
          <div className="text-xs text-slate-500 mt-1">NIK: {user?.nik}</div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Distribusi Shift Hari Ini</h2>
        <p className="text-sm text-slate-500 mb-5">Ringkasan jumlah personil per shift untuk tanggal hari ini.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.key} className={`rounded-xl border border-slate-200 dark:border-slate-800 p-4 ${c.cls}`}>
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

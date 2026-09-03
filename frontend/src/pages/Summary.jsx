import { useEffect, useMemo, useState } from "react";
import api, { SHIFT_KEYS, SHIFT_META, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ShiftBadge } from "../components/ShiftBadge";
import { FileSpreadsheet, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export default function Summary() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/schedule/summary", { params: { month, year } });
      setData(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [month, year]);

  const rows = useMemo(() => {
    const list = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q) || r.nik.toLowerCase().includes(q));
  }, [data, search]);

  const totals = useMemo(() => {
    const t = { Pagi: 0, Siang: 0, Malam: 0, Libur: 0, cuti: 0, absen: 0 };
    (data?.rows || []).forEach((r) => {
      t.Pagi += r.counts.Pagi;
      t.Siang += r.counts.Siang;
      t.Malam += r.counts.Malam;
      t.Libur += r.counts.Libur;
      t.cuti += r.total_cuti;
      t.absen += r.total_absen;
    });
    return t;
  }, [data]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  const exportXLSX = () => {
    if (!rows.length) return toast.error("Tidak ada data");
    const header = ["No", "Nama", "NIK", "Jabatan", ...SHIFT_KEYS, "Total Kerja", "Total Libur", "Total Cuti", "Total Absen"];
    const body = rows.map((r, i) => [
      i + 1, r.name, r.nik, r.jabatan || "",
      ...SHIFT_KEYS.map((k) => r.counts[k] || 0),
      r.total_work, r.total_libur, r.total_cuti, r.total_absen,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws["!cols"] = [{ wch: 5 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, ...SHIFT_KEYS.map(() => ({ wch: 10 })), { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ringkasan");
    XLSX.writeFile(wb, `Ringkasan-Personil-${MONTHS[month - 1]}-${year}.xlsx`);
    toast.success("Excel terunduh");
  };

  return (
    <div className="space-y-6" data-testid="summary-root">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Ringkasan Bulanan</h1>
          <p className="text-slate-500 mt-1 text-sm">Analisis beban kerja per personil (jumlah shift & cuti dalam sebulan).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} data-testid="prev-month-btn"><ChevronLeft className="w-4 h-4" /></Button>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={nextMonth} data-testid="next-month-btn"><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={exportXLSX} data-testid="export-xlsx-button"><FileSpreadsheet className="w-4 h-4 mr-2" /> Ekspor Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {["Pagi", "Siang", "Malam", "Libur"].map((k) => (
          <Card key={k} className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{k}</div>
            <div className="font-heading text-2xl font-bold mt-1">{totals[k]}</div>
          </Card>
        ))}
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Total Cuti</div>
          <div className="font-heading text-2xl font-bold mt-1 text-rose-600">{totals.cuti}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Total Absen Lain</div>
          <div className="font-heading text-2xl font-bold mt-1 text-orange-600">{totals.absen}</div>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Cari nama / NIK" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="summary-search" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/60">
              <tr>
                <th className="p-2 text-left sticky left-0 z-10 bg-slate-100 dark:bg-slate-800/60 min-w-[220px]">Personil</th>
                {SHIFT_KEYS.map((k) => (
                  <th key={k} className="p-2 text-center min-w-[70px]"><ShiftBadge shift={k} small /></th>
                ))}
                <th className="p-2 text-center bg-slate-200 dark:bg-slate-700/60">Kerja</th>
                <th className="p-2 text-center bg-emerald-100 dark:bg-emerald-950/40">Libur</th>
                <th className="p-2 text-center bg-rose-100 dark:bg-rose-950/40">Cuti</th>
                <th className="p-2 text-center bg-orange-100 dark:bg-orange-950/40">Absen</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (<tr><td colSpan={SHIFT_KEYS.length + 5} className="p-8 text-center text-slate-500">Tidak ada data.</td></tr>)}
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <td className="sticky left-0 bg-white dark:bg-slate-900 p-2 border-r border-slate-200 dark:border-slate-800">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{r.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono-alt">{r.nik} · {r.jabatan || "—"}</div>
                  </td>
                  {SHIFT_KEYS.map((k) => (
                    <td key={k} className="p-2 text-center font-semibold">{r.counts[k] || 0}</td>
                  ))}
                  <td className="p-2 text-center font-bold bg-slate-50 dark:bg-slate-800/40">{r.total_work}</td>
                  <td className="p-2 text-center font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">{r.total_libur}</td>
                  <td className="p-2 text-center font-bold text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/20">{r.total_cuti}</td>
                  <td className="p-2 text-center font-bold text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-950/20">{r.total_absen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

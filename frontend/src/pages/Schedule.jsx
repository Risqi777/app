import { useEffect, useMemo, useState, useRef } from "react";
import api, { SHIFT_KEYS, SHIFT_META, formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { ShiftBadge } from "../components/ShiftBadge";
import { Wand2, Printer, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAY_INITIALS = ["M","S","S","R","K","J","S"]; // Sun..Sat (id)

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [personil, setPersonil] = useState([]);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pers, sch, set] = await Promise.all([
        api.get("/personil"),
        api.get("/schedule", { params: { month, year } }),
        api.get("/settings"),
      ]);
      setPersonil(pers.data.filter((p) => p.active !== false));
      setEntries(sch.data);
      setSettings(set.data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [month, year]);

  const nDays = daysInMonth(year, month);
  const map = useMemo(() => {
    const m = {};
    entries.forEach((e) => { m[`${e.user_id}|${e.date}`] = e.shift; });
    return m;
  }, [entries]);

  const dateStr = (d) => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const updateCell = async (user_id, d, shift) => {
    const date = dateStr(d);
    try {
      await api.post("/schedule/cell", { user_id, date, shift });
      setEntries((prev) => {
        const key = `${user_id}|${date}`;
        const rest = prev.filter((e) => !(e.user_id === user_id && e.date === date));
        return [...rest, { user_id, date, shift, day: d, month, year }];
      });
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const generate = async () => {
    if (!confirm("Buat ulang jadwal otomatis bulan ini? Data manual akan ditimpa.")) return;
    try {
      setLoading(true);
      const { data } = await api.post("/schedule/generate", { month, year, overwrite: true });
      toast.success(`Jadwal dibuat: ${data.created} sel untuk ${data.users} personil`);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const printSchedule = () => window.print();

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  return (
    <div className="space-y-6" data-testid="schedule-root">
      <div className="flex items-start justify-between flex-wrap gap-4 no-print">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Jadwal Shift</h1>
          <p className="text-slate-500 mt-1 text-sm">Pola 3 hari kerja → 2 libur. Klik sel untuk mengubah (admin).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} data-testid="prev-month-btn"><ChevronLeft className="w-4 h-4" /></Button>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]" data-testid="month-select"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]" data-testid="year-select"><SelectValue /></SelectTrigger>
            <SelectContent>{[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={nextMonth} data-testid="next-month-btn"><ChevronRight className="w-4 h-4" /></Button>
          {isAdmin && (
            <Button className="bg-sky-600 hover:bg-sky-700" onClick={generate} disabled={loading} data-testid="auto-generate-schedule-button">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />} Buat Jadwal Otomatis
            </Button>
          )}
          <Button variant="outline" onClick={printSchedule} data-testid="export-pdf-button"><Printer className="w-4 h-4 mr-2" /> Cetak / PDF</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        {SHIFT_KEYS.map((k) => (<ShiftBadge key={k} shift={k} />))}
      </div>

      <div ref={printRef} className="print-container">
        {/* Print Header */}
        <div className="hidden print:block mb-4">
          <div className="flex items-center gap-4 border-b-2 border-black pb-3">
            {settings?.logo && <img src={settings.logo} alt="logo" className="w-16 h-16 object-contain" />}
            <div className="flex-1 text-center">
              <div className="font-heading text-xl font-extrabold uppercase">{settings?.title}</div>
              <div className="text-sm">{settings?.subtitle}</div>
              <div className="text-sm mt-1">Periode: {MONTHS[month - 1]} {year}</div>
            </div>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/60">
                  <th className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-2 text-left min-w-[200px]">Personil / NIK</th>
                  {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => {
                    const dow = new Date(year, month - 1, d).getDay();
                    const isSun = dow === 0;
                    return (
                      <th key={d} className={`border border-slate-200 dark:border-slate-800 p-1 text-center min-w-[52px] ${isSun ? "text-rose-600" : ""}`}>
                        <div className="text-[10px]">{DAY_INITIALS[dow]}</div>
                        <div className="font-bold text-sm">{d}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {personil.length === 0 && (
                  <tr><td colSpan={nDays + 1} className="p-8 text-center text-slate-500">Belum ada personil. Tambahkan di menu Personil.</td></tr>
                )}
                {personil.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="sticky left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono-alt">{p.nik}</div>
                    </td>
                    {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => {
                      const key = `${p.id}|${dateStr(d)}`;
                      const shift = map[key];
                      const cellContent = shift ? <ShiftBadge shift={shift} small /> : <span className="text-slate-300 text-xs">—</span>;
                      return (
                        <td key={d} className="border border-slate-200 dark:border-slate-800 p-1 text-center align-middle">
                          {isAdmin ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button data-testid={`cell-${p.id}-${d}`} className="w-full schedule-cell rounded-md py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                                  {cellContent}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center">
                                {SHIFT_KEYS.map((s) => (
                                  <DropdownMenuItem key={s} onClick={() => updateCell(p.id, d, s)}>
                                    <ShiftBadge shift={s} small /> <span className="ml-2">{SHIFT_META[s].label}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : cellContent}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Print Footer / Signature */}
        <div className="hidden print:block mt-8">
          <div className="flex justify-end">
            <div className="text-sm text-center">
              <div>{settings?.place || "Jakarta"}, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
              <div className="mt-1 font-semibold">{settings?.signer_jabatan}</div>
              {settings?.signature && <img src={settings.signature} alt="signature" className="w-40 h-24 object-contain mx-auto my-2" />}
              {!settings?.signature && <div className="h-24" />}
              <div className="font-bold underline">{settings?.signer_name}</div>
              {settings?.signer_nik && <div>NIK. {settings.signer_nik}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

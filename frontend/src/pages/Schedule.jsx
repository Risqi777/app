import { useEffect, useMemo, useState } from "react";
import api, { SHIFT_KEYS, SHIFT_META, formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ShiftBadge } from "../components/ShiftBadge";
import { Wand2, FileDown, FileSpreadsheet, ChevronLeft, ChevronRight, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAY_INITIALS = ["M","S","S","R","K","J","S"];

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
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState([]);

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
        const rest = prev.filter((e) => !(e.user_id === user_id && e.date === date));
        return [...rest, { user_id, date, shift, day: d, month, year }];
      });
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const generate = async () => {
    if (!window.confirm("Buat ulang jadwal otomatis bulan ini? Data manual akan ditimpa.")) return;
    try {
      setLoading(true);
      const { data } = await api.post("/schedule/generate", { month, year, overwrite: true });
      toast.success(`Jadwal dibuat: ${data.created} sel untuk ${data.users} personil`);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const openAudit = async () => {
    setAuditOpen(true);
    try {
      const { data } = await api.get("/schedule/audit", { params: { month, year, limit: 300 } });
      setAudit(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  const exportPDF = async () => {
    if (!personil.length) return toast.error("Belum ada personil");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Header
    let headerHeight = 60;
    if (settings?.logo) {
      try { doc.addImage(settings.logo, "PNG", 32, 24, 48, 48); } catch (_) {}
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text((settings?.title || "JADWAL SHIFT KERJA PERSONIL").toUpperCase(), pageW / 2, 40, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(settings?.subtitle || "", pageW / 2, 56, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Periode: ${MONTHS[month - 1]} ${year}`, pageW / 2, 72, { align: "center" });

    // Build table
    const head = [["No", "Nama / NIK", ...Array.from({ length: nDays }, (_, i) => String(i + 1))]];
    const body = personil.map((p, idx) => {
      const row = [String(idx + 1), `${p.name}\n${p.nik}`];
      for (let d = 1; d <= nDays; d++) {
        const s = map[`${p.id}|${dateStr(d)}`];
        row.push(s ? (SHIFT_META[s]?.code || s) : "-");
      }
      return row;
    });

    const shiftHex = {
      "Pagi": [255, 237, 213], "Siang": [224, 242, 254], "Malam": [224, 231, 255],
      "Libur": [220, 252, 231], "Cuti Tahunan": [255, 228, 230], "Cuti Penting": [252, 231, 243],
      "Cuti Besar": [243, 232, 255], "Sakit": [255, 237, 213], "Dinas Luar": [204, 251, 241],
      "Diklat": [207, 250, 254], "Penugasan": [226, 232, 240],
    };

    autoTable(doc, {
      head, body,
      startY: headerHeight + 30,
      styles: { fontSize: 7, cellPadding: 2, halign: "center", valign: "middle", lineColor: [203, 213, 225], lineWidth: 0.3 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 110, halign: "left", fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index >= 2) {
          const p = personil[data.row.index];
          const d = data.column.index - 1;
          const shift = map[`${p.id}|${dateStr(d)}`];
          if (shift && shiftHex[shift]) data.cell.styles.fillColor = shiftHex[shift];
          const dow = new Date(year, month - 1, d).getDay();
          if (dow === 0) data.cell.styles.textColor = [190, 18, 60];
        }
      },
      margin: { left: 24, right: 24 },
    });

    // Footer signature
    const finalY = doc.lastAutoTable.finalY + 24;
    const dateNow = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const sigX = pageW - 220;
    let y = finalY;
    if (y > pageH - 140) { doc.addPage("landscape"); y = 40; }
    doc.setFontSize(10);
    doc.text(`${settings?.place || "Jakarta"}, ${dateNow}`, sigX, y);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.text(settings?.signer_jabatan || "Kepala Unit", sigX, y);
    y += 6;
    if (settings?.signature) {
      try { doc.addImage(settings.signature, "PNG", sigX, y, 140, 60); } catch (_) {}
    }
    y += 68;
    doc.text(settings?.signer_name || "", sigX, y);
    if (settings?.signer_nik) {
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.text(`NIK. ${settings.signer_nik}`, sigX, y);
    }

    doc.save(`Jadwal-Shift-${MONTHS[month - 1]}-${year}.pdf`);
    toast.success("PDF terunduh");
  };

  const exportXLSX = () => {
    if (!personil.length) return toast.error("Belum ada personil");
    const header = ["No", "Nama", "NIK", ...Array.from({ length: nDays }, (_, i) => String(i + 1))];
    const body = personil.map((p, idx) => {
      const row = [idx + 1, p.name, p.nik];
      for (let d = 1; d <= nDays; d++) {
        const s = map[`${p.id}|${dateStr(d)}`];
        row.push(s ? (SHIFT_META[s]?.code || s) : "");
      }
      return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([
      [(settings?.title || "JADWAL SHIFT KERJA PERSONIL")],
      [`Periode: ${MONTHS[month - 1]} ${year}`],
      [],
      header,
      ...body,
    ]);
    ws["!cols"] = [{ wch: 4 }, { wch: 26 }, { wch: 14 }, ...Array.from({ length: nDays }, () => ({ wch: 7 }))];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 + nDays } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 + nDays } },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[month - 1]} ${year}`);
    XLSX.writeFile(wb, `Jadwal-Shift-${MONTHS[month - 1]}-${year}.xlsx`);
    toast.success("Excel terunduh");
  };

  return (
    <div className="space-y-6" data-testid="schedule-root">
      <div className="flex items-start justify-between flex-wrap gap-4">
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
            <>
              <Button className="bg-sky-600 hover:bg-sky-700" onClick={generate} disabled={loading} data-testid="auto-generate-schedule-button">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />} Buat Jadwal Otomatis
              </Button>
              <Button variant="outline" onClick={openAudit} data-testid="open-audit-button"><History className="w-4 h-4 mr-2" /> Riwayat</Button>
            </>
          )}
          <Button variant="outline" onClick={exportPDF} data-testid="export-pdf-button"><FileDown className="w-4 h-4 mr-2" /> Ekspor PDF</Button>
          <Button variant="outline" onClick={exportXLSX} data-testid="export-xlsx-button"><FileSpreadsheet className="w-4 h-4 mr-2" /> Ekspor Excel</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SHIFT_KEYS.map((k) => (<ShiftBadge key={k} shift={k} />))}
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
                    const shift = map[`${p.id}|${dateStr(d)}`];
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

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Riwayat Perubahan Jadwal — {MONTHS[month - 1]} {year}</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Waktu</th>
                  <th className="p-2">Personil</th>
                  <th className="p-2">Tanggal</th>
                  <th className="p-2">Sebelum</th>
                  <th className="p-2">Sesudah</th>
                  <th className="p-2">Oleh</th>
                  <th className="p-2">Sumber</th>
                </tr>
              </thead>
              <tbody>
                {audit.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">Belum ada perubahan.</td></tr>
                )}
                {audit.map((a) => (
                  <tr key={a.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-2 font-mono-alt text-[11px]">{new Date(a.changed_at).toLocaleString("id-ID")}</td>
                    <td className="p-2 font-semibold">{a.user_name}</td>
                    <td className="p-2 font-mono-alt">{a.date}</td>
                    <td className="p-2">{a.shift_before ? <ShiftBadge shift={a.shift_before} small /> : <span className="text-slate-400">—</span>}</td>
                    <td className="p-2"><ShiftBadge shift={a.shift_after} small /></td>
                    <td className="p-2">{a.changed_by_name}</td>
                    <td className="p-2">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {a.source === "manual" ? "Manual" : a.source === "request-approve" ? "Approve" : a.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

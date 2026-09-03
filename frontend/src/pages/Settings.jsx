import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Save, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function Settings() {
  const [s, setS] = useState(null);

  const load = async () => {
    try { const { data } = await api.get("/settings"); setS(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const upload = async (key, file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran maksimal 2MB");
    const b64 = await fileToBase64(file);
    setS((prev) => ({ ...prev, [key]: b64 }));
  };

  const save = async () => {
    try {
      const payload = { ...s };
      delete payload.id;
      await api.patch("/settings", payload);
      toast.success("Pengaturan disimpan");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (!s) return <div className="p-8 text-slate-500">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="settings-root">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-slate-900 dark:text-slate-50">Pengaturan Header & Tanda Tangan</h1>
        <p className="text-slate-500 text-sm mt-1">Kustomisasi judul, logo, dan blok tanda tangan untuk laporan cetak.</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-heading text-lg font-bold">Judul Laporan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Judul</Label><Input value={s.title || ""} onChange={(e) => setS({ ...s, title: e.target.value })} data-testid="settings-title-input" /></div>
          <div><Label>Sub-Judul</Label><Input value={s.subtitle || ""} onChange={(e) => setS({ ...s, subtitle: e.target.value })} data-testid="settings-subtitle-input" /></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h2 className="font-heading text-lg font-bold">Logo Organisasi</h2>
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
              {s.logo ? <img src={s.logo} alt="logo" className="w-full h-full object-contain" /> : <ImageIcon className="w-8 h-8 text-slate-400" />}
            </div>
            <div className="flex-1 space-y-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer text-sm font-medium">
                <Upload className="w-4 h-4" /> Unggah Logo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload("logo", e.target.files?.[0])} data-testid="upload-logo-input" />
              </label>
              {s.logo && <Button variant="outline" size="sm" onClick={() => setS({ ...s, logo: null })}>Hapus</Button>}
              <p className="text-xs text-slate-500">PNG/JPG, maks. 2MB.</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading text-lg font-bold">Tanda Tangan Digital</h2>
          <div className="flex items-center gap-4">
            <div className="w-40 h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
              {s.signature ? <img src={s.signature} alt="ttd" className="w-full h-full object-contain" /> : <ImageIcon className="w-8 h-8 text-slate-400" />}
            </div>
            <div className="flex-1 space-y-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer text-sm font-medium">
                <Upload className="w-4 h-4" /> Unggah Tanda Tangan
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload("signature", e.target.files?.[0])} data-testid="upload-signature-input" />
              </label>
              {s.signature && <Button variant="outline" size="sm" onClick={() => setS({ ...s, signature: null })}>Hapus</Button>}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-heading text-lg font-bold">Aturan Operasional</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Minimum Personil Aktif per Shift</Label>
            <Input type="number" min={1} max={10} value={s.min_active_per_shift ?? 3}
              onChange={(e) => setS({ ...s, min_active_per_shift: Number(e.target.value) })}
              data-testid="min-active-input" />
            <p className="text-xs text-slate-500 mt-1">Pengajuan cuti/sakit/dinas otomatis ditolak bila persetujuan akan menurunkan personil aktif di suatu shift di bawah nilai ini.</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-heading text-lg font-bold">Data Penandatangan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nama Lengkap</Label><Input value={s.signer_name || ""} onChange={(e) => setS({ ...s, signer_name: e.target.value })} data-testid="signer-name-input" /></div>
          <div><Label>Jabatan</Label><Input value={s.signer_jabatan || ""} onChange={(e) => setS({ ...s, signer_jabatan: e.target.value })} /></div>
          <div><Label>NIK / NIP</Label><Input value={s.signer_nik || ""} onChange={(e) => setS({ ...s, signer_nik: e.target.value })} /></div>
          <div><Label>Kota / Tempat</Label><Input value={s.place || ""} onChange={(e) => setS({ ...s, place: e.target.value })} /></div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-sky-600 hover:bg-sky-700" onClick={save} data-testid="save-settings-button"><Save className="w-4 h-4 mr-2" /> Simpan Pengaturan</Button>
      </div>
    </div>
  );
}

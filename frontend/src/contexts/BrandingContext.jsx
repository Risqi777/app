import { createContext, useContext, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API } from "../lib/api";

const BrandingContext = createContext(null);

const FALLBACK = {
  title: "JADWAL SHIFT KERJA PERSONIL",
  subtitle: "Daftar Penugasan Shift & Hak Cuti",
  app_name: "Shift Scheduler",
  hero_title: "Jadwal Shift Kerja untuk 16 Personil, Terstruktur & Profesional.",
  hero_subtitle: "Kelola shift Pagi, Siang, Malam & Libur. Ajukan Cuti, Sakit, Dinas Luar, Diklat hingga Penugasan dalam satu sistem.",
  hero_image: null,
  logo: null,
  dashboard_banner_title: "Selamat datang di Shift Scheduler",
  dashboard_banner_message: "Pantau shift, ajukan pengajuan, dan kelola operasional harian dengan mudah.",
  dashboard_banner_image: null,
};

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(FALLBACK);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/settings/public`);
      setBranding({ ...FALLBACK, ...data });
    } catch (e) {
      console.warn("Public settings fetch failed, using fallback:", e?.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <BrandingContext.Provider value={{ branding, refreshBranding: load }}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => useContext(BrandingContext) || { branding: FALLBACK, refreshBranding: () => {} };

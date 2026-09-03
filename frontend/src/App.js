import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Personnel from "./pages/Personnel";
import Requests from "./pages/Requests";
import Settings from "./pages/Settings";
import Summary from "./pages/Summary";
import { Toaster } from "sonner";

function Guard({ children, adminOnly = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route element={<Guard><Layout /></Guard>}>
              <Route index element={<Dashboard />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/summary" element={<Summary />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/personil" element={<Guard adminOnly><Personnel /></Guard>} />
              <Route path="/settings" element={<Guard adminOnly><Settings /></Guard>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

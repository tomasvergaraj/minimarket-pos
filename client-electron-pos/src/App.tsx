import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import LoginPage from "@/pages/LoginPage";
import RegisterSelectPage from "@/pages/RegisterSelectPage";
import OpenSessionPage from "@/pages/OpenSessionPage";
import POSPage from "@/pages/POSPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
  const user = useAuthStore((s) => s.user);
  const register = useAuthStore((s) => s.register);
  const session = useAuthStore((s) => s.session);

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {!user ? (
          <Route path="*" element={<LoginPage />} />
        ) : !register ? (
          <Route path="*" element={<RegisterSelectPage />} />
        ) : !session ? (
          <Route path="*" element={<OpenSessionPage />} />
        ) : (
          <>
            <Route path="/pos" element={<POSPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </>
        )}
      </Routes>
    </>
  );
}

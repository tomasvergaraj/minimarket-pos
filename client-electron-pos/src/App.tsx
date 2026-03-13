import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import LicenseBlockOverlay from "@/components/LicenseBlockOverlay";
import LoginPage from "@/pages/LoginPage";
import RegisterSelectPage from "@/pages/RegisterSelectPage";
import OpenSessionPage from "@/pages/OpenSessionPage";
import POSPage from "@/pages/POSPage";
import SettingsPage from "@/pages/SettingsPage";
import UpdateBanner from "@/components/UpdateBanner";

export default function App() {
  const user = useAuthStore((s) => s.user);
  const register = useAuthStore((s) => s.register);
  const session = useAuthStore((s) => s.session);

  return (
    <>
      <Toaster position="top-right" />
      <UpdateBanner />
      <LicenseBlockOverlay />
      <Routes>
        {!user ? (
          <Route path="*" element={<LoginPage />} />
        ) : (
          <>
            <Route path="/settings" element={<SettingsPage />} />
            {!register ? (
              <Route path="*" element={<RegisterSelectPage />} />
            ) : !session ? (
              <Route path="*" element={<OpenSessionPage />} />
            ) : (
              <>
                <Route path="/pos" element={<POSPage />} />
                <Route path="*" element={<Navigate to="/pos" replace />} />
              </>
            )}
          </>
        )}
      </Routes>
    </>
  );
}

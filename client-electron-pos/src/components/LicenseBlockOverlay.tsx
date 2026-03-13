import { AlertTriangle, KeyRound, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useLicenseStore } from "@/stores/licenseStore";

export default function LicenseBlockOverlay() {
  const blockingLicense = useLicenseStore((s) => s.blockingLicense);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  if (!blockingLicense || !user || location.pathname === "/settings") {
    return null;
  }

  const helpText =
    user.role === "admin"
      ? "Abre Configuración para revisar el estado de la licencia y pegar un archivo firmado."
      : "Pídele a un administrador que entre a Configuración y active la licencia para este servidor.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white shadow-2xl">
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Operación bloqueada por licencia</p>
              <p className="mt-1 text-sm text-amber-900">{blockingLicense.message}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-6 text-slate-600">{helpText}</p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/settings")}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <KeyRound size={16} />
              Abrir configuración
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getServerUrl, setServerUrl } from "@/services/api";
import { activateLicense, fetchLicenseStatus } from "@/services/license";
import { useAuthStore } from "@/stores/authStore";
import { useLicenseStore } from "@/stores/licenseStore";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Copy,
  KeyRound,
  Maximize,
  Minimize,
  Printer,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";

const PRINTER_KEY = "printer_name";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-CL");
}

function statusTone(status: string, active: boolean): string {
  if (active && status === "licensed") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (active) {
    return "border border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border border-red-200 bg-red-50 text-red-700";
}

export function getSavedPrinterName(): string {
  return localStorage.getItem(PRINTER_KEY) ?? "";
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const register = useAuthStore((s) => s.register);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const licenseStatus = useLicenseStore((s) => s.licenseStatus);
  const blockingLicense = useLicenseStore((s) => s.blockingLicense);
  const syncLicenseStatus = useLicenseStore((s) => s.syncLicenseStatus);

  const [url, setUrl] = useState(getServerUrl());
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(getSavedPrinterName());
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadingLicense, setLoadingLicense] = useState(false);
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [licenseDocument, setLicenseDocument] = useState("");

  const canManageLicense = user?.role === "admin";
  const backTarget = register && session ? "/pos" : "/";
  const detectedPrinterValue = printers.some((printer) => printer.name === selectedPrinter)
    ? selectedPrinter
    : "";

  useEffect(() => {
    window.electronAPI?.isFullscreen?.().then((value) => setIsFullscreen(!!value));
  }, []);

  useEffect(() => {
    if (!canManageLicense) return;

    let ignore = false;
    setLoadingLicense(true);
    fetchLicenseStatus()
      .then((status) => {
        if (!ignore) syncLicenseStatus(status);
      })
      .catch((err) => {
        if (ignore) return;
        toast.error(err instanceof Error ? err.message : "No se pudo cargar la licencia");
      })
      .finally(() => {
        if (!ignore) setLoadingLicense(false);
      });

    return () => {
      ignore = true;
    };
  }, [canManageLicense, syncLicenseStatus]);

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    await window.electronAPI?.setFullscreen?.(next);
    setIsFullscreen(next);
  };

  const loadPrinters = async () => {
    if (!window.electronAPI?.getPrinters) return;

    setLoadingPrinters(true);
    try {
      const list = await window.electronAPI.getPrinters();
      setPrinters(list);

      if (!selectedPrinter) {
        const defaultPrinter = list.find((printer) => printer.isDefault);
        if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
      }
    } catch {
      toast.error("No se pudo obtener la lista de impresoras");
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  const reloadLicenseStatus = async () => {
    if (!canManageLicense) return;

    setLoadingLicense(true);
    try {
      const status = await fetchLicenseStatus();
      syncLicenseStatus(status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la licencia");
    } finally {
      setLoadingLicense(false);
    }
  };

  const handleSave = () => {
    setServerUrl(url);
    localStorage.setItem(PRINTER_KEY, selectedPrinter.trim());
    toast.success("Configuración guardada");
  };

  const handleActivate = async () => {
    if (!licenseDocument.trim()) {
      toast.error("Pega primero el archivo de licencia");
      return;
    }

    setActivatingLicense(true);
    try {
      const status = await activateLicense(licenseDocument);
      syncLicenseStatus(status);
      setLicenseDocument("");
      toast.success("Licencia activada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo activar la licencia");
    } finally {
      setActivatingLicense(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error(`No se pudo copiar ${label.toLowerCase()}`);
    }
  };

  const licenseSummary = useMemo(() => {
    if (!licenseStatus) return "Cargando estado de licencia...";
    if (licenseStatus.status === "trial") {
      return `Prueba activa con ${licenseStatus.trial_days_remaining ?? 0} días restantes`;
    }
    if (licenseStatus.status === "licensed") {
      return licenseStatus.customer_name
        ? `Licencia activa para ${licenseStatus.customer_name}`
        : "Licencia activa";
    }
    return licenseStatus.message;
  }, [licenseStatus]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          onClick={() => navigate(backTarget)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={20} /> Volver
        </button>

        {blockingLicense && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="font-semibold">Operación bloqueada por licencia</p>
                <p className="mt-1 text-sm">{blockingLicense.message}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.35fr]">
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-gray-400" />
                <h2 className="text-xl font-bold text-gray-800">Configuración</h2>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">URL del Servidor</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2"
                    placeholder="http://192.168.1.100:8000"
                  />
                  <p className="mt-1 text-xs text-gray-500">IP del PC servidor en la red local</p>
                </div>

                {window.electronAPI?.getPrinters && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        <Printer size={14} className="mr-1 inline" />
                        Impresora térmica
                      </label>
                      <button
                        onClick={loadPrinters}
                        disabled={loadingPrinters}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <RefreshCw size={12} className={loadingPrinters ? "animate-spin" : ""} />
                        Actualizar
                      </button>
                    </div>

                    {printers.length === 0 && !loadingPrinters ? (
                      <p className="rounded-lg border px-4 py-2 text-sm text-gray-400">
                        No se encontraron impresoras
                      </p>
                    ) : (
                      <select
                        value={detectedPrinterValue}
                        onChange={(e) => setSelectedPrinter(e.target.value)}
                        className="w-full rounded-lg border px-4 py-2 text-sm"
                        disabled={loadingPrinters}
                      >
                        <option value="">-- Sin impresora (desactivado) --</option>
                        {printers.map((printer) => (
                          <option key={printer.name} value={printer.name}>
                            {printer.displayName || printer.name}
                            {printer.description ? ` - ${printer.description}` : ""}
                            {printer.isDefault ? " (predeterminada)" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    <input
                      type="text"
                      value={selectedPrinter}
                      onChange={(e) => setSelectedPrinter(e.target.value)}
                      className="mt-2 w-full rounded-lg border px-4 py-2 text-sm"
                      placeholder="Nombre exacto en Windows (ej: NII W2K203DPI)"
                      autoComplete="off"
                      spellCheck={false}
                    />

                    {selectedPrinter && !detectedPrinterValue && (
                      <p className="mt-1 text-xs text-amber-600">
                        El nombre guardado no aparece en la lista detectada. Se intentará usar exactamente ese nombre al imprimir.
                      </p>
                    )}

                    <p className="mt-1 text-xs text-gray-500">
                      Selecciona la impresora instalada en Windows o escribe su nombre exacto si no aparece.
                    </p>
                  </div>
                )}

                {window.electronAPI?.setFullscreen && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Pantalla completa</p>
                      <p className="text-xs text-gray-500">También puedes usar F11</p>
                    </div>
                    <button
                      onClick={toggleFullscreen}
                      className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                    >
                      {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                      {isFullscreen ? "Salir" : "Activar"}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleSave}
                  className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-gray-400" />
                  <h3 className="text-xl font-bold text-gray-800">Licencia Offline</h3>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Estado comercial del servidor y activación por archivo firmado.
                </p>
              </div>

              {canManageLicense && (
                <button
                  onClick={() => void reloadLicenseStatus()}
                  disabled={loadingLicense}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  <RefreshCw size={14} className={loadingLicense ? "animate-spin" : ""} />
                  Actualizar
                </button>
              )}
            </div>

            {!canManageLicense ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Solo un administrador puede activar licencias</p>
                  <p className="mt-1">
                    {blockingLicense?.message ??
                      "Si el sistema queda bloqueado por licencia, cierra sesión e ingresa con un usuario administrador para activarlo."}
                  </p>
                </div>

                <button
                  onClick={logout}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cambiar de usuario
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className={`rounded-xl px-4 py-3 text-sm ${statusTone(licenseStatus?.status ?? "loading", !!licenseStatus?.is_active)}`}>
                  <p className="font-semibold">{loadingLicense ? "Cargando..." : licenseSummary}</p>
                  {licenseStatus && <p className="mt-1 text-xs opacity-90">{licenseStatus.message}</p>}
                </div>

                {licenseStatus && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                          <KeyRound size={14} />
                          Instalación
                        </div>
                        <p className="mt-2 break-all font-mono text-sm text-gray-800">
                          {licenseStatus.installation_id}
                        </p>
                        <p className="mt-1 break-all text-xs text-gray-500">
                          {licenseStatus.hardware_hash}
                        </p>
                      </div>

                      <div className="rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                          <Clock3 size={14} />
                          Estado comercial
                        </div>
                        <p className="mt-2 text-sm font-medium text-gray-800">
                          {licenseStatus.status === "trial"
                            ? `Prueba hasta ${formatDate(licenseStatus.trial_expires_at)}`
                            : `Licencia ${licenseStatus.license_type ?? "perpetual"}`}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Activada: {formatDate(licenseStatus.activated_at)} | Actualizaciones: {formatDate(licenseStatus.updates_until)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Cajas activas: {licenseStatus.register_count}
                          {licenseStatus.max_registers != null ? ` / ${licenseStatus.max_registers}` : " / sin límite"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800">Solicitud de activación</h4>
                          <p className="text-xs text-gray-500">
                            Copia este payload y envíalo al emisor de licencias.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => void copyText(licenseStatus.request_code, "Código de activación")}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                          >
                            <Copy size={13} />
                            Código
                          </button>
                          <button
                            onClick={() => void copyText(licenseStatus.request_payload_json, "Solicitud de activación")}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                          >
                            <Copy size={13} />
                            JSON
                          </button>
                        </div>
                      </div>

                      <textarea
                        readOnly
                        value={licenseStatus.request_payload_json}
                        rows={8}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 focus:outline-none"
                      />
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                      <h4 className="text-sm font-semibold text-gray-800">Activar licencia</h4>
                      <p className="mt-1 text-xs text-gray-500">
                        Pega aquí el archivo JSON firmado que te entreguen después de la compra.
                      </p>

                      <textarea
                        value={licenseDocument}
                        onChange={(e) => setLicenseDocument(e.target.value)}
                        rows={8}
                        placeholder='{"payload": {...}, "signature": "..."}'
                        className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
                      />

                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          onClick={() => void handleActivate()}
                          disabled={activatingLicense}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ShieldCheck size={16} />
                          {activatingLicense ? "Activando..." : "Activar licencia"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

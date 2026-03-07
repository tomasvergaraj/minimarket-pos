import { useState, useEffect } from "react";
import { Download, RefreshCw, X, AlertTriangle } from "lucide-react";

type UpdateState = "idle" | "downloading" | "ready" | "error";

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Query current state immediately (handles race condition where
    // events fired before this component mounted)
    window.electronAPI.getUpdateState?.().then(({ state: s, progress: p }) => {
      if (s === "downloading") { setState("downloading"); setProgress(p); }
      else if (s === "ready")  { setState("ready"); setProgress(100); }
    });

    // Listen for future events
    window.electronAPI.onUpdateAvailable(() => {
      setState("downloading");
      setDismissed(false);
    });

    window.electronAPI.onDownloadProgress((percent: number) => {
      setState("downloading");
      setProgress(percent);
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setState("ready");
      setProgress(100);
      setDismissed(false);
    });

    window.electronAPI.onUpdateError((msg: string) => {
      setState("error");
      setErrorMsg(msg);
    });
  }, []);

  if (state === "idle" || dismissed) return null;

  if (state === "ready") {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-green-600 text-white px-5 py-3 shadow-lg">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw size={16} />
          Actualización lista — reinicia para aplicarla
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.electronAPI?.installUpdate()}
            className="bg-white text-green-700 font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-green-50 transition"
          >
            Reiniciar ahora
          </button>
          <button onClick={() => setDismissed(true)} className="text-green-200 hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (state === "downloading") {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 bg-blue-600 text-white px-5 py-2.5 shadow-lg">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Download size={15} className="animate-bounce" />
            Descargando actualización{progress > 0 ? ` ${progress}%` : "..."}
          </div>
          <button onClick={() => setDismissed(true)} className="text-blue-300 hover:text-white">
            <X size={15} />
          </button>
        </div>
        <div className="w-full bg-blue-800 rounded-full h-1.5">
          <div
            className="bg-white h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-red-600 text-white px-5 py-3 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle size={15} />
          Error al actualizar: {errorMsg}
        </div>
        <button onClick={() => setDismissed(true)} className="text-red-200 hover:text-white">
          <X size={15} />
        </button>
      </div>
    );
  }

  return null;
}

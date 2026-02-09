import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";
import { getServerUrl, setServerUrl } from "@/services/api";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [serverUrl, setServerUrlLocal] = useState(getServerUrl());
  const loginWithPin = useAuthStore((s) => s.loginWithPin);

  const handleDigit = (d: string) => {
    if (pin.length < 6) setPin(pin + d);
  };

  const handleClear = () => setPin("");

  const handleLogin = async () => {
    if (!pin) return;
    try {
      await loginWithPin(pin);
    } catch {
      toast.error("PIN inválido");
      setPin("");
    }
  };

  const handleSaveServer = () => {
    setServerUrl(serverUrl);
    toast.success("Servidor actualizado");
    setShowConfig(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-96">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">MiniMarket POS</h1>
        <p className="text-center text-gray-500 mb-6">Ingrese su PIN</p>

        <div className="bg-gray-100 rounded-lg p-4 mb-6 text-center">
          <span className="text-3xl tracking-[0.5em] font-mono">
            {"*".repeat(pin.length)}
            <span className="opacity-30">{"_".repeat(4 - pin.length)}</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(String(d))}
              className="bg-gray-100 hover:bg-gray-200 text-xl font-semibold py-4 rounded-lg transition"
            >
              {d}
            </button>
          ))}
          <button onClick={handleClear} className="bg-red-100 hover:bg-red-200 text-red-600 font-semibold py-4 rounded-lg transition">
            C
          </button>
          <button onClick={() => handleDigit("0")} className="bg-gray-100 hover:bg-gray-200 text-xl font-semibold py-4 rounded-lg transition">
            0
          </button>
          <button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg transition">
            OK
          </button>
        </div>

        <button onClick={() => setShowConfig(!showConfig)} className="text-sm text-gray-400 hover:text-gray-600 w-full text-center">
          Configurar servidor
        </button>

        {showConfig && (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrlLocal(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="http://192.168.1.100:8000"
            />
            <button onClick={handleSaveServer} className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm">
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

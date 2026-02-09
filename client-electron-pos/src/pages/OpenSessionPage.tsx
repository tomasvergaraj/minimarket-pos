import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { formatCLP } from "@/utils/format";
import toast from "react-hot-toast";
import api from "@/services/api";

export default function OpenSessionPage() {
  const { register, openSession, logout, setSession } = useAuthStore();
  const [amount, setAmount] = useState("");

  useEffect(() => {
    // Check if register already has an active session
    api.get("/cash/sessions/active").then(({ data }) => {
      const existing = data.find((s: any) => s.register_id === register?.id);
      if (existing) {
        setSession(existing);
      }
    });
  }, [register, setSession]);

  const handleOpen = async () => {
    const val = parseInt(amount) || 0;
    try {
      await openSession(val);
      toast.success("Sesión abierta");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al abrir sesión");
    }
  };

  const presets = [0, 10000, 20000, 50000];

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-[450px]">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Apertura de Caja</h2>
        <p className="text-sm text-gray-500 mb-6">{register?.name}</p>

        <label className="block text-sm font-medium text-gray-700 mb-2">Monto inicial en caja</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-xl text-center font-mono focus:border-blue-500 focus:outline-none mb-4"
          placeholder="$0"
          autoFocus
        />

        <div className="grid grid-cols-4 gap-2 mb-6">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className="bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-sm font-medium"
            >
              {formatCLP(p)}
            </button>
          ))}
        </div>

        <button onClick={handleOpen} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-lg transition">
          Abrir Caja
        </button>

        <button onClick={logout} className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

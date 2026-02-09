import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Monitor, LogOut } from "lucide-react";

export default function RegisterSelectPage() {
  const { registers, fetchRegisters, selectRegister, user, logout } = useAuthStore();

  useEffect(() => {
    fetchRegisters();
  }, [fetchRegisters]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-[500px]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Seleccionar Caja</h2>
            <p className="text-sm text-gray-500">Bienvenido, {user?.full_name}</p>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-red-500">
            <LogOut size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {registers.map((reg) => (
            <button
              key={reg.id}
              onClick={() => selectRegister(reg)}
              className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-blue-50 border-2 border-transparent hover:border-blue-500 rounded-xl transition"
            >
              <Monitor className="text-blue-600" size={32} />
              <div className="text-left">
                <p className="font-semibold text-gray-800">{reg.name}</p>
                <p className="text-sm text-gray-500">Disponible</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getServerUrl, setServerUrl } from "@/services/api";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const [url, setUrl] = useState(getServerUrl());
  const navigate = useNavigate();

  const handleSave = () => {
    setServerUrl(url);
    toast.success("Configuración guardada");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate("/pos")} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6">
          <ArrowLeft size={20} /> Volver al POS
        </button>

        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          <h2 className="text-xl font-bold text-gray-800">Configuración</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL del Servidor</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border rounded-lg px-4 py-2"
              placeholder="http://192.168.1.100:8000"
            />
            <p className="text-xs text-gray-500 mt-1">IP del PC servidor en la red local</p>
          </div>

          <button onClick={handleSave} className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

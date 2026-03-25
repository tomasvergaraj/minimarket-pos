import { useEffect, useState, useCallback } from "react";
import { X, Users, Clock, RefreshCw } from "lucide-react";
import api from "@/services/api";
import type { TableStatus } from "@/types";
import { formatCLP } from "@/utils/format";

interface Props {
  onSelect: (table: TableStatus) => void;
  onClose: () => void;
}

const STATUS_CONFIG = {
  free: {
    bg: "bg-green-50 border-green-300 hover:bg-green-100 cursor-pointer",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-500",
    label: "Libre",
    selectable: true,
  },
  occupied: {
    bg: "bg-orange-50 border-orange-300 hover:bg-orange-100 cursor-pointer",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
    label: "Ocupada",
    selectable: true,
  },
  bill_requested: {
    bg: "bg-yellow-50 border-yellow-400 hover:bg-yellow-100 cursor-pointer",
    badge: "bg-yellow-100 text-yellow-800",
    dot: "bg-yellow-500 animate-pulse",
    label: "Cuenta pedida",
    selectable: true,
  },
};

function timeElapsed(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
}

export default function TableMapModal({ onSelect, onClose }: Props) {
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/tables/status");
      setTables(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const maxX = Math.max(...tables.map((t) => t.pos_x), 2);
  const maxY = Math.max(...tables.map((t) => t.pos_y), 1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Seleccionar mesa</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 px-5 py-2.5 border-b border-gray-50 text-[11px]">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${v.dot.replace(" animate-pulse", "")}`} />
              <span className="text-gray-500">{v.label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(120px, 1fr))" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No hay mesas configuradas. Ve al panel admin → Mesas para agregarlas.
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.min(maxX + 1, 6)}, minmax(120px, 160px))`,
                gridTemplateRows: `repeat(${maxY + 1}, auto)`,
              }}
            >
              {tables.map((table) => {
                const cfg = STATUS_CONFIG[table.status];
                return (
                  <button
                    key={table.id}
                    onClick={() => onSelect(table)}
                    style={{ gridColumn: table.pos_x + 1, gridRow: table.pos_y + 1 }}
                    className={`relative border-2 rounded-xl p-3 text-left transition-all active:scale-95 ${cfg.bg}`}
                  >
                    <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${cfg.dot}`} />

                    <p className="font-bold text-[13px] text-gray-800 pr-4 leading-tight">{table.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5 mb-1.5">
                      <Users size={9} />
                      <span>{table.capacity} pers.</span>
                    </div>

                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>

                    {table.status !== "free" && table.opened_at && (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock size={9} />
                          <span>{timeElapsed(table.opened_at)}</span>
                        </div>
                        {table.order_total !== null && (
                          <p className="text-[11px] font-semibold text-gray-600">{formatCLP(table.order_total)}</p>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            Continuar sin mesa
          </button>
        </div>
      </div>
    </div>
  );
}

import type { Sale } from "@/types";
import { formatCLP, formatDate } from "@/utils/format";
import { Printer, X } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  sale: Sale;
  onClose: () => void;
}

export default function ReceiptView({ sale, onClose }: Props) {
  const handlePrint = async () => {
    if (!window.electronAPI) {
      toast.error("Impresión solo disponible en app de escritorio");
      return;
    }

    const content = [
      { type: "text", value: "MINIMARKET POS", style: { textAlign: "center", fontWeight: "700", fontSize: "16px" } },
      { type: "text", value: `Boleta N° ${sale.sale_number}`, style: { textAlign: "center", fontSize: "12px" } },
      { type: "text", value: formatDate(sale.created_at), style: { textAlign: "center", fontSize: "10px" } },
      { type: "text", value: "--------------------------------", style: { textAlign: "center" } },
      ...sale.items.map((item) => ({
        type: "text" as const,
        value: `${item.product_name}\n  ${item.quantity} x ${formatCLP(item.unit_price)} = ${formatCLP(item.subtotal)}`,
        style: { fontSize: "11px" },
      })),
      { type: "text", value: "--------------------------------", style: { textAlign: "center" } },
      { type: "text", value: `TOTAL: ${formatCLP(sale.total)}`, style: { textAlign: "right", fontWeight: "700", fontSize: "14px" } },
      { type: "text", value: `Pago: ${sale.payment_method}`, style: { fontSize: "10px" } },
      ...(sale.change_amount > 0
        ? [{ type: "text" as const, value: `Vuelto: ${formatCLP(sale.change_amount)}`, style: { fontSize: "11px" } }]
        : []),
      { type: "text", value: "\n\nGracias por su compra!", style: { textAlign: "center", fontSize: "11px" } },
    ];

    const result = await window.electronAPI.printReceipt({ content });
    if (result.success) {
      toast.success("Ticket impreso");
    } else {
      toast.error(`Error imprimiendo: ${result.error}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 max-w-sm mx-auto">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-gray-800">Ticket Venta #{sale.sale_number}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-3">{formatDate(sale.created_at)}</p>

      <div className="space-y-2 mb-4">
        {sale.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.product_name} x{item.quantity}
            </span>
            <span className="font-medium">{formatCLP(item.subtotal)}</span>
          </div>
        ))}
      </div>

      <hr className="mb-3" />

      <div className="flex justify-between font-bold text-lg mb-1">
        <span>Total</span>
        <span>{formatCLP(sale.total)}</span>
      </div>

      <div className="text-sm text-gray-500 space-y-1 mb-4">
        <p>Pago: {sale.payment_method === "cash" ? "Efectivo" : sale.payment_method === "card" ? "Tarjeta" : "Mixto"}</p>
        {sale.cash_amount > 0 && <p>Efectivo: {formatCLP(sale.cash_amount)}</p>}
        {sale.card_amount > 0 && <p>Tarjeta: {formatCLP(sale.card_amount)}</p>}
        {sale.change_amount > 0 && <p className="text-green-600 font-medium">Vuelto: {formatCLP(sale.change_amount)}</p>}
      </div>

      <button
        onClick={handlePrint}
        className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white py-2 rounded-lg transition"
      >
        <Printer size={16} /> Imprimir Ticket
      </button>
    </div>
  );
}

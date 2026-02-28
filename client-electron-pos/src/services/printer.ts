import type { Sale } from "@/types";
import { formatCLP, formatDate } from "@/utils/format";

export function buildReceiptContent(sale: Sale, storeName: string = "MINIMARKET POS") {
  return [
    { type: "text", value: storeName, style: { textAlign: "center", fontWeight: "700", fontSize: "16px" } },
    { type: "text", value: `Boleta N° ${sale.sale_number}`, style: { textAlign: "center", fontSize: "12px" } },
    { type: "text", value: formatDate(sale.created_at), style: { textAlign: "center", fontSize: "10px" } },
    { type: "text", value: "================================", style: { textAlign: "center", fontFamily: "monospace" } },
    ...sale.items.map((item) => ({
      type: "text" as const,
      value: `${item.product_name}\n  ${item.quantity} x ${formatCLP(item.unit_price)} = ${formatCLP(item.subtotal)}`,
      style: { fontSize: "11px", fontFamily: "monospace" },
    })),
    { type: "text", value: "================================", style: { textAlign: "center", fontFamily: "monospace" } },
    { type: "text", value: `Neto:   ${formatCLP(sale.total - sale.tax_amount)}`, style: { fontSize: "11px", fontFamily: "monospace" } },
    { type: "text", value: `IVA 19%:${formatCLP(sale.tax_amount)}`, style: { fontSize: "11px", fontFamily: "monospace" } },
    { type: "text", value: `TOTAL:  ${formatCLP(sale.total)}`, style: { textAlign: "right", fontWeight: "700", fontSize: "14px" } },
    ...(sale.change_amount > 0
      ? [{ type: "text" as const, value: `Vuelto: ${formatCLP(sale.change_amount)}`, style: { fontSize: "11px" } }]
      : []),
    { type: "text", value: "\nGracias por su compra!", style: { textAlign: "center", fontSize: "11px" } },
  ];
}

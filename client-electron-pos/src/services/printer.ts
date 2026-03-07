import type { Sale, Order } from "@/types";
import { formatCLP, formatDate } from "@/utils/format";

/** Builds the ESC/POS content for a comanda (order ticket) */
export function buildOrderContent(order: Order, storeName: string = "MINIMARKET POS") {
  const sep = "================================";
  return [
    { type: "text" as const, value: storeName, style: { textAlign: "center", fontWeight: "700", fontSize: "14px", fontFamily: "monospace" } },
    { type: "text" as const, value: "--- COMANDA ---", style: { textAlign: "center", fontWeight: "700", fontSize: "13px", fontFamily: "monospace" } },
    { type: "text" as const, value: `N° ${order.order_number}`, style: { textAlign: "center", fontWeight: "700", fontSize: "16px" } },
    ...(order.reference
      ? [{ type: "text" as const, value: `Ref: ${order.reference}`, style: { textAlign: "center", fontSize: "12px", fontFamily: "monospace" } }]
      : []),
    { type: "text" as const, value: formatDate(order.created_at), style: { textAlign: "center", fontSize: "10px" } },
    { type: "text" as const, value: sep, style: { textAlign: "center", fontFamily: "monospace" } },
    ...order.items.map((item) => ({
      type: "text" as const,
      value: `${item.quantity}x  ${item.product_name}`,
      style: { fontSize: "12px", fontFamily: "monospace", fontWeight: "600" },
    })),
    { type: "text" as const, value: sep, style: { textAlign: "center", fontFamily: "monospace" } },
    ...(order.notes
      ? [{ type: "text" as const, value: `Nota: ${order.notes}`, style: { fontSize: "11px", fontFamily: "monospace" } }]
      : []),
    { type: "text" as const, value: " ", style: {} },
  ];
}

export function buildReceiptContent(sale: Sale, barcodeDataUrl?: string, storeName: string = "MINIMARKET POS") {
  const isDte = sale.sii_folio != null;

  // Encabezado: DTE usa "BOLETA ELECTRÓNICA" con folio SII; sin DTE usa número interno
  const headerLines = isDte
    ? [
        { type: "text" as const, value: "BOLETA ELECTRONICA", style: { textAlign: "center", fontWeight: "700", fontSize: "13px", fontFamily: "monospace" } },
        { type: "text" as const, value: `N° ${sale.sii_folio}`, style: { textAlign: "center", fontWeight: "700", fontSize: "15px" } },
      ]
    : [
        { type: "text" as const, value: `Boleta N° ${sale.sale_number}`, style: { textAlign: "center", fontSize: "12px" } },
      ];

  return [
    { type: "text", value: storeName, style: { textAlign: "center", fontWeight: "700", fontSize: "16px" } },
    ...headerLines,
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
    // Pie DTE: código PDF417 + estado SII visible en el ticket
    ...(isDte
      ? [
          { type: "text" as const, value: "--------------------------------", style: { textAlign: "center", fontFamily: "monospace" } },
          ...(barcodeDataUrl
            ? [{ type: "image" as const, url: barcodeDataUrl, style: { display: "block", margin: "4px auto", maxWidth: "100%" } }]
            : []),
          { type: "text" as const, value: `DTE Tipo 39  Folio: ${sale.sii_folio}`, style: { fontSize: "9px", fontFamily: "monospace", textAlign: "center" } },
          { type: "text" as const, value: `Estado SII: ${sale.sii_status ?? "PENDIENTE"}`, style: { fontSize: "9px", fontFamily: "monospace", textAlign: "center" } },
          { type: "text" as const, value: "Verifique en sii.cl/validardoc", style: { fontSize: "9px", fontFamily: "monospace", textAlign: "center" } },
        ]
      : []),
  ];
}

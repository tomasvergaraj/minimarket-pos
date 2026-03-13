import type { Order, Sale, SaleItem } from "@/types";
import { formatCLP, formatDate } from "@/utils/format";
import { buildPdf417DataUrl } from "@/utils/pdf417";

const RECEIPT_COLOR_PRIMARY = "#000000";
const RECEIPT_COLOR_MUTED = "#222222";
const RECEIPT_COLOR_SEPARATOR = "#000000";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  mixed: "Mixto",
};

export interface ReceiptBuildOptions {
  barcodeDataUrl?: string;
  registerName?: string;
  sellerName?: string;
  storeName?: string;
}

export interface OrderBuildOptions {
  registerName?: string;
  showBlankNotesBox?: boolean;
}

export interface ReceiptLayout {
  barcodeDataUrl?: string;
  cardAmount: number;
  cashAmount: number;
  changeAmount: number;
  createdAtLabel: string;
  footerMessage: string;
  isDte: boolean;
  items: SaleItem[];
  netAmount: number;
  paymentMethodLabel: string;
  registerName: string;
  saleNumberLabel: string;
  sellerName: string;
  siiFolio: number | null;
  siiStatusLabel: string;
  showSiiSection: boolean;
  storeName: string;
  taxAmount: number;
  totalAmount: number;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMultilineHtml(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function buildReceiptRow(label: string, value: string, options?: { valueBold?: boolean; tone?: string }) {
  const tone = options?.tone ?? RECEIPT_COLOR_MUTED;
  const valueWeight = options?.valueBold ? "700" : "500";

  return `
    <div style="display:flex;justify-content:space-between;gap:8px;color:${tone};font-size:11px;line-height:1.25;">
      <span>${escapeHtml(label)}</span>
      <span style="font-weight:${valueWeight};color:${options?.valueBold ? RECEIPT_COLOR_PRIMARY : tone};white-space:nowrap;">${escapeHtml(value)}</span>
    </div>
  `;
}

function buildReceiptItemHtml(item: SaleItem) {
  return `
    <div style="margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;line-height:1.2;color:${RECEIPT_COLOR_PRIMARY};">${escapeHtml(item.product_name)}</div>
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:1.25;color:${RECEIPT_COLOR_MUTED};">
        <span>${escapeHtml(`${item.quantity} x ${formatCLP(item.unit_price)}`)}</span>
        <span style="font-weight:700;color:${RECEIPT_COLOR_PRIMARY};white-space:nowrap;">${escapeHtml(formatCLP(item.subtotal))}</span>
      </div>
    </div>
  `;
}

function buildOrderItemHtml(item: Order["items"][number]) {
  const itemNameLength = item.product_name.trim().length;
  const itemFontSize = itemNameLength > 34 ? 15 : 17;
  const itemLineHeight = itemNameLength > 48 ? 1.05 : 1.12;

  return `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
      <div style="min-width:38px;text-align:center;font-size:18px;font-weight:800;line-height:1;color:${RECEIPT_COLOR_PRIMARY};">
        ${escapeHtml(`${item.quantity}x`)}
      </div>
      <div style="flex:1;font-size:${itemFontSize}px;font-weight:800;line-height:${itemLineHeight};letter-spacing:-0.01em;color:${RECEIPT_COLOR_PRIMARY};word-break:break-word;overflow-wrap:anywhere;">
        ${escapeHtml(item.product_name)}
      </div>
    </div>
  `;
}

export function getPaymentMethodLabel(method: string) {
  return PAYMENT_LABELS[method] ?? method;
}

export function buildReceiptLayout(sale: Sale, options: ReceiptBuildOptions = {}): ReceiptLayout {
  const barcodeDataUrl = options.barcodeDataUrl ?? buildPdf417DataUrl(sale.sii_ted_xml);
  const showSiiSection = Boolean(sale.sii_folio || sale.sii_ted_xml || sale.sii_tipo_dte || sale.sii_status);
  const isDte = Boolean(sale.sii_folio || sale.sii_ted_xml || sale.sii_tipo_dte);

  return {
    barcodeDataUrl,
    cardAmount: sale.card_amount,
    cashAmount: sale.cash_amount,
    changeAmount: sale.change_amount,
    createdAtLabel: formatDate(sale.created_at),
    footerMessage: "*** GRACIAS POR SU COMPRA ***",
    isDte,
    items: sale.items,
    netAmount: sale.total - sale.tax_amount,
    paymentMethodLabel: getPaymentMethodLabel(sale.payment_method),
    registerName: options.registerName?.trim() || "",
    saleNumberLabel: sale.sii_folio != null ? `Nro ${sale.sii_folio}` : `BOLETA Nro ${sale.sale_number}`,
    sellerName: options.sellerName?.trim() || "",
    siiFolio: sale.sii_folio,
    siiStatusLabel: sale.sii_status ?? "PENDIENTE",
    showSiiSection,
    storeName: options.storeName ?? "NEXO",
    taxAmount: sale.tax_amount,
    totalAmount: sale.total,
  };
}

export function buildReceiptHtml(sale: Sale, options: ReceiptBuildOptions = {}) {
  const layout = buildReceiptLayout(sale, options);
  const itemsHtml = layout.items.map(buildReceiptItemHtml).join("");

  const paymentRows = [
    buildReceiptRow("Forma de pago:", layout.paymentMethodLabel, { valueBold: true }),
    ...(layout.cashAmount > 0 ? [buildReceiptRow("Efectivo:", formatCLP(layout.cashAmount))] : []),
    ...(layout.cardAmount > 0 ? [buildReceiptRow("Tarjeta:", formatCLP(layout.cardAmount))] : []),
    ...(layout.changeAmount > 0 ? [buildReceiptRow("Vuelto:", formatCLP(layout.changeAmount), { valueBold: true, tone: RECEIPT_COLOR_PRIMARY })] : []),
  ].join("");

  const siiHtml = layout.showSiiSection ? `
    <div style="border-top:1px dashed ${RECEIPT_COLOR_SEPARATOR};margin:8px 0;"></div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
      ${layout.barcodeDataUrl
        ? `<img src="${layout.barcodeDataUrl}" alt="Codigo SII" style="display:block;width:240px;max-width:100%;margin:0 auto;" />`
        : `<div style="font-size:10px;font-weight:700;color:${RECEIPT_COLOR_PRIMARY};text-align:center;">CODIGO SII NO DISPONIBLE</div>`}
      <div style="text-align:center;font-size:9px;line-height:1.25;">
        <div style="color:${RECEIPT_COLOR_MUTED};">DTE Tipo 39 | Folio: ${escapeHtml(String(layout.siiFolio ?? "-"))}</div>
        <div style="font-weight:700;color:${RECEIPT_COLOR_PRIMARY};">SII: ${escapeHtml(layout.siiStatusLabel)}</div>
        ${sale.sii_ted_xml ? "" : `<div style="color:${RECEIPT_COLOR_PRIMARY};">Esta venta no tiene TED guardado.</div>`}
        <div style="color:${RECEIPT_COLOR_MUTED};">Verifique en sii.cl/validardoc</div>
      </div>
    </div>
  ` : "";

  return `
    <div style="width:100%;box-sizing:border-box;padding:0 2px;font-family:'Courier New',Courier,monospace;color:${RECEIPT_COLOR_PRIMARY};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:16px;font-weight:700;letter-spacing:0.04em;">${escapeHtml(layout.storeName)}</div>
        ${layout.registerName ? `<div style="font-size:11px;color:${RECEIPT_COLOR_MUTED};margin-top:2px;">${escapeHtml(layout.registerName)}</div>` : ""}
      </div>

      <div style="border-top:1px dashed ${RECEIPT_COLOR_SEPARATOR};margin:8px 0;"></div>

      <div style="text-align:center;font-size:11px;color:${RECEIPT_COLOR_MUTED};line-height:1.25;">
        ${layout.isDte
          ? `
            <div style="font-size:13px;font-weight:700;letter-spacing:0.06em;color:${RECEIPT_COLOR_PRIMARY};">BOLETA ELECTRONICA</div>
            <div style="font-size:14px;font-weight:700;color:${RECEIPT_COLOR_PRIMARY};">${escapeHtml(layout.saleNumberLabel)}</div>
          `
          : `<div style="font-weight:700;color:${RECEIPT_COLOR_PRIMARY};">${escapeHtml(layout.saleNumberLabel)}</div>`}
        <div>${escapeHtml(layout.createdAtLabel)}</div>
        ${layout.sellerName ? `<div>Cajero: ${escapeHtml(layout.sellerName)}</div>` : ""}
      </div>

      <div style="border-top:1px dashed ${RECEIPT_COLOR_SEPARATOR};margin:8px 0;"></div>

      <div style="margin-bottom:12px;">${itemsHtml}</div>

      <div style="border-top:1px dashed ${RECEIPT_COLOR_SEPARATOR};margin:8px 0;"></div>

      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
        ${buildReceiptRow("Neto:", formatCLP(layout.netAmount))}
        ${buildReceiptRow("IVA (19%):", formatCLP(layout.taxAmount))}
        <div style="text-align:center;font-size:14px;font-weight:700;color:${RECEIPT_COLOR_PRIMARY};padding-top:2px;">
          TOTAL: ${escapeHtml(formatCLP(layout.totalAmount))}
        </div>
      </div>

      <div style="border-top:1px dashed ${RECEIPT_COLOR_SEPARATOR};margin:8px 0;"></div>

      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">
        ${paymentRows}
      </div>

      <div style="border-top:1px dashed ${RECEIPT_COLOR_SEPARATOR};margin:8px 0 12px;"></div>

      <div style="text-align:center;font-size:10px;color:${RECEIPT_COLOR_MUTED};letter-spacing:0.05em;">
        ${escapeHtml(layout.footerMessage)}
      </div>

      ${siiHtml}
    </div>
  `;
}

export function buildOrderHtml(order: Order, options: OrderBuildOptions = {}) {
  const registerName = options.registerName?.trim() || "";
  const showBlankNotesBox = options.showBlankNotesBox ?? true;
  const notes = order.notes?.trim() || "";
  const reference = order.reference?.trim() || "";
  const referenceLength = reference.length;
  const referenceFontSize = referenceLength > 44 ? 15 : referenceLength > 28 ? 18 : 22;
  const referenceLineHeight = referenceLength > 44 ? 1.02 : 1.08;
  const referencePadding = referenceLength > 44 ? "6px 8px" : "8px 10px";
  const notesFontSize = 15;
  const notesLineHeight = 1.16;
  const notesPadding = "10px 12px";
  const commentsBoxHtml = notes || showBlankNotesBox
    ? `
      <div style="margin-top:12px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:${RECEIPT_COLOR_PRIMARY};margin-bottom:5px;">
          COMENTARIOS
        </div>
        <div style="border:2px solid ${RECEIPT_COLOR_PRIMARY};border-radius:10px;min-height:84px;padding:${notesPadding};font-size:${notesFontSize}px;font-weight:700;line-height:${notesLineHeight};letter-spacing:-0.01em;color:${RECEIPT_COLOR_PRIMARY};white-space:normal;word-break:break-word;overflow-wrap:anywhere;box-sizing:border-box;page-break-inside:avoid;break-inside:avoid-page;">
          ${notes ? escapeMultilineHtml(notes) : "&nbsp;"}
        </div>
      </div>
    `
    : "";

  return `
    <div style="width:100%;box-sizing:border-box;padding:2px 4px 14px;font-family:Arial,Helvetica,sans-serif;color:${RECEIPT_COLOR_PRIMARY};-webkit-print-color-adjust:exact;print-color-adjust:exact;page-break-inside:avoid;break-inside:avoid-page;">
      ${registerName ? `<div style="text-align:center;font-size:12px;font-weight:700;color:${RECEIPT_COLOR_MUTED};margin-bottom:2px;">${escapeHtml(registerName)}</div>` : ""}

      <div style="border-top:2px dashed ${RECEIPT_COLOR_SEPARATOR};margin:10px 0;"></div>

      <div style="text-align:center;">
        <div style="font-size:16px;font-weight:800;letter-spacing:0.12em;color:${RECEIPT_COLOR_PRIMARY};">COMANDA</div>
        <div style="font-size:26px;font-weight:900;line-height:1.1;color:${RECEIPT_COLOR_PRIMARY};margin-top:2px;">
          ${escapeHtml(`Nro ${order.order_number}`)}
        </div>
        <div style="font-size:12px;font-weight:700;color:${RECEIPT_COLOR_MUTED};margin-top:4px;">
          ${escapeHtml(formatDate(order.created_at))}
        </div>
      </div>

      ${reference
        ? `
          <div style="margin-top:12px;border:2px solid ${RECEIPT_COLOR_PRIMARY};border-radius:10px;padding:${referencePadding};text-align:center;">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:${RECEIPT_COLOR_PRIMARY};">REFERENCIA</div>
            <div style="font-size:${referenceFontSize}px;font-weight:900;line-height:${referenceLineHeight};letter-spacing:-0.02em;color:${RECEIPT_COLOR_PRIMARY};margin-top:2px;word-break:break-word;overflow-wrap:anywhere;">
              ${escapeHtml(reference)}
            </div>
          </div>
        `
        : ""}

      <div style="border-top:2px dashed ${RECEIPT_COLOR_SEPARATOR};margin:12px 0 10px;"></div>

      <div style="display:flex;flex-direction:column;gap:2px;">
        ${order.items.map(buildOrderItemHtml).join("")}
      </div>

      ${commentsBoxHtml}
    </div>
  `;
}

export function buildOrderContent(order: Order, options: OrderBuildOptions = {}) {
  return [
    {
      type: "text" as const,
      value: buildOrderHtml(order, options),
      style: {
        width: "100%",
        boxSizing: "border-box",
      },
    },
  ];
}

export function buildReceiptContent(sale: Sale, options: ReceiptBuildOptions = {}) {
  return [
    {
      type: "text" as const,
      value: buildReceiptHtml(sale, options),
      style: {
        width: "100%",
        boxSizing: "border-box",
      },
    },
  ];
}

export function buildReceiptPdfFileName(sale: Sale) {
  if (sale.sii_folio != null) {
    return `boleta-sii-${sale.sii_folio}.pdf`;
  }

  return `boleta-${sale.sale_number}.pdf`;
}

export function buildReceiptWhatsAppText(sale: Sale, options: ReceiptBuildOptions = {}) {
  const layout = buildReceiptLayout(sale, options);

  const lines = [
    layout.storeName,
    layout.isDte ? `Boleta electronica ${layout.saleNumberLabel}` : layout.saleNumberLabel,
    layout.createdAtLabel,
    "",
    ...layout.items.map((item) => `${item.quantity} x ${item.product_name} - ${formatCLP(item.subtotal)}`),
    "",
    `Total: ${formatCLP(layout.totalAmount)}`,
    `Pago: ${layout.paymentMethodLabel}`,
    ...(layout.cashAmount > 0 ? [`Efectivo: ${formatCLP(layout.cashAmount)}`] : []),
    ...(layout.cardAmount > 0 ? [`Tarjeta: ${formatCLP(layout.cardAmount)}`] : []),
    ...(layout.changeAmount > 0 ? [`Vuelto: ${formatCLP(layout.changeAmount)}`] : []),
    ...(layout.siiFolio != null ? [`Folio SII: ${layout.siiFolio}`] : []),
    ...(sale.sii_status ? [`SII: ${sale.sii_status}`] : []),
  ];

  return lines.join("\n");
}

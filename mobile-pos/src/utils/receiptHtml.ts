/**
 * Builds the HTML string for a thermal receipt.
 * Used by expo-print (native print dialog) and as source-of-truth for the
 * ReceiptPreviewModal layout data.
 *
 * Mirrors the logic in client-electron-pos/src/services/printer.ts.
 */
import type { Sale } from '../types'

const C_PRIMARY   = '#000000'
const C_MUTED     = '#333333'
const C_SEPARATOR = '#000000'

const PAYMENT_LABELS: Record<string, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  mixed:    'Mixto',
}

function esc(v: string | number) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function row(label: string, value: string, bold = false) {
  return `
    <div style="display:flex;justify-content:space-between;gap:8px;color:${C_MUTED};font-size:11px;line-height:1.3;">
      <span>${esc(label)}</span>
      <span style="font-weight:${bold ? 700 : 500};color:${bold ? C_PRIMARY : C_MUTED};white-space:nowrap;">${esc(value)}</span>
    </div>`
}

function clp(v: number) {
  return `$${Math.round(v).toLocaleString('es-CL')}`
}

export function buildReceiptHtml(sale: Sale, storeName = 'Mi Tienda'): string {
  const date    = new Date(sale.created_at)
  const dateStr = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  const net     = sale.total - sale.tax_amount
  const payLabel = PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method

  const itemsHtml = sale.items.map((item) => `
    <div style="margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:${C_PRIMARY};line-height:1.2;">${esc(item.product_name)}</div>
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:${C_MUTED};">
        <span>${esc(item.quantity)} x ${esc(clp(item.unit_price))}</span>
        <span style="font-weight:700;color:${C_PRIMARY};white-space:nowrap;">${esc(clp(item.subtotal))}</span>
      </div>
    </div>`).join('')

  const payRows = [
    row('Forma de pago:', payLabel, true),
    sale.cash_amount     > 0 ? row('Efectivo:',       clp(sale.cash_amount))     : '',
    sale.card_amount     > 0 ? row('Tarjeta:',        clp(sale.card_amount))     : '',
    sale.transfer_amount > 0 ? row('Transferencia:',  clp(sale.transfer_amount)) : '',
    sale.change_amount   > 0 ? row('Vuelto:',         clp(sale.change_amount), true) : '',
  ].join('')

  const loyaltyHtml = (sale.points_earned > 0 || sale.points_redeemed > 0) ? `
    <div style="border-top:1px dashed ${C_SEPARATOR};margin:8px 0;"></div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      ${sale.points_redeemed > 0 ? row('Puntos canjeados:', `-${sale.points_redeemed} pts`) : ''}
      ${sale.points_earned   > 0 ? row('Puntos ganados:',   `+${sale.points_earned} pts`, true) : ''}
    </div>` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { margin: 0; padding: 0; background: #fff; }
  </style>
</head>
<body>
  <div style="width:100%;box-sizing:border-box;padding:4px 2px;font-family:'Courier New',Courier,monospace;color:${C_PRIMARY};-webkit-print-color-adjust:exact;print-color-adjust:exact;">

    <div style="text-align:center;margin-bottom:12px;">
      <div style="font-size:16px;font-weight:700;letter-spacing:0.04em;">${esc(storeName.toUpperCase())}</div>
    </div>

    <div style="border-top:1px dashed ${C_SEPARATOR};margin:8px 0;"></div>

    <div style="text-align:center;font-size:11px;color:${C_MUTED};line-height:1.3;">
      <div style="font-weight:700;color:${C_PRIMARY};">BOLETA Nro ${esc(String(sale.sale_number))}</div>
      <div>${esc(dateStr)} ${esc(timeStr)}</div>
    </div>

    <div style="border-top:1px dashed ${C_SEPARATOR};margin:8px 0;"></div>

    <div style="margin-bottom:12px;">${itemsHtml}</div>

    <div style="border-top:1px dashed ${C_SEPARATOR};margin:8px 0;"></div>

    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
      ${row('Neto:', clp(net))}
      ${row('IVA (19%):', clp(sale.tax_amount))}
      ${sale.discount_amount > 0 ? row('Descuento:', `-${clp(sale.discount_amount)}`) : ''}
      <div style="text-align:center;font-size:14px;font-weight:700;color:${C_PRIMARY};padding-top:2px;">
        TOTAL: ${esc(clp(sale.total))}
      </div>
    </div>

    <div style="border-top:1px dashed ${C_SEPARATOR};margin:8px 0;"></div>

    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">
      ${payRows}
    </div>

    ${loyaltyHtml}

    <div style="border-top:1px dashed ${C_SEPARATOR};margin:8px 0 12px;"></div>

    <div style="text-align:center;font-size:10px;color:${C_MUTED};letter-spacing:0.05em;">
      *** GRACIAS POR SU COMPRA ***
    </div>

  </div>
</body>
</html>`
}

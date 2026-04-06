import type { PrintPrefs, Sale } from '../types'

interface ReceiptHtmlOptions {
  showPrintButton?: boolean
}

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mixed: 'Mixto',
}

export function generateReceiptHtml(sale: Sale, prefs: PrintPrefs, options: ReceiptHtmlOptions = {}): string {
  const { showPrintButton = true } = options
  const dt = new Date(sale.created_at)
  const dateStr = dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

  const itemRows = sale.items.map((item) => `
    <tr>
      <td style="padding:2px 4px">${item.product_name}</td>
      <td style="padding:2px 4px;text-align:center">${item.quantity}</td>
      <td style="padding:2px 4px;text-align:right">${clp(item.unit_price)}</td>
      <td style="padding:2px 4px;text-align:right">${clp(item.subtotal)}</td>
    </tr>
  `).join('')

  const customerRow = sale.customer_name
    ? `<p style="margin:2px 0">Cliente: <strong>${sale.customer_name}</strong></p>`
    : ''

  const pointsRow = sale.points_earned > 0 || sale.points_redeemed > 0
    ? `<p style="margin:4px 0;font-size:11px">
        ${sale.points_redeemed > 0 ? `Puntos canjeados: ${sale.points_redeemed} | ` : ''}
        Puntos ganados: +${sale.points_earned}
      </p>`
    : ''

  const changeRow = sale.change_amount > 0
    ? `<tr><td style="padding:2px 4px">Vuelto</td><td></td><td></td><td style="padding:2px 4px;text-align:right">${clp(sale.change_amount)}</td></tr>`
    : ''

  const printButton = showPrintButton
    ? '<button class="btn no-print" onclick="window.print()">Imprimir</button>'
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Boleta #${sale.sale_number}</title>
  <style>
    @media print { body { margin: 0; } .no-print { display: none; } }
    body { font-family: monospace; font-size: 13px; max-width: 300px; margin: 20px auto; color: #111; }
    h2 { text-align: center; margin: 4px 0; font-size: 16px; }
    p { margin: 2px 0; }
    hr { border: none; border-top: 1px dashed #aaa; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 2px 4px; border-bottom: 1px solid #ccc; font-size: 11px; }
    .total-row td { font-weight: bold; font-size: 14px; border-top: 1px solid #ccc; }
    .center { text-align: center; }
    .btn {
      display: block;
      width: 100%;
      padding: 10px;
      margin-top: 16px;
      background: #1d4ed8;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h2>${prefs.store_name || 'Nexo POS'}</h2>
  <p class="center">Boleta de Venta</p>
  <hr />
  <p>N° <strong>#${sale.sale_number}</strong></p>
  <p>Fecha: ${dateStr} ${timeStr}</p>
  ${customerRow}
  <hr />
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:center">Cant</th>
        <th style="text-align:right">P.Unit</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr><td colspan="4"><hr style="margin:4px 0" /></td></tr>
      <tr><td style="padding:2px 4px">Subtotal</td><td></td><td></td><td style="padding:2px 4px;text-align:right">${clp(sale.subtotal)}</td></tr>
      <tr><td style="padding:2px 4px">IVA (19%)</td><td></td><td></td><td style="padding:2px 4px;text-align:right">${clp(sale.tax_amount)}</td></tr>
      ${changeRow}
      <tr class="total-row">
        <td style="padding:4px 4px">TOTAL</td><td></td><td></td>
        <td style="padding:4px 4px;text-align:right">${clp(sale.total)}</td>
      </tr>
    </tbody>
  </table>
  <hr />
  <p>Pago: ${METHOD_LABEL[sale.payment_method] ?? sale.payment_method}</p>
  ${pointsRow}
  <hr />
  <p class="center" style="font-size:11px;color:#666">Gracias por su compra</p>
  ${printButton}
</body>
</html>`
}

export function printReceipt(sale: Sale, prefs: PrintPrefs) {
  const html = generateReceiptHtml(sale, prefs, { showPrintButton: true })
  const win = window.open('', '_blank', 'width=360,height=600')
  if (!win) return
  win.document.write(html)
  win.document.close()
  if (prefs.auto_print) {
    win.focus()
    win.print()
  }
}

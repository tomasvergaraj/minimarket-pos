/**
 * Bluetooth thermal printer service (ESC/POS)
 *
 * Uses the native module from `react-native-thermal-printer` via NativeModules
 * directly so the app doesn't crash at JS bundle time if the package is not
 * yet installed.
 *
 * Installation (requires EAS build / custom dev client):
 *   npm install react-native-thermal-printer
 *   eas build --platform android --profile preview
 */
import { NativeModules, Platform } from 'react-native'
import { clp } from '../utils/currency'
import type { Sale } from '../types'

// ─── Native bridge ────────────────────────────────────────────────────────────

interface ThermalPrinterNative {
  printBluetooth(opts: {
    payload: string
    printerNbrCharactersPerLine: number
    macAddress: string
  }): Promise<void>
  getBluetoothDeviceList(): Promise<{ list: BtDevice[] }>
}

export interface BtDevice {
  deviceName: string
  macAddress: string
}

// Access via NativeModules so the JS bundle compiles even without the npm package.
// The native code must still be compiled (EAS build).
const Native = (NativeModules as Record<string, unknown>)
  .ThermalPrinterModule as ThermalPrinterNative | undefined

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true only on Android and when the native module is linked. */
export function isPrinterAvailable(): boolean {
  return Platform.OS === 'android' && !!Native
}

/**
 * Returns all Bluetooth devices currently paired with the phone.
 * Requires BT permissions (already declared in app.json).
 */
export async function getPairedPrinters(): Promise<BtDevice[]> {
  if (!Native) {
    throw new Error(
      'Módulo de impresora no disponible.\n' +
      'Instala react-native-thermal-printer y reconstruye la app con EAS.',
    )
  }
  const result = await Native.getBluetoothDeviceList()
  return result.list ?? []
}

/**
 * Formats and prints a sale receipt to the given printer MAC address.
 * @param sale        Completed sale object from the API
 * @param macAddress  Bluetooth MAC of the paired printer (e.g. "DC:0D:30:00:0E:C3")
 * @param storeName   Store display name printed at the top of the receipt
 */
export async function printSale(
  sale: Sale,
  macAddress: string,
  storeName: string,
): Promise<void> {
  if (!Native) {
    throw new Error(
      'Módulo de impresora no disponible.\n' +
      'Instala react-native-thermal-printer y reconstruye la app con EAS.',
    )
  }
  const payload = buildReceipt(sale, storeName)
  await Native.printBluetooth({ payload, printerNbrCharactersPerLine: 32, macAddress })
}

// ─── ESC/POS receipt builder ──────────────────────────────────────────────────

const SEP = '[L]--------------------------------\n'

const PAYMENT_LABEL: Record<string, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
  mixed:    'Mixto',
}

function buildReceipt(sale: Sale, storeName: string): string {
  const date    = new Date(sale.created_at)
  const dateStr = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

  let r = ''

  // Header
  r += `[C]<b>${storeName.toUpperCase()}</b>\n`
  r += '[C]Boleta de venta\n'
  r += '[L]\n'
  r += `[L]<b>Boleta #${sale.sale_number}</b>[R]${dateStr}\n`
  r += `[L]Hora:[R]${timeStr}\n`
  r += SEP

  // Items
  for (const item of sale.items) {
    const name = item.product_name.length > 22
      ? item.product_name.substring(0, 20) + '..'
      : item.product_name
    r += `[L]${name}\n`
    r += `[L]  x${item.quantity} · ${clp(item.unit_price)} c/u[R]${clp(item.subtotal)}\n`
  }

  r += SEP

  // Totals
  if (sale.tax_amount > 0) {
    r += `[L]Subtotal (sin IVA)[R]${clp(sale.subtotal)}\n`
    r += `[L]IVA (19%)[R]${clp(sale.tax_amount)}\n`
  }
  if (sale.discount_amount > 0) {
    r += `[L]Descuento[R]-${clp(sale.discount_amount)}\n`
  }
  r += `[L]<b>TOTAL</b>[R]<b>${clp(sale.total)}</b>\n`
  r += SEP

  // Payment
  r += `[L]Pago:[R]${PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method}\n`
  if (sale.cash_amount     > 0) r += `[L]Efectivo:[R]${clp(sale.cash_amount)}\n`
  if (sale.card_amount     > 0) r += `[L]Tarjeta:[R]${clp(sale.card_amount)}\n`
  if (sale.transfer_amount > 0) r += `[L]Transferencia:[R]${clp(sale.transfer_amount)}\n`
  if (sale.change_amount   > 0) r += `[L]<b>Vuelto:[R]${clp(sale.change_amount)}</b>\n`

  // Loyalty
  if (sale.points_earned > 0 || sale.points_redeemed > 0) {
    r += SEP
    if (sale.points_redeemed > 0) r += `[L]Puntos canjeados:[R]-${sale.points_redeemed} pts\n`
    if (sale.points_earned   > 0) r += `[L]Puntos ganados:[R]+${sale.points_earned} pts\n`
  }

  // Footer
  r += SEP
  r += '[C]¡Gracias por su compra!\n'
  // Feed lines to ensure paper cuts cleanly
  r += '[L]\n[L]\n[L]\n'

  return r
}

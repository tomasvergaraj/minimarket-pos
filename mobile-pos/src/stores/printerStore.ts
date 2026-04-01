import { create } from 'zustand'
import { Storage } from '../utils/storage'

const KEY_MAC       = 'printer_mac'
const KEY_NAME      = 'printer_name'
const KEY_AUTO      = 'printer_auto'
const KEY_STORE_NAME = 'printer_store_name'

interface PrinterStore {
  macAddress:  string | null
  deviceName:  string | null
  autoPrint:   boolean
  storeName:   string

  setDevice(mac: string, name: string): void
  clearDevice(): void
  setAutoPrint(v: boolean): void
  setStoreName(name: string): void
}

export const usePrinterStore = create<PrinterStore>(() => ({
  macAddress:  Storage.get<string>(KEY_MAC),
  deviceName:  Storage.get<string>(KEY_NAME),
  autoPrint:   Storage.get<boolean>(KEY_AUTO) ?? false,
  storeName:   Storage.get<string>(KEY_STORE_NAME) ?? 'Mi Tienda',

  setDevice(mac, name) {
    Storage.set(KEY_MAC, mac)
    Storage.set(KEY_NAME, name)
    usePrinterStore.setState({ macAddress: mac, deviceName: name })
  },
  clearDevice() {
    Storage.remove(KEY_MAC)
    Storage.remove(KEY_NAME)
    usePrinterStore.setState({ macAddress: null, deviceName: null })
  },
  setAutoPrint(v) {
    Storage.set(KEY_AUTO, v)
    usePrinterStore.setState({ autoPrint: v })
  },
  setStoreName(name) {
    Storage.set(KEY_STORE_NAME, name)
    usePrinterStore.setState({ storeName: name })
  },
}))

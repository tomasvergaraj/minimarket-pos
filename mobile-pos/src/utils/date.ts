const DISPLAY_LOCALE = 'es-CL'
const DISPLAY_TIME_ZONE = 'America/Santiago'

const dateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateTimeFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function parseServerDateTime(iso: string): Date {
  if (!iso) return new Date(NaN)

  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`
  return new Date(normalized)
}

export function formatServerDate(iso: string): string {
  return dateFormatter.format(parseServerDateTime(iso))
}

export function formatServerShortDate(iso: string): string {
  return shortDateFormatter.format(parseServerDateTime(iso))
}

export function formatServerTime(iso: string): string {
  return timeFormatter.format(parseServerDateTime(iso))
}

export function formatServerDateTime(iso: string): string {
  return dateTimeFormatter.format(parseServerDateTime(iso))
}

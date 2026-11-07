/**
 * CSV for spreadsheets. Every cell is quoted when it needs to be. A cell that starts with =, +, - or @ would
 * be run as a formula by Excel or Sheets, so it is prefixed with an apostrophe: names and notes come from
 * customers, and a name like "=HYPERLINK(...)" must stay text.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // A byte order mark first, so Excel reads the file as UTF-8 and keeps non-English names intact.
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

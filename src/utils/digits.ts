const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Converts Latin (and Arabic-Indic) digits in a number or string to Persian digits. */
export function toFaDigits(value: number | string): string {
  return String(value)
    .replace(/[0-9]/g, d => FA_DIGITS[Number(d)])
    .replace(/[٠-٩]/g, d => FA_DIGITS[d.charCodeAt(0) - 0x0660]);
}

/** Converts Persian and Arabic-Indic digits back to Latin digits, e.g. for parsing user input. */
export function toEnDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
}

/** Two-digit zero padded Persian number, e.g. 5 → «۰۵». */
export function pad2Fa(n: number): string {
  return toFaDigits(String(n).padStart(2, '0'));
}

/** Formats a duration in minutes as Persian text, e.g. 135 → «۲ ساعت و ۱۵ دقیقه». */
export function formatDurationFa(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${toFaDigits(m)} دقیقه`;
  }
  if (m === 0) {
    return `${toFaDigits(h)} ساعت`;
  }
  return `${toFaDigits(h)} ساعت و ${toFaDigits(m)} دقیقه`;
}

/** Formats seconds as a clock, e.g. 3725 → «۱:۰۲:۰۵», 125 → «۰۲:۰۵». */
export function formatClockFa(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${pad2Fa(m)}:${pad2Fa(sec)}`;
  return h > 0 ? `${toFaDigits(h)}:${mmss}` : mmss;
}

/** Minutes as «۳:۲۰» (hours:minutes). */
export function formatHMFa(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  return `${toFaDigits(Math.floor(m / 60))}:${pad2Fa(m % 60)}`;
}

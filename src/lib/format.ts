const PREFIXES: [number, string][] = [
  [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'],
]

/** 4700 → "4.7 kΩ" (3 significant digits). */
export function fmtEng(v: number, unit = ''): string {
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return `0 ${unit}`.trim()
  const a = Math.abs(v)
  const [scale, p] = PREFIXES.find(([s]) => a >= s * 0.9995) ?? PREFIXES[PREFIXES.length - 1]
  const n = Number((v / scale).toPrecision(3))
  return `${n} ${p}${unit}`.trim()
}

const MULT: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 }

/** Parses engineering notation: "4.7k", "100n", "10uF", "2.2meg", "1e-6", "1 MHz". NaN if invalid. */
export function parseEng(text: string): number {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([^\d\s]*)\s*$/i.exec(text.replace(',', '.'))
  if (!m) return NaN
  const num = Number(m[1])
  let rest = m[2]
  if (/^meg/i.test(rest)) return num * 1e6
  rest = rest.replace(/(ohms?|Ω|hz|f|s|v)$/i, '')
  if (rest === '') return num
  if (rest.length === 1 && rest in MULT) return num * MULT[rest]
  return NaN
}

export function fmtPct(x: number, digits = 1): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(digits)} %` : '—'
}

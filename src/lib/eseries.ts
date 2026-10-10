/** IEC 60063 preferred-number series. */
export type SeriesName = 'E3' | 'E6' | 'E12' | 'E24' | 'E48' | 'E96' | 'E192'
export const SERIES_NAMES: SeriesName[] = ['E3', 'E6', 'E12', 'E24', 'E48', 'E96', 'E192']

const PRESET: Partial<Record<SeriesName, number[]>> = {
  E3: [1.0, 2.2, 4.7],
  E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
}

const COUNT: Record<SeriesName, number> = { E3: 3, E6: 6, E12: 12, E24: 24, E48: 48, E96: 96, E192: 192 }

/** Mantissas (1.00 … 9.xx) of one decade. E48/E96/E192 are 10^(i/N) rounded to 3 significant digits. */
export function mantissas(s: SeriesName): number[] {
  const p = PRESET[s]
  if (p) return p
  const n = COUNT[s]
  return Array.from({ length: n }, (_, i) => Math.round(10 ** (i / n) * 100) / 100)
}

/** All series values within [min, max] (inclusive), ascending. */
export function seriesValues(s: SeriesName, min: number, max: number): number[] {
  const m = mantissas(s)
  const out: number[] = []
  for (let k = Math.floor(Math.log10(min)) - 1; k <= Math.ceil(Math.log10(max)); k++) {
    for (const x of m) {
      const v = Number(`${x}e${k}`)
      if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.push(v)
    }
  }
  return out
}

/** The series value closest to v on a logarithmic scale. */
export function nearest(s: SeriesName, v: number): number {
  if (!(v > 0)) return NaN
  const k = Math.floor(Math.log10(v))
  const all = seriesValues(s, 10 ** (k - 1), 10 ** (k + 2))
  let best = all[0]
  for (const x of all) if (Math.abs(Math.log(x / v)) < Math.abs(Math.log(best / v))) best = x
  return best
}

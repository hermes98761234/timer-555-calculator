import { nearest, seriesValues, type SeriesName } from './eseries'

export const LN2 = Math.LN2
export const LN3 = Math.log(3)

export type Mode = 'astable' | 'monostable' | 'bistable'
export type Variant = 'bipolar' | 'cmos'

export interface AstableParams {
  r1: number
  r2: number
  c: number
  vcc: number
  /** Diode across R2: charge through R1 only, discharge through R2. */
  diode: boolean
  /** Diode forward voltage in volts (used only with `diode`); 0 = ideal. */
  vf: number
}

export interface AstableResult {
  tHigh: number
  tLow: number
  period: number
  freq: number
  /** High time / period, 0..1. */
  duty: number
}

/** ln of the high-time ratio: charging from Vcc/3 to 2Vcc/3 toward target `vt` (in units of Vcc). */
function chargeLog(vtOverVcc: number): number {
  return Math.log((vtOverVcc - 1 / 3) / (vtOverVcc - 2 / 3))
}

export function astable(p: AstableParams): AstableResult {
  let tHigh: number
  if (p.diode) {
    const vt = 1 - p.vf / p.vcc
    tHigh = vt > 2 / 3 ? p.r1 * p.c * chargeLog(vt) : NaN
  } else {
    tHigh = LN2 * (p.r1 + p.r2) * p.c
  }
  const tLow = LN2 * p.r2 * p.c
  const period = tHigh + tLow
  return { tHigh, tLow, period, freq: 1 / period, duty: tHigh / period }
}

export interface MonostableParams {
  r: number
  c: number
  vcc: number
}

/** Output pulse width T = RC ln 3. */
export function monostable(p: MonostableParams): { width: number } {
  return { width: LN3 * p.r * p.c }
}

/** Comparator thresholds of the 555 (control pin open). */
export function thresholds(vcc: number): { trigger: number; threshold: number } {
  return { trigger: vcc / 3, threshold: (2 * vcc) / 3 }
}

export interface Range {
  min: number
  nom: number
  max: number
}

function range(f: (r1: number, r2: number, c: number) => number, p: { r1: number; r2: number; c: number }, tolR: number, tolC: number): Range {
  const vals: number[] = []
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const d of [-1, 1]) {
    vals.push(f(p.r1 * (1 + a * tolR), p.r2 * (1 + b * tolR), p.c * (1 + d * tolC)))
  }
  const nom = f(p.r1, p.r2, p.c)
  return { min: Math.min(nom, ...vals), nom, max: Math.max(nom, ...vals) }
}

/** Worst-case spread of frequency, duty cycle from fractional component tolerances (corner analysis). */
export function astableTolerance(p: AstableParams, tolR: number, tolC: number): { freq: Range; duty: Range } {
  const mk = (pick: (r: AstableResult) => number) => range((r1, r2, c) => pick(astable({ ...p, r1, r2, c })), p, tolR, tolC)
  return { freq: mk((r) => r.freq), duty: mk((r) => r.duty) }
}

export function monostableTolerance(p: MonostableParams, tolR: number, tolC: number): Range {
  return range((r, _r2, c) => monostable({ ...p, r, c }).width, { r1: p.r, r2: 0, c: p.c }, tolR, tolC)
}

// ---------------------------------------------------------------- variants

export interface VariantInfo {
  vccMin: number
  vccMax: number
  /** Typical maximum astable frequency, Hz. */
  fMax: number
  /** Resistor above which leakage / bias current spoils timing, ohms. */
  rMax: number
}

export const VARIANTS: Record<Variant, VariantInfo> = {
  bipolar: { vccMin: 4.5, vccMax: 16, fMax: 500e3, rMax: 10e6 },
  cmos: { vccMin: 2, vccMax: 15, fMax: 2e6, rMax: 100e6 },
}

export interface Warning {
  /** Translatable English message with {0}.. placeholders. */
  msg: string
  args: (string | number)[]
}

export function checkLimits(
  variant: Variant,
  mode: Mode,
  vcc: number,
  parts: { r1?: number; r2?: number; c?: number },
  astableResult?: AstableResult,
  fmt: (v: number, unit: string) => string = (v, u) => `${v} ${u}`,
): Warning[] {
  const v = VARIANTS[variant]
  const w: Warning[] = []
  if (vcc < v.vccMin || vcc > v.vccMax) {
    w.push({ msg: 'Supply {0} is outside the {1}–{2} V range of this variant.', args: [fmt(vcc, 'V'), v.vccMin, v.vccMax] })
  }
  if (mode !== 'bistable') {
    const rs = [parts.r1, parts.r2].filter((x): x is number => x !== undefined && x > 0)
    if (rs.some((r) => r < 1e3)) w.push({ msg: 'A timing resistor below 1 kΩ loads the discharge transistor. Keep it at 1 kΩ or more.', args: [] })
    if (rs.some((r) => r > v.rMax)) {
      w.push({
        msg: variant === 'bipolar'
          ? 'Resistors above about 10 MΩ: the bipolar 555 input bias current makes the timing inaccurate. Consider the CMOS variant.'
          : 'Resistors above about 100 MΩ: board leakage starts to dominate the timing.',
        args: [],
      })
    }
    if (parts.c !== undefined && parts.c < 100e-12) w.push({ msg: 'Capacitor below 100 pF: stray capacitance will shift the timing.', args: [] })
    if (parts.c !== undefined && parts.c > 100e-6) w.push({ msg: 'Large (electrolytic) timing capacitors have wide tolerance and leakage; expect poor accuracy.', args: [] })
  }
  if (astableResult) {
    if (astableResult.freq > v.fMax) {
      w.push({ msg: 'Frequency {0} is above the typical limit of this variant ({1}).', args: [fmt(astableResult.freq, 'Hz'), fmt(v.fMax, 'Hz')] })
    }
    if (!Number.isFinite(astableResult.period)) {
      w.push({ msg: 'The diode drop is too large for this supply: the capacitor never reaches 2/3 Vcc through the diode.', args: [] })
    }
  }
  return w
}

// ---------------------------------------------------------------- waveforms

export interface Trace {
  id: string
  label: string
  /** Vertical scale: 1 = volts. */
  pts: [number, number][]
}

export interface Waveform {
  traces: Trace[]
  tEnd: number
  /** Time unit label; 's' for real time, '' for arbitrary units. */
  arbitrary: boolean
}

function expSeg(out: [number, number][], t0: number, dur: number, from: number, target: number, tau: number, steps = 28) {
  for (let i = 1; i <= steps; i++) {
    const dt = (dur * i) / steps
    out.push([t0 + dt, target + (from - target) * Math.exp(-dt / tau)])
  }
}

/** Astable: capacitor voltage and output over `cycles` full periods after start-up from 0 V. */
export function astableWaveform(p: AstableParams, cycles = 3): Waveform {
  const vt = p.diode ? p.vcc - p.vf : p.vcc
  const tauH = p.diode ? p.r1 * p.c : (p.r1 + p.r2) * p.c
  const tauL = p.r2 * p.c
  const a = p.vcc / 3
  const b = (2 * p.vcc) / 3
  const vc: [number, number][] = [[0, 0]]
  const out: [number, number][] = [[0, p.vcc]]
  let t = 0
  let v = 0
  let high = true
  const nSeg = 1 + cycles * 2
  for (let i = 0; i < nSeg; i++) {
    let dur: number
    if (high) {
      dur = tauH * Math.log((vt - v) / (vt - b))
      expSeg(vc, t, dur, v, vt, tauH)
      v = b
    } else {
      dur = tauL * Math.log(v / a)
      expSeg(vc, t, dur, v, 0, tauL)
      v = a
    }
    t += dur
    out.push([t, high ? p.vcc : 0])
    high = !high
    out.push([t, high ? p.vcc : 0])
  }
  out.push([t, high ? p.vcc : 0])
  return { traces: [{ id: 'vc', label: 'Capacitor', pts: vc }, { id: 'out', label: 'Output', pts: out }], tEnd: t, arbitrary: false }
}

/** Monostable: three trigger pulses; the second arrives while the output is high and is ignored. */
export function monostableWaveform(p: MonostableParams): Waveform {
  const w = monostable(p).width
  const tau = p.r * p.c
  const trigAt = [0.15 * w, 0.6 * w, 1.5 * w]
  const tp = 0.08 * w
  const tEnd = 2.8 * w
  const trig: [number, number][] = [[0, p.vcc]]
  for (const s of trigAt) trig.push([s, p.vcc], [s, 0], [s + tp, 0], [s + tp, p.vcc])
  trig.push([tEnd, p.vcc])
  const starts = [trigAt[0], trigAt[2]]
  const out: [number, number][] = [[0, 0]]
  const vc: [number, number][] = [[0, 0]]
  for (const s of starts) {
    out.push([s, 0], [s, p.vcc], [s + w, p.vcc], [s + w, 0])
    vc.push([s, 0])
    expSeg(vc, s, w, 0, p.vcc, tau)
    vc.push([s + w, 0])
  }
  out.push([tEnd, 0])
  vc.push([tEnd, 0])
  return {
    traces: [
      { id: 'trig', label: 'Trigger', pts: trig },
      { id: 'vc', label: 'Capacitor', pts: vc },
      { id: 'out', label: 'Output', pts: out },
    ],
    tEnd,
    arbitrary: false,
  }
}

/** Bistable (SR latch): TRIG below Vcc/3 sets, THR above 2Vcc/3 resets. Arbitrary time units. */
export function bistableWaveform(vcc: number): Waveform {
  const setAt = [1, 2.4, 6]
  const resetAt = [4, 8]
  const len = 0.6
  const pulses = (starts: number[], idle: number, active: number): [number, number][] => {
    const o: [number, number][] = [[0, idle]]
    for (const s of starts) o.push([s, idle], [s, active], [s + len, active], [s + len, idle])
    o.push([10, idle])
    return o
  }
  const ev = [...setAt.map((t) => [t, 1] as const), ...resetAt.map((t) => [t, 0] as const)].sort((x, y) => x[0] - y[0])
  const out: [number, number][] = [[0, 0]]
  let level = 0
  for (const [t, to] of ev) {
    if (to !== level) {
      out.push([t, level * vcc], [t, to * vcc])
      level = to
    }
  }
  out.push([10, level * vcc])
  return {
    traces: [
      { id: 'trig', label: 'Trigger (pin 2)', pts: pulses(setAt, vcc, 0) },
      { id: 'thr', label: 'Threshold (pin 6)', pts: pulses(resetAt, 0, vcc) },
      { id: 'out', label: 'Output', pts: out },
    ],
    tEnd: 10,
    arbitrary: true,
  }
}

/** Value of a piecewise-linear trace at time t (vertical steps resolve to the later value). */
export function sampleTrace(pts: [number, number][], t: number): number {
  let v = pts[0][1]
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    if (x > t) {
      const [x0, y0] = pts[i - 1] ?? pts[i]
      return x === x0 ? y0 : y0 + ((y - y0) * (t - x0)) / (x - x0)
    }
    v = y
  }
  return v
}

// ---------------------------------------------------------------- inverse design

export interface DesignOptions {
  series: SeriesName
  capSeries: SeriesName
  /** Fixed capacitor in farads, or undefined to search `capSeries` values. */
  cFixed?: number
  rMin: number
  rMax: number
  cMin: number
  cMax: number
  count: number
}

export interface AstableDesign {
  r1: number
  r2: number
  c: number
  freq: number
  duty: number
  errFreq: number
  errDuty: number
}

export interface MonostableDesign {
  r: number
  c: number
  width: number
  err: number
}

/** The k series values nearest (below and above) to x in a sorted list. */
function around(vals: number[], x: number, k = 3): number[] {
  if (vals.length === 0) return []
  let i = vals.findIndex((v) => v >= x)
  if (i < 0) i = vals.length
  return vals.slice(Math.max(0, i - k), Math.min(vals.length, i + k))
}

function capacitors(o: DesignOptions): number[] {
  return o.cFixed ? [o.cFixed] : seriesValues(o.capSeries, o.cMin, o.cMax)
}

/** Best E-series resistor/capacitor combinations for a target frequency and duty cycle. */
export function designAstable(target: { freq: number; duty: number }, base: Pick<AstableParams, 'vcc' | 'diode' | 'vf'>, o: DesignOptions): AstableDesign[] {
  const period = 1 / target.freq
  const tHigh = period * target.duty
  const tLow = period - tHigh
  const rs = seriesValues(o.series, o.rMin, o.rMax)
  const kH = base.diode ? chargeLog(1 - base.vf / base.vcc) : LN2
  const found: AstableDesign[] = []
  for (const c of capacitors(o)) {
    const r2i = tLow / (LN2 * c)
    const r1i = base.diode ? tHigh / (kH * c) : tHigh / (LN2 * c) - r2i
    const c1 = r1i > 0 ? around(rs, r1i) : rs.slice(0, 3)
    const c2 = around(rs, r2i)
    for (const r1 of c1) for (const r2 of c2) {
      const r = astable({ ...base, r1, r2, c })
      if (!Number.isFinite(r.freq)) continue
      found.push({ r1, r2, c, freq: r.freq, duty: r.duty, errFreq: r.freq / target.freq - 1, errDuty: r.duty - target.duty })
    }
  }
  // Rank by worst relative error, then prefer mid-range resistor values (about 10 kΩ).
  const score = (d: AstableDesign) => Math.max(Math.abs(d.errFreq), Math.abs(d.errDuty / target.duty))
  const tie = (d: AstableDesign) => Math.abs(Math.log10(d.r2 / 1e4)) + Math.abs(Math.log10(d.r1 / 1e4))
  found.sort((x, y) => Math.round(score(x) * 1e4) - Math.round(score(y) * 1e4) || tie(x) - tie(y))
  return found.slice(0, o.count)
}

export function designMonostable(targetWidth: number, o: DesignOptions): MonostableDesign[] {
  const rs = seriesValues(o.series, o.rMin, o.rMax)
  const found: MonostableDesign[] = []
  for (const c of capacitors(o)) {
    const ri = targetWidth / (LN3 * c)
    for (const r of around(rs, ri, 2)) {
      const width = monostable({ r, c, vcc: 5 }).width
      found.push({ r, c, width, err: width / targetWidth - 1 })
    }
  }
  const tie = (d: MonostableDesign) => Math.abs(Math.log10(d.r / 1e5))
  found.sort((x, y) => Math.round(Math.abs(x.err) * 1e4) - Math.round(Math.abs(y.err) * 1e4) || tie(x) - tie(y))
  return found.slice(0, o.count)
}

export { nearest }

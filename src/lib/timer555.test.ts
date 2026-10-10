import { describe, expect, it } from 'vitest'
import {
  astable, astableTolerance, astableWaveform, bistableWaveform, checkLimits, designAstable, designMonostable, LN2, LN3,
  monostable, monostableWaveform, sampleTrace, thresholds,
} from './timer555'

const base = { vcc: 5, diode: false, vf: 0 }
const opts = { series: 'E24' as const, capSeries: 'E6' as const, rMin: 1e3, rMax: 10e6, cMin: 100e-12, cMax: 100e-6, count: 8 }

describe('astable', () => {
  it('matches the textbook formulas', () => {
    const r = astable({ ...base, r1: 1e3, r2: 10e3, c: 10e-9 })
    expect(r.freq).toBeCloseTo(1 / (LN2 * 21e3 * 10e-9), 6)
    expect(r.freq).toBeCloseTo(6870, 0) // ≈ 1.44 / ((R1 + 2 R2) C)
    expect(r.tHigh).toBeCloseTo(LN2 * 11e3 * 10e-9, 12)
    expect(r.tLow).toBeCloseTo(LN2 * 10e3 * 10e-9, 12)
    expect(r.duty).toBeCloseTo(11 / 21, 12)
  })
  it('standard circuit never goes below 50 % duty', () => {
    expect(astable({ ...base, r1: 1, r2: 1e6, c: 1e-9 }).duty).toBeGreaterThan(0.5)
  })
  it('diode steering gives duty R1/(R1+R2) when ideal', () => {
    const r = astable({ ...base, diode: true, r1: 3e3, r2: 7e3, c: 1e-6 })
    expect(r.duty).toBeCloseTo(0.3, 9)
    expect(r.tHigh).toBeCloseTo(LN2 * 3e3 * 1e-6, 12)
  })
  it('diode drop lengthens the high time', () => {
    const ideal = astable({ ...base, diode: true, r1: 3e3, r2: 7e3, c: 1e-6 })
    const real = astable({ ...base, diode: true, vf: 0.6, r1: 3e3, r2: 7e3, c: 1e-6 })
    expect(real.tHigh).toBeGreaterThan(ideal.tHigh)
    // exact: R1 C ln((Vcc-Vf-Vcc/3)/(Vcc-Vf-2Vcc/3))
    expect(real.tHigh).toBeCloseTo(3e3 * 1e-6 * Math.log((5 - 0.6 - 5 / 3) / (5 - 0.6 - 10 / 3)), 12)
  })
  it('flags impossible diode drops', () => {
    expect(astable({ ...base, diode: true, vf: 2, r1: 1e3, r2: 1e3, c: 1e-6 }).period).toBeNaN()
  })
  it('tolerance range brackets nominal', () => {
    const t = astableTolerance({ ...base, r1: 1e3, r2: 10e3, c: 10e-9 }, 0.01, 0.05)
    expect(t.freq.min).toBeLessThan(t.freq.nom)
    expect(t.freq.max).toBeGreaterThan(t.freq.nom)
    // frequency ∝ 1/(R C): worst case about ±(1% + 5%)
    expect(t.freq.max / t.freq.nom).toBeCloseTo(1 / (0.99 * 0.95), 2)
  })
})

describe('monostable', () => {
  it('T = 1.1 R C', () => {
    expect(monostable({ r: 100e3, c: 10e-6, vcc: 5 }).width).toBeCloseTo(1.0986, 4)
    expect(monostable({ r: 10e3, c: 100e-9, vcc: 5 }).width).toBeCloseTo(LN3 * 1e-3, 12)
  })
})

describe('thresholds', () => {
  it('are 1/3 and 2/3 Vcc', () => {
    expect(thresholds(9)).toEqual({ trigger: 3, threshold: 6 })
  })
})

describe('waveforms', () => {
  const p = { ...base, r1: 1e3, r2: 10e3, c: 10e-6 }
  it('astable start-up and cycle timing', () => {
    const w = astableWaveform(p, 3)
    const out = w.traces.find((t) => t.id === 'out')!.pts
    const vc = w.traces.find((t) => t.id === 'vc')!.pts
    const r = astable(p)
    const first = (p.r1 + p.r2) * p.c * LN3 // 0 → 2/3 Vcc through R1+R2
    expect(sampleTrace(out, first * 0.99)).toBe(5)
    expect(sampleTrace(out, first + r.tLow * 0.5)).toBe(0)
    expect(sampleTrace(vc, first)).toBeCloseTo((2 * 5) / 3, 2)
    expect(sampleTrace(vc, first + r.tLow)).toBeCloseTo(5 / 3, 2)
    expect(w.tEnd).toBeCloseTo(first + 3 * r.period, 9)
    // capacitor stays between 1/3 and 2/3 Vcc after start-up
    for (const [t, v] of vc) if (t >= first) { expect(v).toBeGreaterThan(5 / 3 - 1e-6); expect(v).toBeLessThan(10 / 3 + 1e-6) }
  })
  it('monostable ignores the retrigger', () => {
    const q = { r: 100e3, c: 10e-6, vcc: 5 }
    const w = monostableWaveform(q)
    const out = w.traces.find((t) => t.id === 'out')!.pts
    const T = monostable(q).width
    expect(sampleTrace(out, 0.1 * T)).toBe(0)
    expect(sampleTrace(out, 0.5 * T)).toBe(5)
    expect(sampleTrace(out, 0.7 * T)).toBe(5) // 2nd trigger at 0.6T does not extend it
    expect(sampleTrace(out, 1.2 * T)).toBe(0)
    expect(sampleTrace(out, 2.0 * T)).toBe(5)
    const vc = w.traces.find((t) => t.id === 'vc')!.pts
    expect(sampleTrace(vc, 0.15 * T + T * 0.999)).toBeCloseTo((2 * 5) / 3, 1)
  })
  it('bistable latches', () => {
    const w = bistableWaveform(5)
    const out = w.traces.find((t) => t.id === 'out')!.pts
    expect(sampleTrace(out, 0.5)).toBe(0)
    expect(sampleTrace(out, 3.5)).toBe(5)
    expect(sampleTrace(out, 5)).toBe(0)
    expect(sampleTrace(out, 7)).toBe(5)
    expect(sampleTrace(out, 9)).toBe(0)
  })
})

describe('inverse design', () => {
  it('finds a 1 kHz / 50 % diode design within 1 %', () => {
    const d = designAstable({ freq: 1000, duty: 0.5 }, { vcc: 5, diode: true, vf: 0 }, opts)
    expect(d.length).toBeGreaterThan(3)
    expect(Math.abs(d[0].errFreq)).toBeLessThan(0.01)
    expect(Math.abs(d[0].errDuty)).toBeLessThan(0.005)
    for (const x of d) expect(x.r1).toBeGreaterThanOrEqual(1e3)
  })
  it('standard circuit design for 60 % duty hits both targets', () => {
    const d = designAstable({ freq: 2000, duty: 0.6 }, base, opts)
    const r = astable({ ...base, r1: d[0].r1, r2: d[0].r2, c: d[0].c })
    expect(r.freq / 2000).toBeCloseTo(1, 1)
    expect(r.duty).toBeCloseTo(0.6, 1)
  })
  it('standard circuit cannot reach 30 % duty (large error reported)', () => {
    const d = designAstable({ freq: 1000, duty: 0.3 }, base, opts)
    expect(d[0].duty).toBeGreaterThan(0.5)
    expect(Math.abs(d[0].errDuty)).toBeGreaterThan(0.15)
  })
  it('honours a fixed capacitor', () => {
    const d = designAstable({ freq: 100, duty: 0.7 }, base, { ...opts, cFixed: 1e-6 })
    expect(new Set(d.map((x) => x.c))).toEqual(new Set([1e-6]))
  })
  it('designs a monostable', () => {
    const d = designMonostable(1, { ...opts, series: 'E96' })
    expect(Math.abs(d[0].err)).toBeLessThan(0.01)
    expect(d[0].width).toBeCloseTo(LN3 * d[0].r * d[0].c, 12)
  })
})

describe('limits', () => {
  it('warns about supply, frequency and small resistors', () => {
    const r = astable({ ...base, r1: 500, r2: 500, c: 100e-12 })
    const w = checkLimits('bipolar', 'astable', 3, { r1: 500, r2: 500, c: 100e-12 }, r)
    const msgs = w.map((x) => x.msg).join('|')
    expect(msgs).toMatch(/outside/)
    expect(msgs).toMatch(/below 1 kΩ/)
    expect(msgs).toMatch(/above the typical limit/)
  })
  it('CMOS accepts 3 V and higher frequency', () => {
    const parts = { r1: 1e3, r2: 1e3, c: 330e-12 }
    const r = astable({ ...base, ...parts })
    expect(r.freq).toBeGreaterThan(500e3)
    expect(checkLimits('bipolar', 'astable', 5, parts, r).map((x) => x.msg).join()).toMatch(/above the typical limit/)
    expect(checkLimits('cmos', 'astable', 3, parts, r)).toHaveLength(0)
  })
})

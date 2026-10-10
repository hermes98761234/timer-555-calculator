import { describe, expect, it } from 'vitest'
import { fmtEng, parseEng } from './format'

describe('format', () => {
  it('parses engineering notation', () => {
    expect(parseEng('4.7k')).toBe(4700)
    expect(parseEng('100n')).toBeCloseTo(1e-7, 20)
    expect(parseEng('10uF')).toBeCloseTo(1e-5, 20)
    expect(parseEng('10 µF')).toBeCloseTo(1e-5, 20)
    expect(parseEng('2.2meg')).toBe(2.2e6)
    expect(parseEng('1M')).toBe(1e6)
    expect(parseEng('470')).toBe(470)
    expect(parseEng('1e-6')).toBe(1e-6)
    expect(parseEng('1,5k')).toBe(1500)
    expect(parseEng('1 kHz')).toBe(1000)
    expect(parseEng('20ms')).toBeCloseTo(0.02, 12)
    expect(parseEng('abc')).toBeNaN()
    expect(parseEng('')).toBeNaN()
    expect(parseEng('5x')).toBeNaN()
  })
  it('formats with SI prefixes', () => {
    expect(fmtEng(4700, 'Ω')).toBe('4.7 kΩ')
    expect(fmtEng(1.5e-6, 'F')).toBe('1.5 µF')
    expect(fmtEng(0.0011, 's')).toBe('1.1 ms')
    expect(fmtEng(1, 'Hz')).toBe('1 Hz')
    expect(fmtEng(999.9, 'Hz')).toBe('1 kHz')
    expect(fmtEng(NaN, 'Hz')).toBe('—')
  })
})

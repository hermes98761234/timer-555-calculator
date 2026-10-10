import { describe, expect, it } from 'vitest'
import { mantissas, nearest, seriesValues, SERIES_NAMES } from './eseries'

describe('E-series', () => {
  it('has the right number of values per decade', () => {
    const n = { E3: 3, E6: 6, E12: 12, E24: 24, E48: 48, E96: 96, E192: 192 }
    for (const s of SERIES_NAMES) expect(mantissas(s)).toHaveLength(n[s])
  })
  it('matches known E96 / E48 / E192 entries', () => {
    const e96 = mantissas('E96')
    expect(e96.slice(0, 6)).toEqual([1.0, 1.02, 1.05, 1.07, 1.1, 1.13])
    expect(e96).toContain(5.62)
    expect(e96[95]).toBe(9.76)
    expect(mantissas('E48').slice(0, 4)).toEqual([1.0, 1.05, 1.1, 1.15])
    expect(mantissas('E192')[1]).toBe(1.01)
    expect(mantissas('E192')[191]).toBe(9.88)
  })
  it('lists values across decades', () => {
    expect(seriesValues('E12', 1000, 10000)).toEqual([1000, 1200, 1500, 1800, 2200, 2700, 3300, 3900, 4700, 5600, 6800, 8200, 10000])
    expect(seriesValues('E6', 1e-10, 1e-9)).toEqual([1e-10, 1.5e-10, 2.2e-10, 3.3e-10, 4.7e-10, 6.8e-10, 1e-9])
  })
  it('finds the nearest value', () => {
    expect(nearest('E12', 4000)).toBe(3900)
    expect(nearest('E24', 5000)).toBe(5100)
    expect(nearest('E6', 9000)).toBe(10000)
    expect(nearest('E96', 123456)).toBe(124000)
  })
})

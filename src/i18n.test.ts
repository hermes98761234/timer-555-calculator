import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { tr, UK } from './i18n'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const sources = [read('./App.tsx'), read('./components/WaveformView.tsx'), read('./lib/timer555.ts')]

function literals(re: RegExp): string[] {
  return sources.flatMap((src) => [...src.matchAll(re)].map((m) => m[1].replace(/\\'/g, "'")))
}

describe('i18n', () => {
  it('translates every literal passed to t() and every message/label/preset', () => {
    const keys = [
      ...literals(/\bt\('((?:[^'\\]|\\.)*)'/g),
      ...literals(/msg: '((?:[^'\\]|\\.)*)'/g),
      ...literals(/label: '((?:[^'\\]|\\.)*)'/g),
      ...literals(/name: '((?:[^'\\]|\\.)*)'/g),
    ]
    expect(keys.length).toBeGreaterThan(60)
    const missing = [...new Set(keys)].filter((k) => !(k in UK))
    expect(missing).toEqual([])
  })
  it('keeps placeholders consistent', () => {
    for (const [en, uk] of Object.entries(UK)) {
      const ph = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join()
      expect(ph(uk), en).toBe(ph(en))
    }
  })
  it('interpolates', () => {
    expect(tr('en', 'Closest {0} parts for a {1} pulse', 'E24', '1 s')).toBe('Closest E24 parts for a 1 s pulse')
    expect(tr('uk', 'Use')).toBe('Взяти')
    expect(tr('uk', 'unknown {0}', 5)).toBe('unknown 5')
  })
})

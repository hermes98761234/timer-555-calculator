import { useEffect, useRef, useState } from 'react'
import { fmtEng } from '../lib/format'
import { sampleTrace, type Waveform } from '../lib/timer555'
import type { T } from '../i18n'

interface Props {
  wave: Waveform
  vcc: number
  t: T
}

const W = 720
const LANE = 84
const PAD_L = 14
const PAD_R = 14
const COLORS: Record<string, string> = { trig: '#d97706', thr: '#9333ea', vc: '#2563eb', out: '#16a34a' }
const LOOP_SECONDS = 9

export function WaveformView({ wave, vcc, t }: Props) {
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [phase, setPhase] = useState(0.35)
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) {
      last.current = null
      return
    }
    let id = 0
    const tick = (now: number) => {
      if (last.current !== null) setPhase((p) => (p + (now - last.current!) / 1000 / LOOP_SECONDS) % 1)
      last.current = now
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing])

  const H = wave.traces.length * LANE + 26
  const x = (time: number) => PAD_L + (time / wave.tEnd) * (W - PAD_L - PAD_R)
  const y = (lane: number, v: number) => lane * LANE + 12 + (1 - v / vcc) * (LANE - 30)
  const now = phase * wave.tEnd
  const unit = wave.arbitrary ? '' : 's'
  const out = wave.traces.find((tr) => tr.id === 'out')
  const high = out ? sampleTrace(out.pts, now) > vcc / 2 : false

  return (
    <div className="wave">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Animated timing diagram')} fontSize={11} fontFamily="system-ui, sans-serif">
        {wave.traces.map((tr, lane) => {
          const d = tr.pts.map(([tt, v], i) => `${i ? 'L' : 'M'}${x(tt).toFixed(1)} ${y(lane, v).toFixed(1)}`).join('')
          const v = sampleTrace(tr.pts, now)
          return (
            <g key={tr.id}>
              <rect x={PAD_L} y={lane * LANE + 4} width={W - PAD_L - PAD_R} height={LANE - 8} fill="var(--chart-bg)" stroke="var(--line)" rx={3} />
              {[1 / 3, 2 / 3].map((f) => (
                <line key={f} x1={PAD_L} x2={W - PAD_R} y1={y(lane, f * vcc)} y2={y(lane, f * vcc)} stroke="var(--grid-strong)" strokeDasharray="3 4" />
              ))}
              <path d={d} fill="none" stroke={COLORS[tr.id]} strokeWidth={2} strokeLinejoin="round" />
              <circle cx={x(now)} cy={y(lane, v)} r={4} fill={COLORS[tr.id]} />
              <text x={PAD_L + 6} y={lane * LANE + 20} fill="var(--chart-fg)">{t(tr.label)}: {v.toFixed(2)} V</text>
              {tr.id === 'vc' && (
                <g fill="var(--muted)" fontSize={10} textAnchor="end">
                  <text x={W - PAD_R - 4} y={y(lane, (2 / 3) * vcc) - 3}>⅔ Vcc</text>
                  <text x={W - PAD_R - 4} y={y(lane, vcc / 3) - 3}>⅓ Vcc</text>
                </g>
              )}
            </g>
          )
        })}
        <line x1={x(now)} x2={x(now)} y1={4} y2={wave.traces.length * LANE - 4} stroke="var(--fg)" strokeWidth={1} opacity={0.6} />
        <text x={PAD_L} y={H - 6} fill="var(--chart-fg)">0</text>
        <text x={W - PAD_R} y={H - 6} fill="var(--chart-fg)" textAnchor="end">{wave.arbitrary ? t('time (arbitrary units)') : fmtEng(wave.tEnd, unit)}</text>
        <text x={x(now)} y={H - 6} fill="var(--fg)" textAnchor="middle">{wave.arbitrary ? '' : fmtEng(now, unit)}</text>
      </svg>
      <div className="wave-bar">
        <button onClick={() => setPlaying((p) => !p)}>{playing ? t('Pause') : t('Play')}</button>
        <input
          type="range" min={0} max={1000} value={Math.round(phase * 1000)} aria-label={t('Time position')}
          onChange={(e) => { setPlaying(false); setPhase(+e.target.value / 1000) }}
        />
        <span className={`led ${high ? 'on' : ''}`} role="img" aria-label={high ? t('Output high') : t('Output low')} />
        <span className="muted">{high ? t('Output high') : t('Output low')}</span>
      </div>
    </div>
  )
}

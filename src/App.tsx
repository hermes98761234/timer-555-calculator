import { useEffect, useMemo, useState } from 'react'
import { Schematic } from './components/Schematic'
import { WaveformView } from './components/WaveformView'
import { tr, type Lang, type T } from './i18n'
import { nearest, SERIES_NAMES, type SeriesName } from './lib/eseries'
import { fmtEng, fmtPct, parseEng } from './lib/format'
import {
  astable, astableTolerance, astableWaveform, bistableWaveform, checkLimits, designAstable, designMonostable, monostable,
  monostableTolerance, monostableWaveform, thresholds, VARIANTS, type Mode, type Variant,
} from './lib/timer555'

const REPO = 'https://github.com/hermes98761234/timer-555-calculator'

interface State {
  mode: Mode
  variant: Variant
  vcc: string
  r1: string
  r2: string
  c: string
  diode: boolean
  vf: string
  rm: string
  cm: string
  tolR: string
  tolC: string
  series: SeriesName
  capSeries: SeriesName
  tFreq: string
  tDuty: string
  tWidth: string
  cFix: string
}
interface Prefs {
  lang: Lang
  theme: 'system' | 'light' | 'dark'
}

const DEFAULT: State = {
  mode: 'astable', variant: 'bipolar', vcc: '5', r1: '1k', r2: '47k', c: '10u', diode: false, vf: '0.6', rm: '100k', cm: '10u',
  tolR: '1', tolC: '5', series: 'E24', capSeries: 'E6', tFreq: '1k', tDuty: '60', tWidth: '1', cFix: '',
}
const DEFAULT_PREFS: Prefs = { lang: navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en', theme: 'system' }

const PRESETS: { name: string; patch: Partial<State> }[] = [
  { name: 'LED flasher, about 1.5 Hz', patch: { mode: 'astable', diode: false, vcc: '5', r1: '1k', r2: '47k', c: '10u' } },
  { name: 'Audio tone, 1 kHz', patch: { mode: 'astable', diode: false, vcc: '5', r1: '1k', r2: '6.8k', c: '100n' } },
  { name: 'Square wave 50 % with diode', patch: { mode: 'astable', diode: true, vf: '0.6', vcc: '9', r1: '10k', r2: '10k', c: '100n' } },
  { name: 'Servo pulse 1.5 ms (monostable)', patch: { mode: 'monostable', vcc: '5', rm: '13.6k', cm: '100n' } },
  { name: 'One-second delay (monostable)', patch: { mode: 'monostable', vcc: '5', rm: '100k', cm: '10u' } },
  { name: 'Set/reset latch (bistable)', patch: { mode: 'bistable', vcc: '5' } },
]

function useStored<V>(key: string, init: V): [V, (f: (v: V) => V) => void] {
  const [v, setV] = useState<V>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...init, ...JSON.parse(raw) } : init
    } catch {
      return init
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage unavailable */ }
  }, [key, v])
  return [v, (f) => setV(f)]
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; unit: string; hint?: string; snap?: () => void; snapTitle?: string; t: T; optional?: boolean }) {
  const n = parseEng(props.value)
  const bad = !(n > 0) && !(props.optional && (props.value.trim() === '' || n === 0))
  return (
    <div className="field">
      <label>{props.label}</label>
      <div className="row">
        <input
          type="text" inputMode="text" value={props.value} className={bad ? 'bad' : ''} spellCheck={false} aria-invalid={bad}
          onChange={(e) => props.onChange(e.target.value)}
        />
        <span className="unit">{props.unit}</span>
        {props.snap && <button className="small" title={props.snapTitle} onClick={props.snap}>{props.t('Snap')}</button>}
      </div>
      {bad ? <div className="err">{props.t('Enter a positive number, e.g. 4.7k or 100n.')}</div> : props.hint ? <div className="muted small-text">{props.hint}</div> : null}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-l">{label}</div>
      <div className="stat-v">{value}</div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  )
}

export default function App() {
  const [s, setS] = useStored<State>('timer555.state.v1', DEFAULT)
  const [prefs, setPrefs] = useStored<Prefs>('timer555.prefs.v1', DEFAULT_PREFS)
  const lang = prefs.lang
  const t: T = (str, ...a) => tr(lang, str, ...a)
  const set = (patch: Partial<State>) => setS((p) => ({ ...p, ...patch }))

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('555 Timer Calculator: astable, monostable, bistable')
    if (prefs.theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = prefs.theme
  })

  const vcc = parseEng(s.vcc)
  const r1 = parseEng(s.r1)
  const r2 = parseEng(s.r2)
  const c = parseEng(s.c)
  const rm = parseEng(s.rm)
  const cm = parseEng(s.cm)
  const vf = s.vf === '' ? 0 : parseEng(s.vf)
  const tolR = Math.max(0, Number(s.tolR) || 0) / 100
  const tolC = Math.max(0, Number(s.tolC) || 0) / 100
  const okVcc = vcc > 0
  const fmt = (v: number, u: string) => fmtEng(v, u)

  const astOK = okVcc && r1 > 0 && r2 > 0 && c > 0 && vf >= 0
  const astP = { r1, r2, c, vcc, diode: s.diode, vf }
  const ast = useMemo(() => (astOK ? astable(astP) : null), [astOK, r1, r2, c, vcc, s.diode, vf]) // eslint-disable-line
  const astTol = useMemo(() => (ast && Number.isFinite(ast.period) ? astableTolerance(astP, tolR, tolC) : null), [ast, tolR, tolC]) // eslint-disable-line
  const monoOK = okVcc && rm > 0 && cm > 0
  const mono = monoOK ? monostable({ r: rm, c: cm, vcc }) : null
  const monoTol = mono ? monostableTolerance({ r: rm, c: cm, vcc }, tolR, tolC) : null

  const wave = useMemo(() => {
    if (!okVcc) return null
    if (s.mode === 'astable') return ast && Number.isFinite(ast.period) ? astableWaveform(astP) : null
    if (s.mode === 'monostable') return mono ? monostableWaveform({ r: rm, c: cm, vcc }) : null
    return bistableWaveform(vcc)
  }, [s.mode, okVcc, ast, mono, rm, cm, vcc]) // eslint-disable-line

  const warnings = useMemo(() => {
    if (!okVcc) return []
    if (s.mode === 'astable') return astOK ? checkLimits(s.variant, 'astable', vcc, { r1, r2, c }, ast ?? undefined, fmt) : []
    if (s.mode === 'monostable') return monoOK ? checkLimits(s.variant, 'monostable', vcc, { r1: rm, c: cm }, undefined, fmt) : []
    return checkLimits(s.variant, 'bistable', vcc, {}, undefined, fmt)
  }, [s.mode, s.variant, okVcc, astOK, monoOK, vcc, r1, r2, c, rm, cm, ast]) // eslint-disable-line

  // inverse design
  const tFreq = parseEng(s.tFreq)
  const tDuty = Number(s.tDuty) / 100
  const tWidth = parseEng(s.tWidth)
  const cFix = s.cFix.trim() === '' ? undefined : parseEng(s.cFix)
  const designOpts = { series: s.series, capSeries: s.capSeries, cFixed: cFix && cFix > 0 ? cFix : undefined, rMin: 1e3, rMax: VARIANTS[s.variant].rMax, cMin: 100e-12, cMax: 100e-6, count: 8 }
  const astDesigns = useMemo(
    () => (s.mode === 'astable' && tFreq > 0 && tDuty > 0 && tDuty < 1 && okVcc && vf >= 0 && (cFix === undefined || cFix > 0)
      ? designAstable({ freq: tFreq, duty: tDuty }, { vcc, diode: s.diode, vf }, designOpts) : []),
    [s.mode, tFreq, tDuty, okVcc, vcc, s.diode, vf, s.series, s.capSeries, cFix, s.variant], // eslint-disable-line
  )
  const monoDesigns = useMemo(
    () => (s.mode === 'monostable' && tWidth > 0 && (cFix === undefined || cFix > 0) ? designMonostable(tWidth, designOpts) : []),
    [s.mode, tWidth, s.series, s.capSeries, cFix, s.variant], // eslint-disable-line
  )

  const th = okVcc ? thresholds(vcc) : null
  const vi = VARIANTS[s.variant]
  const snapR = (v: string) => { const n = parseEng(v); return n > 0 ? String(nearest(s.series, n)) : v }
  const snapC = (v: string) => { const n = parseEng(v); return n > 0 ? String(nearest(s.capSeries, n)) : v }
  const eng = (n: number) => String(Number(n.toPrecision(6)))

  const modes: [Mode, string][] = [['astable', t('Astable')], ['monostable', t('Monostable')], ['bistable', t('Bistable')]]
  const warnTexts = warnings.map((w) => tr(lang, w.msg, ...w.args))
  const snapTitle = t('Round to the nearest {0} value', s.series)

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('555 Timer Calculator')}</span>
        <span className="muted tagline">{t('Astable, monostable and bistable: frequency, duty, pulse width and E-series part picking.')}</span>
        <span className="spacer" />
        <label>{t('Language')}
          <select value={lang} onChange={(e) => setPrefs((p) => ({ ...p, lang: e.target.value as Lang }))}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
        <label>{t('Theme')}
          <select value={prefs.theme} onChange={(e) => setPrefs((p) => ({ ...p, theme: e.target.value as Prefs['theme'] }))}>
            <option value="system">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
      </header>

      <div className="body">
        <aside className="side">
          <div className="panel">
            <div className="section">
              <h3>{t('Mode')}</h3>
              <div className="tabs" role="tablist">
                {modes.map(([m, label]) => (
                  <button key={m} role="tab" aria-selected={s.mode === m} className={s.mode === m ? 'active' : ''} onClick={() => set({ mode: m })}>{label}</button>
                ))}
              </div>
              <div className="field">
                <label>{t('Examples')}</label>
                <select value="" onChange={(e) => { const p = PRESETS[+e.target.value]; if (p) set(p.patch) }}>
                  <option value="">{t('Load an example…')}</option>
                  {PRESETS.map((p, i) => <option key={p.name} value={i}>{t(p.name)}</option>)}
                </select>
              </div>
            </div>

            <div className="section">
              <h3>{t('Circuit')}</h3>
              <div className="field">
                <label>{t('Chip')}</label>
                <select value={s.variant} onChange={(e) => set({ variant: e.target.value as Variant })}>
                  <option value="bipolar">{t('NE555 / LM555 (bipolar)')}</option>
                  <option value="cmos">{t('TLC555 / LMC555 / ICM7555 (CMOS)')}</option>
                </select>
              </div>
              <Field t={t} label={t('Supply voltage Vcc')} unit="V" value={s.vcc} onChange={(v) => set({ vcc: v })} />
              {s.mode === 'astable' && (
                <>
                  <Field t={t} label="R1" unit="Ω" value={s.r1} onChange={(v) => set({ r1: v })} snap={() => set({ r1: snapR(s.r1) })} snapTitle={snapTitle} />
                  <Field t={t} label="R2" unit="Ω" value={s.r2} onChange={(v) => set({ r2: v })} snap={() => set({ r2: snapR(s.r2) })} snapTitle={snapTitle} />
                  <Field t={t} label="C" unit="F" value={s.c} onChange={(v) => set({ c: v })} snap={() => set({ c: snapC(s.c) })} snapTitle={t('Round to the nearest {0} value', s.capSeries)} />
                  <label className="check">
                    <input type="checkbox" checked={s.diode} onChange={(e) => set({ diode: e.target.checked })} />
                    {t('Diode across R2 (duty below 50 %)')}
                  </label>
                  {s.diode && <Field t={t} optional label={t('Diode forward voltage')} unit="V" value={s.vf} onChange={(v) => set({ vf: v })} hint={t('0 = ideal diode. 0.6 V for a silicon 1N4148.')} />}
                </>
              )}
              {s.mode === 'monostable' && (
                <>
                  <Field t={t} label="R" unit="Ω" value={s.rm} onChange={(v) => set({ rm: v })} snap={() => set({ rm: snapR(s.rm) })} snapTitle={snapTitle} />
                  <Field t={t} label="C" unit="F" value={s.cm} onChange={(v) => set({ cm: v })} snap={() => set({ cm: snapC(s.cm) })} snapTitle={t('Round to the nearest {0} value', s.capSeries)} />
                </>
              )}
              {s.mode !== 'bistable' && (
                <div className="row2">
                  <div className="field"><label>{t('Resistor tolerance')}</label><div className="row"><input value={s.tolR} onChange={(e) => set({ tolR: e.target.value })} inputMode="decimal" /><span className="unit">%</span></div></div>
                  <div className="field"><label>{t('Capacitor tolerance')}</label><div className="row"><input value={s.tolC} onChange={(e) => set({ tolC: e.target.value })} inputMode="decimal" /><span className="unit">%</span></div></div>
                </div>
              )}
              <div className="row2">
                <div className="field"><label>{t('Resistor series')}</label><select value={s.series} onChange={(e) => set({ series: e.target.value as SeriesName })}>{SERIES_NAMES.map((n) => <option key={n}>{n}</option>)}</select></div>
                <div className="field"><label>{t('Capacitor series')}</label><select value={s.capSeries} onChange={(e) => set({ capSeries: e.target.value as SeriesName })}>{SERIES_NAMES.map((n) => <option key={n}>{n}</option>)}</select></div>
              </div>
            </div>

            {s.mode !== 'bistable' && (
              <div className="section">
                <h3>{t('Inverse design')}</h3>
                {s.mode === 'astable' ? (
                  <>
                    <Field t={t} label={t('Target frequency')} unit="Hz" value={s.tFreq} onChange={(v) => set({ tFreq: v })} />
                    <div className="field">
                      <label>{t('Target duty cycle')}</label>
                      <div className="row"><input value={s.tDuty} onChange={(e) => set({ tDuty: e.target.value })} inputMode="decimal" /><span className="unit">%</span></div>
                      {!s.diode && tDuty > 0 && tDuty <= 0.5 && <div className="warn small-text">{t('The standard circuit cannot go to 50 % or below. Tick the diode option.')}</div>}
                    </div>
                  </>
                ) : (
                  <Field t={t} label={t('Target pulse width')} unit="s" value={s.tWidth} onChange={(v) => set({ tWidth: v })} />
                )}
                <Field t={t} optional label={t('Fix the capacitor (optional)')} unit="F" value={s.cFix} onChange={(v) => set({ cFix: v })} hint={t('Leave empty to search all capacitor values from 100 pF to 100 µF.')} />
              </div>
            )}
          </div>
        </aside>

        <main className="main">
          {!okVcc && <div className="box warn">{t('Enter a positive supply voltage.')}</div>}

          <section className="box">
            <h3>{t('Result')}</h3>
            {s.mode === 'astable' && ast && (
              Number.isFinite(ast.period) ? (
                <>
                  <div className="stats">
                    <Stat label={t('Frequency')} value={fmt(ast.freq, 'Hz')} sub={astTol ? `${fmt(astTol.freq.min, 'Hz')} … ${fmt(astTol.freq.max, 'Hz')}` : undefined} />
                    <Stat label={t('Period')} value={fmt(ast.period, 's')} />
                    <Stat label={t('High time')} value={fmt(ast.tHigh, 's')} />
                    <Stat label={t('Low time')} value={fmt(ast.tLow, 's')} />
                    <Stat label={t('Duty cycle')} value={fmtPct(ast.duty)} sub={astTol ? `${fmtPct(astTol.duty.min)} … ${fmtPct(astTol.duty.max)}` : undefined} />
                  </div>
                  <p className="muted small-text">
                    {s.diode
                      ? t('High time = R1·C·ln2 (ideal diode), low time = R2·C·ln2. Duty = R1 / (R1 + R2).')
                      : t('f = 1 / (ln2 · (R1 + 2·R2) · C) ≈ 1.44 / ((R1 + 2·R2)·C). High time = ln2·(R1 + R2)·C, low time = ln2·R2·C.')}
                    {' '}{t('Gray ranges below the values are worst-case component tolerances.')}
                  </p>
                </>
              ) : <div className="warn">{t('The diode drop is too large for this supply: the capacitor never reaches 2/3 Vcc through the diode.')}</div>
            )}
            {s.mode === 'astable' && !ast && <div className="warn">{t('Fix the highlighted fields.')}</div>}
            {s.mode === 'monostable' && (mono && monoTol ? (
              <>
                <div className="stats">
                  <Stat label={t('Pulse width')} value={fmt(mono.width, 's')} sub={`${fmt(monoTol.min, 's')} … ${fmt(monoTol.max, 's')}`} />
                  <Stat label={t('Max trigger pulse')} value={`< ${fmt(mono.width, 's')}`} />
                  <Stat label={t('Trigger level')} value={th ? fmt(th.trigger, 'V') : '—'} sub={t('falling edge below Vcc/3')} />
                </div>
                <p className="muted small-text">{t('T = ln3 · R · C ≈ 1.1 · R · C. The output is high while the capacitor charges from 0 to 2/3 Vcc. A trigger during the pulse is ignored; the trigger must go high again before the pulse ends.')}</p>
              </>
            ) : <div className="warn">{t('Fix the highlighted fields.')}</div>)}
            {s.mode === 'bistable' && th && (
              <>
                <div className="stats">
                  <Stat label={t('Set: TRIG below')} value={fmt(th.trigger, 'V')} sub={t('output goes high')} />
                  <Stat label={t('Reset: THR above')} value={fmt(th.threshold, 'V')} sub={t('output goes low')} />
                  <Stat label={t('Hysteresis band')} value={fmt(th.threshold - th.trigger, 'V')} sub={t('output holds its state')} />
                </div>
                <p className="muted small-text">{t('No timing parts are needed: the chip is an SR latch. Pull TRIG low to set, pull THR high to reset (or pull RESET low to force the output low). Use the 10 kΩ resistors as pull-up and pull-down and add a 10 nF cap on CTRL.')}</p>
              </>
            )}
            {warnTexts.length > 0 && (
              <ul className="warns">{warnTexts.map((w) => <li key={w}>{w}</li>)}</ul>
            )}
          </section>

          {s.mode === 'astable' && astDesigns.length > 0 && (
            <section className="box">
              <h3>{t('Closest {0} parts for {1}, {2} duty', s.series, fmt(tFreq, 'Hz'), fmtPct(tDuty, 0))}</h3>
              <div className="tablewrap"><table>
                <thead><tr><th>R1</th><th>R2</th><th>C</th><th>{t('Frequency')}</th><th>{t('Error')}</th><th>{t('Duty cycle')}</th><th></th></tr></thead>
                <tbody>{astDesigns.map((d, i) => (
                  <tr key={i}>
                    <td>{fmt(d.r1, 'Ω')}</td><td>{fmt(d.r2, 'Ω')}</td><td>{fmt(d.c, 'F')}</td>
                    <td>{fmt(d.freq, 'Hz')}</td><td>{(d.errFreq * 100).toFixed(2)} %</td><td>{fmtPct(d.duty)}</td>
                    <td><button className="small" onClick={() => set({ r1: eng(d.r1), r2: eng(d.r2), c: eng(d.c) })}>{t('Use')}</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </section>
          )}
          {s.mode === 'monostable' && monoDesigns.length > 0 && (
            <section className="box">
              <h3>{t('Closest {0} parts for a {1} pulse', s.series, fmt(tWidth, 's'))}</h3>
              <div className="tablewrap"><table>
                <thead><tr><th>R</th><th>C</th><th>{t('Pulse width')}</th><th>{t('Error')}</th><th></th></tr></thead>
                <tbody>{monoDesigns.map((d, i) => (
                  <tr key={i}>
                    <td>{fmt(d.r, 'Ω')}</td><td>{fmt(d.c, 'F')}</td><td>{fmt(d.width, 's')}</td><td>{(d.err * 100).toFixed(2)} %</td>
                    <td><button className="small" onClick={() => set({ rm: eng(d.r), cm: eng(d.c) })}>{t('Use')}</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </section>
          )}

          <div className="two">
            <section className="box">
              <h3>{t('Waveforms')}</h3>
              {wave ? <WaveformView wave={wave} vcc={vcc} t={t} /> : <div className="muted">{t('Fix the highlighted fields.')}</div>}
            </section>
            <section className="box">
              <h3>{t('Schematic')}</h3>
              <Schematic
                mode={s.mode} diode={s.diode} vcc={okVcc ? String(vcc) : '?'} out={t('OUT')} title={t('Schematic of the 555 circuit')}
                r1={s.mode === 'monostable' ? (rm > 0 ? fmt(rm, 'Ω') : 'R') : r1 > 0 ? fmt(r1, 'Ω') : 'R1'}
                r2={r2 > 0 ? fmt(r2, 'Ω') : 'R2'}
                c={s.mode === 'monostable' ? (cm > 0 ? fmt(cm, 'F') : 'C') : c > 0 ? fmt(c, 'F') : 'C'}
              />
            </section>
          </div>

          <section className="box">
            <h3>{t('Bipolar and CMOS variants')}</h3>
            <div className="tablewrap"><table>
              <thead><tr><th></th><th className={s.variant === 'bipolar' ? 'cur' : ''}>NE555 / LM555</th><th className={s.variant === 'cmos' ? 'cur' : ''}>TLC555 / LMC555</th></tr></thead>
              <tbody>
                <tr><td>{t('Supply')}</td><td className={s.variant === 'bipolar' ? 'cur' : ''}>4.5–16 V</td><td className={s.variant === 'cmos' ? 'cur' : ''}>2–15 V</td></tr>
                <tr><td>{t('Max astable frequency')}</td><td className={s.variant === 'bipolar' ? 'cur' : ''}>~500 kHz</td><td className={s.variant === 'cmos' ? 'cur' : ''}>~2 MHz</td></tr>
                <tr><td>{t('Supply current')}</td><td className={s.variant === 'bipolar' ? 'cur' : ''}>{t('about 3–10 mA')}</td><td className={s.variant === 'cmos' ? 'cur' : ''}>{t('about 0.1–0.5 mA')}</td></tr>
                <tr><td>{t('Output drive')}</td><td className={s.variant === 'bipolar' ? 'cur' : ''}>{t('up to ~200 mA, high level about Vcc − 1.7 V')}</td><td className={s.variant === 'cmos' ? 'cur' : ''}>{t('tens of mA, near rail-to-rail')}</td></tr>
                <tr><td>{t('Timing resistors')}</td><td className={s.variant === 'bipolar' ? 'cur' : ''}>{t('1 kΩ … ~10 MΩ (bias current)')}</td><td className={s.variant === 'cmos' ? 'cur' : ''}>{t('1 kΩ … 100 MΩ (pA inputs)')}</td></tr>
                <tr><td>{t('Switching spikes')}</td><td className={s.variant === 'bipolar' ? 'cur' : ''}>{t('large supply spike: add 100 nF + bulk decoupling')}</td><td className={s.variant === 'cmos' ? 'cur' : ''}>{t('small spike, still decouple')}</td></tr>
              </tbody>
            </table></div>
            <p className="muted small-text">
              {t('Typical datasheet figures; check the part you buy. Using {0}: supply {1}–{2} V, usable up to about {3}.', s.variant === 'bipolar' ? 'NE555' : 'TLC555', vi.vccMin, vi.vccMax, fmt(vi.fMax, 'Hz'))}
            </p>
          </section>
        </main>
      </div>

      <footer className="footer">
        <span>{t('Everything runs in your browser. Results are ideal-component estimates: expect a few percent of error.')}</span>
        <a href={REPO} target="_blank" rel="noreferrer">{t('Source on GitHub')}</a>
      </footer>
    </div>
  )
}

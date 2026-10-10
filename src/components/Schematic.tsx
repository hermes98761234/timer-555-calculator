import type { Mode } from '../lib/timer555'

interface Props {
  mode: Mode
  diode: boolean
  r1: string
  r2: string
  c: string
  vcc: string
  /** Labels for the SVG, already translated. */
  out: string
  title: string
}

const S = { stroke: 'currentColor', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function W({ d }: { d: string }) {
  return <path d={d} {...S} />
}
function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3} fill="currentColor" />
}
/** Vertical resistor centred on x, body from y1 to y2. */
function ResV({ x, y1, y2, label, side = 'right' }: { x: number; y1: number; y2: number; label: string; side?: 'left' | 'right' }) {
  return (
    <g>
      <rect x={x - 6} y={y1} width={12} height={y2 - y1} {...S} />
      <text x={side === 'right' ? x + 12 : x - 12} y={(y1 + y2) / 2 + 4} textAnchor={side === 'right' ? 'start' : 'end'}>{label}</text>
    </g>
  )
}
/** Vertical capacitor between y1 (top) and y2 (bottom). */
function CapV({ x, y1, y2, label }: { x: number; y1: number; y2: number; label: string }) {
  const m = (y1 + y2) / 2
  return (
    <g>
      <W d={`M${x} ${y1}V${m - 5}M${x - 11} ${m - 5}H${x + 11}M${x - 11} ${m + 5}H${x + 11}M${x} ${m + 5}V${y2}`} />
      <text x={x + 16} y={m + 4}>{label}</text>
    </g>
  )
}
/** Vertical diode, anode on top, pointing down. */
function DiodeV({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const m = (y1 + y2) / 2
  return (
    <g>
      <W d={`M${x} ${y1}V${m - 8}M${x} ${m + 8}V${y2}M${x - 8} ${m + 8}H${x + 8}`} />
      <path d={`M${x - 8} ${m - 8}H${x + 8}L${x} ${m + 8}Z`} {...S} fill="currentColor" fillOpacity={0.25} />
      <text x={x - 14} y={m + 4} textAnchor="end">1N4148</text>
    </g>
  )
}

export function Schematic({ mode, diode, r1, r2, c, vcc, out, title }: Props) {
  const BX = 210
  const BR = 310
  const rail = 30
  const gnd = 370
  return (
    <svg viewBox="0 0 480 400" role="img" aria-label={title} className="schematic" fontSize={12} fontFamily="system-ui, sans-serif" fill="currentColor">
      {/* supply and ground rails */}
      <W d={`M60 ${rail}H440`} />
      <text x={64} y={rail - 8}>+{vcc} V</text>
      <W d={`M${mode === 'bistable' ? 90 : 110} ${gnd}H${mode === 'bistable' ? 300 : 410}`} />
      <text x={116} y={gnd + 16}>GND</text>

      {/* IC body */}
      <rect x={BX} y={90} width={BR - BX} height={160} rx={4} {...S} fill="var(--panel)" />
      <text x={(BX + BR) / 2} y={218} textAnchor="middle" fontWeight={700} fontSize={16}>555</text>
      <g fontSize={10} fill="var(--muted)">
        <text x={BX + 5} y={114}>4 RESET</text>
        <text x={BX + 5} y={154}>2 TRIG</text>
        <text x={BX + 5} y={194}>6 THR</text>
        <text x={BX + 5} y={234}>5 CTRL</text>
        <text x={BR - 5} y={134} textAnchor="end">OUT 3</text>
        <text x={BR - 5} y={194} textAnchor="end">DIS 7</text>
        <text x={(BX + BR) / 2 + 4} y={106}>8 VCC</text>
        <text x={(BX + BR) / 2 + 4} y={244}>1 GND</text>
      </g>

      {/* power pins, reset, control cap, output */}
      <W d={`M260 90V${rail}`} />
      <Dot x={260} y={rail} />
      <W d={`M${BX} 110H180V${rail}`} />
      <Dot x={180} y={rail} />
      <W d={`M260 250V${gnd}`} />
      <Dot x={260} y={gnd} />
      <W d={`M${BX} 230H110`} />
      <CapV x={110} y1={230} y2={gnd} label="10 nF" />
      <Dot x={110} y={gnd} />
      <W d={`M${BR} 130H340`} />
      <text x={346} y={134} fontWeight={700}>{out}</text>

      {mode === 'astable' && (
        <g>
          <W d={`M410 ${rail}V60`} />
          <ResV x={410} y1={60} y2={120} label={r1} side="left" />
          <W d={`M410 120V190`} />
          <W d={`M${BR} 190H410`} />
          <Dot x={410} y={190} />
          {diode ? (
            <g>
              <W d="M410 190V215" />
              <ResV x={410} y1={215} y2={275} label={r2} side="right" />
              <W d="M410 275V300H170" />
              <Dot x={410} y={200} />
              <W d="M410 200H355V215" />
              <DiodeV x={355} y1={215} y2={285} />
              <W d="M355 285V300" />
              <Dot x={355} y={300} />
            </g>
          ) : (
            <g>
              <W d="M410 190V215" />
              <ResV x={410} y1={215} y2={275} label={r2} side="right" />
              <W d="M410 275V300H170" />
            </g>
          )}
          <W d={`M${BX} 150H170V300`} />
          <W d={`M${BX} 190H170`} />
          <Dot x={170} y={190} />
          <Dot x={170} y={300} />
          <CapV x={170} y1={300} y2={gnd} label={c} />
          <Dot x={170} y={gnd} />
        </g>
      )}

      {mode === 'monostable' && (
        <g>
          <W d={`M410 ${rail}V60`} />
          <ResV x={410} y1={60} y2={120} label={r1} side="left" />
          <W d={`M410 120V300H170`} />
          <W d={`M${BR} 190H410`} />
          <Dot x={410} y={190} />
          <W d={`M${BX} 190H170V300`} />
          <Dot x={170} y={300} />
          <CapV x={170} y1={300} y2={gnd} label={c} />
          <Dot x={170} y={gnd} />
          {/* trigger input with pull-up */}
          <W d={`M${BX} 150H80`} />
          <W d={`M140 ${rail}V50`} />
          <ResV x={140} y1={50} y2={100} label="10 kΩ" side="left" />
          <W d={`M140 100V150`} />
          <Dot x={140} y={150} />
          <circle cx={80} cy={150} r={4} {...S} />
          <text x={80} y={138} textAnchor="middle">TRIG</text>
        </g>
      )}

      {mode === 'bistable' && (
        <g>
          <W d={`M${BX} 150H70`} />
          <W d={`M140 ${rail}V50`} />
          <ResV x={140} y1={50} y2={100} label="10 kΩ" side="left" />
          <W d="M140 100V150" />
          <Dot x={140} y={150} />
          <circle cx={70} cy={150} r={4} {...S} />
          <text x={70} y={138} textAnchor="middle">SET</text>
          <W d={`M${BX} 190H70`} />
          <W d={`M140 190V250`} />
          <ResV x={140} y1={250} y2={320} label="10 kΩ" side="left" />
          <W d={`M140 320V${gnd}`} />
          <Dot x={140} y={gnd} />
          <Dot x={140} y={190} />
          <circle cx={70} cy={190} r={4} {...S} />
          <text x={70} y={210} textAnchor="middle">RESET</text>
        </g>
      )}
    </svg>
  )
}

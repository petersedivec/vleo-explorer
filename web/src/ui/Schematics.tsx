// Simple, theme-aware schematic diagrams for each propulsion technology. Flow runs left to right:
// propellant store → where the energy goes in → exhaust. Shapes are illustrative, not to scale.

import type { ReactNode } from 'react'
import type { TechCard } from '../data/propulsion101'

const W = 360
const H = 130

function Tank({ x, label, sub }: { x: number; label: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={38} width={62} height={54} rx={22} className="s-tank" />
      <text x={x + 31} y={64} className="s-text" textAnchor="middle">
        {label}
      </text>
      {sub && (
        <text x={x + 31} y={78} className="s-small" textAnchor="middle">
          {sub}
        </text>
      )}
    </g>
  )
}

function Pipe({ x1, x2, y = 65 }: { x1: number; x2: number; y?: number }) {
  return <line x1={x1} y1={y} x2={x2} y2={y} className="s-line" markerEnd="url(#s-arrow)" />
}

function Plume({ x, kind, label }: { x: number; kind: 'gas' | 'hot' | 'ions' | 'plasma'; label: string }) {
  const cls = kind === 'ions' ? 's-ions' : kind === 'plasma' ? 's-plasma' : kind === 'hot' ? 's-hot' : 's-gas'
  const rays = [-26, -13, 0, 13, 26]
  return (
    <g>
      {rays.map((dy) => (
        <line key={dy} x1={x} y1={65 + dy * 0.35} x2={x + 46} y2={65 + dy} className={cls} />
      ))}
      <text x={x + 24} y={112} className="s-small" textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

function Label({ x, y = 22, children }: { x: number; y?: number; children: ReactNode }) {
  return (
    <text x={x} y={y} className="s-small" textAnchor="middle">
      {children}
    </text>
  )
}

function Nozzle({ x }: { x: number }) {
  return <path d={`M${x},55 L${x + 14},55 L${x + 30},40 L${x + 30},90 L${x + 14},75 L${x},75 Z`} className="s-part" />
}

const DIAGRAMS: Record<TechCard['id'], () => ReactNode> = {
  coldGas: () => (
    <>
      <Tank x={10} label="Gas" sub="high pressure" />
      <Pipe x1={72} x2={118} />
      <rect x={120} y={55} width={26} height={20} className="s-part" />
      <Label x={133} y={48}>
        valve
      </Label>
      <Pipe x1={146} x2={176} />
      <Nozzle x={178} />
      <Plume x={210} kind="gas" label="cold gas jet" />
    </>
  ),
  monoprop: () => (
    <>
      <Tank x={10} label="Liquid" sub="propellant" />
      <Pipe x1={72} x2={110} />
      <rect x={112} y={45} width={52} height={40} className="s-hotbox" />
      <text x={138} y={69} className="s-text" textAnchor="middle">
        catalyst
      </text>
      <Label x={138} y={36}>
        heated bed
      </Label>
      <Nozzle x={166} />
      <Plume x={198} kind="hot" label="hot gas" />
    </>
  ),
  electrospray: () => (
    <>
      <Tank x={10} label="Ionic" sub="liquid" />
      <Pipe x1={72} x2={104} />
      {[46, 60, 74, 88].map((y) => (
        <path key={y} d={`M106,${y - 6} L122,${y} L106,${y + 6} Z`} className="s-part" />
      ))}
      <Label x={114} y={112}>
        emitters (high voltage)
      </Label>
      <line x1={140} y1={36} x2={140} y2={96} className="s-grid" />
      <Label x={140} y={26}>
        extractor grid
      </Label>
      <Plume x={150} kind="ions" label="" />
      <text x={204} y={112} className="s-small" textAnchor="middle">
        ion beam
      </text>
    </>
  ),
  feep: () => (
    <>
      <Tank x={44} label="Indium" sub="built-in" />
      <path d="M106,52 L130,65 L106,78 Z" className="s-part" />
      <Label x={116} y={40}>
        needle
      </Label>
      <line x1={142} y1={36} x2={142} y2={96} className="s-grid" />
      <Plume x={152} kind="ions" label="metal ions" />
      <circle cx={230} cy={26} r={7} className="s-part" />
      <text x={242} y={30} className="s-small">
        neutraliser e⁻
      </text>
    </>
  ),
  griddedIon: () => (
    <>
      <Tank x={10} label="Xenon" sub="or iodine" />
      <Pipe x1={72} x2={98} />
      <rect x={100} y={38} width={60} height={54} rx={6} className="s-plasmabox" />
      <text x={130} y={69} className="s-text" textAnchor="middle">
        plasma
      </text>
      <Label x={130} y={30}>
        discharge chamber
      </Label>
      <line x1={164} y1={38} x2={164} y2={92} className="s-grid" />
      <line x1={170} y1={38} x2={170} y2={92} className="s-grid" />
      <Label x={162} y={112}>
        grids
      </Label>
      <Plume x={176} kind="ions" label="" />
      <text x={226} y={112} className="s-small" textAnchor="middle">
        ion beam
      </text>
      <circle cx={250} cy={26} r={7} className="s-part" />
      <text x={262} y={30} className="s-small">
        neutraliser e⁻
      </text>
    </>
  ),
  hall: () => <HallDiagram gas="Xenon" />,
  hallKrypton: () => <HallDiagram gas="Krypton" />,
  rfPlasma: () => (
    <>
      <Tank x={10} label="Gas" />
      <Pipe x1={72} x2={98} />
      <rect x={100} y={48} width={70} height={34} className="s-plasmabox" />
      {[108, 120, 132, 144, 156].map((x) => (
        <ellipse key={x} cx={x} cy={65} rx={4} ry={22} className="s-coil" />
      ))}
      <Label x={135} y={34}>
        RF antenna
      </Label>
      <rect x={170} y={40} width={10} height={50} className="s-part" />
      <Label x={175} y={104}>
        magnet
      </Label>
      <path d="M180,50 C205,46 220,30 245,22 M180,80 C205,84 220,100 245,108" className="s-field" />
      <Label x={222} y={124}>
        magnetic nozzle
      </Label>
      <Plume x={184} kind="plasma" label="" />
    </>
  ),
  airBreathing: () => (
    <>
      {[30, 50, 70, 90].map((y) => (
        <line key={y} x1={4} y1={y} x2={40} y2={y} className="s-gas" markerEnd="url(#s-arrow)" />
      ))}
      <Label x={22} y={18}>
        thin air
      </Label>
      <path d="M44,24 L110,50 L110,80 L44,106" className="s-part" fill="none" />
      <Label x={78} y={122}>
        intake
      </Label>
      <Pipe x1={110} x2={136} />
      <rect x={138} y={45} width={58} height={40} className="s-plasmabox" />
      <text x={167} y={69} className="s-text" textAnchor="middle">
        ioniser
      </text>
      <Plume x={198} kind="plasma" label="exhaust" />
    </>
  ),
}

function HallDiagram({ gas }: { gas: string }) {
  return (
    <>
      <Tank x={10} label={gas} />
      <Pipe x1={72} x2={98} />
      <rect x={100} y={34} width={66} height={18} className="s-part" />
      <rect x={100} y={78} width={66} height={18} className="s-part" />
      <text x={150} y={46} className="s-small" textAnchor="middle">
        magnet
      </text>
      <text x={150} y={90} className="s-small" textAnchor="middle">
        magnet
      </text>
      <rect x={100} y={52} width={10} height={26} className="s-part" />
      <Label x={106} y={112}>
        anode
      </Label>
      <rect x={110} y={52} width={56} height={26} className="s-plasmabox" />
      <text x={138} y={69} className="s-small" textAnchor="middle">
        channel
      </text>
      <Label x={133} y={22}>
        magnetic field traps e⁻
      </Label>
      <Plume x={168} kind="ions" label="ion beam" />
      <circle cx={252} cy={30} r={7} className="s-part" />
      <text x={264} y={34} className="s-small">
        cathode e⁻
      </text>
    </>
  )
}

export function Schematic({ id, name }: { id: TechCard['id']; name: string }) {
  return (
    <svg className="schematic" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Schematic of ${name}`}>
      <defs>
        <marker id="s-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" className="s-arrowhead" />
        </marker>
      </defs>
      {DIAGRAMS[id]()}
    </svg>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { evaluateSatellite, type SatelliteInputs } from './model/satellite'
import { Cards } from './ui/Cards'
import { KM } from './ui/common'
import { Controls } from './ui/Controls'
import { ExploreCharts } from './ui/ExploreCharts'
import { sig } from './ui/format'
import { INPUT_INFO, type InfoKey } from './ui/inputInfo'
import { decodeInputs, encodeInputs } from './ui/urlState'

type Tab = 'explore' | 'propulsion' | 'heritage'

const TABS: { id: Tab; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'heritage', label: 'Heritage missions' },
  { id: 'propulsion', label: 'Propulsion trade' },
]

function tabFromHash(hash: string): Tab {
  const tab = new URLSearchParams(hash.replace(/^#/, '')).get('tab')
  return TABS.some((t) => t.id === tab) ? (tab as Tab) : 'explore'
}

function Explore({ inputs, set }: { inputs: SatelliteInputs; set: (patch: Partial<SatelliteInputs>) => void }) {
  const [openInfo, setOpenInfo] = useState<InfoKey | null>(null)
  const result = useMemo(() => evaluateSatellite(inputs), [inputs])
  const highlight = useMemo(() => new Set(openInfo ? INPUT_INFO[openInfo].affects : []), [openInfo])

  return (
    <div className="layout">
      <Controls inputs={inputs} set={set} openInfo={openInfo} setOpenInfo={setOpenInfo} />
      <main>
        {!result.feasible && (
          <div className="banner" role="alert">
            <strong>No design closes at {inputs.altitude_m / KM} km.</strong> Drag from the arrays needed to power the
            thruster grows faster than the thrust they provide (sizing-loop gain {sig(result.loopGain, 2)}). Try
            edge-on arrays, lower Isp, a smaller storm margin or a higher orbit.
          </div>
        )}
        <Cards inputs={inputs} result={result} highlight={highlight} />
        <ExploreCharts inputs={inputs} />
      </main>
    </div>
  )
}

function ComingSoon({ title, release, children }: { title: string; release: string; children: React.ReactNode }) {
  return (
    <section className="coming-soon">
      <h2>
        {title} <span className="badge">{release}</span>
      </h2>
      {children}
    </section>
  )
}

export default function App() {
  const [inputs, setInputs] = useState<SatelliteInputs>(() => decodeInputs(window.location.hash))
  const [tab, setTab] = useState<Tab>(() => tabFromHash(window.location.hash))
  const set = (patch: Partial<SatelliteInputs>) => setInputs((prev) => ({ ...prev, ...patch }))

  useEffect(() => {
    const params = encodeInputs(inputs)
    window.history.replaceState(null, '', `#${tab === 'explore' ? '' : `tab=${tab}&`}${params}`)
  }, [inputs, tab])

  return (
    <div className="app">
      <header>
        <h1>VLEO Trade Study Explorer</h1>
        <p>
          How altitude, spacecraft design and propulsion trade against drag, power and mission life in very low
          Earth orbit. Tap <span className="info-inline">i</span> beside any input to learn what it does; tap any
          result for its equation.
        </p>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'explore' && <Explore inputs={inputs} set={set} />}
      {tab === 'propulsion' && (
        <ComingSoon title="Propulsion trade" release="v1.3">
          <p>
            Which propulsion technology does the mission best, and where? Compared on a fair basis — equal total
            spacecraft mass — this page will show:
          </p>
          <ul>
            <li>The optimal-Isp curve: total propulsion-system mass vs specific impulse, with each technology as a point.</li>
            <li>A winner map: the best technology across altitude and mission life, spacecraft size or available power.</li>
            <li>Mission life vs altitude for every technology on the same spacecraft.</li>
            <li>A side-by-side table at your chosen altitude.</li>
          </ul>
        </ComingSoon>
      )}
      {tab === 'heritage' && (
        <ComingSoon title="Heritage missions" release="v1.2">
          <p>
            Load a spacecraft that actually flew in or through VLEO, see realistic starting parameters, compare its real
            outcome with the model, then change one thing at a time. Planned missions:
          </p>
          <ul>
            <li>GOCE (ESA, 2009–13) — drag-free gravity mapping at 255–224 km with an ion thruster.</li>
            <li>SLATS / Tsubame (JAXA, 2017–19) — lowest sustained Earth-observation orbit, down to 167 km.</li>
            <li>CHAMP (GFZ, 2000–10) — natural decay from 454 km with no drag makeup.</li>
            <li>SOAR (EU DISCOVERER, 2021–22) — CubeSat testing aerodynamic control and materials.</li>
            <li>Starlink, February 2022 — a geomagnetic storm at about 210 km and the case for a storm margin.</li>
            <li>Albedo Clarity-1 (2025–26) — commercial VLEO imaging demonstration.</li>
            <li>International Space Station — the familiar reference for decay and reboost.</li>
          </ul>
        </ComingSoon>
      )}

      <footer>
        Academic, vendor-neutral teaching tool. Physics and references:{' '}
        <a href="https://github.com/petersedivec/vleo-explorer/blob/main/docs/physics.md">docs/physics.md</a>. Atmosphere:
        NRLMSIS 2.1, orbit-averaged. Not for flight or investment decisions.
      </footer>
    </div>
  )
}

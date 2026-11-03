import { useEffect, useMemo, useState } from 'react'
import { HERITAGE_MISSIONS, type HeritageMission } from './data/heritage'
import { heritageToInputs } from './model/heritage'
import { YEAR_S } from './model/constants'
import { evaluateSatellite, type SatelliteInputs } from './model/satellite'
import { Cards } from './ui/Cards'
import { KM } from './ui/common'
import { Controls } from './ui/Controls'
import { ExploreCharts } from './ui/ExploreCharts'
import { duration, sig } from './ui/format'
import { Constellation } from './ui/Constellation'
import { Heritage } from './ui/Heritage'
import { PropulsionTrade } from './ui/PropulsionTrade'
import { INPUT_INFO, type InfoKey } from './ui/inputInfo'
import { decodeInputs, encodeInputs } from './ui/urlState'

type Tab = 'explore' | 'heritage' | 'propulsion' | 'constellation'

const TABS: { id: Tab; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'heritage', label: 'Heritage missions' },
  { id: 'propulsion', label: 'Propulsion trade' },
  { id: 'constellation', label: 'Constellation' },
]

const hashParams = () => new URLSearchParams(window.location.hash.replace(/^#/, ''))

function tabFromHash(): Tab {
  const tab = hashParams().get('tab')
  return TABS.some((t) => t.id === tab) ? (tab as Tab) : 'explore'
}

function missionFromHash(): string | null {
  const id = hashParams().get('mission')
  return HERITAGE_MISSIONS.some((m) => m.id === id) ? id : null
}

interface ExploreProps {
  inputs: SatelliteInputs
  set: (patch: Partial<SatelliteInputs>) => void
  loaded: HeritageMission | null
  onShowMission: () => void
}

function Explore({ inputs, set, loaded, onShowMission }: ExploreProps) {
  const [openInfo, setOpenInfo] = useState<InfoKey | null>(null)
  const result = useMemo(() => evaluateSatellite(inputs), [inputs])
  const highlight = useMemo(() => new Set(openInfo ? INPUT_INFO[openInfo].affects : []), [openInfo])

  return (
    <div className="layout">
      <Controls inputs={inputs} set={set} openInfo={openInfo} setOpenInfo={setOpenInfo} />
      <main>
        {loaded && (
          <div className="banner info-banner">
            Started from <strong>{loaded.name}</strong> as built. Any change you make is yours, not the real spacecraft.{' '}
            <button type="button" className="link" onClick={onShowMission}>
              Back to the mission
            </button>
          </div>
        )}
        {!result.feasible && result.infeasibility === 'thrustBelowDrag' && (
          <div className="banner" role="alert">
            {inputs.asBuilt.maxThrust_N > 0 ? (
              <>
                <strong>Thrust below drag at {inputs.altitude_m / KM} km.</strong> Available{' '}
                {sig(inputs.asBuilt.maxThrust_N * 1e3, 2)} mN × duty vs drag {sig(result.drag_N * 1e3, 2)} mN (margin ×
                {sig(result.thrustMargin, 2)}). The spacecraft cannot hold this altitude.
              </>
            ) : (
              <strong>No drag-makeup thrust.</strong>
            )}{' '}
            With no thrust it would reenter in about {duration(result.naturalLifetime_s)}, losing{' '}
            {sig(result.decayRate_m_day / 1e3, 2)} km per day now.
          </div>
        )}
        {!result.feasible && result.infeasibility !== 'thrustBelowDrag' && (
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

export default function App() {
  const [inputs, setInputs] = useState<SatelliteInputs>(() => decodeInputs(window.location.hash))
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [missionId, setMissionId] = useState<string>(() => missionFromHash() ?? HERITAGE_MISSIONS[0].id)
  // The heritage mission the Explore inputs were loaded from, shown as a reminder banner.
  const [loadedId, setLoadedId] = useState<string | null>(() => (hashParams().get('loaded') ? missionFromHash() : null))
  const set = (patch: Partial<SatelliteInputs>) => setInputs((prev) => ({ ...prev, ...patch }))
  const loaded = HERITAGE_MISSIONS.find((m) => m.id === loadedId) ?? null

  useEffect(() => {
    const prefix = new URLSearchParams()
    if (tab !== 'explore') prefix.set('tab', tab)
    if (tab === 'heritage' || loadedId) prefix.set('mission', tab === 'heritage' ? missionId : loadedId!)
    if (loadedId && tab === 'explore') prefix.set('loaded', '1')
    const head = prefix.toString()
    window.history.replaceState(null, '', `#${head ? `${head}&` : ''}${encodeInputs(inputs)}`)
  }, [inputs, tab, missionId, loadedId])

  const loadMission = (mission: HeritageMission) => {
    // A finite design life keeps the Explore slider meaningful; heritage checks themselves use no cap.
    setInputs({ ...heritageToInputs(mission), designLife_s: 15 * YEAR_S })
    setLoadedId(mission.id)
    setTab('explore')
    window.scrollTo({ top: 0 })
  }

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

      {tab === 'explore' && (
        <Explore
          inputs={inputs}
          set={set}
          loaded={loaded}
          onShowMission={() => {
            if (loaded) setMissionId(loaded.id)
            setTab('heritage')
          }}
        />
      )}
      {tab === 'heritage' && <Heritage selectedId={missionId} onSelect={setMissionId} onLoad={loadMission} />}
      {tab === 'propulsion' && <PropulsionTrade inputs={inputs} set={set} onEditSpacecraft={() => setTab('explore')} />}
      {tab === 'constellation' && <Constellation inputs={inputs} set={set} onEditSpacecraft={() => setTab('explore')} />}

      <footer>
        Academic, vendor-neutral teaching tool. Physics and references:{' '}
        <a href="https://github.com/petersedivec/vleo-explorer/blob/main/docs/physics.md">docs/physics.md</a>. Heritage
        data: public sources cited per mission. Atmosphere: NRLMSIS 2.1, orbit-averaged. Not for flight or investment
        decisions.
      </footer>
    </div>
  )
}

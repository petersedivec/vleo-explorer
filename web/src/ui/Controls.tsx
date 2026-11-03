// Input controls for the Explore tab, each with an info pop-up.

import { useId, type ReactNode } from 'react'
import { SOLAR_MODES } from '../model/atmosphere'
import { YEAR_S } from '../model/constants'
import { PROPULSION_PRESETS, thrustToPower_N_W, type PropulsionClass } from '../model/propulsion'
import type { SatelliteInputs } from '../model/satellite'
import { KM, MODE_LABEL, MODES, solarModeOf } from './common'
import { sig } from './format'
import { InfoButton } from './InfoButton'
import type { InfoKey } from './inputInfo'

interface InfoProps {
  info: InfoKey
  openInfo: InfoKey | null
  setOpenInfo: (key: InfoKey | null) => void
}

function ControlLabel({ htmlFor, label, display, info, openInfo, setOpenInfo }: InfoProps & {
  htmlFor?: string
  label: string
  display?: ReactNode
}) {
  return (
    <span className="control-label">
      <span className="control-name">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        <InfoButton infoKey={info} open={openInfo === info} onOpenChange={setOpenInfo} />
      </span>
      {display !== undefined && <output htmlFor={htmlFor}>{display}</output>}
    </span>
  )
}

interface SliderProps extends InfoProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
  log?: boolean
}

function Slider({ label, value, min, max, step, display, onChange, log, ...info }: SliderProps) {
  const id = useId()
  const toSlider = (v: number) => (log ? Math.log10(v) : v)
  const fromSlider = (s: number) => (log ? 10 ** s : s)
  return (
    <div className={`control${info.openInfo === info.info ? ' info-open' : ''}`}>
      <ControlLabel htmlFor={id} label={label} display={display} {...info} />
      <input
        id={id}
        type="range"
        min={toSlider(min)}
        max={toSlider(max)}
        step={log ? 0.01 : step}
        value={toSlider(value)}
        onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
      />
    </div>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  ...info
}: InfoProps & {
  label: string
  value: T | null
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className={`control${info.openInfo === info.info ? ' info-open' : ''}`}>
      <ControlLabel label={label} {...info} />
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Round a log-slider value to two significant figures. */
const round2 = (v: number) => Number(v.toPrecision(2))

interface ControlsProps {
  inputs: SatelliteInputs
  set: (patch: Partial<SatelliteInputs>) => void
  openInfo: InfoKey | null
  setOpenInfo: (key: InfoKey | null) => void
}

export function Controls({ inputs, set, openInfo, setOpenInfo }: ControlsProps) {
  const electric = PROPULSION_PRESETS[inputs.propulsion].efficiency !== null
  const techId = useId()
  const eclipseId = useId()
  const info = (key: InfoKey) => ({ info: key, openInfo, setOpenInfo })

  const asBuilt = inputs.mode === 'asBuilt'
  const customSolar = solarModeOf(inputs) === null

  return (
    <aside className="controls" aria-label="Inputs">
      <Segmented
        {...info('mode')}
        label="Spacecraft"
        value={inputs.mode}
        options={[
          { value: 'design', label: 'Design it' },
          { value: 'asBuilt', label: 'As built' },
        ]}
        onChange={(v) => set({ mode: v })}
      />

      <h2>Orbit</h2>
      <Slider
        {...info('altitude')}
        label="Altitude"
        value={inputs.altitude_m / KM}
        min={150}
        max={600}
        step={5}
        display={`${inputs.altitude_m / KM} km`}
        onChange={(v) => set({ altitude_m: v * KM })}
      />
      <Slider
        {...info('inclination')}
        label="Inclination"
        value={inputs.inclination_deg}
        min={0}
        max={97.5}
        step={0.5}
        display={`${inputs.inclination_deg}°`}
        onChange={(v) => set({ inclination_deg: v })}
      />
      <Slider
        {...info('beta')}
        label="Sun angle to orbit plane (β)"
        value={inputs.beta_deg}
        min={0}
        max={90}
        step={1}
        display={`${inputs.beta_deg}°`}
        onChange={(v) => set({ beta_deg: v })}
      />

      <h2>Environment</h2>
      <Segmented
        {...info('solarActivity')}
        label="Solar activity"
        value={solarModeOf(inputs)}
        options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        onChange={(m) => set({ solar: { ...SOLAR_MODES[m] } })}
      />
      {customSolar && (
        <p className="control-note">
          Custom: F10.7 = {inputs.solar.f107}, Ap = {inputs.solar.ap}
        </p>
      )}
      <Segmented
        {...info('atmosphereModel')}
        label="Atmosphere model"
        value={inputs.atmosphereModel}
        options={[
          { value: 'msis', label: 'NRLMSIS 2.1' },
          { value: 'exponential', label: 'Exponential' },
        ]}
        onChange={(v) => set({ atmosphereModel: v })}
      />
      <Slider
        {...info('stormMargin')}
        label="Storm margin on density"
        value={inputs.stormMargin}
        min={1}
        max={5}
        step={0.5}
        display={`×${inputs.stormMargin}`}
        onChange={(v) => set({ stormMargin: v })}
      />

      <h2>Spacecraft</h2>
      {asBuilt ? (
        <>
          <Slider
            {...info('asBuiltMass')}
            label="Dry mass"
            value={inputs.asBuilt.dryMass_kg}
            min={1}
            max={500000}
            step={1}
            log
            display={`${sig(inputs.asBuilt.dryMass_kg, 3)} kg`}
            onChange={(v) => set({ asBuilt: { ...inputs.asBuilt, dryMass_kg: round2(v) } })}
          />
          <Slider
            {...info('asBuiltArea')}
            label="Drag area"
            value={inputs.asBuilt.dragArea_m2}
            min={0.005}
            max={2000}
            step={0.001}
            log
            display={`${sig(inputs.asBuilt.dragArea_m2, 2)} m²`}
            onChange={(v) => set({ asBuilt: { ...inputs.asBuilt, dragArea_m2: round2(v) } })}
          />
        </>
      ) : (
        <>
        <Slider
          {...info('payloadMass')}
          label="Payload mass"
          value={inputs.payloadMass_kg}
          min={1}
          max={500}
          step={1}
          log
          display={`${sig(inputs.payloadMass_kg, 2)} kg`}
          onChange={(v) => set({ payloadMass_kg: round2(v) })}
        />
        <Slider
          {...info('payloadPower')}
          label="Payload power"
          value={inputs.payloadPower_W}
          min={1}
          max={2000}
          step={1}
          log
          display={`${sig(inputs.payloadPower_W, 2)} W`}
          onChange={(v) => set({ payloadPower_W: round2(v) })}
        />
        </>
      )}
      <Slider
        {...info('cd')}
        label="Drag coefficient C_D"
        value={inputs.cd}
        min={2}
        max={4}
        step={0.05}
        display={inputs.cd.toFixed(2)}
        onChange={(v) => set({ cd: v })}
      />
      {!asBuilt && (
        <>
        <Segmented
          {...info('arrays')}
          label="Solar arrays"
          value={inputs.arrayOrientation}
          options={[
            { value: 'edgeOn', label: 'Edge-on to flow' },
            { value: 'sunTracking', label: 'Sun-tracking' },
          ]}
          onChange={(v) => set({ arrayOrientation: v })}
        />
        </>
      )}

      <h2>Propulsion</h2>
      <div className={`control${openInfo === 'technology' ? ' info-open' : ''}`}>
        <ControlLabel htmlFor={techId} label="Technology" {...info('technology')} />
        <select
          id={techId}
          value={inputs.propulsion}
          onChange={(e) => {
            const p = e.target.value as PropulsionClass
            const preset = PROPULSION_PRESETS[p]
            set({
              propulsion: p,
              isp_s: preset.isp_s,
              efficiency: preset.efficiency ?? inputs.efficiency,
              thrusterFixedMass_kg: preset.systemFixedMass_kg,
            })
          }}
        >
          {(Object.keys(PROPULSION_PRESETS) as PropulsionClass[]).map((p) => (
            <option key={p} value={p}>
              {PROPULSION_PRESETS[p].label}
            </option>
          ))}
        </select>
      </div>
      {asBuilt && (
        <Slider
          {...info('maxThrust')}
          label="Maximum thrust"
          value={Math.max(inputs.asBuilt.maxThrust_N * 1e3, 0.01)}
          min={0.01}
          max={1000}
          step={0.01}
          log
          display={inputs.asBuilt.maxThrust_N > 0 ? `${sig(inputs.asBuilt.maxThrust_N * 1e3, 2)} mN` : 'none'}
          onChange={(v) => set({ asBuilt: { ...inputs.asBuilt, maxThrust_N: v <= 0.0105 ? 0 : round2(v) / 1e3 } })}
        />
      )}
      <Slider
        {...info('isp')}
        label="Specific impulse"
        value={inputs.isp_s}
        min={50}
        max={6000}
        step={10}
        log
        display={`${sig(inputs.isp_s, 2)} s`}
        onChange={(v) => set({ isp_s: round2(v) })}
      />
      {electric && (
        <Slider
          {...info('efficiency')}
          label="Thruster efficiency η"
          value={inputs.efficiency}
          min={0.1}
          max={0.8}
          step={0.01}
          display={`${Math.round(inputs.efficiency * 100)}% → ${sig(thrustToPower_N_W(inputs.isp_s, inputs.efficiency) * 1e6, 2)} µN/W`}
          onChange={(v) => set({ efficiency: v })}
        />
      )}
      <Slider
        {...info('propellant')}
        label="Propellant"
        value={inputs.propellant_kg}
        min={0.1}
        max={200}
        step={0.1}
        log
        display={`${sig(inputs.propellant_kg, 2)} kg`}
        onChange={(v) => set({ propellant_kg: round2(v) })}
      />
      <Slider
        {...info('designLife')}
        label="Design life"
        value={inputs.designLife_s / YEAR_S}
        min={0.5}
        max={15}
        step={0.5}
        display={`${inputs.designLife_s / YEAR_S} yr`}
        onChange={(v) => set({ designLife_s: v * YEAR_S })}
      />
      <div className={`control checkbox${openInfo === 'thrustInEclipse' ? ' info-open' : ''}`}>
        <input
          id={eclipseId}
          type="checkbox"
          checked={inputs.thrustInEclipse}
          onChange={(e) => set({ thrustInEclipse: e.target.checked })}
        />
        <label htmlFor={eclipseId}>Thrust in eclipse (battery-powered)</label>
        <InfoButton infoKey="thrustInEclipse" open={openInfo === 'thrustInEclipse'} onOpenChange={setOpenInfo} />
      </div>
    </aside>
  )
}

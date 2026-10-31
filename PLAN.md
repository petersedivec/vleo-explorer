# VLEO Explorer — Project Plan

An interactive web app for understanding the **mission trade space for a very low Earth
orbit (VLEO) constellation**. Move a slider — altitude, spacecraft size, propulsion,
propellant, constellation size, solar activity — and watch every dependent quantity update:
drag, thrust and power needed, mission life, coverage and revisit, satellites required, and
the yearly cost of keeping the constellation running. Every number comes with its equation,
its assumptions, and a plain-language "why".

- **Audience:** upper-division undergraduate / master's aerospace coursework, and engineers
  and business people new to VLEO.
- **Platform:** responsive web app — desktop, tablet, phone. Offline not required.
- **Scope:** purely academic and vendor-neutral. Covers the VLEO band (~150–450 km) with
  comparison up to 600 km. Public, citable, textbook-level data only.
- **Repo:** public, open source — `petersedivec/vleo-explorer`.

Status legend: ✅ decided · 🟡 proposed default (confirm) · ❓ open question

---

## 1. Goals and non-goals

**Goals**
1. Make the central VLEO tension visible: **drag-driven costs grow exponentially as altitude
   drops, while mission benefits improve only polynomially** — which is why an optimum
   altitude exists, and why it moves with the mission, the spacecraft and the solar cycle.
2. Show cause → effect: change one input, see which outputs move and by how much.
3. Treat the **constellation** as the unit of design: lower orbit means better performance
   per satellite but more satellites, shorter lives and faster replacement.
4. Be honest about uncertainty: solar activity changes drag several-fold; show bands.
5. Teach: every output has its equation, assumptions and a reference.
6. Be numerically trustworthy: validated against hand calculations and real missions.

**Non-goals**
- Not a high-fidelity propagator (no full numerical J2+drag+SRP propagation of every satellite).
- Not a tool for real flight or investment decisions; cost figures are teaching assumptions.
- No accounts, servers or ads. Static site.

---

## 2. How things scale with altitude (the core lesson)

| Quantity | Scales with altitude *h* | Shape |
|---|---|---|
| Atmospheric density, drag, propellant burn, atomic-oxygen erosion | ~e^(−h/H), scale height H ≈ 30–60 km | **Exponential** (×3–10 with solar activity) |
| Natural decay / disposal time | ~e^(+h/H) | **Exponential** |
| Optical ground sample distance (GSD), fixed aperture | ∝ h | Linear |
| Telescope aperture for a fixed GSD | ∝ h (payload mass ∝ ~D²–D³) | Linear → steeper in mass |
| RF link strength (comms, direct-to-device) | ∝ 1/h² | Inverse square |
| SAR signal-to-noise ratio | ∝ 1/h³ | Inverse cube |
| Swath / footprint at fixed off-nadir or elevation angle | swath ∝ ~h, area ∝ ~h² | Quadratic |
| **Satellites needed for a coverage requirement** | ∝ ~1/h² | **Inverse square** |
| Pass duration / downlink contact time | ∝ ~h | Linear |
| Orbital period / latency | 88–94 min across the band | ~flat |
| Radiation dose; debris and collision risk | lower when lower | Benefits |

The app's headline chart is **cost per year to sustain a mission requirement vs altitude** —
a U-shaped curve whose left wall is drag (short lives, big thrusters, lots of replacement)
and whose right wall is performance (bigger payloads, more power, more satellites… or
missing the requirement).

---

## 3. Missions (v1) ✅

Each mission is a preset that sets a **requirement**; the app sizes the payload and the
constellation to meet it at each altitude.

| Mission | Requirement inputs | Altitude benefit | Payload sizing relation |
|---|---|---|---|
| **Optical Earth observation** | GSD (m), revisit (h), max off-nadir angle, latitude band | GSD ∝ h | Diffraction limit: D ≈ 1.22 λ h / GSD; payload mass/power from aperture |
| **Synthetic aperture radar (SAR)** | Resolution, NESZ (sensitivity), swath, revisit | SNR ∝ 1/h³ | Radar equation: required transmit power × antenna area ∝ h³ (for fixed NESZ) |
| **Direct-to-device comms** | User link margin, min user elevation angle, continuous vs intermittent coverage, capacity | Link ∝ 1/h² | Link budget: required EIRP ∝ h²; beam footprint and capacity per satellite |

Later (v2+): RF/signals sensing, IoT/data relay, LEO navigation augmentation, short-life
tactical missions, science (gravity, upper atmosphere).

Key mission difference the app should make obvious: **imaging needs revisit** (a satellite
passes often enough), **comms needs continuous coverage** (a satellite is always in view
above the minimum elevation) — continuous coverage costs far more satellites.

---

## 4. The model

### 4.1 Inputs
| Group | Parameter | Range / default |
|---|---|---|
| Orbit | Altitude *h* | 150–600 km; VLEO band highlighted (default 300) |
| | Inclination *i*, sun-synchronous toggle, dawn-dusk toggle | 0–98° |
| | Eccentricity | circular only in v1 |
| Spacecraft | Bus dry mass or "size class" (CubeSat, 100 kg, 500 kg, large) | 5–1,500 kg |
| | Frontal area, drag coefficient C_D | 0.01–5 m²; 2.0–2.6 (default 2.2) |
| | Solar array area and orientation (edge-on vs sun-tracking) | adds drag area, sets power |
| Propulsion | Technology class (cold gas, monoprop, electrospray, FEEP, gridded ion, Hall, RF plasma, air-breathing what-if) | sets Isp, thrust/power, efficiency |
| | Isp, max thrust, µN/W, efficiency η, total-impulse / operating-hour limit | editable after preset |
| | Propellant mass | 0–50% of wet mass |
| Environment | Solar activity (low / moderate / high) or launch year across the solar cycle | F10.7, Ap |
| Constellation | Walker pattern: planes, satellites per plane, phasing; or "size it for me" | |
| Mission | Requirement per §3 | |
| Cost | Bus $/kg, payload cost model, launch $/kg (rideshare vs dedicated), ops $/sat/yr, ground station $/yr, learning-curve rate | editable, labelled as teaching assumptions |

### 4.2 Single-satellite outputs (each with an explanation card)
| Output | Core relation |
|---|---|
| Orbital speed, period, orbits/day | v = √(μ/r), T = 2π√(r³/μ) |
| Atmospheric density ρ(h, solar) | NRLMSIS 2.0 lookup tables (§5) |
| Drag force; ballistic coefficient | D = ½ ρ v² C_D A; B = m / (C_D A) |
| Natural decay rate and lifetime with no thrust | da/dt = −√(μa) ρ / B, integrated over altitude |
| Δv per year to hold altitude | (D/m) · seconds per year |
| Power required | P = T · g₀ · Isp / (2η) |
| Propellant flow and burn per year | ṁ = T / (g₀ Isp) |
| **Mission life** | min(propellant life, thruster total-impulse life, design life) |
| Minimum sustainable altitude | where max thrust (power-limited) = drag |
| Descent from rideshare orbit | Δv ≈ v₂ − v₁ (low-thrust spiral); time ≈ Δv · m / T |
| Disposal time | decay time from end-of-life altitude vs the 5-year rule |
| Eclipse fraction, power available | geometry; dawn-dusk SSO ≈ no eclipse |
| Atomic-oxygen fluence (relative) | n_O · v · t |

### 4.3 Constellation outputs
| Output | Method |
|---|---|
| Footprint / swath per satellite | spherical-Earth geometry from off-nadir or min-elevation angle |
| Coverage: mean and max revisit, % time covered, by latitude | in-browser simulation: circular orbits with J2 nodal precession over a grid of ground points, run in a Web Worker |
| Satellites needed to meet the requirement vs altitude | search over Walker patterns using the simulator; analytic first estimate (footprint ∝ h²) |
| Downlink: contacts/day, minutes/day, data volume per ground station | same simulator with ground-station sites |
| Deployment: launches needed, sats per launch, time to full operation (incl. descent) | launch capacity + descent time |

### 4.4 Cost and replenishment outputs ✅
| Output | Relation |
|---|---|
| Satellite unit cost | bus $/kg × mass + payload cost (from §3 sizing), with learning curve over quantity |
| Replacement rate | N_sats / mission life (satellites per year) |
| **Cost per year to sustain** | (unit cost + launch cost per sat) × replacement rate + ops + ground |
| Up-front deployment cost | N_sats × (unit + launch) + ground |
| Cost per unit of service | per km² imaged at the required GSD; per Gbps or per user-hour for comms |
| Optimum altitude | minimum of cost-per-year curve that still meets the requirement |

All cost parameters are editable, sourced where possible to public figures, and clearly
labelled as order-of-magnitude teaching assumptions.

### 4.5 Uncertainty and optimization (v3)
- Monte Carlo over solar activity, C_D and thruster performance → P10/P50/P90 bands on life,
  satellite count and cost.
- Optimizer: sweep altitude × satellite count × propulsion class; show the Pareto front of
  cost vs performance; mark the cheapest design meeting the requirement.

---

## 5. Physics data and references

- **Atmosphere:** precompute total and atomic-O density vs altitude (100–1,000 km, 1 km steps)
  for several solar-activity levels with **NRLMSIS 2.0** (Python `pymsis`); ship as JSON;
  interpolate log-density. Teaching comparison: piecewise-exponential atmosphere (Vallado).
- **Solar cycle:** published F10.7 history and forecast to map "launch year" → activity level.
- **References** (cited in explanation cards):
  - Vallado, *Fundamentals of Astrodynamics and Applications* — drag, decay, atmosphere.
  - Wertz et al., *Space Mission Engineering: The New SMAD* — sizing, coverage, cost.
  - King-Hele, *Satellite Orbits in an Atmosphere* — decay theory.
  - Goebel & Katz, *Fundamentals of Electric Propulsion* — P = T·g₀·Isp/(2η).
  - NASA SST State of the Art, In-Space Propulsion — thruster parameter ranges.
  - Curlander & McDonough, *Synthetic Aperture Radar* — SAR radar equation.
  - Walker (1984) — constellation patterns.
- **Validation cases (golden tests):** GOCE; JAXA SLATS; ISS decay rate; hand calcs
  (≈16 orbits/day at 250 km); published teaching examples (Lira 2015; arXiv 2508.19549);
  NASA DAS / STK lifetime numbers where available.

---

## 6. Architecture ✅

**TypeScript + React + Vite**, static site on **GitHub Pages**.

```
vleo-explorer/
├── reference/              Python reference model (the "truth")
│   ├── vleo_model.py       same equations as the app, readable
│   ├── build_atmos.py      generates atmosphere tables with pymsis
│   ├── notebooks/          validation vs GOCE, SLATS, ISS, textbook examples
│   └── golden/*.json       input → output vectors consumed by TS tests
├── web/
│   ├── src/physics/        pure TS: orbit, atmosphere, drag, propulsion, lifetime
│   ├── src/missions/       optical, SAR, direct-to-device sizing
│   ├── src/constellation/  Walker patterns, coverage simulator (Web Worker)
│   ├── src/cost/           cost and replenishment model
│   ├── src/data/           atmosphere tables, propulsion presets, scenarios
│   └── src/ui/             React components, charts, globe
└── docs/                   physics spec, equations, references
```

- Physics, missions, constellation and cost modules are **pure TypeScript with no React** →
  unit-tested with Vitest against the Python golden vectors.
- 🟡 Charts: Plotly.js (familiar to data scientists; switch to ECharts if bundle size hurts).
- 🟡 Globe: globe.gl (three.js) for constellation and footprint animation; CesiumJS if needed.
- 🟡 State: Zustand. **Scenarios encoded in the URL** so a configuration can be shared as a link
  (useful for coursework and problem sets).
- CI (GitHub Actions): typecheck, lint, Vitest, pytest; deploy to Pages on `main`.

---

## 7. App experience

1. **Explore:** grouped sliders; live output cards. Changed outputs flash ↑/↓ with % change.
   Tap a card → equation, assumptions, reference.
2. **Altitude trade curves:** any output vs altitude with solar min/max band; overlay
   propulsion classes or missions. Linear vs exponential behaviour labelled on the chart.
3. **Mission sizing:** pick optical / SAR / direct-to-device, set the requirement, see payload
   size, satellites needed and cost at each altitude.
4. **Constellation view:** globe with orbits and footprints; revisit and coverage maps by
   latitude; satellites-needed vs altitude.
5. **Cost:** cost-per-year U-curve, breakdown (build, launch, replacement, ops), optimum altitude.
6. **Cause → effect map:** dependency graph from inputs → intermediates → outputs; highlights
   the path from the slider being moved.
7. **Sensitivity:** tornado chart, ±20% on each input → effect on life, sat count or cost.
8. **Scenarios and problem sets:** presets across the band; guided exercises with shareable links.
9. **Units:** SI default; µN/mN, W, kg, m/s, days/years, $M.

---

## 8. Roadmap

| Phase | Release | Deliverable | Done when |
|---|---|---|---|
| 0 | — | This plan; `docs/physics.md` spec; license | Equations and references written down |
| 1 | — | Python reference model, atmosphere tables, validation notebook, golden vectors | Matches GOCE/ISS/hand-calc checks |
| 2 | — | Web skeleton, TS physics core, CI, Pages deploy | TS passes golden vectors; site live |
| 3 | **v1** | Explore + altitude trade curves + explanation cards + solar bands | Student can answer "why" for every number |
| 4 | **v1** | Mission sizing: optical, SAR, direct-to-device | Payload size vs altitude for each mission |
| 5 | **v2** | Constellation: Walker, coverage/revisit simulator, globe, sats-needed vs altitude, downlink, deployment | Sats needed vs altitude for each mission |
| 6 | **v3** | Cost and replenishment model; cost U-curve; optimum altitude | Headline chart works for all three missions |
| 7 | **v3** | Monte Carlo uncertainty; optimizer / Pareto; sensitivity | P10/P50/P90 bands; Pareto view |
| 8 | — | Problem sets, scenario links, accessibility, docs polish | Usable in a course |

Each release is a complete, showable app.

---

## 9. Prior art (surveyed Oct 2026)

No existing tool combines VLEO focus + propulsion/power/life coupling + constellation sizing
+ cost + teaching explanations in a browser. Closest neighbours:

| Category | Examples | What they do | Gap we fill |
|---|---|---|---|
| Professional tools | Ansys STK Lifetime, NASA DAS, ESA DRAMA/OSCAR, GMAT | High-fidelity decay/lifetime | Desktop, expert UI, licences/applications; no "why" |
| Research code (VLEO) | ADBSat (GPLv3, drag coefficients), VLEO-DSMC, air-breathing simulators | One subsystem in depth | Not interactive, not teaching-oriented |
| Educational orbit apps | Orbital Lab, Orbit Architect, Orbital Simulator: Explorer, OrbitCalc | Keplerian orbits, transfers, Δv lessons | No drag, propulsion, lifetime, constellation or cost |
| Web calculators | Orbit-decay and storm-drag calculators | Single-formula lifetime | Crude atmosphere, no trade linkage |
| Teaching papers | Lira 2015 (*Physics Education*); arXiv 2508.19549 (2025) | Simplified analytical decay | Text only — good references and validation |

Ideas to borrow: Orbital Lab's "lesson completes only when you do the task"; DRAMA/OSCAR's
solar-activity scenarios; ADBSat-derived C_D values for presets; DAS/STK numbers as cross-checks.

---

## 10. Decision log

| Date | Decision |
|---|---|
| Oct 2026 | Purely academic, vendor-neutral, public repo |
| Oct 2026 | Web app (TypeScript + React), responsive; offline not required (replaces native Kotlin Multiplatform plan) |
| Oct 2026 | Constellation size, coverage and revisit are first-class trades |
| Oct 2026 | Cost and replenishment model included, with editable labelled assumptions |
| Oct 2026 | v1 missions: optical EO, SAR, direct-to-device comms (commercial focus; science deferred) |

## 11. Open questions

- ❓ License: 🟡 MIT (simplest) vs Apache-2.0 (patent grant).
- ❓ Name: "VLEO Explorer" OK?
- ❓ Revenue side: stop at cost per unit of service, or add simple revenue / break-even later?
- ❓ Mass change over life (rocket equation) in v1, or constant mass first?
- ❓ Air-breathing propulsion as a what-if in v1, or later?
- ❓ Any instructor or course to pilot with?

## 12. Guardrails for a public repo

- Public, citable data only (NASA, ESA, textbooks, published papers).
- Propulsion presets are **generic technology classes**, not vendor products.
- No company-specific, proprietary or non-public information of any kind.
- Cost figures are labelled teaching assumptions, not market data.

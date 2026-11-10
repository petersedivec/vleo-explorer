# VLEO Trade Study Explorer — Project Plan

An interactive web app for understanding the **mission trade space for a very low Earth
orbit (VLEO) constellation**. Move a slider — altitude, spacecraft size, propulsion,
propellant, constellation size, solar activity — and watch every dependent quantity update:
drag, thrust and power needed, mission life, satellites required, and the yearly cost of
keeping the constellation running. Every number comes with its equation, its assumptions,
and a plain-language "why".

- **Audience:** upper-division undergraduate / master's aerospace coursework, and engineers
  and business people new to VLEO.
- **Platform:** responsive web app — desktop, tablet, phone. Offline not required.
- **Scope:** purely academic and vendor-neutral. Covers the VLEO band (~150–450 km) with
  comparison up to 600 km. Public, citable, textbook-level data only.
- **Repo:** public, open source (MIT) — `petersedivec/vleo-explorer`.
- **Physics spec:** [`docs/physics.md`](docs/physics.md) is the source of truth for every
  equation; code in `reference/` (Python) and `web/` (TypeScript) follows it.

---

## 1. Goals and non-goals

**Goals**
1. Make the central VLEO tension visible: **drag-driven costs grow exponentially as altitude
   drops, while mission benefits improve only polynomially** — which is why an optimum
   altitude exists, and why it moves with the mission, the spacecraft and the solar cycle.
2. Show cause → effect: change one input, see which outputs move and by how much.
3. Treat the **constellation** as the unit of design: lower orbit means better performance
   per satellite, but (for most missions) more satellites, shorter lives and faster replacement.
4. Be honest about uncertainty: solar activity changes drag several-fold; cost assumptions
   dominate where the optimum lands. Show bands and breakdowns, not false precision.
5. Teach: every output has its equation, assumptions and a reference.
6. Be numerically trustworthy: validated against real missions and textbook examples.

**Non-goals**
- Not a high-fidelity propagator.
- Not a tool for real flight or investment decisions; cost figures are teaching assumptions.
- No accounts, servers or ads. Static site.
- No revenue model: economics stop at **cost per unit of service**.

---

## 2. How things scale with altitude (the core lesson)

| Quantity | Scales with altitude *h* | Shape |
|---|---|---|
| Atmospheric density, drag, propellant burn, atomic-oxygen erosion | ~e^(−h/H); scale height H ≈ 22 km at 150 km, rising to ~60 km at 450 km | **Exponential** |
| Solar-activity effect on density (solar max ÷ solar min) | ~×2–3 at 200 km, ×10+ at 450 km | Grows with altitude |
| Natural decay / disposal time | ~e^(+h/H) | **Exponential** |
| Optical GSD, fixed aperture | ∝ h | Linear |
| Telescope aperture for a fixed GSD | ∝ h (payload mass ∝ ~D²–D³) | Linear → steeper in mass |
| SAR signal-to-noise ratio, fixed hardware | ∝ 1/h³ | Inverse cube |
| SAR minimum antenna area (ambiguity limit) | ∝ h | Linear — smaller antenna, less drag |
| SAR power × antenna area² for fixed sensitivity (NESZ) | ∝ h³ | Cube |
| Direct-to-device: satellite receive antenna area (uplink-limited) | ∝ h² | Square — but it is a drag surface |
| Swath at fixed off-nadir angle | ∝ ~h | Linear |
| Footprint area at fixed elevation angle | ∝ ~h² | Quadratic |
| **Satellites for imaging revisit** (swath-limited) | ∝ ~1/h | **Inverse** |
| **Satellites for continuous coverage** (comms) | ∝ ~1/h² | **Inverse square** |
| Pass duration / downlink contact time | ∝ ~h | Linear (lower is worse) |
| Orbital period | 88–94 min across the band | ~flat |
| Propagation latency | ∝ h | Linear (small) |
| Free-molecular heating ½ρv³ | ~500 W/m² at 150 km, ~60 W/m² at 200 km | Exponential |
| Aerodynamic torque ½ρv²·A·Δx_cp | follows density | Exponential |
| Radiation dose; debris and collision risk | lower when lower | Benefits |

**Headline chart:** cost per year to sustain a mission requirement vs altitude — a U-shaped
curve. The **left wall is physics** (drag → short lives, big thrusters and arrays, or no
feasible design at all). The **right wall is mostly assumption** (payload cost, $/kg,
learning curve). The app says so on the chart.

---

## 3. Missions (v1)

Each mission is a preset that sets a **requirement**; the app sizes the payload and the
constellation to meet it at each altitude.

| Mission | Requirement inputs | Payload sizing | Constellation sizing |
|---|---|---|---|
| **Optical Earth observation** | GSD, revisit, max off-nadir angle, min solar elevation, latitude band | GSD ≈ Q·λ·h / D (Q ≈ 1–2, convention stated); payload mass/power from aperture | Revisit, swath-limited: N ∝ ~1/h |
| **Synthetic aperture radar (SAR)** | Resolution, NESZ, swath, revisit | NESZ ∝ h³·λ·v / (P_avg·A²); ambiguity limit A ≥ 4·v·λ·R·tanθ / c ∝ h → with minimum-area antenna, P ∝ h | Revisit, swath-limited: N ∝ ~1/h |
| **Direct-to-device comms** | Phone EIRP (fixed), required link margin, min user elevation, capacity | **Uplink-limited**: satellite G/T sets receive antenna area ∝ h² — which adds drag area | Continuous coverage: N ∝ ~1/h² |

Notes the app makes explicit:
- **Imaging needs revisit; comms needs continuous coverage.** Continuous coverage costs far
  more satellites.
- Direct-to-device per-link gains at low altitude are partly cancelled at constellation level
  (footprint ∝ h², satellites ∝ 1/h²), and the big receive array fights drag. **The model
  finds the optimum; it is not tuned to land in VLEO.**
- Dawn-dusk sun-synchronous orbits suit SAR, not optical (terminator lighting). Optical
  coverage applies a minimum solar-elevation constraint.

Later: RF/signals sensing, IoT/data relay, LEO navigation augmentation, short-life tactical
missions, science.

---

## 4. The model

### 4.1 Inputs
| Group | Parameter | Notes |
|---|---|---|
| Orbit | Altitude *h* (150–600 km; default 300) | VLEO band highlighted |
| | Inclination; sun-synchronous and dawn-dusk toggles | Toggles flag eclipse seasons and lighting |
| Spacecraft | Payload (from mission sizing), bus mass fraction, body frontal area, C_D | C_D presets by shape (ADBSat-derived); 2.2 is a compact-body value |
| | Solar array area (sized by the loop) and orientation (edge-on vs sun-tracking) | Arrays add drag area |
| Propulsion | Technology class: cold gas, monoprop, electrospray, FEEP, gridded ion, Hall, RF plasma | Air-breathing what-if added in v3 |
| | Isp, efficiency η (thrust-per-watt is **derived**: T/P = 2η / (g₀·Isp)), max thrust per unit, total-impulse limit | Cold gas/monoprop use a separate (heater/valve) power model |
| | Propellant mass | |
| Environment | **Exploration mode:** solar activity low / moderate / high (F10.7, Ap) | Quick what-if |
| | **Mission-life mode:** launch year → time-varying F10.7(t) across the 11-year cycle | Used for lifetime and propellant |
| | Storm margin on density (×2–5) | For minimum sustainable altitude |
| Constellation | Walker pattern, or "size it for me" | |
| Cost | Bus $/kg, payload cost per mission, launch $/kg (rideshare vs dedicated), ops $/sat/yr, ground $/yr, learning-curve rate | Each as a low–high range; labelled teaching assumptions |

### 4.2 Closed sizing loop
Mass, power and drag depend on each other, so the model iterates to a fixed point:

```
payload (from requirement) → bus mass → power needed (payload + thruster + bus)
→ array area → drag area → drag → thrust → thruster power → power needed … repeat
```

- Thruster duty cycle accounts for eclipse and battery capacity; payload power competes
  with the thruster (SAR especially).
- **If the loop does not converge, or max thrust < drag × storm margin, the design is
  infeasible** at that altitude. Infeasible regions are shown hatched, not as "high cost".
  This is the left wall of the U-curve.

### 4.3 Single-satellite outputs (each with an explanation card)
| Output | Core relation |
|---|---|
| Orbital speed, period, orbits/day | v = √(μ/r), T = 2π√(r³/μ) |
| Atmospheric density ρ(h, F10.7, Ap) | Orbit-averaged NRLMSIS 2.1 tables (§5) |
| Drag; ballistic coefficient | D = ½ρv²C_D·A; B = m / (C_D·A) |
| Natural decay rate and lifetime with no thrust | da/dt = −√(μa)·ρ / B, integrated with time-varying density |
| Δv per year to hold altitude | (D/m) · seconds per year |
| Electric thruster power | P = T·g₀·Isp / (2η) |
| Propellant flow | ṁ = D / (g₀·Isp) — independent of spacecraft mass at constant altitude |
| **Propellant life (constant altitude)** | m_prop·g₀·Isp / D. **Isp is the lever, not mass.** |
| Mass over time | Time-stepped. Mass matters for: descent (accel = T/m), decay after a thruster failure (lighter → lower B → faster fall), and time-varying solar activity |
| **Mission life** | min(propellant life, thruster total-impulse life, design life) |
| Minimum sustainable altitude | Where max thrust = drag × storm margin. Teaching case: Starlink, Feb 2022, ~210 km |
| Descent from rideshare orbit | Edelbaum Δv ≈ |v₁ − v₂|; natural decay assists; time from time-stepped thrust |
| Disposal time vs the FCC 5-year rule | Decay time from end-of-life altitude |
| Eclipse fraction | Eclipse when \|β\| < asin(R⊕ / (R⊕+h)) (~73° at 300 km); dawn-dusk SSO still has eclipse seasons in VLEO |
| Free-molecular heating; aerodynamic torque | ½ρv³; ½ρv²·A·Δx_cp (attitude control and momentum dumping) |
| Atomic-oxygen fluence (relative) | n_O·v·t |

**Why electrospray vs Hall is a real trade:** high Isp saves propellant, but at fixed power
gives less thrust (T/P = 2η / (g₀·Isp)). More thrust needs more power → bigger arrays → more
drag → more thrust. The closed loop is what makes this visible.

### 4.4 Constellation outputs
| Output | v1 (analytic) | v2 (simulated) |
|---|---|---|
| Satellites for imaging revisit | Swath-based: ground-track spacing vs swath, by latitude | Coverage simulator verifies and refines |
| Satellites for continuous coverage | Streets-of-coverage method (Walker / Rider) | Coverage simulator verifies and refines |
| Revisit and coverage by latitude | Analytic estimate | 2D map from the simulator |
| Downlink contacts, minutes, data volume per station | — | Simulator with ground-station sites |
| Deployment time | — | Launches, sats per launch, descent, and J2 differential drift for plane separation (rideshare does not deliver the RAAN you need) |

### 4.5 Cost and replenishment outputs
| Output | Relation |
|---|---|
| Satellite unit cost | Bus $/kg × mass + payload cost, with learning curve over quantity |
| Replacement rate | N_sats / mission life |
| **Cost per year to sustain** (steady-state replacement view) | (unit + launch per sat) × replacement rate + ops + ground |
| Up-front deployment cost | N_sats × (unit + launch) + ground |
| **Cost per unit of service** | per km² imaged at the required GSD; per Gbps or per user-hour for comms |
| Optimum altitude | Minimum of the cost-per-year curve that meets the requirement |

**Cost display rules**
- Dollars, shown as a **low–high band** from the cost-assumption ranges, rounded to 1–2
  significant figures.
- Cost breakdown (build, launch, replacement, ops, ground) always visible next to the curve.
- Optimum altitude shown as a range, with a note that its location is assumption-driven.
- Infeasible altitudes are hatched, not priced.

### 4.6 Uncertainty and optimization
- **Sensitivity (v1):** tornado chart, ±20% on each input → effect on life, satellite count, cost.
- **Monte Carlo (v2):** over solar activity, C_D, thruster performance and cost ranges →
  P10/P50/P90 bands.
- **Optimizer (v3):** sweep altitude × satellite count × propulsion; Pareto front of cost vs
  performance.

---

## 5. Physics data and references

- **Atmosphere:** NRLMSIS 2.1 via Python `pymsis` (version pinned). Tables are
  **orbit-averaged** (over local time, latitude for the inclination, and season), gridded over
  altitude (100–1,000 km), F10.7 and Ap. Total and atomic-O density; stored as log10 in JSON
  (~200 KB), committed with the generating script and a checksum. Teaching comparison:
  piecewise-exponential atmosphere (Vallado).
- **Solar cycle:** published F10.7 history and forecast → time-varying F10.7(t) for
  mission-life mode.
- **References** (cited in explanation cards):
  - Vallado, *Fundamentals of Astrodynamics and Applications* — drag, decay, atmosphere.
  - Wertz et al., *Space Mission Engineering: The New SMAD* — sizing, coverage, cost.
  - King-Hele, *Satellite Orbits in an Atmosphere* — decay theory.
  - Goebel & Katz, *Fundamentals of Electric Propulsion* — P = T·g₀·Isp/(2η).
  - NASA SST State of the Art, In-Space Propulsion — thruster parameter ranges.
  - Curlander & McDonough, *Synthetic Aperture Radar* — SAR radar equation, ambiguities.
  - Walker (1984); Rider (1986) — constellation patterns, streets of coverage.
  - Edelbaum (1961) — low-thrust transfer Δv.
- **Validation (independent of our own code):** GOCE; JAXA SLATS; ISS decay rate; Starlink
  Feb 2022 storm loss; textbook worked examples (Vallado, SMAD); Lira 2015; arXiv 2508.19549;
  NASA DAS / STK lifetime numbers where available.

---

## 6. Architecture

**TypeScript + React + Vite**, static site on **GitHub Pages**.

```
vleo-explorer/
├── docs/physics.md         equation spec: the source of truth
├── reference/              Python reference model — physics and atmosphere only
│   ├── vleo_model.py
│   ├── build_atmos.py      generates atmosphere tables with pymsis (pinned)
│   ├── tests/              validation vs GOCE, SLATS, ISS, textbook examples
│   └── golden/*.json       input → output vectors consumed by TS tests
├── web/
│   ├── src/model/          pure TS: physics, missions, constellation, cost
│   ├── src/data/           atmosphere tables, propulsion presets, scenarios
│   └── src/ui/             React components and charts
└── .github/workflows/      CI and Pages deploy
```

- **One pure model API:** `evaluate(inputs) → outputs`. SI units internally; unit-suffixed
  names (`thrust_N`, `altitude_m`). Memoized. No React inside `src/model/`.
- **Testing:**
  - Physics and atmosphere: Vitest against Python golden vectors, and **both** checked
    against independent validation cases (§5) — agreement between our two codes alone
    proves nothing.
  - Missions, constellation, cost: TypeScript property tests (monotonicity, limiting cases,
    unit sanity). No parallel Python copy.
- **Charts:** Plotly.js cartesian partial bundle, lazy-loaded behind a thin chart wrapper.
- **Maps:** d3-geo 2D map first (v2); globe.gl lazy-loaded later (v3). No Cesium.
- **Coverage simulator (v2):** Web Worker (Vite `new Worker(new URL(...))` + Comlink).
  Latitude-row spatial indexing; longitude symmetry; runs at discrete altitudes, never on live
  slider drag. Bracket satellite counts analytically, then simulate a few candidates.
  Precomputed tables for default requirements if needed.
- **Shareable links:** URL state with a schema version from day one; encode only differences
  from a preset. Versioned snapshots deployed on Pages (e.g. `/v1.0/`) so course links stay
  reproducible after physics fixes.
- **CI:** typecheck, lint, Vitest, pytest; deploy to Pages on `main`.

---

## 7. App experience

1. **Explore:** grouped sliders; live output cards. Changed outputs flash ↑/↓ with % change.
   Tap a card → equation, assumptions, reference.
2. **Altitude trade curves:** any output vs altitude with solar min/max band; infeasible
   regions hatched; linear vs exponential behaviour labelled.
3. **Mission sizing:** optical / SAR / direct-to-device; set the requirement; see payload,
   satellites needed and cost at each altitude.
4. **Cost:** the U-curve as a band, the breakdown, the optimum altitude range.
5. **Sensitivity:** tornado chart.
6. **How it connects:** static diagram of the sizing loop and dependencies (v1); interactive
   cause → effect graph (v3).
7. **Constellation view (v2):** 2D revisit and coverage map; globe in v3.
8. **Scenarios and problem sets:** presets across the band; shareable versioned links.
9. **Units:** SI default; µN/mN, W, kg, m/s, days/years, $M.

---

## 8. Roadmap

| Phase | Release | Deliverable | Done when |
|---|---|---|---|
| 0 | — | Plan; `docs/physics.md`; license | Equations, units, references written down |
| 1 | — | Python reference (physics + atmosphere), atmosphere tables, validation tests, golden vectors | Matches GOCE / ISS / hand-calc checks |
| 2 | — | Web skeleton, TS physics core, CI, Pages deploy | TS passes golden vectors; site live |
| 3 | **v1.0** ✅ | Explore, altitude trade curves, explanation cards, solar bands, closed sizing loop, infeasible regions | Student can answer "why" for every number |
| 3a | **v1.1** ✅ | Info pop-ups on every input (what it is, typical values, what it drives, design insight, reference; highlights affected results); tab layout: Explore / Propulsion trade / Heritage missions | Every input explained in place, on desktop and phone |
| 3b | **v1.2** ✅ | As-built mode (fixed mass, area, power, thruster) alongside Design mode; heritage missions — GOCE, SLATS, CHAMP, SOAR, Starlink Feb 2022 storm batch, Albedo Clarity-1 — each with sourced parameters (published vs estimated) and real outcome vs model | Each heritage mission loads and its outcome is compared with the model |
| 3c | **v1.3** ✅ | Propulsion trade page (technical, no cost): tank mass per technology; optimal-Isp curve; "winner map" (altitude × life, size or power); life vs altitude per technology; comparison table | Shows which technology does the mission best where, on a fair basis |
| 3d | **v1.4** ✅ | Constellation tab (technical, no cost): coverage type (revisit or continuous), off-nadir or minimum-elevation angle, latitude band; footprint and swath, analytic satellites needed (~1/h revisit, ~1/h² continuous), replacement rate, **mass to orbit per year** to sustain the constellation vs altitude, optimum altitude | U-curve of mass to orbit per year with the optimum marked |
| 3e | **v1.5** ✅ | Requirement-based payloads (optical GSD, radar NESZ with ambiguity-limited antenna, direct-to-device cell size and uplink); cost model (learning curve, launch, operations; low–high bands; cost per km² imaged or per cell); 10% near-optimum bands; Python reference for the sizing loop | Each mission gives a mass and a cost U-curve with its optimum band |
| 4 | **v1** | Three missions ✅; analytic satellite counts ✅; simple cost model ✅; **U-curve** ✅; tornado chart | Headline chart works for all three missions |
| 5 | **v2** | Coverage simulator, 2D map, downlink, deployment, Monte Carlo | Analytic counts verified by simulation |
| 6 | **v3** | Optimizer / Pareto; globe; interactive cause → effect graph; air-breathing what-if | Feature-complete |
| 7 | — | Problem sets, accessibility, docs polish | Usable in a course |

Each release is a complete, showable app.

---

## 9. Prior art (surveyed Oct 2026)

No existing tool combines VLEO focus + propulsion/power/life coupling + constellation sizing
+ cost + teaching explanations in a browser.

| Category | Examples | What they do | Gap we fill |
|---|---|---|---|
| Professional tools | Ansys STK Lifetime, NASA DAS, ESA DRAMA/OSCAR, GMAT | High-fidelity decay/lifetime | Desktop, expert UI, licences/applications; no "why" |
| Research code (VLEO) | ADBSat (GPLv3, drag coefficients), VLEO-DSMC, air-breathing simulators | One subsystem in depth | Not interactive, not teaching-oriented |
| Educational orbit apps | Orbital Lab, Orbit Architect, Orbital Simulator: Explorer, OrbitCalc | Keplerian orbits, transfers, Δv lessons | No drag, propulsion, lifetime, constellation or cost |
| Web calculators | Orbit-decay and storm-drag calculators | Single-formula lifetime | Crude atmosphere, no trade linkage |
| Teaching papers | Lira 2015 (*Physics Education*); arXiv 2508.19549 (2025) | Simplified analytical decay | Text only — good references and validation |

---

## 10. Decision log

| Date | Decision |
|---|---|
| Oct 2026 | Purely academic, vendor-neutral, public repo |
| Oct 2026 | Web app (TypeScript + React), responsive; offline not required |
| Oct 2026 | Constellation size, coverage and revisit are first-class trades |
| Oct 2026 | Cost and replenishment model included; economics stop at cost per unit of service |
| Oct 2026 | v1 missions: optical EO, SAR, direct-to-device comms |
| Oct 2026 | Name: **VLEO Trade Study Explorer**; license: **MIT** |
| Oct 2026 | Mass change modelled (time-stepped). Rationale corrected after review: at constant altitude propellant life = m_prop·g₀·Isp/D, independent of mass; mass matters for descent, post-failure decay and time-varying solar activity |
| Oct 2026 | Independent review applied: corrected SAR, revisit, direct-to-device and eclipse scalings; closed sizing loop; analytic U-curve moved into v1; orbit-averaged, F10.7/Ap-gridded atmosphere |
| Oct 2026 | Cost shown in dollars as low–high bands, 1–2 significant figures, breakdown always visible |
| Oct 2026 | Solar activity: both exploration mode (low/moderate/high) and mission-life mode (launch year) |
| Oct 2026 | Air-breathing what-if in v3 |
| Oct 2026 | Charts: Plotly.js cartesian partial bundle, lazy-loaded |
| Nov 2026 | v1.0 live on GitHub Pages; single-satellite depth (v1.1–v1.3) comes before missions and cost |
| Nov 2026 | Heritage missions include commercial cases (Starlink storm batch, Albedo Clarity-1) alongside government and academic missions |
| Nov 2026 | v1.4 adds payload growth with altitude, (h/300 km)^k, as the right wall of the mass-per-year curve until v2 requirement-based payload sizing |
| Nov 2026 | Overview landing tab added (purpose, quick start, how tabs connect, assumptions, next steps). Tab order: Overview, Heritage missions, Explore, Propulsion trade, Constellation |
| Nov 2026 | Propulsion estimates reviewed by the author: xenon tank 0.15, krypton tank 0.30 (new krypton Hall class), Hall fixed 2.5 kg, gridded ion fixed 1.5 kg; minimum power Hall 75 W, electrospray 2 W, gridded ion 40 W, RF 20 W. Independent literature check commissioned |
| Nov 2026 | Efficiencies corrected to small-satellite power levels from a public-data review (ion 0.20, Hall Xe 0.35, Kr 0.26, FEEP 0.15, RF 0.12); simple thruster wear model (units for total impulse) with an "ignore wear" sensitivity switch; RF plasma uses flight-class values (4 kg, 100 W); Explore default thruster changed to Hall (xenon) |
| Nov 2026 | Propulsion 101 tab added (concepts, at-a-glance chart, a card and schematic per technology), fact-checked by an independent agent; RF plasma minimum power set to 50 W after the fact-check found a ~30–60 W flight unit. Propulsion trade gains spacecraft-size presets and a wear-life what-if |
| Nov 2026 | Propulsion 101 moved off the main tabs into a linked sub-page (from Overview › Reference, Explore's technology picker, and the Propulsion trade page), with a contents list and back links |
| Nov 2026 | Extend the Python reference model to the sizing loop (and later constellation and trade) for independent validation and future reuse |
| Nov 2026 | Add an orbit-type choice (dawn-dusk / noon SSO / other) that sets β automatically — not urgent |
| Nov 2026 | Overview wording: "Explore VLEO and how propulsion technologies may support it"; cost model moved up the roadmap |
| Nov 2026 | Not modelled for now, stated as assumptions: per-module thruster mass and wear life, battery mass; colour-blind patterns deferred |
| Nov 2026 | ISS removed from heritage missions: too large, and relies on visiting vehicles for reboost rather than its own drag makeup |
| Nov 2026 | Corrected presets to published thrust-to-power: electrospray η 0.35 (≈48 µN/W), RF plasma η 0.15 (≈38 µN/W); added per-technology tank fraction and fixed system mass (teaching estimates) |
| Nov 2026 | v1.4 constellation tab added before missions and cost; uses mass to orbit per year as a technical proxy for cost |
| Nov 2026 | Propulsion comparison is purely technical. Default basis: equal total (wet) mass, compare capability (life, minimum altitude); alternative: equal mission requirement, compare total mass. "Equal propellant mass" shown only to explain why it misleads |
| Nov 2026 | Electrospray preset reviewed against public literature and independently fact-checked: η 0.35 kept and defined as system-level including PPU losses; Isp range stated as 150–4,000 s (droplet to pure-ion; 1,500 s is the top end for small modules); wear life per module raised from 100 to **300 N·s with a 50–2,000 N·s band** scaled from public life tests (top end from ST7 droplet-mode heritage only), hours at rated thrust shown next to N·s; wear values labelled "preset" not "published"; AeroCube-8 added to the Propulsion 101 card |
| Nov 2026 | Python reference extended to the closed sizing loop and As-built mode, solved by a different method (closed-form array/power per trial mass + root-find) from the TypeScript fixed-point iteration; 13 golden cases agree to 10⁻⁵. Next for the reference: constellation and trade |
| Nov 2026 | Requirement-based payload sizing replaces (h/300 km)^k as the Constellation default (scaling kept as an option): optical aperture from diffraction-matched GSD; radar antenna at 1.2× the ambiguity-limited minimum with power from NESZ (≈3 m resolution); phone-link antenna from cell size and uplink, with power scaled to keep the same power per cell (fact-check finding). New `payloadDragArea_m2` input for edge-on antennas. Fact-checked independently |
| Nov 2026 | Cost model added as teaching estimates in low–high bands: first-unit $/kg (bus, payload) with a quantity-based learning curve, launch $/kg, per-satellite and fixed operations; cost per km² imaged (imaging) or per cell-year (phone service), labelled a cost to collect, not a price. Optima shown with the band of altitudes within 10% |
| Nov 2026 | Cost fact-check applied: Wright cumulative-average learning (95/90/85% by quantity, SMAD 3rd ed. after Meisl & Morales) applied by segment so cost is continuous; imaging duty lowered (optical 2%, radar 5%) and cost per km² labelled an upper bound (downlink not modelled), with the gap to market prices explained; operations high end raised (per satellite $400k, fixed $15M per year); dollars stated as ~2025 US$ |
| Nov 2026 | Google Tag Manager (GTM-5T75378Z) added to the page head so the owner can see site traffic |

## 11. Open questions

- None blocking.

## 12. Guardrails for a public repo

- Public, citable data only (NASA, ESA, textbooks, published papers).
- Propulsion presets are **generic technology classes**, not vendor products.
- Heritage missions are historical public records (government, academic and commercial), each parameter cited and marked published or estimated.
- No company-specific, proprietary or non-public information of any kind.
- Cost figures are labelled teaching assumptions, not market data.

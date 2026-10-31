# VLEO Explorer — Project Plan

An interactive mobile app for understanding **very low Earth orbit (VLEO)** trade-offs.
Move a slider (altitude, spacecraft size, propellant, thruster type, solar activity) and
watch every dependent quantity — drag, thrust and power needed, propellant burn, mission
life — update, with the equation and a plain-language "why" behind each one.

- **Audience:** upper-division undergraduate / master's level aerospace coursework, and
  engineers new to VLEO.
- **Platforms:** Android first, iOS second, from one shared codebase.
- **Repo:** public, open source.
- **Scope:** purely academic and vendor-neutral. Covers the full VLEO band (~150–450 km), with
  comparison up to 600 km. Uses only public, textbook-level data; no company-specific content.

Status legend: ✅ decided · 🟡 proposed default (confirm) · ❓ open question

---

## 1. Goals and non-goals

**Goals**
1. Make the core VLEO trade visible: *lower altitude = better sensing/links but
   exponentially more drag → more thrust, power and propellant → shorter life.*
2. Show cause → effect: change one input, see which outputs move and by how much.
3. Be honest about uncertainty: solar activity changes drag several-fold; show bands,
   not single numbers.
4. Teach: every output has its equation, assumptions, and a reference (Vallado, SMAD, etc.).
5. Be numerically trustworthy: physics core validated against hand calcs and real missions
   (GOCE, SLATS, ISS decay).

**Non-goals (v1)**
- Not a high-fidelity orbit propagator (no full numerical propagation with J2+drag+SRP in v1).
- Not a mission-design tool for real flight decisions.
- No accounts, servers, or ads. Runs fully offline (works at sea).

---

## 2. The model ("trade engine")

### Inputs
| Group | Parameter | Range / default |
|---|---|---|
| Orbit | Altitude *h* | 150–600 km; VLEO band 150–450 km highlighted (default 300) |
| | Inclination *i* | 0–98° (affects ground track/coverage; sun-sync option) |
| | Eccentricity | circular only in v1 |
| Spacecraft | Wet mass *m* | 5–1,500 kg (default 100) |
| | Frontal area *A* (body) | 0.01–5 m² |
| | Solar array area + orientation (edge-on vs sun-tracking) | adds drag area, sets power |
| | Drag coefficient *C_D* | 2.0–2.6 (default 2.2) |
| Propulsion | Type preset (cold gas, monoprop, electrospray, FEEP, gridded ion, Hall, RF, air-breathing*) | sets Isp, thrust/power, efficiency |
| | Isp, max thrust, thrust-to-power (µN/W), efficiency η | editable after preset |
| | Propellant mass | 0–50% of wet mass |
| Power | Power available to propulsion (W) | derived from arrays, or set directly |
| Environment | Solar activity | low / moderate / high (F10.7, Ap) |

\*Air-breathing shown as a "what-if" with a clear "unproven in flight" label.

### Outputs (each with equation + explanation card)
| Output | Core relation |
|---|---|
| Orbital speed, period, orbits/day | v = √(μ/r), T = 2π√(r³/μ) |
| Atmospheric density ρ(h, solar) | lookup tables from NRLMSIS 2.0 (see §3) |
| Drag force | D = ½ ρ v² C_D A |
| Ballistic coefficient | B = m / (C_D A) |
| Natural decay rate & lifetime with no thrust | da/dt = −√(μa) ρ / B, integrated over altitude |
| Δv per year to hold altitude | Δv/yr = (D/m) · seconds/yr |
| Thrust required (continuous) | T_req = D (plus margin) |
| Power required | P = T · g₀ · Isp / (2η) |
| Propellant flow & burn per year | ṁ = T / (g₀ Isp) |
| **Mission life (propellant-limited)** | m_prop / ṁ (with rocket equation as mass drops) |
| Thrust/drag margin; minimum sustainable altitude | altitude where max thrust = drag |
| Descent from rideshare orbit (e.g., 500→250 km) | Δv ≈ v₂ − v₁ (low-thrust spiral), time ≈ Δv·m/T |
| Post-mission disposal time | decay lifetime from end-of-life altitude vs. 5-year rule |
| Sensing/comm benefit (relative) | GSD ∝ h; link power ∝ 1/h² vs. reference altitude |
| Footprint / swath at a given off-nadir angle | spherical-Earth geometry |
| Atomic-oxygen fluence (relative) | n_O · v · t (from MSIS O density) |

### Key insights the app should make obvious
- Drag grows roughly exponentially as altitude drops (scale height ~ 30–60 km in VLEO).
- Solar max can multiply drag 3–10× vs solar min at the same altitude.
- Thrust-per-watt vs Isp: high-Isp thrusters save propellant but need more power per mN.
- Solar arrays give power but add drag — a closed loop the user can explore.
- Ballistic coefficient (dense, slim spacecraft) is the single biggest lever on life.

---

## 3. Physics data and references

- **Atmosphere:** precompute density (total + atomic O) vs altitude (100–1,000 km, 1 km steps)
  for 3–5 solar-activity levels using **NRLMSIS 2.0** (Python `pymsis`). Ship as a small JSON/CSV
  table; interpolate log-density in-app. Fallback/teaching mode: piecewise-exponential
  atmosphere (Vallado Table 8-4) so students can compare models.
- **References** (cite in each explanation card):
  - Vallado, *Fundamentals of Astrodynamics and Applications* — drag, decay, atmosphere tables.
  - Wertz et al., *Space Mission Engineering: The New SMAD* — sizing, lifetime, coverage.
  - King-Hele, *Satellite Orbits in an Atmosphere* — decay theory.
  - NASA SST State of the Art, In-Space Propulsion chapter — thruster parameter ranges.
  - Goebel & Katz, *Fundamentals of Electric Propulsion* — P = T·g₀·Isp/(2η).
- **Validation cases** (golden tests):
  - GOCE (~1,000 kg, ~1.1 m² frontal, ~255–280 km, 1–20 mN ion thrust).
  - JAXA SLATS (Tsubame) low-altitude hold and descent.
  - ISS decay rate (~2 km/month order at solar max) as a sanity check.
  - Hand calcs at 250 km: orbits/day ≈ 16; drag of order mN per m².

---

## 4. Architecture

🟡 **Kotlin Multiplatform + Compose Multiplatform**
- Native Kotlin/Compose on Android (first-class, Play Store-ready).
- Same physics core **and** UI compile to iOS (Compose Multiplatform for iOS is stable since 2025).
- Physics core is a pure-Kotlin module with no UI deps → easy to unit-test.
- Alternative considered: Flutter (also cross-platform, Dart). KMP chosen because Android is
  the priority and the physics core stays in a mainstream, strongly-typed JVM language.

```
vleo-explorer/
├── reference/            Python reference model + notebooks (the "truth")
│   ├── vleo_model.py     same equations as the app, readable
│   ├── build_atmos.py    generates atmosphere tables from pymsis
│   ├── notebooks/        validation vs GOCE, SLATS, ISS
│   └── golden/*.json     test vectors consumed by Kotlin tests
├── shared/               KMP module
│   ├── physics/          pure Kotlin trade engine
│   ├── data/             atmosphere tables, thruster presets, scenario presets
│   └── ui/               Compose Multiplatform screens
├── androidApp/
├── iosApp/               (phase 6)
└── docs/                 physics spec, equations, references
```

**Golden-vector testing:** Python reference model generates input→output JSON; Kotlin tests
must match within tolerance. Keeps the app honest and lets the Python side be the notebook
playground.

🟡 Charts: Vico (Android) or Koalaplot (multiplatform) — decide in phase 3.

---

## 5. App experience

1. **Explore (main screen):** grouped sliders on top/left, live output cards below.
   Changed outputs flash with ↑/↓ and % change. Tap a card → equation, assumptions, reference.
2. **Trade curves:** pick an x-axis input (e.g., altitude), plot any output, with solar
   min/max band. Overlay up to 3 thruster types.
3. **Cause → effect map:** dependency graph of inputs → intermediates → outputs; highlight
   the path from the slider being moved.
4. **Sensitivity (tornado chart):** ±20% on each input → effect on mission life.
5. **Scenarios:** presets spanning the VLEO band — 6U CubeSat at 400 km, ~150 kg smallsat at
   300 km, GOCE-like at 260 km, SLATS-like low hold at 180 km, a large broadband-class satellite
   at 350 km, "rideshare then descend". Save/compare your own.
6. **Learn / problem sets:** short guided exercises ("find the lowest altitude a 100 kg
   satellite with 100 W can hold at solar max").
7. **Units toggle:** SI default; show µN/mN, W, kg, m/s, days/years.

---

## 6. Phased roadmap

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Repo, this plan, `docs/physics.md` spec, license | Equations + references written down |
| 1 | Python reference model + atmosphere tables + validation notebook | Matches GOCE/ISS sanity checks; golden vectors generated |
| 2 | KMP skeleton + Kotlin physics core | Kotlin passes all golden-vector tests in CI |
| 3 | Android MVP: Explore screen, 6 key outputs, one trade chart | Installable APK sideloaded on an Android phone |
| 4 | Explanation cards, solar bands, scenarios, units | A student can answer "why" for every number |
| 5 | Sensitivity, dependency map, descent planner, coverage/imaging, problem sets | Feature-complete v1 |
| 6 | iOS build | Runs on iPhone simulator + TestFlight |
| 7 | Public release | Play Store (closed test: new personal dev accounts need 12 testers × 14 days), App Store |

CI: GitHub Actions — Python tests, Kotlin tests, Android debug build on each push.

---

## 7. Prior art (surveyed Oct 2026)

No existing app combines VLEO focus + propulsion/power/propellant/life coupling + teaching
explanations + mobile/offline. Closest neighbours:

| Category | Examples | What they do | Gap we fill |
|---|---|---|---|
| Professional tools | Ansys STK Lifetime, NASA DAS, ESA DRAMA/OSCAR, GMAT | High-fidelity decay/lifetime | Desktop, expert UI, licences/applications; no "why" |
| Research code (VLEO) | ADBSat (GPLv3, drag coefficients), VLEO-DSMC, ABEP simulators | One subsystem in depth | Not interactive, not teaching-oriented |
| Educational orbit apps | Orbital Lab, Orbit Architect, Orbital Simulator: Explorer, OrbitCalc | Keplerian orbits, transfers, Δv lessons | No drag, propulsion or lifetime |
| Web calculators | Orbit decay / storm drag calculators | Single-formula lifetime | Crude atmosphere, no trade linkage |
| Teaching papers | Lira 2015 (*Physics Education*), arXiv 2508.19549 (2025) | Simplified analytical decay for students | Text only — good references/validation |

Ideas to borrow: Orbital Lab's "lesson completes only when you do the task"; DRAMA/OSCAR's
solar-activity scenarios; ADBSat-derived C_D values for presets; DAS/STK lifetime numbers as
cross-checks.

## 8. Open questions

- ❓ Name: "VLEO Explorer" OK?
- ❓ License: 🟡 MIT (simplest) vs Apache-2.0 (patent grant).
- ❓ Mass changes over life (rocket equation) in v1, or constant mass first?
- ❓ Include eccentric orbits / perigee-only drag later?
- ❓ Include air-breathing as a what-if in v1, or later?
- ❓ Tablet/landscape layout priority (useful for coursework/lecture demos)?
- ❓ Any instructor/course to pilot with?

## 9. Guardrails for a public repo

- Use only public, citable data (NASA SST, textbooks, published mission papers).
- Thruster presets are **generic technology classes**, not specific vendor products.
- No company-specific, proprietary, or non-public information of any kind. Purely academic.

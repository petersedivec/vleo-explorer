# VLEO Explorer — Planning Handoff

Where planning stands (Oct 2026). Read with `PLAN.md`. Where they disagree, this file is
newer: `PLAN.md` still describes the earlier native-app (Kotlin Multiplatform, offline) design.

## Decisions made
- **Purpose:** help someone new to the field understand the mission trade space for
  developing a VLEO constellation. Aimed at upper-undergraduate / master's coursework.
- **Purely academic and vendor-neutral.** Public, citable data only. No company-specific info.
- **Public GitHub repo:** `petersedivec/vleo-explorer` (empty; nothing pushed yet).
- **Web app**, responsive for desktop, tablet and phone. **Offline not required.**
  - Proposed stack: TypeScript + React + Vite; charts with Plotly or ECharts; globe with
    CesiumJS or globe.gl; hosted on GitHub Pages.
  - Keep a Python reference model to generate golden test vectors for the TypeScript physics core.
- **Constellation scope added:** constellation size, coverage area, and revisit frequency
  are first-class trades ("lower orbit means more satellites").

## Core teaching idea
Drag-driven costs grow **exponentially** as altitude drops; mission benefits improve only
**polynomially**. That mismatch is why an optimum altitude exists.

| Quantity | Scales with altitude h | Shape |
|---|---|---|
| Density, drag, propellant burn, atomic-oxygen erosion | ~e^(−h/H), H ≈ 30–60 km | Exponential (×3–10 with solar activity) |
| Natural decay / disposal time | ~e^(+h/H) | Exponential |
| Optical ground sample distance (GSD), fixed aperture | ∝ h | Linear |
| Aperture needed for a fixed GSD | ∝ h | Linear |
| RF link strength (comms, direct-to-device) | ∝ 1/h² | Inverse square |
| SAR signal-to-noise ratio | ∝ 1/h³ | Inverse cube |
| Swath / footprint at fixed off-nadir angle | swath ∝ h, area ∝ ~h² | Quadratic |
| Satellites needed for coverage | ∝ ~1/h² | Inverse square |
| Pass duration / downlink contact time | ∝ ~h | Linear |
| Period / latency | 88–94 min across band | ~flat |
| Radiation dose, debris / collision risk | lower when lower | Benefits |

## Candidate missions (each as a preset with a requirement)
Optical Earth observation; synthetic aperture radar (SAR); RF / signals sensing; broadband
and direct-to-device comms; IoT / data relay; science (gravity, upper atmosphere); LEO
navigation (PNT) augmentation; short-life tactical missions (30–90 days).

## Added trades (beyond the single-satellite model in PLAN.md)
1. **Cost and replenishment:** sats × unit cost ÷ lifetime + launches + ground segment, per
   year. The U-shaped curve against altitude is the headline output.
2. **Walker constellation geometry:** planes, sats per plane, inclination, phasing.
3. **Coverage metrics:** mean and maximum revisit, percent of time covered, coverage by
   latitude, response time.
4. **Data downlink:** shorter passes, so more ground stations or inter-satellite links.
5. **Power and orbit choice:** dawn-dusk sun-synchronous orbit (arrays edge-on, little eclipse).
   Arrays add both power and drag.
6. **Launch date across the 11-year solar cycle** (next minimum ~2030).
7. **Deployment:** launches needed, sats per launch, rideshare-then-descend time.
8. **Thruster life:** total impulse and operating hours, not just propellant.
9. **Uncertainty:** Monte Carlo over solar activity and drag coefficient; P10/P50/P90 bands.
10. **Optimizer / Pareto view:** set the requirements, sweep altitude × sat count × propulsion,
    show the cost-vs-performance Pareto front.

## Proposed phasing
- **v1:** single-satellite trade engine + mission benefit curves.
- **v2:** constellation sizing, coverage and revisit, globe view.
- **v3:** cost model, uncertainty, optimizer.

## Open questions (awaiting Peter)
1. OK with TypeScript + React (learning TS)?
2. Include the cost/replenishment model with editable, clearly labelled rough assumptions?
3. Which 3–4 missions in v1? (Suggested: optical, SAR, direct-to-device comms, science.)
4. Peter's review feedback on `PLAN.md`.
5. License (MIT vs Apache-2.0); name "VLEO Explorer" OK?

## Next step
Rewrite `PLAN.md` for the web-app + constellation design, get approval, then make the first
push. Pushing needs the Claude GitHub App to have access to `vleo-explorer`.

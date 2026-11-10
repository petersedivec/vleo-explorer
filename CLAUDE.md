# CLAUDE.md — VLEO Trade Study Explorer

Context for Claude Code sessions on this repository. Read this first; then `PLAN.md` (scope, roadmap,
decision log) and `docs/physics.md` (every equation, value and source).

## What this is

A public, interactive web app that teaches the trade space of **very low Earth orbit (VLEO, ~150–450 km)**
and how propulsion technologies may support it: altitude vs drag, power, propellant, mission life,
constellation size, and which thruster does the job best where.

- **Live:** https://petersedivec.github.io/vleo-explorer/ (GitHub Pages, deployed by CI on every push to `main`).
- **Audience:** upper-undergraduate / master's students and engineers or business people new to VLEO.
  Also the owner's own learning tool.
- **Owner:** Peter Sedivec — mechanical engineer, former Boeing satellite attitude-control engineer and
  data scientist; strong in Python, learning TypeScript. Wants plain explanations of trade-offs and clear,
  honest caveats.

## Non-negotiable rules

- **Purely academic and vendor-neutral.** Public, citable data only. Technologies are generic classes, not
  products. Name missions, not makers (the owner works for an electrospray-thruster company; the app must
  not favour or disparage any vendor).
- **No non-public information** of any kind — including claims a company has not published (e.g. "wear
  is solved"). Model such claims only as labelled what-ifs.
- **Every parameter is either published (with source) or estimated (with reasoning).** Teaching estimates
  are labelled as such in the UI and in `docs/physics.md`.
- **Don't overstate precision.** Show bands across solar activity, ties within 10%, and what is not modelled.
- **When the model disagrees with reality, say so** (see the heritage model-vs-reality checks).
- `docs/physics.md` is the source of truth for equations. Code and doc must agree; update both together.
- Fact-check new educational content with an independent sub-agent before shipping, then let the owner review.

## Repository layout

| Path | Contents |
|---|---|
| `PLAN.md` | Goals, scope, roadmap, **decision log** (append new decisions there) |
| `docs/physics.md` | Equation spec, presets, sources |
| `reference/` | Python reference model (physics + atmosphere), NRLMSIS table generator, validation tests, golden vectors |
| `web/src/model/` | Pure TypeScript model: `satellite.ts` (closed sizing loop, as-built), `atmosphere.ts`, `drag.ts`, `propulsion.ts` (presets), `propulsionTrade.ts`, `constellation.ts`, `heritage.ts` |
| `web/src/data/` | `atmosphere.json` (generated), `heritage.ts` (missions, sourced), `propulsion101.ts` (primer content) |
| `web/src/ui/` | React UI. Tabs: `Overview`, `Heritage`, Explore (`Controls`/`Cards`/`ExploreCharts`), `PropulsionTrade`, `Constellation`; sub-page `Propulsion101` (reached by links, not a main tab) |
| `web/src/ui/inputInfo.ts` | Explanation text for every input (owner reviews this) |
| `.github/workflows/ci.yml` | Python tests, lint, typecheck, Vitest, build, Pages deploy |

Tab order: Overview, Heritage missions, Explore, Propulsion trade, Constellation. Explore's satellite is
shared with the other tabs. URL hash holds state (`#tab=…&v=1&…`; schema-versioned, validated on decode).

## Build and test

```bash
cd web && npm ci
npm run dev            # http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build

cd reference
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python -m pytest -q    # validation vs Vallado, ISS, GOCE, Edelbaum, analytic decay
python build_atmos.py  # regenerate web/src/data/atmosphere.json (pymsis pinned)
python make_golden.py  # regenerate golden vectors used by web/src/model/golden.test.ts
```

Before pushing: run all of the above and check the app in a browser at desktop and phone widths
(no horizontal scroll, no console errors). Playwright + Chromium are available in cloud sessions.

## Conventions

- SI units inside the model; unit-suffixed names (`thrust_N`, `altitude_m`). No React in `web/src/model/`.
- Teaching numbers live in one place (`propulsion.ts` presets, `heritage.ts`, `inputInfo.ts`,
  `propulsion101.ts`); UI tables are generated from them so they cannot drift.
- Commit to `main` (solo project); CI deploys. Commit messages explain what and why.
- Plain English in UI text; define jargon on first use.

## Status (Nov 2026)

v1.0–v1.4 built: single-satellite sizing loop with As-built mode; heritage missions with sourced data and
model-vs-reality checks; propulsion trade (winner map, optimal-Isp curve, equal-mass comparison, thruster
wear model, size presets, what-if wear life, fairness toggles); constellation sizing (satellites, replacement,
mass to orbit per year, optimum altitude); Overview landing page; Propulsion 101 sub-page (fact-checked).

## Open items and next steps

**Waiting on the owner**
- Review `web/src/ui/inputInfo.ts` and the Propulsion 101 cards (especially electrospray, FEEP, Hall).
- Check chart ranges and per-unit wear lives against NASA's Small Spacecraft Technology State of the Art,
  In-Space Propulsion chapter (nasa.gov was not reachable from the cloud sessions so far).

**Next to build (agreed, in rough order)**
1. Extend the Python reference model to the sizing loop (then constellation and trade) for independent
   validation and future reuse.
2. Requirement-based payload sizing for the three missions — optical (GSD), SAR (NESZ, ambiguity-limited
   antenna), direct-to-device (uplink-limited antenna) — replacing the (h/300 km)^k payload scaling.
3. Cost model: satellites, launch, replacement and operations → cost per year and cost per unit of service
   (dollars as low–high bands, 1–2 significant figures, breakdown always visible).
4. Coverage simulator and 2D revisit map to check analytic satellite counts; ground stations and downlink.
5. Time-varying solar cycle (pick a launch year).
6. Orbit-type choice (dawn-dusk / noon sun-synchronous / other) that sets the sun angle β automatically.
7. Uncertainty bands (Monte Carlo) on life, satellite count and mass.
8. Battery mass; thruster efficiency that varies with operating power.
9. Optimizer across altitude, satellite count and propulsion.
10. Air-breathing electric propulsion as a labelled what-if.

**Deliberately left out for now** (stated in the app as assumptions): battery mass, per-module mass beyond
the simple wear model, colour-blind patterns on the winner map.

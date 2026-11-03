# VLEO Trade Study Explorer

An interactive web app for understanding the mission trade space of **very low Earth orbit
(VLEO)** satellites and constellations (~150–450 km). Move a slider — altitude, spacecraft
size, propulsion, propellant, solar activity — and see drag, thrust and power needed, mission
life and disposal time update, each with its equation and a plain-language explanation.

Built for upper-division undergraduate and master's coursework, and for engineers and business
people new to VLEO. Purely academic and vendor-neutral.

**Live app:** https://petersedivec.github.io/vleo-explorer/

## Status

v1.4. Working now: single-satellite trade engine with a closed mass/power/drag sizing loop and an
As-built mode; NRLMSIS 2.1 atmosphere across the solar cycle; mission life, no-thrust lifetime and
disposal; altitude trade curves; an explanation for every input; and six heritage missions (GOCE,
SLATS, CHAMP, SOAR, the February 2022 Starlink batch, Albedo Clarity-1) with sourced parameters
and model-vs-reality checks; and a propulsion trade page (winner map, optimal-Isp curve, equal-mass
comparison); and constellation sizing (satellites needed, replacement rate, mass to orbit per year and
the optimum altitude). Next: requirement-based mission sizing and cost.
See [PLAN.md](PLAN.md).

## Repository

| Path | Contents |
|---|---|
| [`PLAN.md`](PLAN.md) | Goals, scope, roadmap, decisions |
| [`docs/physics.md`](docs/physics.md) | Equation specification — the source of truth |
| [`reference/`](reference) | Python reference model, atmosphere-table generator, validation tests, golden vectors |
| [`web/`](web) | TypeScript + React + Vite app; `src/model/` is the pure model, `src/ui/` the interface |

## Development

```bash
# Web app
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # model tests, including golden vectors from the Python reference

# Python reference
cd reference
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m pytest            # validation against textbook and mission cases
python build_atmos.py       # regenerate atmosphere tables (NRLMSIS 2.1 via pymsis)
python make_golden.py       # regenerate golden vectors for the TypeScript tests
```

## License

MIT — see [LICENSE](LICENSE).

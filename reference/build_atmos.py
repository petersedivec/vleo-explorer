#!/usr/bin/env python3
"""Generate orbit-averaged NRLMSIS 2.1 density tables (docs/physics.md §2.1).

Writes web/src/data/atmosphere.json with log10 total mass density (kg/m^3) and log10
atomic-oxygen number density (m^-3) on an altitude x F10.7 x Ap x inclination grid.
"""

import hashlib
import json
from pathlib import Path

import numpy as np
import pymsis

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "src" / "data" / "atmosphere.json"

ALTITUDES_KM = np.arange(100, 1001, 5)
F107 = [70, 100, 150, 200, 250]
AP = [4, 15, 50, 150]
INCLINATIONS_DEG = [0.0, 30.0, 45.0, 53.0, 70.0, 97.5]

N_U = 18  # argument-of-latitude samples on [0, pi/2]
LONGITUDES = np.arange(0, 360, 45)  # 8 local times at fixed UT
DATES = np.array(
    ["2024-03-20T12:00", "2024-06-21T12:00", "2024-09-22T12:00", "2024-12-21T12:00"],
    dtype="datetime64[m]",
)


def latitudes_for(inclination_deg: float) -> np.ndarray:
    """Latitudes sampled uniformly in argument of latitude (time-weighted)."""
    u = (np.arange(N_U) + 0.5) * (np.pi / 2) / N_U
    s = np.sin(np.radians(min(inclination_deg, 180 - inclination_deg)))
    return np.degrees(np.arcsin(s * np.sin(u)))


def orbit_average(f107: float, ap: float, inclination_deg: float) -> tuple[np.ndarray, np.ndarray]:
    lats = latitudes_for(inclination_deg)
    n = len(DATES)
    out = pymsis.calculate(
        DATES,
        LONGITUDES,
        lats,
        ALTITUDES_KM,
        f107s=np.full(n, f107),
        f107as=np.full(n, f107),
        aps=np.full((n, 7), ap),
        version=2.1,
    )
    # out shape: (dates, lons, lats, alts, variables); average all but altitude.
    rho = out[..., pymsis.Variable.MASS_DENSITY].mean(axis=(0, 1, 2))
    n_o = out[..., pymsis.Variable.O].mean(axis=(0, 1, 2))
    return rho, n_o


def main() -> None:
    shape = (len(F107), len(AP), len(INCLINATIONS_DEG), len(ALTITUDES_KM))
    log_rho = np.empty(shape)
    log_o = np.empty(shape)
    for a, f in enumerate(F107):
        for b, ap in enumerate(AP):
            for c, inc in enumerate(INCLINATIONS_DEG):
                rho, n_o = orbit_average(f, ap, inc)
                log_rho[a, b, c] = np.log10(rho)
                log_o[a, b, c] = np.log10(n_o)

    table = {
        "description": "Orbit-averaged NRLMSIS 2.1 density; see docs/physics.md section 2.1",
        "generator": f"reference/build_atmos.py, pymsis {pymsis.__version__}",
        "axes": {
            "altitude_km": ALTITUDES_KM.tolist(),
            "f107_sfu": F107,
            "ap": AP,
            "inclination_deg": INCLINATIONS_DEG,
        },
        "order": ["f107_sfu", "ap", "inclination_deg", "altitude_km"],
        "log10_density_kg_m3": np.round(log_rho, 4).tolist(),
        "log10_o_number_density_m3": np.round(log_o, 4).tolist(),
    }
    text = json.dumps(table, separators=(",", ":"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)
    OUT.with_suffix(".sha256").write_text(hashlib.sha256(text.encode()).hexdigest() + "\n")
    print(f"wrote {OUT} ({len(text) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()

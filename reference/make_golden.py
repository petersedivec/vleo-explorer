#!/usr/bin/env python3
"""Write golden input -> output vectors for the TypeScript model tests."""

import json
import math
from pathlib import Path

import numpy as np

import vleo_model as vm

OUT = Path(__file__).resolve().parent / "golden" / "physics.json"
KM = 1e3


# Thruster presets used in the sizing cases. These mirror web/src/model/propulsion.ts; golden.test.ts
# checks that they still match, so a changed preset forces the golden vectors to be regenerated.
THRUSTERS = {
    "hall": vm.Thruster(1200, 0.35, 5e-3, 0, 75, 50_000, 0.7, 2.5),
    "electrospray": vm.Thruster(1500, 0.35, 0.15e-3, 0, 2, 300, 0.2, 0.5),
    "feep": vm.Thruster(3500, 0.15, 0.35e-3, 0, 10, 5_000, 0.9, 0.8),
    "monoprop": vm.Thruster(220, None, 1.0, 20, 0, math.inf, 0, 1.5),
    "rfPlasma": vm.Thruster(800, 0.12, 10e-3, 0, 50, math.inf, 0, 4),
}


def sc_with(thruster: str, **kw):
    sc = vm.Spacecraft(thruster=THRUSTERS[thruster], **kw)
    object.__setattr__(sc, "thruster_name", thruster)  # frozen dataclass; label only
    return sc


CUBESAT = dict(payload_mass_kg=2, payload_power_W=5, bus_fixed_mass_kg=3, bus_power_W=5, propellant_kg=1.0)


def sizing_cases():
    return [
        ("default Hall, 300 km", sc_with("hall")),
        ("Hall, 250 km, high solar activity", sc_with("hall", altitude_m=250e3, f107=250, ap=15)),
        ("Hall, 200 km, sun-tracking arrays", sc_with("hall", altitude_m=200e3, array_orientation="sunTracking")),
        ("Hall, 165 km: below the wall", sc_with("hall", altitude_m=165e3)),
        ("Hall, exponential atmosphere, 350 km", sc_with("hall", altitude_m=350e3, atmosphere="exponential")),
        ("Electrospray CubeSat, 350 km, 2 yr (wear sets units)", sc_with("electrospray", altitude_m=350e3, design_life_s=2 * vm.YEAR_S, **CUBESAT)),
        ("Electrospray CubeSat, 450 km, no wear", sc_with("electrospray", altitude_m=450e3, wear=False, **CUBESAT)),
        ("FEEP, 400 km, daylight-only thrust, beta 40", sc_with("feep", altitude_m=400e3, beta_deg=40, thrust_in_eclipse=False)),
        ("Monopropellant, 200 km, low solar activity", sc_with("monoprop", altitude_m=200e3, f107=70, ap=4, propellant_kg=30)),
        ("RF plasma, 280 km, 97.5 deg, payload frontal area", sc_with("rfPlasma", altitude_m=280e3, inclination_deg=97.5, payload_frontal_area_m2=0.4)),
        ("Hall, fixed body area, heavy payload", sc_with("hall", altitude_m=320e3, body_frontal_area_m2=0.8, payload_mass_kg=150, payload_power_W=300)),
        ("Hall, 260 km, edge-on antenna drag", sc_with("hall", altitude_m=260e3, payload_drag_area_m2=0.45, payload_mass_kg=58, payload_power_W=100)),
    ]


def as_built_cases():
    goce_like = sc_with("hall", altitude_m=260e3, f107=80, ap=8, inclination_deg=96.7, cd=3.0, storm_margin=1, propellant_kg=40)
    return [
        ("GOCE-like, as built", goce_like, 1000.0, 1.1, 20e-3),
        ("Small spacecraft that cannot hold 250 km", sc_with("electrospray", altitude_m=250e3), 60.0, 0.5, 0.3e-3),
    ]


def spacecraft_json(sc) -> dict:
    d = {k: getattr(sc, k) for k in vm.Spacecraft.__dataclass_fields__ if k != "thruster"}
    return {k: (None if isinstance(v, float) and math.isinf(v) else v) for k, v in d.items()}


def clean(r: dict) -> dict:
    out = {}
    for k, v in r.items():
        if isinstance(v, (float, np.floating)):
            v = float(v)
            v = None if not math.isfinite(v) else v
        elif isinstance(v, np.bool_):
            v = bool(v)
        elif isinstance(v, np.integer):
            v = int(v)
        out[k] = v
    return out


def sizing_case(name, sc) -> dict:
    return {"name": name, "inputs": spacecraft_json(sc), "thruster": sc.thruster_name, **clean(vm.size_design(sc))}


def main() -> None:
    altitudes_km = [150, 200, 240, 300, 375, 450, 600]
    orbit = [
        {
            "altitude_m": h * KM,
            "speed_m_s": vm.circular_speed_m_s(h * KM),
            "period_s": vm.period_s(h * KM),
            "orbits_per_day": vm.orbits_per_day(h * KM),
            "sso_inclination_deg": vm.sun_synchronous_inclination_deg(h * KM),
            "nodal_regression_53deg_rad_s": vm.nodal_regression_rad_s(h * KM, 53),
        }
        for h in altitudes_km
    ]

    # Include off-grid points in every axis to exercise interpolation.
    atmos_cases = [
        (h, f, ap, inc)
        for h in (152.5, 210, 300, 333.3, 450, 587)
        for f, ap in ((70, 4), (150, 15), (250, 15), (120, 30))
        for inc in (0, 53, 60, 97.5)
    ]
    t = vm.msis()
    atmosphere = [
        {
            "altitude_m": h * KM, "f107": f, "ap": ap, "inclination_deg": inc,
            "density_kg_m3": t.density_kg_m3(h * KM, f, ap, inc),
            "o_number_density_m3": t.o_number_density_m3(h * KM, f, ap, inc),
        }
        for h, f, ap, inc in atmos_cases
    ]
    exponential = [
        {"altitude_m": h * KM, "density_kg_m3": vm.exponential_density_kg_m3(h * KM)}
        for h in (100, 155, 180, 260, 300, 420, 650, 999)
    ]

    def moderate(inc):
        return lambda h: t.density_kg_m3(h, 150, 15, inc)

    decay = [
        {
            "altitude_m": h * KM, "ballistic_kg_m2": b, "f107": 150, "ap": 15, "inclination_deg": 53,
            "lifetime_s": vm.decay_lifetime_s(h * KM, b, moderate(53)),
        }
        for h, b in ((200, 30), (250, 50), (300, 50), (350, 100), (400, 20))
    ]
    eclipse = [
        {"altitude_m": h * KM, "beta_deg": beta, "fraction": vm.eclipse_fraction(h * KM, beta)}
        for h in (150, 300, 450) for beta in (0, 30, 60, 72, 75, 85)
    ]
    propulsion = [
        {
            "thrust_N": th, "isp_s": isp, "efficiency": eta,
            "power_W": vm.electric_power_W(th, isp, eta),
            "thrust_to_power_N_W": vm.thrust_to_power_N_W(isp, eta),
            "mass_flow_kg_s": vm.mass_flow_kg_s(th, isp),
        }
        for th, isp, eta in ((1e-3, 1500, 0.55), (5e-3, 2500, 0.55), (15e-3, 1400, 0.45), (0.35e-3, 4000, 0.3))
    ]
    descent = []
    for h1, h2, thrust, isp, m, area in ((500, 240, 3e-3, 1500, 80, 0.3), (550, 300, 15e-3, 1400, 150, 0.5)):
        time_s, prop = vm.descent_time_s(h1 * KM, h2 * KM, thrust, isp, m, 2.2, area, moderate(53))
        descent.append({
            "start_altitude_m": h1 * KM, "end_altitude_m": h2 * KM, "thrust_N": thrust, "isp_s": isp,
            "mass_kg": m, "cd": 2.2, "area_m2": area, "f107": 150, "ap": 15, "inclination_deg": 53,
            "edelbaum_delta_v_m_s": vm.edelbaum_delta_v_m_s(h1 * KM, h2 * KM),
            "time_s": time_s, "propellant_kg": prop,
        })

    sizing = [sizing_case(name, sc) for name, sc in sizing_cases()]
    as_built = []
    for name, sc, m, area, tmax in as_built_cases():
        r = vm.evaluate_as_built(sc, m, area, tmax)
        as_built.append({"name": name, "inputs": spacecraft_json(sc), "thruster": sc.thruster_name,
                         "dry_mass_kg": m, "drag_area_m2": area, "max_thrust_N": tmax, **clean(r)})

    missions = [
        {"altitude_m": h * KM, "gsd_m": 0.8, "nesz_dB": nesz, "cell_width_m": cell, "min_elevation_deg": el,
         "optical": clean(vm.optical_payload(h * KM, 0.8)), "sar": clean(vm.sar_payload(h * KM, nesz)),
         "d2d": clean(vm.d2d_payload(h * KM, cell, el))}
        for h, nesz, cell, el in ((200, -17, 50e3, 25), (300, -20, 30e3, 30), (450, -15, 100e3, 20), (600, -17, 2000e3, 25))
    ]

    golden = {
        "note": "Generated by reference/make_golden.py; do not edit by hand.",
        "orbit": orbit, "atmosphere": atmosphere, "exponential_atmosphere": exponential,
        "decay": decay, "eclipse": eclipse, "propulsion": propulsion, "descent": descent,
        "thrusters": {k: clean(vars(t)) for k, t in THRUSTERS.items()},
        "sizing": sizing, "as_built": as_built, "missions": missions,
    }
    OUT.write_text(json.dumps(golden, indent=1) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()

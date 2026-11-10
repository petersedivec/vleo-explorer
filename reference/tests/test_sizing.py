"""Checks on the closed sizing loop (docs/physics.md §7) that do not depend on the TypeScript model."""

import math

import numpy as np
import pytest

import vleo_model as vm

KM = 1e3
HALL = vm.Thruster(1200, 0.35, 5e-3, 0, 75, 50_000, 0.7, 2.5)
IDEAL = vm.Thruster(1500, 0.35, 1.0)  # no minimum power, one unit, no wear


def test_solution_satisfies_every_equation_in_section_7():
    """Recompute steps 1-6 of §7 by hand at the solution and check the mass balance closes."""
    sc = vm.Spacecraft(altitude_m=280 * KM, thruster=HALL, design_life_s=3 * vm.YEAR_S)
    r = vm.size_design(sc)
    assert r["feasible"]
    m, a_arr, p_thr = r["dry_mass_kg"], r["array_area_m2"], r["thruster_power_W"]

    a_body = 0.6 * (m / 400) ** (2 / 3)
    a_ref = a_body + 0.07 * a_arr  # edge-on arrays: grazing term only
    rho = vm.msis().density_kg_m3(sc.altitude_m, 150, 15, 53) * 3
    v = vm.circular_speed_m_s(sc.altitude_m)
    d_storm = 0.5 * rho * v**2 * 2.2 * a_ref
    assert r["storm_drag_N"] == pytest.approx(d_storm, rel=1e-9)

    p_needed = d_storm * vm.G0 * 1200 / (2 * 0.35)
    assert p_thr == pytest.approx(max(p_needed, 75), rel=1e-9)

    fe = vm.eclipse_fraction(sc.altitude_m, 0)
    t = vm.period_s(sc.altitude_m)
    load = 30 + 40 + p_thr  # thruster fires in eclipse too (battery)
    p_array = (load * fe * t / 0.6 + load * (1 - fe) * t / 0.8) / ((1 - fe) * t)
    assert a_arr == pytest.approx(p_array / (1361 * 0.30 * 0.85 * 0.85 * (2 / math.pi)), rel=1e-9)

    units = max(1, math.ceil(d_storm / 5e-3), math.ceil(d_storm / 3 * 3 * vm.YEAR_S / 50_000))
    assert r["thruster_units"] == units
    m_balance = (20 + 15 + 3 * a_arr + 0.02 * p_thr + 2.5 + (units - 1) * 0.7) / 0.75
    assert m == pytest.approx(m_balance, rel=1e-9)


@pytest.mark.parametrize("orientation", ["edgeOn", "sunTracking"])
def test_hard_floor_follows_loop_gain(orientation):
    """§7.1: designs with G < 0.85 close; designs with G > 1.05 do not."""
    for h_km in np.arange(150, 400, 5):
        r = vm.size_design(vm.Spacecraft(altitude_m=h_km * KM, thruster=HALL, array_orientation=orientation))
        if r["loop_gain"] < 0.85:
            assert r["feasible"] or r["infeasibility"] == "massGrowth", h_km
        if r["loop_gain"] > 1.05:
            assert not r["feasible"], h_km


def test_sun_tracking_arrays_raise_the_gain():
    edge = vm.size_design(vm.Spacecraft(altitude_m=250 * KM, thruster=HALL))
    track = vm.size_design(vm.Spacecraft(altitude_m=250 * KM, thruster=HALL, array_orientation="sunTracking"))
    assert track["loop_gain"] > 3 * edge["loop_gain"]


def test_drag_free_limit_high_up():
    """Far above VLEO, drag vanishes and the design tends to the drag-free reference."""
    r = vm.size_design(vm.Spacecraft(altitude_m=900 * KM, thruster=IDEAL))
    assert r["mass_growth"] == pytest.approx(1.0, abs=2e-3)


def test_dry_mass_falls_with_altitude_until_drag_vanishes():
    masses = [vm.size_design(vm.Spacecraft(altitude_m=h * KM, thruster=IDEAL))["dry_mass_kg"] for h in range(220, 460, 20)]
    assert all(a > b for a, b in zip(masses, masses[1:]))


def test_sizing_does_not_depend_on_propellant_mass():
    a = vm.size_design(vm.Spacecraft(propellant_kg=1, thruster=HALL))
    b = vm.size_design(vm.Spacecraft(propellant_kg=50, thruster=HALL))
    assert a["dry_mass_kg"] == pytest.approx(b["dry_mass_kg"], rel=1e-12)
    assert b["propellant_life_s"] == pytest.approx(50 * a["propellant_life_s"], rel=1e-9)


def test_wear_units_cover_the_mission_total_impulse():
    es = vm.Thruster(1500, 0.35, 0.15e-3, 0, 2, 300, 0.2, 0.5)
    for years in (0.5, 2, 5):
        sc = vm.Spacecraft(altitude_m=350 * KM, thruster=es, design_life_s=years * vm.YEAR_S,
                           payload_mass_kg=2, payload_power_W=5, bus_fixed_mass_kg=3, bus_power_W=5)
        r = vm.size_design(sc)
        assert r["thruster_units"] * 300 >= r["drag_N"] * years * vm.YEAR_S * (1 - 1e-9)
        assert (r["thruster_units"] - 1) * 300 < r["drag_N"] * years * vm.YEAR_S


def test_minimum_power_sets_the_floor_high_up():
    r = vm.size_design(vm.Spacecraft(altitude_m=450 * KM, thruster=HALL))
    assert r["thruster_power_W"] == 75


def test_as_built_goce_holds_altitude_with_margin():
    """GOCE (~1,000 kg, ~1.1 m², 1-20 mN ion engine) held ~255-260 km near solar minimum."""
    sc = vm.Spacecraft(altitude_m=260 * KM, f107=80, ap=8, inclination_deg=96.7, cd=3.0, storm_margin=1,
                       propellant_kg=40, thruster=HALL)
    r = vm.evaluate_as_built(sc, 1000, 1.1, 20e-3)
    assert r["feasible"]
    assert 1 < r["thrust_margin"] < 20

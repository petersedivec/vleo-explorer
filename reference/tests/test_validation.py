"""Validation of the reference model against independent checks (docs/physics.md §12)."""

import math

import pytest

import vleo_model as vm

KM = 1e3


def moderate(h_m, inc=53.0):
    return vm.msis().density_kg_m3(h_m, 150, 15, inc)


# ── Orbit ───────────────────────────────────────────────────────────────────────


def test_orbits_per_day_at_250_km():
    assert vm.orbits_per_day(250 * KM) == pytest.approx(16.07, abs=0.02)


def test_sun_synchronous_inclination():
    # Textbook value: ~96.9 deg at 300 km, ~97.4 deg at 500 km.
    assert vm.sun_synchronous_inclination_deg(300 * KM) == pytest.approx(96.7, abs=0.3)
    assert vm.sun_synchronous_inclination_deg(500 * KM) == pytest.approx(97.4, abs=0.3)


# ── Atmosphere ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("h_km", [200, 250, 300, 350, 400, 450, 500])
def test_msis_moderate_close_to_vallado(h_km):
    ratio = moderate(h_km * KM) / vm.exponential_density_kg_m3(h_km * KM)
    assert 1 / 3 < ratio < 3


def test_solar_cycle_ratio_grows_with_altitude():
    t = vm.msis()

    def ratio(h_km):
        return t.density_kg_m3(h_km * KM, 250, 15, 53) / t.density_kg_m3(h_km * KM, 70, 4, 53)

    assert 1.5 < ratio(200) < 4
    assert ratio(450) > 10
    assert ratio(150) < ratio(200) < ratio(300) < ratio(450)


def test_scale_height_rises_with_altitude():
    h150 = vm.scale_height_m(moderate, 150 * KM)
    h450 = vm.scale_height_m(moderate, 450 * KM)
    assert 15 * KM < h150 < 30 * KM
    assert 45 * KM < h450 < 80 * KM


def test_interpolation_reproduces_grid_points():
    t = vm.msis()
    i = t.alt_km.index(300)
    assert t.density_kg_m3(300 * KM, 150, 15, 53) == pytest.approx(10 ** t.log_rho[2, 1, 3, i], rel=1e-12)


# ── Decay ───────────────────────────────────────────────────────────────────────


def test_decay_integrator_matches_analytic_exponential():
    rho0, scale = 2.418e-11, 53.628 * KM
    h0, h1, b = 300 * KM, 260 * KM, 50.0

    def rho(h):
        return rho0 * math.exp(-(h - h0) / scale)

    # Analytic solution freezes sqrt(mu a); compare over a short band where that holds.
    numeric = vm.decay_lifetime_s(h0, b, rho, reentry_altitude_m=h1)
    analytic = vm.analytic_exponential_decay_s(h0, h1, b, rho0, scale)
    assert numeric == pytest.approx(analytic, rel=0.01)


def test_iss_decay_rate_order_of_magnitude():
    # ISS ~420 km, B ~ 100-150 kg/m^2: commonly cited decay of order a few km per month.
    b = 125.0
    h = 420 * KM
    for f107 in (100, 150, 200):
        rho = vm.msis().density_kg_m3(h, f107, 15, 51.6)
        rate_km_month = math.sqrt(vm.MU * vm.radius_m(h)) * rho / b * 30 * vm.DAY_S / KM
        assert 0.3 < rate_km_month < 10


def test_lifetime_monotonic_in_altitude_and_ballistic_coefficient():
    t200 = vm.decay_lifetime_s(200 * KM, 50, moderate)
    t300 = vm.decay_lifetime_s(300 * KM, 50, moderate)
    t300_heavy = vm.decay_lifetime_s(300 * KM, 100, moderate)
    assert t200 < t300 < t300_heavy
    assert t300_heavy == pytest.approx(2 * t300, rel=1e-3)  # lifetime is linear in B


# ── Propulsion and power ────────────────────────────────────────────────────────


def test_electric_power_equation():
    # 1 mN at Isp 3000 s, eta 0.6 -> 24.5 W
    assert vm.electric_power_W(1e-3, 3000, 0.6) == pytest.approx(24.52, rel=1e-3)


def test_thrust_to_power_hall_preset():
    assert vm.thrust_to_power_N_W(1400, 0.45) * 1e6 == pytest.approx(65.6, abs=0.5)


def test_propellant_life_independent_of_mass_and_equals_impulse_over_drag():
    drag = 2e-3
    life = vm.propellant_life_s(10, 1500, drag)
    assert life == pytest.approx(10 * vm.G0 * 1500 / drag)


def test_goce_like_drag_within_thruster_range():
    # GOCE: ~1,050 kg, ~1.1 m^2 frontal, ~260 km, near solar minimum; ion thruster 1-20 mN.
    rho = vm.msis().density_kg_m3(260 * KM, 80, 8, 96.7)
    d = vm.drag_N(rho, vm.circular_speed_m_s(260 * KM), 3.0, 1.1)
    assert 1e-3 < d < 20e-3


# ── Eclipse ─────────────────────────────────────────────────────────────────────


def test_eclipse_beta_limit_at_300_km():
    beta_star = math.degrees(math.asin(vm.R_EARTH / vm.radius_m(300 * KM)))
    assert beta_star == pytest.approx(72.8, abs=0.2)
    assert vm.eclipse_fraction(300 * KM, 75) == 0
    assert vm.eclipse_fraction(300 * KM, 70) > 0


def test_eclipse_fraction_at_zero_beta():
    # ~38-40% at 300 km for beta = 0
    assert vm.eclipse_fraction(300 * KM, 0) == pytest.approx(0.39, abs=0.02)


# ── Descent ─────────────────────────────────────────────────────────────────────


def test_edelbaum_500_to_240():
    assert vm.edelbaum_delta_v_m_s(500 * KM, 240 * KM) == pytest.approx(148.1, abs=0.5)


def test_descent_faster_with_drag_and_propellant_below_edelbaum():
    def no_drag(_h):
        return 0.0

    t_vac, prop_vac = vm.descent_time_s(500 * KM, 240 * KM, 3e-3, 1500, 80, 2.2, 0.3, no_drag)
    t_air, prop_air = vm.descent_time_s(500 * KM, 240 * KM, 3e-3, 1500, 80, 2.2, 0.3, moderate)
    assert t_air < t_vac
    assert prop_air < prop_vac
    # Vacuum spiral propellant matches the rocket equation with the Edelbaum delta-v.
    dv = vm.edelbaum_delta_v_m_s(500 * KM, 240 * KM)
    expected = 80 * (1 - math.exp(-dv / (vm.G0 * 1500)))
    assert prop_vac == pytest.approx(expected, rel=0.01)

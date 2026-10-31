"""Reference implementation of the physics in docs/physics.md (sections 1-8).

Readable over fast: this is the "truth" the TypeScript model is tested against.
SI units throughout; names carry unit suffixes.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

# ── Constants (docs/physics.md §0) ──────────────────────────────────────────────

MU = 3.986004418e14  # m^3/s^2
R_EARTH = 6_378_137.0  # m
J2 = 1.08262668e-3
OMEGA_EARTH = 7.2921159e-5  # rad/s
G0 = 9.80665  # m/s^2
SOLAR_CONSTANT = 1361.0  # W/m^2
YEAR_S = 31_557_600.0
DAY_S = 86_400.0
REENTRY_ALTITUDE_M = 120e3

ATMOSPHERE_JSON = Path(__file__).resolve().parent.parent / "web" / "src" / "data" / "atmosphere.json"

SOLAR_MODES = {
    "low": {"f107": 70.0, "ap": 4.0},
    "moderate": {"f107": 150.0, "ap": 15.0},
    "high": {"f107": 250.0, "ap": 15.0},
}

# ── Orbit (§1) ──────────────────────────────────────────────────────────────────


def radius_m(altitude_m: float) -> float:
    return R_EARTH + altitude_m


def circular_speed_m_s(altitude_m: float) -> float:
    return math.sqrt(MU / radius_m(altitude_m))


def period_s(altitude_m: float) -> float:
    return 2 * math.pi * math.sqrt(radius_m(altitude_m) ** 3 / MU)


def orbits_per_day(altitude_m: float) -> float:
    return DAY_S / period_s(altitude_m)


def nodal_regression_rad_s(altitude_m: float, inclination_deg: float) -> float:
    r = radius_m(altitude_m)
    n = 2 * math.pi / period_s(altitude_m)
    return -1.5 * J2 * (R_EARTH / r) ** 2 * n * math.cos(math.radians(inclination_deg))


def sun_synchronous_inclination_deg(altitude_m: float) -> float:
    r = radius_m(altitude_m)
    n = 2 * math.pi / period_s(altitude_m)
    omega_sun = 2 * math.pi / (365.2422 * DAY_S)
    return math.degrees(math.acos(-omega_sun / (1.5 * J2 * (R_EARTH / r) ** 2 * n)))


# ── Atmosphere (§2) ─────────────────────────────────────────────────────────────


def _interp_index(axis: list[float], x: float) -> tuple[int, float]:
    """Lower index and fraction for linear interpolation, clamped to the axis."""
    if x <= axis[0]:
        return 0, 0.0
    if x >= axis[-1]:
        return len(axis) - 2, 1.0
    i = int(np.searchsorted(axis, x, side="right")) - 1
    return i, (x - axis[i]) / (axis[i + 1] - axis[i])


class MsisTable:
    """Orbit-averaged NRLMSIS 2.1 table, interpolated multilinearly in log10 density."""

    def __init__(self, path: Path = ATMOSPHERE_JSON):
        t = json.loads(path.read_text())
        ax = t["axes"]
        self.alt_km = ax["altitude_km"]
        self.f107 = ax["f107_sfu"]
        self.ap = ax["ap"]
        self.inc = ax["inclination_deg"]
        self.log_rho = np.array(t["log10_density_kg_m3"])
        self.log_o = np.array(t["log10_o_number_density_m3"])

    def _interp(self, grid: np.ndarray, altitude_m: float, f107: float, ap: float, inclination_deg: float) -> float:
        idx = [
            _interp_index(self.f107, f107),
            _interp_index(self.ap, ap),
            _interp_index(self.inc, inclination_deg),
            _interp_index(self.alt_km, altitude_m / 1e3),
        ]
        total = 0.0
        for corner in range(16):
            weight = 1.0
            pos = []
            for d, (i, frac) in enumerate(idx):
                bit = (corner >> d) & 1
                weight *= frac if bit else 1 - frac
                pos.append(i + bit)
            if weight:
                total += weight * grid[tuple(pos)]
        return total

    def density_kg_m3(self, altitude_m: float, f107: float, ap: float, inclination_deg: float) -> float:
        return 10 ** self._interp(self.log_rho, altitude_m, f107, ap, inclination_deg)

    def o_number_density_m3(self, altitude_m: float, f107: float, ap: float, inclination_deg: float) -> float:
        return 10 ** self._interp(self.log_o, altitude_m, f107, ap, inclination_deg)


@lru_cache(maxsize=1)
def msis() -> MsisTable:
    return MsisTable()


# Vallado Table 8-4: (base altitude km, base density kg/m^3, scale height km)
VALLADO_BANDS = [
    (100, 5.297e-7, 5.877), (110, 9.661e-8, 7.263), (120, 2.438e-8, 9.473),
    (130, 8.484e-9, 12.636), (140, 3.845e-9, 16.149), (150, 2.070e-9, 22.523),
    (180, 5.464e-10, 29.740), (200, 2.789e-10, 37.105), (250, 7.248e-11, 45.546),
    (300, 2.418e-11, 53.628), (350, 9.518e-12, 53.298), (400, 3.725e-12, 58.515),
    (450, 1.585e-12, 60.828), (500, 6.967e-13, 63.822), (600, 1.454e-13, 71.835),
    (700, 3.614e-14, 88.667), (800, 1.170e-14, 124.64), (900, 5.245e-15, 181.05),
    (1000, 3.019e-15, 268.00),
]


def exponential_density_kg_m3(altitude_m: float) -> float:
    h_km = altitude_m / 1e3
    band = VALLADO_BANDS[0]
    for b in VALLADO_BANDS:
        if h_km >= b[0]:
            band = b
    h0, rho0, scale = band
    return rho0 * math.exp(-(h_km - h0) / scale)


def scale_height_m(density_fn, altitude_m: float, dh_m: float = 1e3) -> float:
    lo, hi = density_fn(altitude_m - dh_m), density_fn(altitude_m + dh_m)
    return -2 * dh_m / math.log(hi / lo)


# ── Drag (§3) ───────────────────────────────────────────────────────────────────


def drag_N(density_kg_m3: float, speed_m_s: float, cd: float, area_m2: float) -> float:
    return 0.5 * density_kg_m3 * speed_m_s**2 * cd * area_m2


def ballistic_coefficient_kg_m2(mass_kg: float, cd: float, area_m2: float) -> float:
    return mass_kg / (cd * area_m2)


# ── Decay (§4) ──────────────────────────────────────────────────────────────────


def decay_lifetime_s(
    altitude_m: float,
    ballistic_kg_m2: float,
    density_fn,
    reentry_altitude_m: float = REENTRY_ALTITUDE_M,
) -> float:
    """Time to decay from altitude_m to reentry with no thrust.

    da/dt = -sqrt(mu a) rho / B, so t = integral of B / (sqrt(mu a) rho) da from reentry to start.
    Integrating in altitude rather than time is exact for a density that depends on altitude only.
    """

    def dt_da(_a, _t):
        a = _a
        return [ballistic_kg_m2 / (math.sqrt(MU * a) * density_fn(a - R_EARTH))]

    a0, a1 = radius_m(reentry_altitude_m), radius_m(altitude_m)
    sol = solve_ivp(dt_da, (a0, a1), [0.0], rtol=1e-9, atol=1e-6, max_step=1e3)
    return float(sol.y[0, -1])


def analytic_exponential_decay_s(h0_m: float, h1_m: float, ballistic_kg_m2: float, rho0: float, scale_m: float) -> float:
    """Closed-form decay time in a single exponential band with sqrt(mu a) frozen at h0 (§4)."""
    return ballistic_kg_m2 * scale_m / (math.sqrt(MU * radius_m(h0_m)) * rho0) * (1 - math.exp(-(h0_m - h1_m) / scale_m))


# ── Propulsion (§5) ─────────────────────────────────────────────────────────────


def electric_power_W(thrust_N: float, isp_s: float, efficiency: float) -> float:
    return thrust_N * G0 * isp_s / (2 * efficiency)


def thrust_to_power_N_W(isp_s: float, efficiency: float) -> float:
    return 2 * efficiency / (G0 * isp_s)


def mass_flow_kg_s(thrust_N: float, isp_s: float) -> float:
    return thrust_N / (G0 * isp_s)


def propellant_life_s(propellant_kg: float, isp_s: float, drag_force_N: float) -> float:
    return propellant_kg * G0 * isp_s / drag_force_N


def rocket_delta_v_m_s(isp_s: float, m0_kg: float, mf_kg: float) -> float:
    return G0 * isp_s * math.log(m0_kg / mf_kg)


# ── Eclipse (§6.1) ──────────────────────────────────────────────────────────────


def eclipse_fraction(altitude_m: float, beta_deg: float) -> float:
    r = radius_m(altitude_m)
    beta = math.radians(abs(beta_deg))
    if beta >= math.asin(R_EARTH / r):
        return 0.0
    return math.acos(math.sqrt(altitude_m**2 + 2 * R_EARTH * altitude_m) / (r * math.cos(beta))) / math.pi


# ── Sizing-loop gain (§7.1) ─────────────────────────────────────────────────────


def loop_gain(
    density_kg_m3: float, speed_m_s: float, cd: float, k_array: float,
    isp_s: float, efficiency: float, duty: float, array_power_W_m2: float,
) -> float:
    return (0.5 * density_kg_m3 * speed_m_s**2 * cd * k_array) * (G0 * isp_s / (2 * efficiency * duty)) / array_power_W_m2


# ── Descent (§8) ────────────────────────────────────────────────────────────────


def edelbaum_delta_v_m_s(h1_m: float, h2_m: float) -> float:
    return abs(circular_speed_m_s(h1_m) - circular_speed_m_s(h2_m))


def descent_time_s(
    h_start_m: float, h_end_m: float, thrust_N: float, isp_s: float,
    mass_kg: float, cd: float, area_m2: float, density_fn,
) -> tuple[float, float]:
    """Time and propellant to spiral down with continuous retro-thrust, drag assisting.

    da/dt = -2 sqrt(a^3/mu) T/m - sqrt(mu a) rho / B(m);  dm/dt = -T / (g0 Isp).
    Integrated in semi-major axis with state [t, m] (da/dt < 0 throughout).
    Returns (time_s, propellant_kg).
    """

    def rhs(a, y):
        _t, m = y
        rho = density_fn(a - R_EARTH)
        a_dot = -2 * math.sqrt(a**3 / MU) * thrust_N / m - math.sqrt(MU * a) * rho * cd * area_m2 / m
        return [1 / a_dot, -thrust_N / (G0 * isp_s) / a_dot]

    sol = solve_ivp(
        rhs, (radius_m(h_start_m), radius_m(h_end_m)), [0.0, mass_kg],
        rtol=1e-9, atol=[1e-3, 1e-9], max_step=1e3,
    )
    return float(sol.y[0, -1]), mass_kg - float(sol.y[1, -1])

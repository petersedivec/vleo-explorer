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


# ── Closed sizing loop (§7), as-built mode (§7a) and life (§4–§5.6) ────────────
#
# Written from docs/physics.md, independently of web/src/model/satellite.ts. The TypeScript model
# iterates mass, array area and power together until they stop changing. Here, for a trial dry mass,
# the array–drag–power coupling is linear and is solved in closed form (its denominator is 1 − G, the
# loop gain of §7.1); the dry mass is then found by root-finding the mass balance. Two methods agreeing
# is a stronger check than one method translated twice.

from dataclasses import dataclass, field, replace  # noqa: E402

from scipy.optimize import brentq  # noqa: E402

K_GRAZE = 0.07  # §3
K_TRACK = 2 / math.pi  # §3
X_ECLIPSE, X_DAYLIGHT = 0.6, 0.8  # §6.2
MASS_GROWTH_LIMIT = 10.0  # §7


@dataclass(frozen=True)
class Thruster:
    """One technology's numbers (§5.3, §5.7). efficiency None = not power-limited (cold gas, monoprop)."""

    isp_s: float
    efficiency: float | None
    unit_thrust_N: float
    fixed_power_W: float = 0.0
    min_power_W: float = 0.0
    unit_total_impulse_Ns: float = math.inf
    unit_mass_kg: float = 0.0
    system_fixed_mass_kg: float = 0.0


@dataclass(frozen=True)
class Spacecraft:
    altitude_m: float = 300e3
    inclination_deg: float = 53.0
    beta_deg: float = 0.0
    f107: float = 150.0
    ap: float = 15.0
    atmosphere: str = "msis"  # or "exponential"
    storm_margin: float = 3.0
    payload_mass_kg: float = 20.0
    payload_power_W: float = 40.0
    payload_frontal_area_m2: float = 0.0
    bus_fixed_mass_kg: float = 15.0
    bus_power_W: float = 30.0
    structure_fraction: float = 0.25
    body_frontal_area_m2: float | None = None
    bulk_density_kg_m3: float = 400.0
    shape_factor: float = 0.6
    cd: float = 2.2
    array_orientation: str = "edgeOn"  # or "sunTracking"
    cell_efficiency: float = 0.30
    packing_factor: float = 0.85
    life_degradation: float = 0.85
    array_areal_mass_kg_m2: float = 3.0
    ppu_specific_mass_kg_W: float = 0.02
    thrust_in_eclipse: bool = True
    propellant_kg: float = 8.0
    design_life_s: float = 5 * YEAR_S
    total_impulse_Ns: float = math.inf  # rated impulse of the thruster set, beyond wear
    wear: bool = True
    thruster: Thruster = field(default_factory=lambda: Thruster(1200, 0.35, 5e-3, 0, 75, 50_000, 0.7, 2.5))


def density_fn(sc: Spacecraft):
    if sc.atmosphere == "exponential":
        return exponential_density_kg_m3
    t = msis()
    return lambda h: t.density_kg_m3(h, sc.f107, sc.ap, sc.inclination_deg)


def _life(sc: Spacecraft, dry_kg: float, drag_area_m2: float, impulse_cap_Ns: float) -> dict:
    """Drag, lives and decay for a spacecraft of known mass and area (§3–§5.6)."""
    rho_fn = density_fn(sc)
    h = sc.altitude_m
    rho = rho_fn(h)
    d = drag_N(rho, circular_speed_m_s(h), sc.cd, drag_area_m2)
    wet = dry_kg + sc.propellant_kg
    prop_life = propellant_life_s(sc.propellant_kg, sc.thruster.isp_s, d)
    impulse_life = min(sc.total_impulse_Ns, impulse_cap_Ns) / d
    unit_b = 1 / (sc.cd * drag_area_m2)
    return {
        "density_kg_m3": rho,
        "drag_N": d,
        "wet_mass_kg": wet,
        "propellant_life_s": prop_life,
        "impulse_life_s": impulse_life,
        "mission_life_s": min(prop_life, impulse_life, sc.design_life_s),
        "natural_lifetime_s": decay_lifetime_s(h, wet * unit_b, rho_fn),
        "disposal_time_s": decay_lifetime_s(h, dry_kg * unit_b, rho_fn),
    }


def size_design(sc: Spacecraft) -> dict:
    """Design mode: find the dry mass that closes mass, power and drag (§7)."""
    th = sc.thruster
    h = sc.altitude_m
    rho_storm = density_fn(sc)(h) * sc.storm_margin
    v = circular_speed_m_s(h)
    t_orbit = period_s(h)
    fe = eclipse_fraction(h, sc.beta_deg)
    duty = 1.0 if sc.thrust_in_eclipse else 1 - fe
    sun_tracking = sc.array_orientation == "sunTracking"
    k_array = (K_TRACK if sun_tracking else 0.0) + K_GRAZE
    cos_avg = 1.0 if sun_tracking else K_TRACK
    p_area = SOLAR_CONSTANT * sc.cell_efficiency * sc.packing_factor * sc.life_degradation * cos_avg  # W/m²
    electric = th.efficiency is not None

    # §6.2: array power = (P_e T_e / X_e + P_d T_d / X_d) / T_d. Split into array watts per watt of load.
    t_e, t_d = fe * t_orbit, (1 - fe) * t_orbit
    e_base = t_e / (X_ECLIPSE * t_d) + 1 / X_DAYLIGHT  # bus and payload run all orbit
    e_thr = (t_e / (X_ECLIPSE * t_d) if sc.thrust_in_eclipse else 0.0) + 1 / X_DAYLIGHT
    base_load = sc.bus_power_W + sc.payload_power_W
    q = 0.5 * rho_storm * v**2 * sc.cd  # storm drag per m² of reference area
    watts_per_newton = G0 * th.isp_s / (2 * th.efficiency * duty) if electric else 0.0  # §5.1 with T_fire = D/d
    gain = q * k_array * watts_per_newton * e_thr / p_area  # §7.1

    def body_area(m: float) -> float:
        a = sc.body_frontal_area_m2 if sc.body_frontal_area_m2 is not None else sc.shape_factor * (m / sc.bulk_density_kg_m3) ** (2 / 3)
        return max(a, sc.payload_frontal_area_m2)

    def state(m: float) -> dict | None:
        """Array, power and drag consistent with dry mass m; None if no array is large enough (G ≥ 1)."""
        a_body = body_area(m)
        if electric:
            # P = c (A_body + k A_array), A_array = (L E_b + P E_t) / p  →  linear in A_array.
            if gain >= 1:
                return None
            a_arr = (base_load * e_base + q * watts_per_newton * a_body * e_thr) / (p_area * (1 - gain))
            p_thr = q * watts_per_newton * (a_body + k_array * a_arr)
            if p_thr < th.min_power_W:  # §5.7 minimum operating power
                p_thr = th.min_power_W
                a_arr = (base_load * e_base + p_thr * e_thr) / p_area
        else:
            p_thr = th.fixed_power_W
            a_arr = (base_load * e_base + p_thr * e_thr) / p_area
        storm_drag = q * (a_body + k_array * a_arr)
        nominal_drag = storm_drag / sc.storm_margin
        units = max(1, math.ceil(storm_drag / duty / th.unit_thrust_N - 1e-9))
        if sc.wear and math.isfinite(th.unit_total_impulse_Ns) and math.isfinite(sc.design_life_s):
            units = max(units, math.ceil(nominal_drag * sc.design_life_s / th.unit_total_impulse_Ns - 1e-9))
        mass = (
            sc.payload_mass_kg + sc.bus_fixed_mass_kg + sc.array_areal_mass_kg_m2 * a_arr
            + (sc.ppu_specific_mass_kg_W * p_thr if electric else 0.0)
            + th.system_fixed_mass_kg + (units - 1) * th.unit_mass_kg
        ) / (1 - sc.structure_fraction)
        return {"array_area_m2": a_arr, "thruster_power_W": p_thr, "storm_drag_N": storm_drag,
                "body_area_m2": a_body, "units": units, "mass_kg": mass}

    # Drag-free reference (§7): arrays for bus and payload only, no PPU power.
    base_array = base_load * e_base / p_area
    m0 = (sc.payload_mass_kg + sc.bus_fixed_mass_kg + sc.array_areal_mass_kg_m2 * base_array
          + th.system_fixed_mass_kg) / (1 - sc.structure_fraction)

    result = {"drag_free_dry_mass_kg": m0, "eclipse_fraction": fe, "duty": duty, "loop_gain": gain if electric else 0.0}

    def residual(m: float) -> float:
        s = state(m)
        return s["mass_kg"] - m

    # The least fixed point of the (increasing) mass map is the design: scan up from m0 for the first
    # point where the mass balance closes, then refine. None within 10 × m0 → infeasible (§7).
    feasible, reason, m_star = False, "massGrowth", math.nan
    if electric and gain >= 1:
        reason = "loopGain"
    else:
        grid = m0 * np.geomspace(1.0, MASS_GROWTH_LIMIT, 400)
        prev = grid[0]
        for m in grid[1:]:
            if residual(m) <= 0:
                m_star = brentq(residual, prev, m, xtol=1e-12, rtol=1e-13)
                # Unit counts make the map a staircase; take the right side of any step.
                s = state(m_star)
                if s["mass_kg"] > m_star:
                    m_star = s["mass_kg"]
                feasible, reason = True, None
                break
            prev = m
    if not feasible:
        return {**result, "feasible": False, "infeasibility": reason}

    s = state(m_star)
    impulse_cap = s["units"] * th.unit_total_impulse_Ns if sc.wear else math.inf
    drag_area = s["body_area_m2"] + k_array * s["array_area_m2"]
    life = _life(sc, m_star, drag_area, impulse_cap)
    return {
        **result, **life,
        "feasible": True, "infeasibility": None,
        "dry_mass_kg": m_star,
        "mass_growth": m_star / m0,
        "array_area_m2": s["array_area_m2"],
        "body_frontal_area_m2": s["body_area_m2"],
        "drag_area_m2": drag_area,
        "thruster_power_W": s["thruster_power_W"],
        "storm_drag_N": s["storm_drag_N"],
        "thruster_units": s["units"],
    }


def evaluate_as_built(sc: Spacecraft, dry_mass_kg: float, drag_area_m2: float, max_thrust_N: float) -> dict:
    """As-built mode (§7a): mass, area and thrust are given; check whether it holds altitude."""
    th = sc.thruster
    fe = eclipse_fraction(sc.altitude_m, sc.beta_deg)
    duty = 1.0 if sc.thrust_in_eclipse else 1 - fe
    life = _life(sc, dry_mass_kg, drag_area_m2, math.inf)
    margin = max_thrust_N * duty / life["drag_N"]
    power = electric_power_W(life["drag_N"] / duty, th.isp_s, th.efficiency) if th.efficiency is not None else th.fixed_power_W
    return {**life, "feasible": margin >= 1, "thrust_margin": margin, "thruster_power_W": power,
            "mission_life_s": life["mission_life_s"] if margin >= 1 else 0.0}


__all__ = ["Spacecraft", "Thruster", "size_design", "evaluate_as_built", "replace"]

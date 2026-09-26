// Terms used here are explained in the himmelszelt site's glossary (site/src/data/glossary.json).
import { arcsecondsToDegrees, DEG_TO_RAD, RAD_TO_DEG } from "./math.js";
import * as moon from "./moon.js";
import * as sun from "./sun.js";
import { type JulianDay, julianCenturiesSinceStandardEquinox } from "./time.js";

/** Mean radius of the Earth, in kilometers. http://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html */
export const MEAN_RADIUS_KM = 6371.0;

/** Thickness of the atmosphere if its density were uniform, in kilometers. */
export const ATMOSPHERE_THICKNESS_KM = 7.994;

/** Actual thickness of the atmosphere, in kilometers. */
export const ATMOSPHERE_THICKNESS_NON_UNIFORM_KM = 85.0;

/** Faintest apparent magnitude generally visible to the naked eye. http://www.astronomynotes.com/starprop/s4.htm */
export const APPARENT_MAGNITUDE_LIMIT = 6.5;

/**
 * Orbital eccentricity of the Earth's orbit around the Sun, per Bretagnon's "Théorie du mouvement de
 * l'ensemble des planètes. Solution VSOP82" (1982).
 */
export function orbitEccentricity(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    return 0.01670862 + T * (-0.000042037 + T * (-0.0000001236 + T * 0.00000000004));
}

/** Constant regardless of `t` in this approximation; kept as a parameter to match `orbitEccentricity`'s
 *  shape so switching the import is the only thing a caller has to change. http://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html */
export function orbitEccentricityApprox(_t: JulianDay): number {
    return 0.01671022;
}

/**
 * The 63 periodic terms of the IAU 1980 nutation, per Meeus' "Astronomical Algorithms" (table 22.A): the multiples of
 * D, M, M', F and Ω in the argument, then the coefficients of sin (Δψ) and cos (Δε), in 0.0001", each with its T term.
 */
// biome-ignore format: one term per row, as in the book
const NUTATION_TERMS: readonly (readonly [number, number, number, number, number, number, number, number, number])[] = [
    [0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9],
    [-2, 0, 0, 2, 2, -13187, -1.6, 5736, -3.1],
    [0, 0, 0, 2, 2, -2274, -0.2, 977, -0.5],
    [0, 0, 0, 0, 2, 2062, 0.2, -895, 0.5],
    [0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1],
    [0, 0, 1, 0, 0, 712, 0.1, -7, 0],
    [-2, 1, 0, 2, 2, -517, 1.2, 224, -0.6],
    [0, 0, 0, 2, 1, -386, -0.4, 200, 0],
    [0, 0, 1, 2, 2, -301, 0, 129, -0.1],
    [-2, -1, 0, 2, 2, 217, -0.5, -95, 0.3],
    [-2, 0, 1, 0, 0, -158, 0, 0, 0],
    [-2, 0, 0, 2, 1, 129, 0.1, -70, 0],
    [0, 0, -1, 2, 2, 123, 0, -53, 0],
    [2, 0, 0, 0, 0, 63, 0, 0, 0],
    [0, 0, 1, 0, 1, 63, 0.1, -33, 0],
    [2, 0, -1, 2, 2, -59, 0, 26, 0],
    [0, 0, -1, 0, 1, -58, -0.1, 32, 0],
    [0, 0, 1, 2, 1, -51, 0, 27, 0],
    [-2, 0, 2, 0, 0, 48, 0, 0, 0],
    [0, 0, -2, 2, 1, 46, 0, -24, 0],
    [2, 0, 0, 2, 2, -38, 0, 16, 0],
    [0, 0, 2, 2, 2, -31, 0, 13, 0],
    [0, 0, 2, 0, 0, 29, 0, 0, 0],
    [-2, 0, 1, 2, 2, 29, 0, -12, 0],
    [0, 0, 0, 2, 0, 26, 0, 0, 0],
    [-2, 0, 0, 2, 0, -22, 0, 0, 0],
    [0, 0, -1, 2, 1, 21, 0, -10, 0],
    [0, 2, 0, 0, 0, 17, -0.1, 0, 0],
    [2, 0, -1, 0, 1, 16, 0, -8, 0],
    [-2, 2, 0, 2, 2, -16, 0.1, 7, 0],
    [0, 1, 0, 0, 1, -15, 0, 9, 0],
    [-2, 0, 1, 0, 1, -13, 0, 7, 0],
    [0, -1, 0, 0, 1, -12, 0, 6, 0],
    [0, 0, 2, -2, 0, 11, 0, 0, 0],
    [2, 0, -1, 2, 1, -10, 0, 5, 0],
    [2, 0, 1, 2, 2, -8, 0, 3, 0],
    [0, 1, 0, 2, 2, 7, 0, -3, 0],
    [-2, 1, 1, 0, 0, -7, 0, 0, 0],
    [0, -1, 0, 2, 2, -7, 0, 3, 0],
    [2, 0, 0, 2, 1, -7, 0, 3, 0],
    [2, 0, 1, 0, 0, 6, 0, 0, 0],
    [-2, 0, 2, 2, 2, 6, 0, -3, 0],
    [-2, 0, 1, 2, 1, 6, 0, -3, 0],
    [2, 0, -2, 0, 1, -6, 0, 3, 0],
    [2, 0, 0, 0, 1, -6, 0, 3, 0],
    [0, -1, 1, 0, 0, 5, 0, 0, 0],
    [-2, -1, 0, 2, 1, -5, 0, 3, 0],
    [-2, 0, 0, 0, 1, -5, 0, 3, 0],
    [0, 0, 2, 2, 1, -5, 0, 3, 0],
    [-2, 0, 2, 0, 1, 4, 0, 0, 0],
    [-2, 1, 0, 2, 1, 4, 0, 0, 0],
    [0, 0, 1, -2, 0, 4, 0, 0, 0],
    [-1, 0, 1, 0, 0, -4, 0, 0, 0],
    [-2, 1, 0, 0, 0, -4, 0, 0, 0],
    [1, 0, 0, 0, 0, -4, 0, 0, 0],
    [0, 0, 1, 2, 0, 3, 0, 0, 0],
    [0, 0, -2, 2, 2, -3, 0, 0, 0],
    [-1, -1, 1, 0, 0, -3, 0, 0, 0],
    [0, 1, 1, 0, 0, -3, 0, 0, 0],
    [0, -1, 1, 2, 2, -3, 0, 0, 0],
    [2, -1, -1, 2, 2, -3, 0, 0, 0],
    [0, 0, 3, 2, 2, -3, 0, 0, 0],
    [2, -1, 0, 2, 2, -3, 0, 0, 0],
];

/** Nutation in longitude (Δψ) and in obliquity (Δε), in degrees, summed over {@link NUTATION_TERMS} with the
 *  arguments of Meeus' chapter 22, which differ slightly from the Moon's own mean elements of chapter 47. */
function nutation(t: JulianDay): { longitude: number; obliquity: number } {
    const T = julianCenturiesSinceStandardEquinox(t);
    const D = (297.85036 + T * (445267.11148 + T * (-0.0019142 + T / 189474))) * DEG_TO_RAD;
    const M = (357.52772 + T * (35999.05034 + T * (-0.0001603 - T / 300000))) * DEG_TO_RAD;
    const Mm = (134.96298 + T * (477198.867398 + T * (0.0086972 + T / 56250))) * DEG_TO_RAD;
    const F = (93.27191 + T * (483202.017538 + T * (-0.0036825 + T / 327270))) * DEG_TO_RAD;
    const O = (125.04452 + T * (-1934.136261 + T * (0.0020708 + T / 450000))) * DEG_TO_RAD;

    let psi = 0;
    let eps = 0;
    for (const [d, m, mm, f, o, s0, s1, c0, c1] of NUTATION_TERMS) {
        const argument = d * D + m * M + mm * Mm + f * F + o * O;
        psi += (s0 + s1 * T) * Math.sin(argument);
        eps += (c0 + c1 * T) * Math.cos(argument);
    }

    return { longitude: arcsecondsToDegrees(psi * 0.0001), obliquity: arcsecondsToDegrees(eps * 0.0001) };
}

/** Nutation in longitude (Δψ), in degrees, per Meeus' "Astronomical Algorithms" (table 22.A). */
export function longitudeNutation(t: JulianDay): number {
    return nutation(t).longitude;
}

/** Approximate nutation in longitude (Δψ), in degrees, from its four largest terms, per Meeus' "Astronomical
 *  Algorithms" (ch. 22): within 0.5". L and L' are the Sun's and the Moon's mean longitudes. */
export function longitudeNutationApprox(t: JulianDay): number {
    const L = sun.meanLongitudeApprox(t) * DEG_TO_RAD;
    const Lm = moon.meanLongitudeApprox(t) * DEG_TO_RAD;
    const O = moon.meanAscendingNodeLongitudeApprox(t) * DEG_TO_RAD;

    return arcsecondsToDegrees(
        -17.2 * Math.sin(O) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * O),
    );
}

/** Nutation in obliquity (Δε), in degrees, per Meeus' "Astronomical Algorithms" (table 22.A). */
export function obliquityNutation(t: JulianDay): number {
    return nutation(t).obliquity;
}

/** Approximate nutation in obliquity (Δε), in degrees, from the same four terms: within 0.1". */
export function obliquityNutationApprox(t: JulianDay): number {
    const L = sun.meanLongitudeApprox(t) * DEG_TO_RAD;
    const Lm = moon.meanLongitudeApprox(t) * DEG_TO_RAD;
    const O = moon.meanAscendingNodeLongitudeApprox(t) * DEG_TO_RAD;

    return arcsecondsToDegrees(
        9.2 * Math.cos(O) + 0.57 * Math.cos(2 * L) + 0.1 * Math.cos(2 * Lm) - 0.09 * Math.cos(2 * O),
    );
}

export function trueObliquity(t: JulianDay): number {
    return meanObliquity(t) + obliquityNutation(t);
}

export function trueObliquityApprox(t: JulianDay): number {
    return meanObliquityApprox(t) + obliquityNutationApprox(t);
}

/**
 * Inclination of the Earth's axis of rotation, in degrees, per Meeus' "Astronomical Algorithms" (21.3),
 * by J. Laskar, "Astronomy and Astrophysics" 1986. Only valid for `|U| < 1`, i.e. within 10,000 years of J2000.
 */
export function meanObliquity(t: JulianDay): number {
    const U = julianCenturiesSinceStandardEquinox(t) * 0.01;

    const e0 =
        -4680.93 * U -
        1.55 * U ** 2 +
        1999.25 * U ** 3 -
        51.38 * U ** 4 -
        249.67 * U ** 5 -
        39.05 * U ** 6 +
        7.12 * U ** 7 +
        27.87 * U ** 8 +
        5.79 * U ** 9 +
        2.45 * U ** 10;

    return arcsecondsToDegrees(23 * 3600 + 26 * 60 + 21.448) + arcsecondsToDegrees(e0);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanObliquityApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    return (0.409093 - 0.000227 * T) * RAD_TO_DEG;
}

/** Pressure scale height of the international standard atmosphere, in meters: R·T₀ / (M·g) at 288.15 K. */
export const PRESSURE_SCALE_HEIGHT_M = 8434.5;

/**
 * Air pressure at a given height above sea level, relative to the sea-level pressure (so 1 at h = 0), per the
 * barometric formula for the international standard atmosphere. This is what scales refraction with height:
 * thinner air bends light less, which is why a body's apparent position gets closer to its true one the
 * higher the observer is, and why refraction vanishes at the top of the atmosphere.
 */
export function airPressureRatio(observerHeightM: number): number {
    return Math.exp(-observerHeightM / PRESSURE_SCALE_HEIGHT_M);
}

/** Local conditions at the observer. Both default to the ones Bennett's formula itself assumes. */
export interface RefractionConditions {
    /** Observer height above sea level, in meters (not to be confused with `altitude`, a sky angle). */
    observerHeightM?: number;
    /** Local air temperature, in degrees Celsius. */
    temperatureC?: number;
}

/**
 * Effect of atmospheric refraction on the true altitude, in degrees, per Meeus' "Astronomical Algorithms" (15.4)
 * and Þorsteinn Sæmundsson, "Atmospheric Refraction", Sky and Telescope (1986).
 *
 * The fit assumes an observer at sea level at 10 °C; `conditions` scales the result for anything else
 * (AA.15, the P/1010 · 283/(273+T) factor, with the pressure ratio taken from `airPressureRatio`). Strictly,
 * refraction is the integral of the refractive index gradient along the whole ray, not a function of the
 * conditions at one end of it, but scaling by the observer's pressure is the standard approximation.
 *
 * Takes the *true* (geometric) altitude, i.e. AA.15.4. Use `atmosphericRefractionFromApparent` for the other
 * direction; the two fits differ by ~5' at the horizon and are not interchangeable.
 *
 * Note this is unrelated to the scattering coefficients a renderer uses: refraction comes from air's
 * refractive index, absorption and scattering from its cross-sections, and neither follows from the other.
 */
export function atmosphericRefraction(altitude: number, conditions: RefractionConditions = {}): number {
    // The constant zeroes R at the zenith, which the bare fit misses by ~0.0019'.
    const R = 1.02 / Math.tan((altitude + 10.3 / (altitude + 5.11)) * DEG_TO_RAD) + 0.0019279;

    return (R / 60) * refractionConditionFactor(conditions); // R is in arcminutes.
}

/**
 * Effect of atmospheric refraction, in degrees, as a function of the *apparent* altitude it produced, per
 * Meeus' "Astronomical Algorithms" (15.3) and G. G. Bennett, "The Calculation of Astronomical Refraction in
 * Marine Navigation", Journal of Navigation (1982). The inverse relation of `atmosphericRefraction`, and the one a renderer wants,
 * since a camera ray is by definition an apparent direction: subtracting this from the ray's apparent altitude
 * gives the true altitude to look the sky up at. `@himmelszelt/dunstkreis` carries a WGSL twin for per-ray use on
 * the GPU; the two are pinned to each other by a test and must stay in sync.
 *
 * ~34.5' at the horizon, slightly more than the Sun's own ~32' apparent diameter, which is why a Sun that
 * looks like it is touching the horizon has geometrically already set.
 *
 * Meeus' fit is stated for apparent altitudes of 0 and above, and diverges below (it has a pole at -4.4°), so
 * the input is clamped at 0. Rays below the horizontal therefore all get the horizon value; they are either
 * ground or, for an elevated observer, within ~1° of the horizon, where that is a good approximation anyway.
 */
export function atmosphericRefractionFromApparent(
    apparentAltitude: number,
    conditions: RefractionConditions = {},
): number {
    const h = Math.max(apparentAltitude, 0);

    // As in AA.15.4 above, the constant zeroes R at the zenith rather than leaving the fit's ~-0.0014' there.
    const R = 1 / Math.tan((h + 7.31 / (h + 4.4)) * DEG_TO_RAD) + 0.0013515216737563;

    return (R / 60) * refractionConditionFactor(conditions); // R is in arcminutes.
}

/** The AA.15 `P/1010 · 283/(273+T)` scaling shared by both fits, as a plain multiplier that is 1 by default. */
function refractionConditionFactor({ observerHeightM = 0, temperatureC = 10 }: RefractionConditions): number {
    return airPressureRatio(observerHeightM) * (283 / (273 + temperatureC));
}

export interface ViewDistanceOptions {
    /** Observer height above sea level, in meters. */
    observerHeightM?: number;
    /** Bend the ray by atmospheric refraction first, treating `y` as the true direction. Precise variant only. */
    refractionCorrected?: boolean;
}

/**
 * Distance traveled through the atmosphere, in kilometers, along a view direction whose vertical (up) component
 * is `y` (i.e. `y = sin(altitude)`), through the uniform-density shell of `ATMOSPHERE_THICKNESS_KM`: an air mass
 * in kilometers. A ray that hits the ground ends there, so looking down from sea level gives 0, while an elevated
 * observer's slightly downward ray still crosses some air before it reaches the ground.
 */
export function viewDistanceWithinAtmosphere(y: number, options: ViewDistanceOptions = {}): number {
    const { observerHeightM = 0, refractionCorrected = false } = options;
    let yy = y;
    if (refractionCorrected) {
        const altitude = Math.asin(Math.max(-1, Math.min(1, y))) * RAD_TO_DEG;
        yy = Math.sin((altitude + atmosphericRefraction(altitude, { observerHeightM })) * DEG_TO_RAD);
    }
    return rayThroughShell(yy, observerHeightM);
}

/** The same distance without refraction; it is exact and cheap, so the approximate variant needs no fit. */
export function viewDistanceWithinAtmosphereApprox(
    y: number,
    options: Omit<ViewDistanceOptions, "refractionCorrected"> = {},
): number {
    return rayThroughShell(y, options.observerHeightM ?? 0);
}

// Ray from radius `ro` with vertical component `y` against two concentric spheres: the ground (R) and the top of
// the shell (R + t). Distances along the ray solve |o + d·v|² = ρ², i.e. d = -ro·y ± sqrt(ro²y² - ro² + ρ²).
function rayThroughShell(y: number, observerHeightM: number): number {
    const R = MEAN_RADIUS_KM;
    const top = R + ATMOSPHERE_THICKNESS_KM;
    const ro = Math.min(R + Math.max(0, observerHeightM) / 1000, top);
    const b = ro * y;
    const toGround = b * b - ro * ro + R * R;
    // Downward and the ground in the way: the first (near) intersection with it.
    if (y < 0 && toGround >= 0) return Math.max(0, -b - Math.sqrt(toGround));
    return -b + Math.sqrt(b * b - ro * ro + top * top);
}

/**
 * Dip of the horizon, in degrees: how far below the true horizontal the visible horizon lies for an observer
 * `observerHeightM` meters above the ground, from the tangent to a spherical Earth, `acos(R / (R + h))`. Geometric only:
 * terrestrial refraction, which lifts the visible horizon by roughly a tenth of that, is left out.
 */
export function horizonDip(observerHeightM: number): number {
    const R = MEAN_RADIUS_KM * 1000;
    return Math.acos(R / (R + Math.max(observerHeightM, 0))) * RAD_TO_DEG;
}

/** The small-angle form of `horizonDip`, `sqrt(2h / R)`: within 0.01% of it anywhere within the atmosphere. */
export function horizonDipApprox(observerHeightM: number): number {
    return Math.sqrt((2 * Math.max(observerHeightM, 0)) / (MEAN_RADIUS_KM * 1000)) * RAD_TO_DEG;
}

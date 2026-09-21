// See ../GLOSSARY.md for obliquity, nutation, orbital eccentricity, and atmospheric refraction.
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

/** Nutation in longitude (Δψ), in degrees, per Meeus' "Astronomical Algorithms" (21.A). */
export function longitudeNutation(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const sM = sun.meanAnomaly(t) * DEG_TO_RAD;

    const mM = moon.meanAnomaly(t) * DEG_TO_RAD;
    const mD = moon.meanElongation(t) * DEG_TO_RAD;
    const mF = moon.meanArgumentOfLatitude(t) * DEG_TO_RAD;
    const O = moon.meanAscendingNodeLongitude(t) * DEG_TO_RAD;

    let Dr = 0.0;

    Dr -= (17.1996 - 0.01742 * T) * Math.sin(O);
    Dr -= (1.3187 - 0.00016 * T) * Math.sin(-2 * mD + 2 * mF + 2 * O);
    Dr -= (0.2274 - 0.00002 * T) * Math.sin(2 * mF + 2 * O);
    Dr += (0.2062 + 0.00002 * T) * Math.sin(2 * O);
    Dr += (0.1426 - 0.00034 * T) * Math.sin(sM);
    Dr += (0.0712 + 0.00001 * T) * Math.sin(mM);
    Dr += (0.0517 + 0.00012 * T) * Math.sin(-2 * mD + sM + 2 * mF + 2 * O);
    Dr -= (0.0386 - 0.00004 * T) * Math.sin(2 * mF + O);
    Dr -= 0.0301 * Math.sin(mM + 2 * mF + 2 * O);
    Dr += (0.0217 - 0.00005 * T) * Math.sin(-2 * mD - sM + 2 * mF + 2 * O);
    Dr -= 0.0158 * Math.sin(-2 * mD + mM);
    Dr += (0.0129 + 0.00001 * T) * Math.sin(-2 * mD + 2 * mF + O);
    Dr += 0.0123 * Math.sin(-mM + 2 * mF + 2 * O);
    Dr += 0.0063 * Math.sin(2 * mD);
    Dr += (0.0063 + 0.00001 * T) * Math.sin(mM + O);
    Dr -= 0.0059 * Math.sin(2 * mD - mM + 2 * mF + 2 * O);
    Dr -= (0.0058 - 0.00001 * T) * Math.sin(-mM + O);
    Dr -= 0.0051 * Math.sin(mM + 2 * mF + O);
    Dr += 0.0048 * Math.sin(-2 * mD + 2 * mM);
    Dr += 0.0046 * Math.sin(-2 * mM + 2 * mF + O);
    Dr -= 0.0038 * Math.sin(2 * mD + 2 * mF + 2 * O);
    Dr -= 0.0031 * Math.sin(2 * mM + 2 * mF + 2 * O);
    Dr += 0.0029 * Math.sin(2 * mM);
    Dr += 0.0029 * Math.sin(2 * mD + mM + 2 * mF + 2 * O);
    Dr += 0.0026 * Math.sin(2 * mF);
    Dr -= 0.0022 * Math.sin(-2 * mD + 2 * mF);
    Dr += 0.0021 * Math.sin(-mM + 2 * mF + O);
    Dr += (0.0017 - 0.00001 * T) * Math.sin(2 * sM);
    Dr += 0.0016 * Math.sin(2 * mD - mM + O);
    Dr -= (0.0016 + 0.00001 * T) * Math.sin(-2 * mD + 2 * sM + 2 * mF + 2 * O);
    Dr -= 0.0015 * Math.sin(sM + O);
    Dr -= 0.0013 * Math.sin(-2 * mD + mM + O);
    Dr -= 0.0012 * Math.sin(-sM + O);
    Dr += 0.0011 * Math.sin(2 * mM - 2 * mF);
    Dr -= 0.001 * Math.sin(2 * mD - mM + 2 * mF + O);
    Dr -= 0.0008 * Math.sin(2 * mD + mM + 2 * mF + 2 * O);
    Dr += 0.0007 * Math.sin(sM + 2 * mF + 2 * O);
    Dr += 0.0007 * Math.sin(-2 * mD + sM + mM);
    Dr -= 0.0007 * Math.sin(-sM + 2 * mF + 2 * O);
    Dr -= 0.0007 * Math.sin(2 * mD + 2 * mF + O);
    Dr += 0.0006 * Math.sin(2 * mD + mM);
    Dr += 0.0006 * Math.sin(-2 * mD + 2 * mM + 2 * mF + 2 * O);
    Dr += 0.0006 * Math.sin(-2 * mD + mM + 2 * mF + O);
    Dr -= 0.0006 * Math.sin(2 * mD - 2 * mM + O);
    Dr -= 0.0006 * Math.sin(2 * mD + O);
    Dr += 0.0005 * Math.sin(-sM + mM);
    Dr += 0.0005 * Math.sin(-2 * mD - sM + 2 * mF + O);
    Dr -= 0.0005 * Math.sin(-2 * mD + O);
    Dr -= 0.0005 * Math.sin(2 * mM + 2 * mF + O);
    Dr += 0.0004 * Math.sin(-2 * mD + 2 * mM + O);
    Dr += 0.0004 * Math.sin(-2 * mD + sM + 2 * mF + O);
    Dr += 0.0004 * Math.sin(mM - 2 * mF);
    Dr -= 0.0004 * Math.sin(-mD + mM);
    Dr -= 0.0004 * Math.sin(-2 * mD + sM);
    Dr -= 0.0004 * Math.sin(mD);
    Dr += 0.0003 * Math.sin(mM + 2 * mF);
    Dr -= 0.0003 * Math.sin(-2 * mM + 2 * mF + 2 * O);
    Dr -= 0.0003 * Math.sin(-mD - sM + mM);
    Dr -= 0.0003 * Math.sin(sM + mM);
    Dr -= 0.0003 * Math.sin(-sM + mM + 2 * mF + 2 * O);
    Dr -= 0.0003 * Math.sin(2 * mD - sM - mM + 2 * mF + 2 * O);
    Dr -= 0.0003 * Math.sin(3 * mM + 2 * mF + 2 * O);
    Dr -= 0.0003 * Math.sin(2 * mD - sM + 2 * mF + 2 * O);

    return arcsecondsToDegrees(Dr);
}

/**
 * Approximate nutation in longitude (Δψ), in degrees, per Jensen et al.,
 * "A Physically-Based Night Sky Model" (2001).
 */
export function longitudeNutationApprox(t: JulianDay): number {
    const sM = sun.meanAnomalyApprox(t) * DEG_TO_RAD;
    const mM = moon.meanAnomalyApprox(t) * DEG_TO_RAD;
    const O = moon.meanAscendingNodeLongitudeApprox(t) * DEG_TO_RAD;

    return (
        -arcsecondsToDegrees(17.2) * Math.sin(O) -
        arcsecondsToDegrees(1.32) * Math.sin(2.0 * sM) -
        arcsecondsToDegrees(0.23) * Math.sin(2.0 * mM) +
        arcsecondsToDegrees(0.21) * Math.sin(2.0 * O)
    );
}

/** Nutation in obliquity (Δε), in degrees, per Meeus' "Astronomical Algorithms" (21.A). */
export function obliquityNutation(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const sM = sun.meanAnomaly(t) * DEG_TO_RAD;

    const mM = moon.meanAnomaly(t) * DEG_TO_RAD;
    const mD = moon.meanElongation(t) * DEG_TO_RAD;
    const mF = moon.meanArgumentOfLatitude(t) * DEG_TO_RAD;
    const O = moon.meanAscendingNodeLongitude(t) * DEG_TO_RAD;

    let De = 0.0;

    De += (9.2025 + 0.00089 * T) * Math.cos(O);
    De += (0.5736 - 0.00031 * T) * Math.cos(-2 * mD + 2 * mF + 2 * O);
    De += (0.0977 - 0.00005 * T) * Math.cos(2 * mF + 2 * O);
    De -= (0.0895 + 0.00005 * T) * Math.cos(2 * O);
    De += (0.0054 - 0.00001 * T) * Math.cos(sM);
    De -= 0.0007 * Math.cos(mM);
    De += (0.0224 - 0.00006 * T) * Math.cos(-2 * mD + sM + 2 * mF + 2 * O);
    De += 0.02 * Math.cos(2 * mF + O);
    De += (0.0129 - 0.00001 * T) * Math.cos(mM + 2 * mF + 2 * O);
    De -= (0.0095 + 0.00003 * T) * Math.cos(-2 * mD - sM + 2 * mF + 2 * O);
    De -= 0.007 * Math.cos(-2 * mD + 2 * mF + O);
    De -= 0.0053 * Math.cos(-mM + 2 * mF + 2 * O);
    De -= 0.0033 * Math.cos(mM + O);
    De += 0.0026 * Math.cos(2 * mD - mM + 2 * mF + 2 * O);
    De += 0.0032 * Math.cos(-mM + O);
    De += 0.0027 * Math.cos(mM + 2 * mF + O);
    De -= 0.0024 * Math.cos(-2 * mM + 2 * mF + O);
    De += 0.0016 * Math.cos(2 * mD + 2 * mF + 2 * O);
    De += 0.0013 * Math.cos(2 * mM + 2 * mF + 2 * O);
    De -= 0.0012 * Math.cos(2 * mD + mM + 2 * mF + 2 * O);
    De -= 0.001 * Math.cos(-mM + 2 * mF + O);
    De -= 0.0008 * Math.cos(2 * mD - mM + O);
    De += 0.0007 * Math.cos(-2 * mD + 2 * sM + 2 * mF + 2 * O);
    De += 0.0009 * Math.cos(sM + O);
    De += 0.0007 * Math.cos(-2 * mD + mM + O);
    De += 0.0006 * Math.cos(-sM + O);
    De += 0.0005 * Math.cos(2 * mD - mM + 2 * mF + O);
    De += 0.0003 * Math.cos(2 * mD + mM + 2 * mF + 2 * O);
    De -= 0.0003 * Math.cos(sM + 2 * mF + 2 * O);
    De += 0.0003 * Math.cos(-sM + 2 * mF + 2 * O);
    De += 0.0003 * Math.cos(2 * mD + 2 * mF + O);
    De -= 0.0003 * Math.cos(-2 * mD + 2 * mM + 2 * mF + 2 * O);
    De -= 0.0003 * Math.cos(-2 * mD + mM + 2 * mF + O);
    De += 0.0003 * Math.cos(2 * mD - 2 * mM + O);
    De += 0.0003 * Math.cos(2 * mD + O);
    De += 0.0003 * Math.cos(-2 * mD - sM + 2 * mF + O);
    De += 0.0003 * Math.cos(-2 * mD + O);
    De += 0.0003 * Math.cos(2 * mM + 2 * mF + O);

    return arcsecondsToDegrees(De);
}

/**
 * Approximate nutation in obliquity (Δε), in degrees, per Jensen et al.,
 * "A Physically-Based Night Sky Model" (2001).
 */
export function obliquityNutationApprox(t: JulianDay): number {
    const O = moon.meanAscendingNodeLongitudeApprox(t) * DEG_TO_RAD;
    const Ls = sun.meanAnomalyApprox(t) * DEG_TO_RAD;
    const Lm = moon.meanAnomalyApprox(t) * DEG_TO_RAD;

    return (
        arcsecondsToDegrees(9.2) * Math.cos(O) +
        arcsecondsToDegrees(0.57) * Math.cos(2.0 * Ls) +
        arcsecondsToDegrees(0.1) * Math.cos(2.0 * Lm) -
        arcsecondsToDegrees(0.09) * Math.cos(2.0 * O)
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
 * Effect of atmospheric refraction on the true altitude, in degrees, per Meeus' "Astronomical Algorithms" (15.4),
 * G.G. Bennet, "The Calculation of the Astronomical Refraction in marine Navigation" (1982), and
 * Þorsteinn Sæmundsson, "Sky and Telescope" (1982).
 *
 * Bennett's fit assumes an observer at sea level at 10 °C; `conditions` scales the result for anything else
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
 * Meeus' "Astronomical Algorithms" (15.3) and G.G. Bennet, "The Calculation of the Astronomical Refraction in
 * marine Navigation" (1982). The inverse relation of `atmosphericRefraction`, and the one a renderer wants,
 * since a camera ray is by definition an apparent direction: subtracting this from the ray's apparent altitude
 * gives the true altitude to look the sky up at. `@himmel/dunstkreis` carries a WGSL twin for per-ray use on
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

/**
 * Distance traveled through the atmosphere, in kilometers, along a view direction whose vertical (up) component
 * is `y` (i.e. `y = sin(altitude)`), optionally corrected for atmospheric refraction.
 */
export function viewDistanceWithinAtmosphere(y: number, refractionCorrected = false): number {
    const t = ATMOSPHERE_THICKNESS_KM;
    const r = MEAN_RADIUS_KM;

    // The correction avoids loss of precision in h at y = 1.0.
    let h = Math.asin(y * (1.0 - 1e-12));

    if (refractionCorrected) h += atmosphericRefraction(Math.asin(y) * RAD_TO_DEG) * DEG_TO_RAD;

    const cosa = Math.cos(h);
    const rt = r + t;

    // Law of sine for an arbitrary triangle with two sides and one angle known. Since the angle is
    // (π/2 + a), cosine is used instead of sine.
    return (Math.cos(h + Math.asin((cosa * r) / rt)) * rt) / cosa;
}

// The bracket is airmass-shaped and should be ~1 at zenith (y=1), since by definition the path length
// straight up equals exactly the atmosphere thickness t. The original osgHimmel C++ (earth2.cpp) has
// 1116.0 here, which gives ~999.6 at zenith instead of ~1: a decimal-point typo for 1.116, off by exactly
// 1000x. Fixed here since it's off by orders of magnitude at every altitude, not a porting decision.
/** This is not refraction corrected. Only valid for the Earth's actual mean radius. */
export function viewDistanceWithinAtmosphereApprox(y: number): number {
    return (ATMOSPHERE_THICKNESS_KM * 1.116) / ((y + 0.004) * 1.1116);
}

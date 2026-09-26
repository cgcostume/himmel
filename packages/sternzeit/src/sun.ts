// Terms used here are explained in the himmelszelt site's glossary (site/src/data/glossary.json).
import {
    applyParallax,
    EQUATORIAL_RADIUS_KM,
    type EquatorialCoords,
    eclipticalToEquatorial,
    equatorialToHorizontal,
    type HorizontalCoords,
} from "./coords.js";
import * as earth from "./earth.js";
import { ASTRONOMICAL_UNIT_KM, DEG_TO_RAD, normalizeDegrees, polynomial, RAD_TO_DEG } from "./math.js";
import { apparentSiderealTime, apparentSiderealTimeApprox } from "./siderealTime.js";
import {
    type AstronomicalTime,
    type JulianDay,
    julianCenturiesSinceStandardEquinox,
    julianEphemerisDay,
} from "./time.js";

/** http://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html */
export const MEAN_RADIUS_KM = 696_000;

/** Mean anomaly (M), in degrees, per Meeus 47.3, the one the Moon's series take too. */
export function meanAnomaly(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = polynomial(T, 357.5291092, 35999.0502909, -0.0001536, 1 / 24490000);

    return normalizeDegrees(M);
}

/** Approximation per Jensen et al. 2001. */
export function meanAnomalyApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = (6.24 + 628.302 * T) * RAD_TO_DEG;

    return normalizeDegrees(M);
}

/** Geometric mean longitude (L0), referred to the mean equinox of the date, in degrees, per Meeus 25.2. */
export function meanLongitude(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const L0 = polynomial(T, 280.46646, 36000.76983, 0.0003032);

    return normalizeDegrees(L0);
}

/** The mean longitude to four decimals, as Meeus' short nutation formula takes it (ch. 22). */
export function meanLongitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const L0 = 280.4665 + T * 36000.7698;

    return normalizeDegrees(L0);
}

/** Equation of the center (C), in degrees, per Meeus 25.4. */
export function center(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = meanAnomaly(t) * DEG_TO_RAD;

    return (
        polynomial(T, 1.914602, -0.004817, -0.000014) * Math.sin(M) +
        (0.019993 - T * 0.000101) * Math.sin(2.0 * M) +
        0.000289 * Math.sin(3.0 * M)
    );
}

/** v = M + C */
export function trueAnomaly(t: JulianDay): number {
    return meanAnomaly(t) + center(t);
}

/** True geometric longitude referred to the mean equinox of the date (Θ). */
export function trueLongitude(t: JulianDay): number {
    return meanLongitude(t) + center(t);
}

/** Geometric longitude from the approximate mean elements and equation of the center, per Jensen et al.
 *  2001: the counterpart of {@link trueLongitude}. */
export function trueLongitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = meanAnomalyApprox(t) * DEG_TO_RAD;
    const L = 4.895048 + 628.331951 * T + (0.033417 - 0.000084 * T) * Math.sin(M) + 0.000351 * Math.sin(2 * M);

    return normalizeDegrees(L * RAD_TO_DEG);
}

/**
 * Apparent longitude (λ), in degrees: the true longitude moved to the true equinox of the date by the nutation in
 * longitude and back by the aberration, 20.4898" / R with R in AU, per Meeus ch. 25.
 */
export function apparentLongitude(t: JulianDay): number {
    const R = distance(t) / ASTRONOMICAL_UNIT_KM;
    return normalizeDegrees(trueLongitude(t) + earth.longitudeNutation(t) - 20.4898 / 3600 / R);
}

/** The same from the approximate true longitude and nutation. */
export function apparentLongitudeApprox(t: JulianDay): number {
    const R = distanceApprox(t) / ASTRONOMICAL_UNIT_KM;
    return normalizeDegrees(trueLongitudeApprox(t) + earth.longitudeNutationApprox(t) - 20.4898 / 3600 / R);
}

/** Apparent equatorial position: the apparent longitude at the true obliquity, per Meeus ch. 25.
 *  Geocentric; the Sun's ecliptical latitude stays below 1.2" and is left out. */
export function apparentPosition(t: JulianDay): EquatorialCoords {
    return eclipticalToEquatorial({ longitude: apparentLongitude(t), latitude: 0 }, earth.trueObliquity(t));
}

export function apparentPositionApprox(t: JulianDay): EquatorialCoords {
    return eclipticalToEquatorial({ longitude: apparentLongitudeApprox(t), latitude: 0 }, earth.trueObliquityApprox(t));
}

/** Equatorial horizontal parallax (π), in degrees, per Meeus 40.1: 8.794" at 1 AU.
 *  Tiny compared to the Moon's, but applying it keeps sun/moon topocentric positions on the same footing. */
export function equatorialHorizontalParallax(t: JulianDay): number {
    return Math.asin(EQUATORIAL_RADIUS_KM / distance(t)) * RAD_TO_DEG;
}

export function equatorialHorizontalParallaxApprox(t: JulianDay): number {
    return Math.asin(EQUATORIAL_RADIUS_KM / distanceApprox(t)) * RAD_TO_DEG;
}

/** The Sun's topocentric equatorial position: apparentPosition corrected for an observer's parallax. See
 *  moon.ts's topocentricPosition for the same shape; the Sun's shift is only ~8.8" but nonzero. Feeds
 *  horizontalPosition below, so that comparing sun/moon horizontal positions (e.g. for eclipses) compares
 *  positions from the same observer-centered frame instead of mixing a geocentric Sun with a topocentric Moon. */
export function topocentricPosition(
    time: AstronomicalTime,
    latitude: number,
    longitude: number,
    observerHeightM = 0,
): EquatorialCoords {
    const t = julianEphemerisDay(time);
    const s = apparentSiderealTime(time);

    return applyParallax(apparentPosition(t), equatorialHorizontalParallax(t), s, latitude, longitude, observerHeightM);
}

export function topocentricPositionApprox(
    time: AstronomicalTime,
    latitude: number,
    longitude: number,
    observerHeightM = 0,
): EquatorialCoords {
    const t = julianEphemerisDay(time);
    const s = apparentSiderealTimeApprox(time);

    return applyParallax(
        apparentPositionApprox(t),
        equatorialHorizontalParallaxApprox(t),
        s,
        latitude,
        longitude,
        observerHeightM,
    );
}

export function horizontalPosition(
    time: AstronomicalTime,
    latitude: number,
    longitude: number,
    observerHeightM = 0,
): HorizontalCoords {
    const s = apparentSiderealTime(time);

    return equatorialToHorizontal(
        topocentricPosition(time, latitude, longitude, observerHeightM),
        s,
        latitude,
        longitude,
    );
}

export function horizontalPositionApprox(
    time: AstronomicalTime,
    latitude: number,
    longitude: number,
    observerHeightM = 0,
): HorizontalCoords {
    const s = apparentSiderealTimeApprox(time);

    return equatorialToHorizontal(
        topocentricPositionApprox(time, latitude, longitude, observerHeightM),
        s,
        latitude,
        longitude,
    );
}

/** Distance from the center of the Sun to the center of the Earth, in kilometers, per Meeus 25.5. */
export function distance(t: JulianDay): number {
    const e = earth.orbitEccentricity(t);
    const R = (1.000001018 * (1.0 - e * e)) / (1.0 + e * Math.cos(trueAnomaly(t) * DEG_TO_RAD));

    return R * ASTRONOMICAL_UNIT_KM;
}

/** Approximation per Jensen et al. 2001. */
export function distanceApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = 6.24 + 628.302 * T;

    const R = 1.00014 - (0.016708 - 0.000042 * T) * Math.cos(M) - 0.000141 * Math.cos(2 * M);

    return R * ASTRONOMICAL_UNIT_KM;
}

/** The Sun's apparent angular width as seen from Earth, in radians. */
export function apparentAngularDiameter(t: JulianDay): number {
    return 2 * Math.atan(MEAN_RADIUS_KM / distance(t));
}

/** The Sun's apparent angular width as seen from Earth, in radians. */
export function apparentAngularDiameterApprox(t: JulianDay): number {
    return 2 * Math.atan(MEAN_RADIUS_KM / distanceApprox(t));
}

// See ../GLOSSARY.md for mean/true anomaly, mean/true longitude, equation of the center, and apparent position.
import {
    applyParallax,
    type EquatorialCoords,
    eclipticalToEquatorial,
    equatorialToHorizontal,
    type HorizontalCoords,
} from "./coords.js";
import * as earth from "./earth.js";
import { meanAnomaly, meanAnomalyApprox, meanAscendingNodeLongitude } from "./elements.js";
import { ASTRONOMICAL_UNIT_KM, DEG_TO_RAD, normalizeDegrees, RAD_TO_DEG } from "./math.js";
import { meanSiderealTime, meanSiderealTimeApprox } from "./siderealTime.js";
import { type AstronomicalTime, type JulianDay, julianCenturiesSinceStandardEquinox, julianDayUT } from "./time.js";

/** http://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html */
export const MEAN_RADIUS_KM = 0.696e6;

// Mean anomaly (see elements.ts for why it lives there, not here).
export { meanAnomaly, meanAnomalyApprox };

export function meanLongitude(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const L0 = 280.46645 + T * (36000.76983 + T * 0.0003032);

    return normalizeDegrees(L0);
}

export function meanLongitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const L0 = 280.4665 + T * 36000.7698;

    return normalizeDegrees(L0);
}

/** Equation of the center (AA p152). */
export function center(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = meanAnomaly(t) * DEG_TO_RAD;

    return (
        (1.9146 - T * (0.004817 - T * 0.000014)) * Math.sin(M) +
        (0.019993 - T * 0.000101) * Math.sin(2.0 * M) +
        0.00029 * Math.sin(3.0 * M)
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

export function apparentPosition(t: JulianDay): EquatorialCoords {
    const O = meanAscendingNodeLongitude(t) * DEG_TO_RAD;
    const e = (earth.trueObliquity(t) + 0.00256 * Math.cos(O)) * DEG_TO_RAD;
    const l = (trueLongitude(t) - 0.00569 - 0.00478 * Math.sin(O)) * DEG_TO_RAD;

    const sinl = Math.sin(l);

    return {
        rightAscension: normalizeDegrees(Math.atan2(Math.cos(e) * sinl, Math.cos(l)) * RAD_TO_DEG),
        declination: Math.asin(Math.sin(e) * sinl) * RAD_TO_DEG,
    };
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function apparentPositionApprox(t: JulianDay): EquatorialCoords {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = meanAnomalyApprox(t) * DEG_TO_RAD;

    const longitude =
        (4.895048 + 628.331951 * T + (0.033417 - 0.000084 * T) * Math.sin(M) + 0.000351 * Math.sin(2 * M)) * RAD_TO_DEG;

    return eclipticalToEquatorial({ longitude, latitude: 0 }, earth.trueObliquityApprox(t));
}

/** Equatorial horizontal parallax (π), in degrees, per Meeus' "Astronomical Algorithms" (40.6). Tiny (~8.8")
 *  compared to the Moon's, but applying it keeps sun/moon topocentric positions on the same footing. */
export function equatorialHorizontalParallax(t: JulianDay): number {
    return Math.asin(earth.MEAN_RADIUS_KM / distance(t)) * RAD_TO_DEG;
}

export function equatorialHorizontalParallaxApprox(t: JulianDay): number {
    return Math.asin(earth.MEAN_RADIUS_KM / distanceApprox(t)) * RAD_TO_DEG;
}

/** The Sun's topocentric equatorial position: apparentPosition corrected for an observer's parallax. See
 *  moon.ts's topocentricPosition for the same shape; the Sun's shift is only ~8.8" but nonzero. Feeds
 *  horizontalPosition below, so that comparing sun/moon horizontal positions (e.g. for eclipses) compares
 *  positions from the same observer-centered frame instead of mixing a geocentric Sun with a topocentric Moon. */
export function topocentricPosition(time: AstronomicalTime, latitude: number, longitude: number): EquatorialCoords {
    const t = julianDayUT(time);
    const s = meanSiderealTime(time);

    return applyParallax(apparentPosition(t), equatorialHorizontalParallax(t), s, latitude, longitude);
}

export function topocentricPositionApprox(
    time: AstronomicalTime,
    latitude: number,
    longitude: number,
): EquatorialCoords {
    const t = julianDayUT(time);
    const s = meanSiderealTimeApprox(time);

    return applyParallax(apparentPositionApprox(t), equatorialHorizontalParallaxApprox(t), s, latitude, longitude);
}

export function horizontalPosition(time: AstronomicalTime, latitude: number, longitude: number): HorizontalCoords {
    const s = meanSiderealTime(time);

    return equatorialToHorizontal(topocentricPosition(time, latitude, longitude), s, latitude, longitude);
}

export function horizontalPositionApprox(
    time: AstronomicalTime,
    latitude: number,
    longitude: number,
): HorizontalCoords {
    const s = meanSiderealTimeApprox(time);

    return equatorialToHorizontal(topocentricPositionApprox(time, latitude, longitude), s, latitude, longitude);
}

/** Distance from the center of the Sun to the center of the Earth, in kilometers (AA.24.5). */
export function distance(t: JulianDay): number {
    const e = earth.orbitEccentricity(t);
    const R = (1.000001018 * (1.0 - e * e)) / (1.0 + e * Math.cos(trueAnomaly(t) * DEG_TO_RAD));

    return R * ASTRONOMICAL_UNIT_KM;
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
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

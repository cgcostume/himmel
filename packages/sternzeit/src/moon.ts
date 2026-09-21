// See ../GLOSSARY.md for mean elongation, argument of latitude, ascending node, libration, parallactic angle, and parallax.
import {
    applyParallax,
    type EclipticalCoords,
    type EquatorialCoords,
    eclipticalToEquatorial,
    equatorialToHorizontal,
    type HorizontalCoords,
} from "./coords.js";
import * as earth from "./earth.js";
import {
    meanAscendingNodeLongitude,
    meanAscendingNodeLongitudeApprox,
    meanAnomaly as sunMeanAnomaly,
    meanAnomalyApprox as sunMeanAnomalyApprox,
} from "./elements.js";
import { DEG_TO_RAD, normalizeDegrees, RAD_TO_DEG } from "./math.js";
import { meanSiderealTime, meanSiderealTimeApprox } from "./siderealTime.js";
import {
    type AstronomicalTime,
    type JulianCenturies,
    type JulianDay,
    julianCenturiesSinceStandardEquinox,
    julianDayUT,
} from "./time.js";

/** http://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html */
export const MEAN_RADIUS_KM = 1737.1;

/** Inclination of the Moon's mean equator to the ecliptic (I), in radians. */
const MEAN_EQUATOR_INCLINATION = 1.54242 * DEG_TO_RAD;

/** Mean longitude, referred to the mean equinox of the date, in degrees, per Meeus' "Astronomical Algorithms" (45.1). */
export function meanLongitude(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const L0 = 218.3164591 + T * (481267.88134236 + T * (-0.0013268 + T * (1.0 / 528841.0 + T * (-1.0 / 65194000.0))));

    return normalizeDegrees(L0);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanLongitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const L0 = (3.8104 + 8399.7091 * T) * RAD_TO_DEG;

    return normalizeDegrees(L0);
}

/** Mean elongation, in degrees, per Meeus' "Astronomical Algorithms" (45.2). */
export function meanElongation(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const D = 297.8502042 + T * (445267.1115168 + T * (-0.00163 + T * (1.0 / 545868.0 + T * (-1.0 / 113065000.0))));

    return normalizeDegrees(D);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanElongationApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const D = (5.1985 + 7771.3772 * T) * RAD_TO_DEG;

    return normalizeDegrees(D);
}

/** Mean anomaly, in degrees, per Meeus' "Astronomical Algorithms" (45.4). */
export function meanAnomaly(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const M = 134.9634114 + T * (477198.8676313 + T * (0.008997 + T * (1.0 / 69699.0 + T * (-1.0 / 14712000.0))));

    return normalizeDegrees(M);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanAnomalyApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = (2.3554 + 8328.6911 * T) * RAD_TO_DEG;

    return normalizeDegrees(M);
}

/** Mean distance of the Moon from its ascending node, in degrees, per Meeus' "Astronomical Algorithms" (45.5). */
export function meanArgumentOfLatitude(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const F = 93.2720993 + T * (483202.0175273 + T * (-0.0034029 + T * (-1.0 / 3526000.0 + T * (1.0 / 863310000.0))));

    return normalizeDegrees(F);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanArgumentOfLatitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const F = (1.628 + 8433.4663 * T) * RAD_TO_DEG;

    return normalizeDegrees(F);
}

// Mean ascending node longitude (see elements.ts for why it lives there, not here).
export { meanAscendingNodeLongitude, meanAscendingNodeLongitudeApprox };

/**
 * Correction factor for the eccentricity of the Earth's orbit around the Sun, used in the periodic terms
 * below (AA.45.6). This is unrelated to `earth.orbitEccentricity`, which is ~60x smaller.
 */
function eccentricityCorrection(T: JulianCenturies): number {
    return 1.0 + T * (-0.002516 + T * -0.0000074);
}

/** Geocentric ecliptical position, per Meeus' "Astronomical Algorithms" (45.A, 45.B). */
export function position(t: JulianDay): EclipticalCoords {
    const sM = sunMeanAnomaly(t) * DEG_TO_RAD;

    const mL = meanLongitude(t) * DEG_TO_RAD;
    const mM = meanAnomaly(t) * DEG_TO_RAD;
    const mD = meanElongation(t) * DEG_TO_RAD;
    const mF = meanArgumentOfLatitude(t) * DEG_TO_RAD;

    const T = julianCenturiesSinceStandardEquinox(t);

    const A1 = normalizeDegrees(119.75 + 131.849 * T) * DEG_TO_RAD;
    const A2 = normalizeDegrees(53.09 + 479264.29 * T) * DEG_TO_RAD;
    const A3 = normalizeDegrees(313.45 + 481266.484 * T) * DEG_TO_RAD;

    const E = eccentricityCorrection(T);
    const EE = E * E;

    let Sl = 0.0;

    Sl += 6288.774 * Math.sin(mM);
    Sl += 1274.027 * Math.sin(2 * mD - mM);
    Sl += 658.314 * Math.sin(2 * mD);
    Sl += 213.618 * Math.sin(2 * mM);
    Sl -= 185.116 * Math.sin(sM) * E;
    Sl -= 114.332 * Math.sin(2 * mF);
    Sl += 58.793 * Math.sin(2 * mD - 2 * mM);
    Sl += 57.066 * Math.sin(2 * mD - sM - mM) * E;
    Sl += 53.322 * Math.sin(2 * mD + mM);
    Sl += 45.758 * Math.sin(2 * mD - sM) * E;
    Sl -= 40.923 * Math.sin(sM - mM) * E;
    Sl -= 34.72 * Math.sin(mD);
    Sl -= 30.383 * Math.sin(sM + mM) * E;
    Sl += 15.327 * Math.sin(2 * mD - 2 * mF);
    Sl -= 12.528 * Math.sin(mM + 2 * mF);
    Sl += 10.98 * Math.sin(mM - 2 * mF);
    Sl += 10.675 * Math.sin(4 * mD - mM);
    Sl += 10.034 * Math.sin(3 * mM);
    Sl += 8.548 * Math.sin(4 * mD - 2 * mM);
    Sl -= 7.888 * Math.sin(2 * mD + sM - mM) * E;
    Sl -= 6.766 * Math.sin(2 * mD + sM) * E;
    Sl -= 5.163 * Math.sin(mD - mM);
    Sl += 4.987 * Math.sin(mD + sM) * E;
    Sl += 4.036 * Math.sin(2 * mD - sM + mM) * E;
    Sl += 3.994 * Math.sin(2 * mD + 2 * mM);
    Sl += 3.861 * Math.sin(4 * mD);
    Sl += 3.665 * Math.sin(2 * mD - 3 * mM);
    Sl -= 2.689 * Math.sin(sM - 2 * mM) * E;
    Sl -= 2.602 * Math.sin(2 * mD - mM + 2 * mF);
    Sl += 2.39 * Math.sin(2 * mD - sM - 2 * mM) * E;
    Sl -= 2.348 * Math.sin(mD + mM);
    Sl += 2.236 * Math.sin(2 * mD - 2 * sM) * EE;
    Sl -= 2.12 * Math.sin(sM + 2 * mM) * E;
    Sl -= 2.069 * Math.sin(2 * sM) * EE;
    Sl += 2.048 * Math.sin(2 * mD - 2 * sM - mM) * EE;
    Sl -= 1.773 * Math.sin(2 * mD + mM - 2 * mF);
    Sl -= 1.595 * Math.sin(2 * mD + 2 * mF);
    Sl += 1.215 * Math.sin(4 * mD - sM - mM) * E;
    Sl -= 1.11 * Math.sin(2 * mM + 2 * mF);
    Sl -= 0.892 * Math.sin(3 * mD - mM);
    Sl -= 0.81 * Math.sin(2 * mD + sM + mM) * E;
    Sl += 0.759 * Math.sin(4 * mD - sM - 2 * mM) * E;
    Sl -= 0.713 * Math.sin(2 * sM - mM) * EE;
    Sl -= 0.7 * Math.sin(2 * mD + 2 * sM - mM) * EE;
    Sl += 0.691 * Math.sin(2 * mD + sM - 2 * mM);
    Sl += 0.596 * Math.sin(2 * mD - sM - 2 * mF) * E;
    Sl += 0.549 * Math.sin(4 * mD + mM);
    Sl += 0.537 * Math.sin(4 * mM);
    Sl += 0.52 * Math.sin(4 * mD - sM) * E;
    Sl -= 0.487 * Math.sin(mD - 2 * mM);
    Sl -= 0.399 * Math.sin(2 * mD + sM - 2 * mF) * E;
    Sl -= 0.381 * Math.sin(2 * mM - 2 * mF);
    Sl += 0.351 * Math.sin(mD + sM + mM) * E;
    Sl -= 0.34 * Math.sin(3 * mD - 2 * mM);
    Sl += 0.33 * Math.sin(4 * mD - 3 * mM);
    Sl += 0.327 * Math.sin(2 * mD - sM + 2 * mM) * E;
    Sl -= 0.323 * Math.sin(2 * sM + mM) * EE;
    Sl += 0.299 * Math.sin(mD + sM - mM) * E;
    Sl += 0.294 * Math.sin(2 * mD + 3 * mM);

    let Sb = 0.0;

    Sb += 5128.122 * Math.sin(mF);
    Sb += 280.602 * Math.sin(mM + mF);
    Sb += 277.693 * Math.sin(mM - mF);
    Sb += 173.237 * Math.sin(2 * mD - mF);
    Sb += 55.413 * Math.sin(2 * mD - mM + mF);
    Sb += 46.271 * Math.sin(2 * mD - mM - mF);
    Sb += 32.573 * Math.sin(2 * mD + mF);
    Sb += 17.198 * Math.sin(2 * mM + mF);
    Sb += 9.266 * Math.sin(2 * mD + mM - mF);
    Sb += 8.822 * Math.sin(2 * mM - mF);
    Sb += 8.216 * Math.sin(2 * mD - sM - mF) * E;
    Sb += 4.324 * Math.sin(2 * mD - 2 * mM - mF);
    Sb += 4.2 * Math.sin(2 * mD + mM + mF);
    Sb -= 3.359 * Math.sin(2 * mD + sM - mF) * E;
    Sb += 2.463 * Math.sin(2 * mD - sM - mM + mF) * E;
    Sb += 2.211 * Math.sin(2 * mD - sM + mF) * E;
    Sb += 2.065 * Math.sin(2 * mD - sM - mM - mF) * E;
    Sb -= 1.87 * Math.sin(sM - mM - mF) * E;
    Sb += 1.828 * Math.sin(4 * mD - mM - mF);
    Sb -= 1.794 * Math.sin(sM + mF) * E;
    Sb -= 1.749 * Math.sin(3 * mF);
    Sb -= 1.565 * Math.sin(sM - mM + mF) * E;
    Sb -= 1.491 * Math.sin(mD + mF);
    Sb -= 1.475 * Math.sin(sM + mM + mF) * E;
    Sb -= 1.41 * Math.sin(sM + mM - mF) * E;
    Sb -= 1.344 * Math.sin(sM - mF) * E;
    Sb -= 1.335 * Math.sin(mD - mF);
    Sb += 1.107 * Math.sin(3 * mM + mF);
    Sb += 1.024 * Math.sin(4 * mD - mF);
    Sb += 0.833 * Math.sin(4 * mD - mM + mF);
    Sb += 0.777 * Math.sin(mM - 3 * mF);
    Sb += 0.671 * Math.sin(4 * mD - 2 * mM + mF);
    Sb += 0.607 * Math.sin(2 * mD - 3 * mF);
    Sb += 0.596 * Math.sin(2 * mD + 2 * mM - mF);
    Sb += 0.491 * Math.sin(2 * mD - sM + mM - mF) * E;
    Sb -= 0.451 * Math.sin(2 * mD - 2 * mM + mF);
    Sb += 0.439 * Math.sin(3 * mM - mF);
    Sb += 0.422 * Math.sin(2 * mD + 2 * mM + mF);
    Sb += 0.421 * Math.sin(2 * mD - 3 * mM - mF);
    Sb -= 0.366 * Math.sin(2 * mD + sM - mM + mF) * E;
    Sb -= 0.351 * Math.sin(2 * mD + sM + mF) * E;
    Sb += 0.331 * Math.sin(4 * mD + mF);
    Sb += 0.315 * Math.sin(2 * mD - sM + mM + mF) * E;
    Sb += 0.302 * Math.sin(2 * mD - 2 * sM - mF) * EE;
    Sb -= 0.283 * Math.sin(mM + 3 * mF);
    Sb -= 0.229 * Math.sin(2 * mD + sM + mM - mF) * E;
    Sb += 0.223 * Math.sin(mD + sM - mF) * E;
    Sb += 0.223 * Math.sin(mD + sM + mF) * E;
    Sb -= 0.22 * Math.sin(sM - 2 * mM - mF) * E;
    Sb -= 0.22 * Math.sin(2 * mD + sM - mM - mF) * E;
    Sb -= 0.185 * Math.sin(mD + mM + mF);
    Sb += 0.181 * Math.sin(2 * mD - sM - 2 * mM - mF) * E;
    Sb -= 0.177 * Math.sin(sM + 2 * mM + mF) * E;
    Sb += 0.176 * Math.sin(4 * mD - 2 * mM - mF);
    Sb += 0.166 * Math.sin(4 * mD - sM - mM - mF) * E;
    Sb -= 0.164 * Math.sin(mD + mM - mF);
    Sb += 0.132 * Math.sin(4 * mD + mM - mF);
    Sb -= 0.119 * Math.sin(mD - mM - mF);
    Sb += 0.115 * Math.sin(4 * mD - sM - mF) * E;
    Sb += 0.107 * Math.sin(2 * mD - 2 * sM + mF) * EE;

    Sl += 3.958 * Math.sin(A1) + 1.962 * Math.sin(mL - mF) + 0.318 * Math.sin(A2);

    Sb +=
        -2.235 * Math.sin(mL) +
        0.382 * Math.sin(A3) +
        0.175 * Math.sin(A1 - mF) +
        0.175 * Math.sin(A1 + mF) +
        0.127 * Math.sin(mL - mM) -
        0.115 * Math.sin(mL + mM);

    return {
        longitude: meanLongitude(t) + Sl * 0.001 + earth.longitudeNutation(t),
        latitude: Sb * 0.001,
    };
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function positionApprox(t: JulianDay): EclipticalCoords {
    const sM = sunMeanAnomalyApprox(t) * DEG_TO_RAD;

    const mL = meanLongitudeApprox(t) * DEG_TO_RAD;
    const mM = meanAnomalyApprox(t) * DEG_TO_RAD;
    const mD = meanElongationApprox(t) * DEG_TO_RAD;
    const mF = meanArgumentOfLatitudeApprox(t) * DEG_TO_RAD;

    let Sl = mL;

    Sl += 0.1098 * Math.sin(mM);
    Sl += 0.0222 * Math.sin(2 * mD - mM);
    Sl += 0.0115 * Math.sin(2 * mD);
    Sl += 0.0037 * Math.sin(2 * mM);
    Sl -= 0.0032 * Math.sin(sM);
    Sl -= 0.002 * Math.sin(2 * mF);
    Sl += 0.001 * Math.sin(2 * mD - 2 * mM);
    Sl += 0.001 * Math.sin(2 * mD - sM - mM);
    Sl += 0.0009 * Math.sin(2 * mD + mM);
    Sl += 0.0008 * Math.sin(2 * mD - sM);
    Sl -= 0.0007 * Math.sin(sM - mM);
    Sl -= 0.0006 * Math.sin(mD);
    Sl -= 0.0005 * Math.sin(sM + mM);

    let Sb = 0.0;

    Sb += 0.0895 * Math.sin(mF);
    Sb += 0.0049 * Math.sin(mM + mF);
    Sb += 0.0048 * Math.sin(mM - mF);
    Sb += 0.003 * Math.sin(2 * mD - mF);
    Sb += 0.001 * Math.sin(2 * mD - mM + mF);
    Sb += 0.0008 * Math.sin(2 * mD - mM - mF);
    Sb += 0.0006 * Math.sin(2 * mD + mF);

    return { longitude: Sl * RAD_TO_DEG, latitude: Sb * RAD_TO_DEG };
}

export function apparentPosition(t: JulianDay): EquatorialCoords {
    // position(t) already folds longitude nutation (Δψ) into its longitude, so it isn't added again here.
    // trueObliquity (not meanObliquity) additionally applies nutation in obliquity (Δε), matching how
    // apparentPositionApprox uses trueObliquityApprox below.
    return eclipticalToEquatorial(position(t), earth.trueObliquity(t));
}

export function apparentPositionApprox(t: JulianDay): EquatorialCoords {
    return eclipticalToEquatorial(positionApprox(t), earth.trueObliquityApprox(t));
}

/** Equatorial horizontal parallax (π), in degrees, per Meeus' "Astronomical Algorithms" (40.6), simplified to
 *  a spherical (not oblate) Earth, consistent with this library having no elevation/oblateness model elsewhere. */
export function equatorialHorizontalParallax(t: JulianDay): number {
    return Math.asin(earth.MEAN_RADIUS_KM / distance(t)) * RAD_TO_DEG;
}

export function equatorialHorizontalParallaxApprox(t: JulianDay): number {
    return Math.asin(earth.MEAN_RADIUS_KM / distanceApprox(t)) * RAD_TO_DEG;
}

/** The Moon's topocentric equatorial position: apparentPosition corrected for an observer's parallax, since
 *  at the Moon's distance (~384,000 km) that shift is on the order of a degree (sun.ts has the same shape,
 *  though its parallax is only ~8.8"). Feeds horizontalPosition below. */
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

/** Distance from the center of the Moon to the center of the Earth, in kilometers, per Meeus' "Astronomical Algorithms" (45.A). */
export function distance(t: JulianDay): number {
    const sM = sunMeanAnomaly(t) * DEG_TO_RAD;

    const mM = meanAnomaly(t) * DEG_TO_RAD;
    const mD = meanElongation(t) * DEG_TO_RAD;
    const mF = meanArgumentOfLatitude(t) * DEG_TO_RAD;

    const T = julianCenturiesSinceStandardEquinox(t);
    const E = eccentricityCorrection(T);
    const EE = E * E;

    let Sr = 0.0;

    Sr -= 20905.355 * Math.cos(mM);
    Sr -= 3699.111 * Math.cos(2 * mD - mM);
    Sr -= 2955.968 * Math.cos(2 * mD);
    Sr -= 569.925 * Math.cos(2 * mM);
    Sr += 48.888 * Math.cos(sM) * E;
    Sr -= 3.149 * Math.cos(2 * mF);
    Sr += 246.158 * Math.cos(2 * mD - 2 * mM);
    Sr -= 152.138 * Math.cos(2 * mD - sM - mM) * E;
    Sr -= 170.733 * Math.cos(2 * mD + mM);
    Sr -= 204.586 * Math.cos(2 * mD - sM) * E;
    Sr -= 129.62 * Math.cos(sM - mM) * E;
    Sr += 108.743 * Math.cos(mD);
    Sr += 104.755 * Math.cos(sM + mM) * E;
    Sr += 10.321 * Math.cos(2 * mD - 2 * mF);
    Sr += 79.661 * Math.cos(mM - 2 * mF);
    Sr -= 34.782 * Math.cos(4 * mD - mM);
    Sr -= 23.21 * Math.cos(3 * mM);
    Sr -= 21.636 * Math.cos(4 * mD - 2 * mM);
    Sr += 24.208 * Math.cos(2 * mD + sM - mM) * E;
    Sr += 30.824 * Math.cos(2 * mD + sM) * E;
    Sr -= 8.379 * Math.cos(mD - mM);
    Sr -= 16.675 * Math.cos(mD + sM) * E;
    Sr -= 12.831 * Math.cos(2 * mD - sM + mM) * E;
    Sr -= 10.445 * Math.cos(2 * mD + 2 * mM);
    Sr -= 11.65 * Math.cos(4 * mD);
    Sr += 14.403 * Math.cos(2 * mD - 3 * mM);
    Sr -= 7.003 * Math.cos(sM - 2 * mM) * E;
    Sr += 10.056 * Math.cos(2 * mD - sM - 2 * mM) * E;
    Sr += 6.322 * Math.cos(mD + mM);
    Sr -= 9.884 * Math.cos(2 * mD - 2 * sM) * EE;
    Sr += 5.751 * Math.cos(sM + 2 * mM) * E;
    Sr -= 4.95 * Math.cos(2 * mD - 2 * sM - mM) * EE;
    Sr += 4.13 * Math.cos(2 * mD + mM - 2 * mF);
    Sr -= 3.958 * Math.cos(4 * mD - sM - mM) * E;
    Sr += 3.258 * Math.cos(3 * mD - mM);
    Sr += 2.616 * Math.cos(2 * mD + sM + mM) * E;
    Sr -= 1.897 * Math.cos(4 * mD - sM - 2 * mM) * E;
    Sr -= 2.117 * Math.cos(2 * sM - mM) * EE;
    Sr += 2.354 * Math.cos(2 * mD + 2 * sM - mM) * EE;
    Sr -= 1.423 * Math.cos(4 * mD + mM);
    Sr -= 1.117 * Math.cos(4 * mM);
    Sr -= 1.571 * Math.cos(4 * mD - sM) * E;
    Sr -= 1.739 * Math.cos(mD - 2 * mM);
    Sr -= 4.421 * Math.cos(2 * mM - 2 * mF);
    Sr += 1.165 * Math.cos(2 * sM + mM) * EE;
    Sr += 8.752 * Math.cos(2 * mD - mM - 2 * mF);

    return 385000.56 + Sr;
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function distanceApprox(t: JulianDay): number {
    const sM = sunMeanAnomalyApprox(t) * DEG_TO_RAD;

    const mM = meanAnomalyApprox(t) * DEG_TO_RAD;
    const mD = meanElongationApprox(t) * DEG_TO_RAD;

    let Sr = 0.016593;

    Sr += 0.000904 * Math.cos(mM);
    Sr += 0.000166 * Math.cos(2 * mD - mM);
    Sr += 0.000137 * Math.cos(2 * mD);
    Sr += 0.000049 * Math.cos(2 * mM);
    Sr += 0.000015 * Math.cos(2 * mD + mM);
    Sr += 0.000009 * Math.cos(2 * mD - sM);

    return earth.MEAN_RADIUS_KM / Sr;
}

/** The Moon's apparent angular width as seen from Earth, in radians. */
export function apparentAngularDiameter(t: JulianDay): number {
    return 2 * Math.atan(MEAN_RADIUS_KM / distance(t));
}

/** The Moon's apparent angular width as seen from Earth, in radians. */
export function apparentAngularDiameterApprox(t: JulianDay): number {
    return 2 * Math.atan(MEAN_RADIUS_KM / distanceApprox(t));
}

export interface MoonLibration {
    /** Libration in longitude, in degrees. */
    longitude: number;
    /** Libration in latitude, in degrees. */
    latitude: number;
}

/** Optical librations, per Meeus' "Astronomical Algorithms" (51.1). */
export function opticalLibrations(t: JulianDay): MoonLibration {
    const Dr = earth.longitudeNutation(t) * DEG_TO_RAD;

    const F = meanArgumentOfLatitude(t) * DEG_TO_RAD;
    const O = meanAscendingNodeLongitude(t) * DEG_TO_RAD;

    const ecl = position(t);
    const lo = ecl.longitude * DEG_TO_RAD;
    const la = ecl.latitude * DEG_TO_RAD;

    const cosLa = Math.cos(la);
    const sinLa = Math.sin(la);
    const cosI = Math.cos(MEAN_EQUATOR_INCLINATION);
    const sinI = Math.sin(MEAN_EQUATOR_INCLINATION);

    const W = normalizeRadians(lo - Dr - O);
    const sinW = Math.sin(W);

    const A = normalizeRadians(Math.atan2(sinW * cosLa * cosI - sinLa * sinI, Math.cos(W) * cosLa));

    return {
        longitude: A * RAD_TO_DEG - F * RAD_TO_DEG,
        latitude: Math.asin(-sinW * cosLa * sinI - sinLa * cosI) * RAD_TO_DEG,
    };
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function opticalLibrationsApprox(t: JulianDay): MoonLibration {
    const Dr = earth.longitudeNutationApprox(t) * DEG_TO_RAD;

    const F = meanArgumentOfLatitudeApprox(t) * DEG_TO_RAD;
    const O = meanAscendingNodeLongitudeApprox(t) * DEG_TO_RAD;

    const ecl = positionApprox(t);
    const lo = ecl.longitude * DEG_TO_RAD;
    const la = ecl.latitude * DEG_TO_RAD;

    const cosLa = Math.cos(la);
    const sinLa = Math.sin(la);
    const cosI = Math.cos(MEAN_EQUATOR_INCLINATION);
    const sinI = Math.sin(MEAN_EQUATOR_INCLINATION);

    const W = normalizeRadians(lo - Dr - O);
    const sinW = Math.sin(W);

    const A = normalizeRadians(Math.atan2(sinW * cosLa * cosI - sinLa * sinI, Math.cos(W) * cosLa));

    return {
        longitude: A * RAD_TO_DEG - F * RAD_TO_DEG,
        latitude: Math.asin(-sinW * cosLa * sinI - sinLa * cosI) * RAD_TO_DEG,
    };
}

/** Parallactic angle, in degrees, per Meeus' "Astronomical Algorithms" (13.1). */
export function parallacticAngle(time: AstronomicalTime, latitude: number, longitude: number): number {
    const t = julianDayUT(time);

    const la = latitude * DEG_TO_RAD;
    const lo = longitude * DEG_TO_RAD;

    const pos = apparentPosition(t);
    const ra = pos.rightAscension * DEG_TO_RAD;
    const de = pos.declination * DEG_TO_RAD;

    const s = meanSiderealTime(time) * DEG_TO_RAD;

    // Local hour angle (AA.p88).
    const H = s + lo - ra;

    const cosLa = Math.cos(la);
    const P = Math.atan2(Math.sin(H) * cosLa, Math.sin(la) * Math.cos(de) - Math.sin(de) * cosLa * Math.cos(H));

    return P * RAD_TO_DEG;
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function parallacticAngleApprox(time: AstronomicalTime, latitude: number, longitude: number): number {
    const t = julianDayUT(time);

    const la = latitude * DEG_TO_RAD;
    const lo = longitude * DEG_TO_RAD;

    const pos = apparentPositionApprox(t);
    const ra = pos.rightAscension * DEG_TO_RAD;
    const de = pos.declination * DEG_TO_RAD;

    const s = meanSiderealTimeApprox(time) * DEG_TO_RAD;

    const H = s + lo - ra;

    const cosLa = Math.cos(la);
    const P = Math.atan2(Math.sin(H) * cosLa, Math.sin(la) * Math.cos(de) - Math.sin(de) * cosLa * Math.cos(H));

    return P * RAD_TO_DEG;
}

/** Position angle of the Moon's axis of rotation, in degrees, per Meeus' "Astronomical Algorithms" (p344). */
export function positionAngleOfAxis(t: JulianDay): number {
    const pos = apparentPosition(t);

    const a = pos.rightAscension * DEG_TO_RAD;
    const e = earth.meanObliquity(t) * DEG_TO_RAD;

    const Dr = earth.longitudeNutation(t) * DEG_TO_RAD;
    const O = meanAscendingNodeLongitude(t) * DEG_TO_RAD;

    const V = O + Dr;

    const sinI = Math.sin(MEAN_EQUATOR_INCLINATION);

    const X = sinI * Math.sin(V);
    const Y = sinI * Math.cos(V) * Math.cos(e) - Math.cos(MEAN_EQUATOR_INCLINATION) * Math.sin(e);

    const ecl = position(t);
    const lo = ecl.longitude * DEG_TO_RAD;
    const la = ecl.latitude * DEG_TO_RAD;

    const W = normalizeRadians(lo - Dr - O);
    const b = Math.asin(-Math.sin(W) * Math.cos(la) * sinI - Math.sin(la) * Math.cos(MEAN_EQUATOR_INCLINATION));

    const w = normalizeRadians(Math.atan2(X, Y));
    const P = Math.asin((Math.sqrt(X * X + Y * Y) * Math.cos(a - w)) / Math.cos(b));

    return P * RAD_TO_DEG;
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function positionAngleOfAxisApprox(t: JulianDay): number {
    const pos = apparentPositionApprox(t);

    const a = pos.rightAscension * DEG_TO_RAD;
    const e = earth.meanObliquityApprox(t) * DEG_TO_RAD;

    const Dr = earth.longitudeNutationApprox(t) * DEG_TO_RAD;
    const O = meanAscendingNodeLongitudeApprox(t) * DEG_TO_RAD;

    const V = O + Dr;

    const sinI = Math.sin(MEAN_EQUATOR_INCLINATION);

    const X = sinI * Math.sin(V);
    const Y = sinI * Math.cos(V) * Math.cos(e) - Math.cos(MEAN_EQUATOR_INCLINATION) * Math.sin(e);

    const ecl = positionApprox(t);
    const lo = ecl.longitude * DEG_TO_RAD;
    const la = ecl.latitude * DEG_TO_RAD;

    const W = normalizeRadians(lo - Dr - O);
    const b = Math.asin(-Math.sin(W) * Math.cos(la) * sinI - Math.sin(la) * Math.cos(MEAN_EQUATOR_INCLINATION));

    const w = normalizeRadians(Math.atan2(X, Y));
    const P = Math.asin((Math.sqrt(X * X + Y * Y) * Math.cos(a - w)) / Math.cos(b));

    return P * RAD_TO_DEG;
}

/** Normalizes an angle in radians to the range [0, 2π). */
function normalizeRadians(rad: number): number {
    return rad - Math.floor(rad / (2 * Math.PI)) * 2 * Math.PI;
}

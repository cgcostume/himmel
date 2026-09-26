// Terms used here are explained in the himmelszelt site's glossary (site/src/data/glossary.json).
import {
    applyParallax,
    type Direction,
    type EclipticalCoords,
    EQUATORIAL_RADIUS_KM,
    type EquatorialCoords,
    eclipticalToEquatorial,
    equatorialToHorizontal,
    type HorizontalCoords,
    horizontalToDirection,
} from "./coords.js";
import * as earth from "./earth.js";
import { angularSeparation, DEG_TO_RAD, normalizeDegrees, RAD_TO_DEG } from "./math.js";
import { apparentSiderealTime, apparentSiderealTimeApprox } from "./siderealTime.js";
import * as sun from "./sun.js";
import {
    type AstronomicalTime,
    type JulianCenturies,
    type JulianDay,
    julianCenturiesSinceStandardEquinox,
    julianEphemerisDay,
} from "./time.js";

/** http://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html */
export const MEAN_RADIUS_KM = 1737.1;

/**
 * Mean length of a lunation, new moon to new moon, in days, per Meeus' "Astronomical Algorithms" (49.1). The true
 * interval swings about half a day either side of it, so it locates a phase rather than timing it: stepping by it
 * from `MEAN_NEW_MOON` lands within a day of every new moon, which is enough to then search for one.
 */
export const MEAN_SYNODIC_MONTH = 29.530588861;

/**
 * The mean new moon of 2000 January 6, from which lunations are counted (Meeus 49.1): lunation k is at
 * `MEAN_NEW_MOON + k * MEAN_SYNODIC_MONTH`, a full moon half a lunation later. In JDE (terrestrial time), which
 * is about a minute ahead of the UT these functions take, far below the accuracy of the mean phase itself.
 */
export const MEAN_NEW_MOON = 2451550.09766;

/** Inclination of the Moon's mean equator to the ecliptic (I), in radians. */
const MEAN_EQUATOR_INCLINATION = 1.54242 * DEG_TO_RAD;

/** Mean longitude, referred to the mean equinox of the date, in degrees, per Meeus' "Astronomical Algorithms" (47.1). */
export function meanLongitude(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const L0 = 218.3164477 + T * (481267.88123421 + T * (-0.0015786 + T * (1.0 / 538841.0 + T * (-1.0 / 65194000.0))));

    return normalizeDegrees(L0);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanLongitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const L0 = (3.8104 + 8399.7091 * T) * RAD_TO_DEG;

    return normalizeDegrees(L0);
}

/** Mean elongation, in degrees, per Meeus' "Astronomical Algorithms" (47.2). */
export function meanElongation(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const D = 297.8501921 + T * (445267.1114034 + T * (-0.0018819 + T * (1.0 / 545868.0 + T * (-1.0 / 113065000.0))));

    return normalizeDegrees(D);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanElongationApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const D = (5.1985 + 7771.3772 * T) * RAD_TO_DEG;

    return normalizeDegrees(D);
}

/** Mean anomaly, in degrees, per Meeus' "Astronomical Algorithms" (47.4). */
export function meanAnomaly(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const M = 134.9633964 + T * (477198.8675055 + T * (0.0087414 + T * (1.0 / 69699.0 + T * (-1.0 / 14712000.0))));

    return normalizeDegrees(M);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanAnomalyApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = (2.3554 + 8328.6911 * T) * RAD_TO_DEG;

    return normalizeDegrees(M);
}

/** Mean distance of the Moon from its ascending node, in degrees, per Meeus' "Astronomical Algorithms" (47.5). */
export function meanArgumentOfLatitude(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);

    const F = 93.272095 + T * (483202.0175233 + T * (-0.0036539 + T * (-1.0 / 3526000.0 + T * (1.0 / 863310000.0))));

    return normalizeDegrees(F);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanArgumentOfLatitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const F = (1.628 + 8433.4663 * T) * RAD_TO_DEG;

    return normalizeDegrees(F);
}

/** Longitude of the mean ascending node (Ω), in degrees, per Meeus' "Astronomical Algorithms" (47.7). */
export function meanAscendingNodeLongitude(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const O = 125.0445479 + T * (-1934.1362891 + T * (0.0020754 + T * (1.0 / 467441.0 + T * (-1.0 / 60616000.0))));

    return normalizeDegrees(O);
}

export function meanAscendingNodeLongitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const O = 125.04 + T * -1934.136;

    return normalizeDegrees(O);
}

/**
 * Correction factor for the eccentricity of the Earth's orbit around the Sun, used in the periodic terms
 * below (AA.45.6). This is unrelated to `earth.orbitEccentricity`, which is ~60x smaller.
 */
function eccentricityCorrection(T: JulianCenturies): number {
    return 1.0 + T * (-0.002516 + T * -0.0000074);
}

/** Geocentric ecliptical position, per Meeus' "Astronomical Algorithms" (45.A, 45.B). */
export function position(t: JulianDay): EclipticalCoords {
    const sM = sun.meanAnomaly(t) * DEG_TO_RAD;

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
    Sl += 0.691 * Math.sin(2 * mD + sM - 2 * mM) * E;
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
    Sb += 1.021 * Math.sin(4 * mD - mF);
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
    const sM = sun.meanAnomalyApprox(t) * DEG_TO_RAD;

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

    // Referred to the true equinox of the date like `position`, so both variants compose the same way downstream.
    return { longitude: Sl * RAD_TO_DEG + earth.longitudeNutationApprox(t), latitude: Sb * RAD_TO_DEG };
}

export function apparentPosition(t: JulianDay): EquatorialCoords {
    // position(t) already folds the nutation in longitude (Δψ) in; trueObliquity adds the one in obliquity (Δε).
    return eclipticalToEquatorial(position(t), earth.trueObliquity(t));
}

export function apparentPositionApprox(t: JulianDay): EquatorialCoords {
    return eclipticalToEquatorial(positionApprox(t), earth.trueObliquityApprox(t));
}

/** Equatorial horizontal parallax (π), in degrees: the angle Earth's equatorial radius spans at the Moon's distance,
 *  per Meeus' "Astronomical Algorithms" (ch. 47). The observer's place on the ellipsoid enters in `applyParallax`. */
export function equatorialHorizontalParallax(t: JulianDay): number {
    return Math.asin(EQUATORIAL_RADIUS_KM / distance(t)) * RAD_TO_DEG;
}

export function equatorialHorizontalParallaxApprox(t: JulianDay): number {
    return Math.asin(EQUATORIAL_RADIUS_KM / distanceApprox(t)) * RAD_TO_DEG;
}

/** The Moon's topocentric equatorial position: apparentPosition corrected for an observer's parallax, since
 *  at the Moon's distance (~384,000 km) that shift is on the order of a degree (sun.ts has the same shape,
 *  though its parallax is only ~8.8"). Feeds horizontalPosition below. */
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

/** Distance from the center of the Moon to the center of the Earth, in kilometers, per Meeus' "Astronomical Algorithms" (45.A). */
export function distance(t: JulianDay): number {
    const sM = sun.meanAnomaly(t) * DEG_TO_RAD;

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

    return 385_000.56 + Sr;
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function distanceApprox(t: JulianDay): number {
    const sM = sun.meanAnomalyApprox(t) * DEG_TO_RAD;

    const mM = meanAnomalyApprox(t) * DEG_TO_RAD;
    const mD = meanElongationApprox(t) * DEG_TO_RAD;

    let Sr = 0.016593;

    Sr += 0.000904 * Math.cos(mM);
    Sr += 0.000166 * Math.cos(2 * mD - mM);
    Sr += 0.000137 * Math.cos(2 * mD);
    Sr += 0.000049 * Math.cos(2 * mM);
    Sr += 0.000015 * Math.cos(2 * mD + mM);
    Sr += 0.000009 * Math.cos(2 * mD - sM);

    // Sr is the sine of the equatorial horizontal parallax, so it measures the equatorial radius, not the mean one.
    return EQUATORIAL_RADIUS_KM / Sr;
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
    /** Libration in longitude, in degrees, -180 to 180: positive shows more of the Moon's eastern limb. */
    longitude: number;
    /** Libration in latitude, in degrees: positive shows more of the Moon's north. */
    latitude: number;
}

/** Wraps an angle in degrees into [-180, 180). */
const wrap180 = (deg: number) => normalizeDegrees(deg + 180) - 180;

/**
 * Optical libration (l', b') from the Moon's apparent ecliptical position, per Meeus' "Astronomical Algorithms" (53.1),
 * with the angle A that the physical libration takes, in radians. All inputs in degrees.
 */
function optical(ecl: EclipticalCoords, nutationInLongitude: number, node: number, argumentOfLatitude: number) {
    const la = ecl.latitude * DEG_TO_RAD;
    const W = (ecl.longitude - nutationInLongitude - node) * DEG_TO_RAD;
    const cosI = Math.cos(MEAN_EQUATOR_INCLINATION);
    const sinI = Math.sin(MEAN_EQUATOR_INCLINATION);

    const A = Math.atan2(Math.sin(W) * Math.cos(la) * cosI - Math.sin(la) * sinI, Math.cos(W) * Math.cos(la));
    const b = Math.asin(-Math.sin(W) * Math.cos(la) * sinI - Math.sin(la) * cosI);

    return { longitude: wrap180(A * RAD_TO_DEG - argumentOfLatitude), latitude: b * RAD_TO_DEG, A };
}

/** Optical librations: the tilt and the varying speed of the orbit alone, per Meeus (53.1). */
export function opticalLibrations(t: JulianDay): MoonLibration {
    const { longitude, latitude } = optical(
        position(t),
        earth.longitudeNutation(t),
        meanAscendingNodeLongitude(t),
        meanArgumentOfLatitude(t),
    );
    return { longitude, latitude };
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function opticalLibrationsApprox(t: JulianDay): MoonLibration {
    const { longitude, latitude } = optical(
        positionApprox(t),
        earth.longitudeNutationApprox(t),
        meanAscendingNodeLongitudeApprox(t),
        meanArgumentOfLatitudeApprox(t),
    );
    return { longitude, latitude };
}

/**
 * The physical libration's ρ, σ and τ, in degrees: the Moon's own wobble about its mean rotation, driven by Earth's and
 * the Sun's pull on its uneven mass, per Meeus' "Astronomical Algorithms" (ch. 53). Below 0.04°.
 */
function physicalTerms(t: JulianDay): { rho: number; sigma: number; tau: number } {
    const T = julianCenturiesSinceStandardEquinox(t);
    const D = meanElongation(t) * DEG_TO_RAD;
    const M = sun.meanAnomaly(t) * DEG_TO_RAD;
    const Mm = meanAnomaly(t) * DEG_TO_RAD;
    const F = meanArgumentOfLatitude(t) * DEG_TO_RAD;
    const O = meanAscendingNodeLongitude(t) * DEG_TO_RAD;
    const E = eccentricityCorrection(T);
    const K1 = (119.75 + 131.849 * T) * DEG_TO_RAD;
    const K2 = (72.56 + 20.186 * T) * DEG_TO_RAD;

    // biome-ignore format: one term per line, as in the book
    const rho =
        -0.02752 * Math.cos(Mm) - 0.02245 * Math.sin(F) + 0.00684 * Math.cos(Mm - 2 * F) - 0.00293 * Math.cos(2 * F) -
        0.00085 * Math.cos(2 * F - 2 * D) - 0.00054 * Math.cos(Mm - 2 * D) - 0.0002 * Math.sin(Mm + F) -
        0.0002 * Math.cos(Mm + 2 * F) - 0.0002 * Math.cos(Mm - F) + 0.00014 * Math.cos(Mm + 2 * F - 2 * D);

    // biome-ignore format: one term per line, as in the book
    const sigma =
        -0.02816 * Math.sin(Mm) + 0.02244 * Math.cos(F) - 0.00682 * Math.sin(Mm - 2 * F) - 0.00279 * Math.sin(2 * F) -
        0.00083 * Math.sin(2 * F - 2 * D) + 0.00069 * Math.sin(Mm - 2 * D) + 0.0004 * Math.cos(Mm + F) -
        0.00025 * Math.sin(2 * Mm) - 0.00023 * Math.sin(Mm + 2 * F) + 0.0002 * Math.cos(Mm - F) +
        0.00019 * Math.sin(Mm - F) + 0.00013 * Math.sin(Mm + 2 * F - 2 * D) - 0.0001 * Math.cos(Mm - 3 * F);

    // biome-ignore format: one term per line, as in the book
    const tau =
        0.0252 * E * Math.sin(M) + 0.00473 * Math.sin(2 * Mm - 2 * F) - 0.00467 * Math.sin(Mm) +
        0.00396 * Math.sin(K1) + 0.00276 * Math.sin(2 * Mm - 2 * D) + 0.00196 * Math.sin(O) -
        0.00183 * Math.cos(Mm - F) + 0.00115 * Math.sin(Mm - 2 * D) - 0.00096 * Math.sin(Mm - D) +
        0.00046 * Math.sin(2 * F - 2 * D) - 0.00039 * Math.sin(Mm - F) - 0.00032 * Math.sin(Mm - M - D) +
        0.00027 * Math.sin(2 * Mm - M - 2 * D) + 0.00023 * Math.sin(K2) - 0.00014 * Math.sin(2 * D) +
        0.00014 * Math.cos(2 * Mm - 2 * F) - 0.00012 * Math.sin(Mm - 2 * F) - 0.00012 * Math.sin(2 * Mm) +
        0.00011 * Math.sin(2 * Mm - 2 * M - 2 * D);

    return { rho, sigma, tau };
}

/**
 * Total librations, optical plus physical (53.2), per Meeus' "Astronomical Algorithms" (ch. 53): which part of the
 * Moon's face is turned towards Earth's center.
 */
export function librations(t: JulianDay): MoonLibration {
    const o = optical(
        position(t),
        earth.longitudeNutation(t),
        meanAscendingNodeLongitude(t),
        meanArgumentOfLatitude(t),
    );
    const { rho, sigma, tau } = physicalTerms(t);
    const cosA = Math.cos(o.A);
    const sinA = Math.sin(o.A);

    return {
        longitude: wrap180(o.longitude - tau + (rho * cosA + sigma * sinA) * Math.tan(o.latitude * DEG_TO_RAD)),
        latitude: o.latitude + sigma * cosA - rho * sinA,
    };
}

/** The optical librations alone: the physical part stays below 0.04°. */
export function librationsApprox(t: JulianDay): MoonLibration {
    return opticalLibrationsApprox(t);
}

/** Parallactic angle, in degrees, per Meeus' "Astronomical Algorithms" (13.1). */
export function parallacticAngle(time: AstronomicalTime, latitude: number, longitude: number): number {
    const t = julianEphemerisDay(time);

    const la = latitude * DEG_TO_RAD;
    const lo = longitude * DEG_TO_RAD;

    const pos = apparentPosition(t);
    const ra = pos.rightAscension * DEG_TO_RAD;
    const de = pos.declination * DEG_TO_RAD;

    const s = apparentSiderealTime(time) * DEG_TO_RAD;

    // Local hour angle (AA.p88).
    const H = s + lo - ra;

    const cosLa = Math.cos(la);
    const P = Math.atan2(Math.sin(H) * cosLa, Math.sin(la) * Math.cos(de) - Math.sin(de) * cosLa * Math.cos(H));

    return P * RAD_TO_DEG;
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function parallacticAngleApprox(time: AstronomicalTime, latitude: number, longitude: number): number {
    const t = julianEphemerisDay(time);

    const la = latitude * DEG_TO_RAD;
    const lo = longitude * DEG_TO_RAD;

    const pos = apparentPositionApprox(t);
    const ra = pos.rightAscension * DEG_TO_RAD;
    const de = pos.declination * DEG_TO_RAD;

    const s = apparentSiderealTimeApprox(time) * DEG_TO_RAD;

    const H = s + lo - ra;

    const cosLa = Math.cos(la);
    const P = Math.atan2(Math.sin(H) * cosLa, Math.sin(la) * Math.cos(de) - Math.sin(de) * cosLa * Math.cos(H));

    return P * RAD_TO_DEG;
}

/**
 * Position angle of the Moon's axis of rotation (P), in degrees, from the north point of the disc through east, per
 * Meeus' "Astronomical Algorithms" (ch. 53), with the physical libration.
 */
export function positionAngleOfAxis(t: JulianDay): number {
    const { rho, sigma } = physicalTerms(t);
    const node =
        meanAscendingNodeLongitude(t) + earth.longitudeNutation(t) + sigma / Math.sin(MEAN_EQUATOR_INCLINATION);
    const inclination = MEAN_EQUATOR_INCLINATION + rho * DEG_TO_RAD;

    return axisAngle(node, inclination, earth.trueObliquity(t), apparentPosition(t), librations(t).latitude);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.), without the physical libration. */
export function positionAngleOfAxisApprox(t: JulianDay): number {
    const node = meanAscendingNodeLongitudeApprox(t) + earth.longitudeNutationApprox(t);
    const b = opticalLibrationsApprox(t).latitude;

    return axisAngle(node, MEAN_EQUATOR_INCLINATION, earth.trueObliquityApprox(t), apparentPositionApprox(t), b);
}

/** P from V (degrees), the inclination (radians), the obliquity (degrees), α and the libration in latitude b. */
function axisAngle(V: number, inclination: number, obliquity: number, pos: EquatorialCoords, b: number): number {
    const v = V * DEG_TO_RAD;
    const e = obliquity * DEG_TO_RAD;
    const X = Math.sin(inclination) * Math.sin(v);
    const Y = Math.sin(inclination) * Math.cos(v) * Math.cos(e) - Math.cos(inclination) * Math.sin(e);
    const w = Math.atan2(X, Y);

    return (
        Math.asin((Math.hypot(X, Y) * Math.cos(pos.rightAscension * DEG_TO_RAD - w)) / Math.cos(b * DEG_TO_RAD)) *
        RAD_TO_DEG
    );
}

/** Geocentric elongation of the Moon from the Sun (ψ), in degrees, per Meeus' "Astronomical Algorithms" (48.2). */
function elongation(moonPosition: EquatorialCoords, sunPosition: EquatorialCoords): number {
    const { rightAscension: a, declination: d } = moonPosition;

    return angularSeparation(sunPosition.rightAscension, sunPosition.declination, a, d);
}

/**
 * Phase angle (i), in degrees: the angle Sun-Moon-Earth, 0 at full moon and 180 at new moon, per Meeus'
 * "Astronomical Algorithms" (48.3). Drives how much of the disc is lit (`illuminatedFraction`) and, from the other
 * side, how much of the Earth the Moon sees lit (`earthshine`).
 */
export function phaseAngle(t: JulianDay): number {
    const psi = elongation(apparentPosition(t), sun.apparentPosition(t)) * DEG_TO_RAD;
    const R = sun.distance(t);

    return Math.atan2(R * Math.sin(psi), distance(t) - R * Math.cos(psi)) * RAD_TO_DEG;
}

/** Phase angle from the mean elements alone, per Meeus' "Astronomical Algorithms" (48.4); within ~0.2° of 48.3. */
export function phaseAngleApprox(t: JulianDay): number {
    const D = meanElongationApprox(t) * DEG_TO_RAD;
    const M = sun.meanAnomalyApprox(t) * DEG_TO_RAD;
    const Mm = meanAnomalyApprox(t) * DEG_TO_RAD;

    const i =
        180 -
        D * RAD_TO_DEG -
        6.289 * Math.sin(Mm) +
        2.1 * Math.sin(M) -
        1.274 * Math.sin(2 * D - Mm) -
        0.658 * Math.sin(2 * D) -
        0.214 * Math.sin(2 * Mm) -
        0.11 * Math.sin(D);

    return normalizeDegrees(i);
}

/** Illuminated fraction of the Moon's disc (k), 0 at new moon to 1 at full moon, per Meeus' (48.1). */
export function illuminatedFraction(t: JulianDay): number {
    return (1 + Math.cos(phaseAngle(t) * DEG_TO_RAD)) / 2;
}

export function illuminatedFractionApprox(t: JulianDay): number {
    return (1 + Math.cos(phaseAngleApprox(t) * DEG_TO_RAD)) / 2;
}

/**
 * Unit direction from the Moon's center towards the Sun, in the observer's local ENU frame (x east, y north, z up):
 * the light direction for shading the Moon's disc. Not quite the Sun's own direction as seen from Earth: the Moon
 * sits ~384,000 km off to the side, which turns the vector by up to ~0.15°.
 */
export function sunDirection(time: AstronomicalTime, latitude: number, longitude: number): Direction {
    const t = julianEphemerisDay(time);

    return between(
        horizontalToDirection(horizontalPosition(time, latitude, longitude)),
        distance(t),
        horizontalToDirection(sun.horizontalPosition(time, latitude, longitude)),
        sun.distance(t),
    );
}

export function sunDirectionApprox(time: AstronomicalTime, latitude: number, longitude: number): Direction {
    const t = julianEphemerisDay(time);

    return between(
        horizontalToDirection(horizontalPositionApprox(time, latitude, longitude)),
        distanceApprox(t),
        horizontalToDirection(sun.horizontalPositionApprox(time, latitude, longitude)),
        sun.distanceApprox(t),
    );
}

/** Unit vector from point `a` to point `b`, both given as a direction and a distance from the same origin. */
function between(a: Direction, aDistance: number, b: Direction, bDistance: number): Direction {
    const x = b[0] * bDistance - a[0] * aDistance;
    const y = b[1] * bDistance - a[1] * aDistance;
    const z = b[2] * bDistance - a[2] * aDistance;
    const length = Math.hypot(x, y, z);

    return [x / length, y / length, z / length];
}

/**
 * Earthshine on the Moon, relative to full sunlight on it: sunlight reflected by the Earth, which lights the Moon's
 * night side as a faint ashen glow. Peaks at ~0.095 around new moon, when the Moon sees a full Earth, and vanishes
 * at full moon. Per van de Hulst, "Multiple Light Scattering" (1980), with Jensen et al.'s Earth albedo of 0.19,
 * as used by osgHimmel.
 */
export function earthshine(t: JulianDay): number {
    // Half the elongation, clamped off both ends, where the formula is a 0 * infinity limit that tends to 0.
    const psi = elongation(apparentPosition(t), sun.apparentPosition(t)) * DEG_TO_RAD;
    const e = Math.min(Math.max(psi / 2, 1e-6), Math.PI / 2 - 1e-6);

    return 0.19 * 0.5 * (1 - Math.sin(e) * Math.tan(e) * Math.log(1 / Math.tan(e / 2)));
}

/** osgHimmel's polynomial fit of `earthshine`, within ~3% of it, with no logarithm or tangent to evaluate. */
export function earthshineApprox(t: JulianDay): number {
    const e = Math.PI - elongation(apparentPositionApprox(t), sun.apparentPositionApprox(t)) * DEG_TO_RAD;

    return Math.max(0, -0.0061 * e * e * e + 0.0289 * e * e - 0.0105 * Math.sin(e));
}

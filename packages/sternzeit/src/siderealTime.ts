// See ../GLOSSARY.md for sidereal time.
import { normalizeDegrees, RAD_TO_DEG } from "./math.js";
import {
    type AstronomicalTime,
    julianCenturiesSinceStandardEquinox,
    julianDaysSinceStandardEquinox,
    julianDayUT,
} from "./time.js";

/**
 * Mean sidereal time at Greenwich, in degrees, per Meeus' "Astronomical
 * Algorithms" (12.4).
 */
export function meanSiderealTime(time: AstronomicalTime): number {
    const jd = julianDayUT(time);
    const T = julianCenturiesSinceStandardEquinox(jd);

    const t =
        280.46061837 + 360.98564736629 * julianDaysSinceStandardEquinox(jd) + T * T * (0.000387933 - T / 38710000);

    return normalizeDegrees(t);
}

/**
 * Faster mean sidereal time approximation, in degrees, from Jensen et al.,
 * "A Physically-Based Night Sky Model" (2001).
 */
export function meanSiderealTimeApprox(time: AstronomicalTime): number {
    const jd = julianDayUT(time);
    const T = julianCenturiesSinceStandardEquinox(jd);
    const t = 4.894961 + 230121.675315 * T;

    return normalizeDegrees(t * RAD_TO_DEG);
}

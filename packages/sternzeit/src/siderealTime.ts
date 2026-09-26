// Terms used here are explained in the himmelszelt site's glossary (site/src/data/glossary.json).
import * as earth from "./earth.js";
import { DEG_TO_RAD, normalizeDegrees, RAD_TO_DEG } from "./math.js";
import {
    type AstronomicalTime,
    julianCenturiesSinceStandardEquinox,
    julianDaysSinceStandardEquinox,
    julianDayUT,
    julianEphemerisDay,
} from "./time.js";

/** Mean sidereal time at Greenwich, in degrees, per Meeus 12.4. */
export function meanSiderealTime(time: AstronomicalTime): number {
    const jd = julianDayUT(time);
    const T = julianCenturiesSinceStandardEquinox(jd);

    const t =
        280.46061837 + 360.98564736629 * julianDaysSinceStandardEquinox(jd) + T * T * (0.000387933 - T / 38710000);

    return normalizeDegrees(t);
}

/** Mean sidereal time at Greenwich, in degrees: approximation per Jensen et al. 2001. */
export function meanSiderealTimeApprox(time: AstronomicalTime): number {
    const jd = julianDayUT(time);
    const T = julianCenturiesSinceStandardEquinox(jd);
    const t = 4.894961 + 230121.675315 * T;

    return normalizeDegrees(t * RAD_TO_DEG);
}

/**
 * Apparent sidereal time at Greenwich, in degrees: the mean one plus the equation of the equinoxes (Δψ cos ε), per
 * Meeus ch. 12. It is measured from the true equinox, so it is the one an apparent right
 * ascension needs for its hour angle. The two differ by at most about a second of time.
 */
export function apparentSiderealTime(time: AstronomicalTime): number {
    const t = julianEphemerisDay(time);
    return normalizeDegrees(
        meanSiderealTime(time) + earth.longitudeNutation(t) * Math.cos(earth.trueObliquity(t) * DEG_TO_RAD),
    );
}

/** {@link apparentSiderealTime} with the approximate nutation and obliquity. */
export function apparentSiderealTimeApprox(time: AstronomicalTime): number {
    const t = julianEphemerisDay(time);
    return normalizeDegrees(
        meanSiderealTimeApprox(time) +
            earth.longitudeNutationApprox(t) * Math.cos(earth.trueObliquityApprox(t) * DEG_TO_RAD),
    );
}

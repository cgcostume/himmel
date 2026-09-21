// See ../GLOSSARY.md for Julian Day, Julian century, standard equinox, and epoch.
import { dayFraction, frac, toInt } from "./math.js";

/** A calendar date/time used for astronomical calculations. */
export interface AstronomicalTime {
    year: number;
    /** 1-12 */
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    /** Offset from UTC, in seconds. */
    utcOffsetSeconds: number;
}

export type JulianDay = number;
/** Julian centuries since a reference epoch (commonly `T`). Not a {@link JulianDay}; see {@link julianCenturiesSinceStandardEquinox}. */
export type JulianCenturies = number;

/** 2000 January 1, 12:00 TT, the J2000.0 epoch. */
export const J2000: JulianDay = 2451545.0;
/** 2050 January 1, 12:00 TT. */
export const J2050: JulianDay = 2469807.5;
/** 1900 January 0.8135 TT. */
export const B1900: JulianDay = 2415020.3135;
/** 1950 January 0.9235 TT. */
export const B1950: JulianDay = 2433282.4235;

export const STANDARD_EQUINOX: JulianDay = J2000;

/**
 * Julian Day for a given calendar date/time, per Meeus' "Astronomical
 * Algorithms" (ch. 7). Only valid for dates on/after the Gregorian
 * calendar reform (1582-10-15); returns 0 for the few days it skipped.
 */
export function julianDay(time: AstronomicalTime): JulianDay {
    let { year, month } = time;
    const { day, hour, minute, second } = time;

    if (month < 3) {
        // January/February are treated as month 13/14 of the preceding year.
        year -= 1;
        month += 12;
    }

    const h = dayFraction(hour, minute, second);

    let b = 0;
    const cutover = year * 10000 + month * 100 + day;
    if (cutover >= 15821015) {
        const a = toInt(year * 0.01);
        b = 2 - a + toInt(a * 0.25);
    } else if (cutover > 15821004) {
        return 0;
    }

    return toInt(365.25 * (year + 4716)) + toInt(30.600001 * (month + 1)) + day + h + b - 1524.5;
}

/** Julian Day of `time` converted to UT first. */
export function julianDayUT(time: AstronomicalTime): JulianDay {
    return julianDay(time.utcOffsetSeconds === 0 ? time : toUT(time));
}

/** Julian Day at 0h UT of the same calendar date as `time`. */
export function julianDay0UT(time: AstronomicalTime): JulianDay {
    return julianDayUT({ ...time, hour: 0, minute: 0, second: 0 });
}

/** Modified Julian Day (JD - 2400000.5). */
export function modifiedJulianDay(time: AstronomicalTime): JulianDay {
    return julianDay(time) - 2400000.5;
}

/** Inverse of {@link julianDay}. */
export function fromJulianDay(jd: JulianDay, utcOffsetSeconds = 0): AstronomicalTime {
    const shifted = jd + 0.5;
    const z = toInt(shifted);
    const f = frac(shifted);

    let a = z;
    if (z >= 2299161) {
        // Gregorian calendar.
        const g = toInt((z - 1867216.25) / 36524.25);
        a = z + 1 + g - toInt(g / 4);
    }

    const b = toInt(a + 1524);
    const c = toInt((b - 122.1) / 365.25);
    const d = toInt(365.25 * c);
    const e = toInt((b - d) / 30.600001);

    const day = b - d - toInt(30.600001 * e);
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;

    const h = f * 24;
    const m = frac(h) * 60;
    const s = frac(m) * 60.0001;

    return { year, month, day, hour: toInt(h), minute: toInt(m), second: toInt(s), utcOffsetSeconds };
}

/** `time` converted to UT (utcOffsetSeconds = 0). */
export function toUT(time: AstronomicalTime): AstronomicalTime {
    if (time.utcOffsetSeconds === 0) return time;
    return fromJulianDay(julianDay(time) - time.utcOffsetSeconds / 3600 / 24, 0);
}

export function julianDaysSinceStandardEquinox(jd: JulianDay): number {
    return jd - STANDARD_EQUINOX;
}

/** Julian centuries since the standard equinox (J2000.0). Commonly denoted `T`. */
export function julianCenturiesSinceStandardEquinox(jd: JulianDay): JulianCenturies {
    return julianDaysSinceStandardEquinox(jd) / 36525;
}

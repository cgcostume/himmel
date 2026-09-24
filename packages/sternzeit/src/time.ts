// Terms used here are explained in the himmelszelt site's glossary (site/src/data/glossary.json).
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

/**
 * ΔT = TT - UT, in seconds, at a given Julian Day (UT): how far Earth's slowing, uneven rotation has fallen behind the
 * uniform time the ephemerides run on. About a minute today, hours in antiquity, and unpredictable in detail for the
 * future. Per Espenak & Meeus, "Polynomial Expressions for Delta T", from the Five Millennium Canon of Solar Eclipses
 * (NASA TP-2006-214141), fitted to Morrison & Stephenson (2004). https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html
 */
export function deltaT(jd: JulianDay): number {
    const y = 2000 + (jd - J2000) / 365.25;
    const long = (u: number) => -20 + 32 * u * u;
    const poly = (t: number, ...c: number[]) => c.reduceRight((sum, k) => sum * t + k, 0);

    if (y < -500) return long((y - 1820) / 100);
    if (y < 500) {
        return poly(y / 100, 10583.6, -1014.41, 33.78311, -5.952053, -0.1798452, 0.022174192, 0.0090316521);
    }
    if (y < 1600) {
        const u = (y - 1000) / 100;
        return poly(u, 1574.2, -556.01, 71.23472, 0.319781, -0.8503463, -0.005050998, 0.0083572073);
    }
    if (y < 1700) return poly(y - 1600, 120, -0.9808, -0.01532, 1 / 7129);
    if (y < 1800) return poly(y - 1700, 8.83, 0.1603, -0.0059285, 0.00013336, -1 / 1174000);
    if (y < 1860) {
        const t = y - 1800;
        return poly(
            t,
            13.72,
            -0.332447,
            0.0068612,
            0.0041116,
            -0.00037436,
            0.0000121272,
            -0.0000001699,
            0.000000000875,
        );
    }
    if (y < 1900) return poly(y - 1860, 7.62, 0.5737, -0.251754, 0.01680668, -0.0004473624, 1 / 233174);
    if (y < 1920) return poly(y - 1900, -2.79, 1.494119, -0.0598939, 0.0061966, -0.000197);
    if (y < 1941) return poly(y - 1920, 21.2, 0.84493, -0.0761, 0.0020936);
    if (y < 1961) return poly(y - 1950, 29.07, 0.407, -1 / 233, 1 / 2547);
    if (y < 1986) return poly(y - 1975, 45.45, 1.067, -1 / 260, -1 / 718);
    if (y < 2005) return poly(y - 2000, 63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599);
    if (y < 2050) return poly(y - 2000, 62.92, 0.32217, 0.005589);
    if (y < 2150) return long((y - 1820) / 100) - 0.5628 * (2150 - y);
    return long((y - 1820) / 100);
}

/** Julian Ephemeris Day (JDE) of `time`: its Julian Day in UT moved on by {@link deltaT}, the uniform time the orbits
 *  are computed in. Sidereal time keeps to UT, since it follows Earth's actual rotation. */
export function julianEphemerisDay(time: AstronomicalTime): JulianDay {
    const jd = julianDayUT(time);
    return jd + deltaT(jd) / 86400;
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

/** A JavaScript `Date` as an AstronomicalTime in the runtime's local time zone, offset included, milliseconds as fractional seconds. */
export function fromDate(date: Date): AstronomicalTime {
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds() + date.getMilliseconds() / 1000,
        utcOffsetSeconds: -date.getTimezoneOffset() * 60,
    };
}

/** Inverse of {@link fromDate}: the same instant as a JavaScript `Date`. */
export function toDate(time: AstronomicalTime): Date {
    const date = new Date(0);
    // setUTCFullYear, unlike Date.UTC, doesn't map the years 0-99 to 1900-1999.
    date.setUTCFullYear(time.year, time.month - 1, time.day);
    date.setUTCHours(time.hour, time.minute, 0, 0);
    return new Date(date.getTime() + (time.second - time.utcOffsetSeconds) * 1000);
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

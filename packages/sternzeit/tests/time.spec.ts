import { expect, test } from "@playwright/test";
import { meanSiderealTime } from "../src/siderealTime.js";
import {
    type AstronomicalTime,
    deltaT,
    fromDate,
    fromJulianDay,
    J2000,
    julianDay,
    julianDayUT,
    julianEphemerisDay,
    toDate,
} from "../src/time.js";

function utc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): AstronomicalTime {
    return { year, month, day, hour, minute, second, utcOffsetSeconds: 0 };
}

test("julianDay matches the J2000.0 epoch", () => {
    expect(julianDay(utc(2000, 1, 1, 12))).toBeCloseTo(J2000, 6);
});

test("julianDay matches a known reference date (1999-01-01 0h UT)", () => {
    expect(julianDay(utc(1999, 1, 1))).toBeCloseTo(2451179.5, 6);
});

test("julianDay matches Meeus' worked example (1957-10-04.81)", () => {
    // Meeus, "Astronomical Algorithms", example 7.a (Sputnik 1 launch).
    expect(julianDay(utc(1957, 10, 4, 19, 26, 24))).toBeCloseTo(2436116.31, 2);
});

test("fromJulianDay is the inverse of julianDay", () => {
    const time = utc(2000, 1, 1, 12);
    expect(fromJulianDay(julianDay(time))).toEqual(time);
});

test("fromDate keeps the instant, whatever the runtime's time zone", () => {
    const date = new Date("2026-09-21T20:00:00+02:00");
    expect(julianDayUT(fromDate(date))).toBeCloseTo(2461305.25, 8);
    expect(toDate(fromDate(date)).getTime()).toBe(date.getTime());
});

test("meanSiderealTime matches Meeus' worked examples (12.a/12.b)", () => {
    expect(meanSiderealTime(utc(1987, 4, 10))).toBeCloseTo(197.693195, 2);
    expect(meanSiderealTime(utc(1987, 4, 10, 19, 21, 0))).toBeCloseTo(128.7378734, 2);
});

// Espenak & Meeus, "Polynomial Expressions for Delta T": the observed value in 2000 and the fit's own at -500.
test("deltaT follows the NASA polynomials", () => {
    expect(deltaT(J2000)).toBeCloseTo(63.86, 1);
    expect(deltaT(J2000 - 2500 * 365.25)).toBeCloseTo(17203.7, -1);
});

test("julianEphemerisDay runs ahead of UT by deltaT", () => {
    const time = { year: 2026, month: 8, day: 12, hour: 18, minute: 0, second: 0, utcOffsetSeconds: 0 };
    const seconds = (julianEphemerisDay(time) - julianDayUT(time)) * 86400;
    expect(seconds).toBeCloseTo(deltaT(julianDayUT(time)), 3);
});

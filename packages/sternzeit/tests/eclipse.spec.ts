import { expect, test } from "@playwright/test";
import * as approx from "../src/approx.js";
import * as precise from "../src/index.js";

function time(year: number, month: number, day: number, hour: number, minute: number, second: number) {
    return { year, month, day, hour, minute, second, utcOffsetSeconds: 0 };
}

// Greatest eclipse of the 2024-04-08 total solar eclipse, near Nazas, Durango, Mexico: 18:18:29 UTC,
// 25.3N 104.1W. observersLongitude is positive east (see coords.ts), so 104.1W is -104.1.
const SOLAR_ECLIPSE_TIME = time(2024, 4, 8, 18, 18, 29);
const SOLAR_ECLIPSE_LATITUDE = 25.3;
const SOLAR_ECLIPSE_LONGITUDE = -104.1;

// The Moon's apparent radius exceeds the Sun's by only ~0.01 deg at this eclipse, so totality spans phase 0 to 0.5
// over a separation of just ~36". At the greatest-eclipse point the Moon sits close to the Sun's center.
test("solarEclipseState is total at the real 2024-04-08 eclipse's greatest-eclipse point", () => {
    const state = precise.eclipse.solar(SOLAR_ECLIPSE_TIME, SOLAR_ECLIPSE_LATITUDE, SOLAR_ECLIPSE_LONGITUDE);

    expect(state.separation).toBeLessThan(0.01);
    expect(state.phase).toBeLessThan(0.5);
});

test("approx.eclipse.solar roughly agrees with the precise result", () => {
    const state = approx.eclipse.solar(SOLAR_ECLIPSE_TIME, SOLAR_ECLIPSE_LATITUDE, SOLAR_ECLIPSE_LONGITUDE);

    expect(state.separation).toBeLessThan(0.03);
    expect(state.phase).toBeLessThan(1);
});

// Totality in Zaragoza, Spain, during the 2026-08-12 total solar eclipse: max eclipse 20:29:45 CEST
// (18:29:45 UTC), 41.65N 0.89W (-0.89, positive east).
const SOLAR_ECLIPSE_2026_TIME = time(2026, 8, 12, 18, 29, 45);
const SOLAR_ECLIPSE_2026_LATITUDE = 41.65;
const SOLAR_ECLIPSE_2026_LONGITUDE = -0.89;

test("solarEclipseState is total in Zaragoza during the real 2026-08-12 eclipse", () => {
    const state = precise.eclipse.solar(
        SOLAR_ECLIPSE_2026_TIME,
        SOLAR_ECLIPSE_2026_LATITUDE,
        SOLAR_ECLIPSE_2026_LONGITUDE,
    );

    expect(state.separation).toBeLessThan(0.01);
    expect(state.phase).toBeLessThan(0.5);
});

test("solarEclipseState phase is above 1 (no eclipse) for an ordinary date/place", () => {
    const state = precise.eclipse.solar(time(2024, 1, 1, 12, 0, 0), 52.5, 13.4);

    expect(state.phase).toBeGreaterThan(1);
});

// Greatest eclipse of the 2022-11-08 total lunar eclipse: 10:59:11 UTC (geocentric, no observer location).
const LUNAR_ECLIPSE_JD = precise.julianDayUT(time(2022, 11, 8, 10, 59, 11));

test("lunarEclipseState phase is near 0 (deep umbra) at the real 2022-11-08 eclipse's greatest-eclipse instant", () => {
    const state = precise.eclipse.lunar(LUNAR_ECLIPSE_JD);

    expect(state.phase).toBeLessThan(0.3);
});

test("lunarEclipseState shadow radii at the Moon's distance match the similar-triangle geometry", () => {
    const state = precise.eclipse.lunar(LUNAR_ECLIPSE_JD);

    expect(state.umbraRadiusKm).toBeGreaterThan(4300);
    expect(state.umbraRadiusKm).toBeLessThan(4900);
    expect(state.penumbraRadiusKm).toBeGreaterThan(7900);
    expect(state.penumbraRadiusKm).toBeLessThan(8500);
});

test("lunarEclipseState phase is above 1 (no eclipse) for an ordinary date", () => {
    const state = precise.eclipse.lunar(precise.julianDayUT(time(2024, 1, 1, 12, 0, 0)));

    expect(state.phase).toBeGreaterThan(1);
});

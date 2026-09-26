import { expect, test } from "@playwright/test";
import * as approx from "../src/approx.js";
import * as precise from "../src/index.js";

function time(year: number, month: number, day: number, hour: number, minute: number, second: number) {
    return { year, month, day, hour, minute, second, utcOffsetSeconds: 0 };
}

// Greatest eclipse of the 2024-04-08 total solar eclipse, near Nazas, Durango, Mexico: 18:18:29 UTC,
// 25.3N 104.1W. Longitudes are positive east, so 104.1W is -104.1.
const SOLAR_ECLIPSE_TIME = time(2024, 4, 8, 18, 18, 29);
const SOLAR_ECLIPSE_PLACE = { latitude: 25.3, longitude: -104.1 };

// The Moon's apparent radius exceeds the Sun's by only ~0.01 deg at this eclipse, so totality spans phase 0 to 0.5
// over a separation of just ~36". At the greatest-eclipse point the Moon sits close to the Sun's center.
test("solarEclipseState is total at the real 2024-04-08 eclipse's greatest-eclipse point", () => {
    const state = precise.eclipse.solar(SOLAR_ECLIPSE_TIME, SOLAR_ECLIPSE_PLACE);

    expect(state.separation).toBeLessThan(0.01);
    expect(state.phase).toBeLessThan(0.5);
});

// The approximate Moon is off by a few hundredths of a degree here, most of the Sun's radius.
test("approx.eclipse.solar roughly agrees with the precise result", () => {
    const state = approx.eclipse.solar(SOLAR_ECLIPSE_TIME, SOLAR_ECLIPSE_PLACE);

    expect(state.separation).toBeLessThan(0.05);
    expect(state.phase).toBeLessThan(1);
});

// Totality in Zaragoza, Spain, during the 2026-08-12 total solar eclipse: max eclipse 20:29:45 CEST
// (18:29:45 UTC), 41.65N 0.89W (-0.89, positive east).
const SOLAR_ECLIPSE_2026_TIME = time(2026, 8, 12, 18, 29, 45);
const SOLAR_ECLIPSE_2026_PLACE = { latitude: 41.65, longitude: -0.89 };

test("solarEclipseState is total in Zaragoza during the real 2026-08-12 eclipse", () => {
    const state = precise.eclipse.solar(SOLAR_ECLIPSE_2026_TIME, SOLAR_ECLIPSE_2026_PLACE);

    expect(state.separation).toBeLessThan(0.01);
    expect(state.phase).toBeLessThan(0.5);
});

test("solarEclipseState phase is above 1 (no eclipse) for an ordinary date/place", () => {
    const state = precise.eclipse.solar(time(2024, 1, 1, 12, 0, 0), { latitude: 52.5, longitude: 13.4 });

    expect(state.phase).toBeGreaterThan(1);
});

// Greatest eclipse of the 2022-11-08 total lunar eclipse: 10:59:11 UTC (geocentric, no observer location).
const LUNAR_ECLIPSE_JD = precise.julianEphemerisDay(time(2022, 11, 8, 10, 59, 11));

test("lunarEclipseState phase is near 0 (deep umbra) at the real 2022-11-08 eclipse's greatest-eclipse instant", () => {
    const state = precise.eclipse.lunar(LUNAR_ECLIPSE_JD);

    expect(state.phase).toBeLessThan(0.3);
});

// The shadow axis needs the Sun's equation of the center, about -1.6° on this date; without it the Moon misses.
test("approx.eclipse.lunar finds the same eclipse", () => {
    expect(approx.eclipse.lunar(LUNAR_ECLIPSE_JD).phase).toBeLessThan(0.3);
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

// NASA's Five Millennium Canon gives the ratio of the Moon's apparent diameter to the Sun's at greatest eclipse:
// 1.0566 for 2024-04-08 (18:17:20 UT, 25.29N 104.13W) and 0.9520 for the annular 2023-10-14 (17:59:39 UT, 11.4N 83.1W).
test("moon.topocentricAngularDiameter matches the canon's diameter ratios of central eclipses", () => {
    for (const [at, place, k] of [
        [time(2024, 4, 8, 18, 17, 20), { latitude: 25.29, longitude: -104.13 }, 1.0566],
        [time(2023, 10, 14, 17, 59, 39), { latitude: 11.4, longitude: -83.1 }, 0.952],
    ] as const) {
        const ratio =
            precise.moon.topocentricAngularDiameter(at, place) /
            precise.sun.apparentAngularDiameter(precise.julianEphemerisDay(at));
        expect(ratio).toBeCloseTo(k, 3);
    }
});

test("eclipse.solar magnitude is 1 or more in totality, below (1 + k) / 2", () => {
    const state = precise.eclipse.solar(SOLAR_ECLIPSE_TIME, SOLAR_ECLIPSE_PLACE);
    expect(state.magnitude).toBeGreaterThan(1);
    expect(state.magnitude).toBeLessThan((1 + 1.0566) / 2);
    expect(
        precise.eclipse.solar(time(2024, 1, 1, 12, 0, 0), { latitude: 52.5, longitude: 13.4 }).magnitude,
    ).toBeLessThan(0);
});

// NASA gives an umbral magnitude of 1.359 for 2022-11-08; the geometric shadow here is the enlarged one's 1-2% smaller.
test("eclipse.lunar umbral magnitude is a little below the canon's", () => {
    const state = precise.eclipse.lunar(LUNAR_ECLIPSE_JD);
    expect(state.umbralMagnitude).toBeGreaterThan(1.31);
    expect(state.umbralMagnitude).toBeLessThan(1.359);
    expect(state.penumbralMagnitude).toBeGreaterThan(state.umbralMagnitude + 1);
});

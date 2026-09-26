// Cross-check of sternzeit (S) against astronomia (A, https://github.com/commenthol/astronomia), an independent
// JavaScript implementation of Meeus. Compared at about 750 moments from 1900 to 2100, 97.3 days apart: a step that
// no lunar month or year divides, so the moments fall on every phase and season. Each tolerance names what, besides
// rounding, still differs.
import { expect, test } from "@playwright/test";
import * as A from "astronomia";
import vsop87Bearth from "astronomia/data/vsop87Bearth";
import { observerGeocentric } from "../src/coords.js";
import * as S from "../src/index.js";

const R = 180 / Math.PI;
const D = Math.PI / 180;
const ARCSEC = 1 / 3600;
const AU_KM = 149597870;

/** Signed difference of two angles in degrees, wrapped into [-180, 180). */
const angle = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

const samples: number[] = [];
for (let jd = 2415020.5; jd < 2488069.5; jd += 97.3) samples.push(jd);

test("nutation and obliquity agree (table 22.A, 22.3)", () => {
    for (const jd of samples) {
        const [dpsi, deps] = A.nutation.nutation(jd);
        expect(Math.abs(S.earth.longitudeNutation(jd) - dpsi * R)).toBeLessThan(1e-6 * ARCSEC);
        expect(Math.abs(S.earth.obliquityNutation(jd) - deps * R)).toBeLessThan(1e-6 * ARCSEC);
        expect(Math.abs(S.earth.meanObliquity(jd) - A.nutation.meanObliquityLaskar(jd) * R)).toBeLessThan(1e-9);
    }
});

test("mean and apparent sidereal time agree (12.4, 12.2)", () => {
    for (const jd of samples) {
        const time = S.fromJulianDay(jd);
        // 12.4 in degrees here, 12.2 in seconds of time there: the same expression, rounded differently.
        expect(Math.abs(angle(S.siderealTime(time), A.sidereal.mean(jd) / 240))).toBeLessThan(0.01 * ARCSEC);
        expect(Math.abs(angle(S.apparentSiderealTime(time), A.sidereal.apparent(jd) / 240))).toBeLessThan(
            0.01 * ARCSEC,
        );
    }
});

test("the Sun agrees (chapter 25)", () => {
    for (const jd of samples) {
        const T = (jd - S.J2000) / 36525;
        // The mean anomaly comes from 47.3 here and from 25.3 there.
        expect(Math.abs(angle(S.sun.trueLongitude(jd), A.solar.trueLongitude(T).lon * R))).toBeLessThan(0.001 * ARCSEC);
        expect(Math.abs(S.sun.distance(jd) / S.ASTRONOMICAL_UNIT_KM - A.solar.radius(T))).toBeLessThan(1e-7);
        // astronomia takes 25.8's shortcut, the nutation from its largest term only; the full series moves it by 2".
        const ours = S.sun.apparentPosition(jd);
        const theirs = A.solar.apparentEquatorial(jd);
        expect(Math.abs(angle(ours.rightAscension, theirs.ra * R))).toBeLessThan(3 * ARCSEC);
        expect(Math.abs(ours.declination - theirs.dec * R)).toBeLessThan(1 * ARCSEC);
    }
});

test("the Moon agrees (chapter 47)", () => {
    for (const jd of samples) {
        const theirs = A.moonposition.position(jd);
        const ours = S.moon.position(jd);
        // position adds the nutation in longitude, astronomia's stays on the mean equinox.
        const longitude = ours.longitude - S.earth.longitudeNutation(jd);
        expect(Math.abs(angle(longitude, theirs.lon * R))).toBeLessThan(0.0001 * ARCSEC);
        expect(Math.abs(ours.latitude - theirs.lat * R)).toBeLessThan(0.0001 * ARCSEC);
        expect(Math.abs(S.moon.distance(jd) - theirs.range)).toBeLessThan(0.001);
        // Earth's equatorial radius is 6378.14 km here and 6378.137 km there.
        const parallax = A.moonposition.parallax(theirs.range) * R;
        expect(Math.abs(S.moon.equatorialHorizontalParallax(jd) - parallax)).toBeLessThan(0.01 * ARCSEC);
    }
});

test("the observer's place and the topocentric Moon agree (chapter 11, 40.2, 40.3)", () => {
    const [latitude, longitude, height] = [52.5, 13.4, 1500];
    const [rhoSinPhi, rhoCosPhi] = A.globe.Earth76.parallaxConstants(latitude * D, height);
    const ours = observerGeocentric(latitude, height);
    // Meeus prints b/a rounded to 0.99664719, astronomia derives it from the flattening: 2 cm apart.
    expect(Math.abs(ours.rhoSinPhi - rhoSinPhi)).toBeLessThan(1e-8);
    expect(Math.abs(ours.rhoCosPhi - rhoCosPhi)).toBeLessThan(1e-8);

    for (const jd of samples) {
        const time = S.fromJulianDay(jd);
        const jde = S.julianEphemerisDay(time);
        const geocentric = S.moon.apparentPosition(jde);
        const c = new A.base.Coord(
            geocentric.rightAscension * D,
            geocentric.declination * D,
            S.moon.distance(jde) / AU_KM,
        );
        // Meeus counts longitudes positive west. The parallax comes from 8.794" at 1 AU there, the radius here.
        const theirs = A.parallax.topocentric(c, rhoSinPhi, rhoCosPhi, -longitude * D, jd);
        const topocentric = S.moon.topocentricPosition(time, latitude, longitude, height);
        expect(Math.abs(angle(topocentric.rightAscension, theirs.ra * R))).toBeLessThan(0.1 * ARCSEC);
        expect(Math.abs(topocentric.declination - theirs.dec * R)).toBeLessThan(0.1 * ARCSEC);
    }
});

test("the Moon's phase angle and parallactic angle agree (48.2, 48.3, 14.1)", () => {
    const [latitude, longitude] = [52.5, 13.4];
    for (const jd of samples) {
        const moon = S.moon.apparentPosition(jd);
        const sun = S.sun.apparentPosition(jd);
        const cMoon = new A.base.Coord(moon.rightAscension * D, moon.declination * D, S.moon.distance(jd));
        const cSun = new A.base.Coord(sun.rightAscension * D, sun.declination * D, S.sun.distance(jd));
        expect(Math.abs(S.moon.phaseAngle(jd) - A.moonillum.phaseAngleEquatorial(cMoon, cSun) * R)).toBeLessThan(1e-9);

        const time = S.fromJulianDay(jd);
        const at = S.moon.apparentPosition(S.julianEphemerisDay(time));
        const hourAngle = (S.apparentSiderealTime(time) + longitude - at.rightAscension) * D;
        const theirs = A.parallactic.parallacticAngle(latitude * D, at.declination * D, hourAngle) * R;
        expect(Math.abs(angle(S.moon.parallacticAngle(time, latitude, longitude), theirs))).toBeLessThan(1e-9);
    }
});

test("the Moon's librations and axis agree (chapter 53)", () => {
    const earth = new A.planetposition.Planet(vsop87Bearth);
    for (const jd of samples.filter((_, i) => i % 5 === 0)) {
        const [selenographic, P] = A.moon.physical(jd, earth);
        const ours = S.moon.librations(jd);
        expect(Math.abs(angle(ours.longitude, selenographic.lon * R))).toBeLessThan(0.0001);
        expect(Math.abs(ours.latitude - selenographic.lat * R)).toBeLessThan(0.0001);
        expect(Math.abs(angle(S.moon.positionAngleOfAxis(jd), P * R))).toBeLessThan(0.0001);
    }
});

test("refraction agrees, but for the constants that zero it at the zenith (16.3, 16.4)", () => {
    for (const altitude of [0, 1, 5, 15, 45, 89]) {
        const bennett = A.refraction.bennett(altitude * D) * R;
        const saemundsson = A.refraction.saemundsson(altitude * D) * R;
        expect(Math.abs(S.earth.atmosphericRefractionFromApparent(altitude) - bennett)).toBeLessThan(0.1 * ARCSEC);
        expect(Math.abs(S.earth.atmosphericRefraction(altitude) - saemundsson)).toBeLessThan(0.12 * ARCSEC);
    }
});

test("Julian Days agree in both calendars (chapter 7)", () => {
    const dates = [
        [2026, 9, 21.5],
        [1957, 10, 4.81],
        [1582, 10, 15],
        [1582, 10, 4],
        [333, 1, 27.5],
        [-1000, 7, 12.5],
    ] as const;
    for (const [year, month, d] of dates) {
        const julian = year < 1582 || (year === 1582 && d < 15);
        const theirs = julian
            ? A.julian.CalendarJulianToJD(year, month, d)
            : A.julian.CalendarGregorianToJD(year, month, d);
        const time = { year, month, day: Math.floor(d), hour: (d % 1) * 24, minute: 0, second: 0, utcOffsetSeconds: 0 };
        expect(S.julianDay(time)).toBeCloseTo(theirs, 6);
    }
});

// From 1600 on astronomia interpolates observed values and IERS predictions; both use the NASA polynomials outside.
test("deltaT agrees where both use the NASA polynomials", () => {
    for (const year of [-1000, -500, 0, 500, 1000, 1500, 2200, 2500]) {
        expect(S.deltaT(S.J2000 + (year - 2000) * 365.25)).toBeCloseTo(A.deltat.deltaT(year), 6);
    }
});

// astronomia interpolates the monthly USNO series: it matches the yearly IERS values here to a few hundredths.
test("deltaT agrees with observed values", () => {
    for (let year = 1974; year <= 2023; year++) {
        expect(Math.abs(S.deltaT(S.J2000 + (year - 2000) * 365.25) - A.deltat.deltaT(year))).toBeLessThan(0.1);
    }
});

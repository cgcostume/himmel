import { expect, test } from "@playwright/test";
import * as approx from "../src/approx.js";
import * as precise from "../src/index.js";

// Meeus, "Astronomical Algorithms", example 25.a (1992-10-13.0 TD, JDE 2448908.5).
const JDE = 2448908.5;

test("sun.meanAnomaly matches Meeus' worked example 25.a", () => {
    expect(precise.sun.meanAnomaly(JDE)).toBeCloseTo(278.99397, 3);
});

test("sun.meanLongitude matches Meeus' worked example 25.a", () => {
    expect(precise.sun.meanLongitude(JDE)).toBeCloseTo(201.8072, 3);
});

test("sun.trueLongitude matches Meeus' worked example 25.a", () => {
    expect(precise.sun.trueLongitude(JDE)).toBeCloseTo(199.90987, 3);
});

test("sun.trueAnomaly matches Meeus' worked example 25.a", () => {
    expect(precise.sun.trueAnomaly(JDE)).toBeCloseTo(277.09664, 3);
});

test("earth.orbitEccentricity matches Meeus' worked example 25.a", () => {
    expect(precise.earth.orbitEccentricity(JDE)).toBeCloseTo(0.01671167, 6);
});

test("sun.distance matches Meeus' worked example 25.a", () => {
    expect(precise.sun.distance(JDE)).toBeCloseTo(149248233, -2);
});

test("sun.apparentPosition matches Meeus' worked example 25.a", () => {
    const equ = precise.sun.apparentPosition(JDE);
    expect(equ.rightAscension).toBeCloseTo(198.38083, 3);
    expect(equ.declination).toBeCloseTo(-7.78507, 3);
});

test("approx.sun.apparentPosition roughly agrees with the precise result", () => {
    const preciseEqu = precise.sun.apparentPosition(JDE);
    const approxEqu = approx.sun.apparentPosition(JDE);

    expect(approxEqu.rightAscension).toBeCloseTo(preciseEqu.rightAscension, 0);
    expect(approxEqu.declination).toBeCloseTo(preciseEqu.declination, 0);
});

test("sun.equatorialHorizontalParallax is on the order of the Sun's real ~8.8 arcsecond parallax", () => {
    expect(precise.sun.equatorialHorizontalParallax(JDE)).toBeCloseTo(8.8 / 3600, 3);
});

test("sun.topocentricPosition nudges apparentPosition by no more than the Sun's parallax", () => {
    const time = precise.fromJulianDay(JDE);
    const apparent = precise.sun.apparentPosition(JDE);
    const topocentric = precise.sun.topocentricPosition(time, 52.39, 13.09);

    expect(Math.abs(topocentric.rightAscension - apparent.rightAscension)).toBeLessThan(8.8 / 3600);
    expect(Math.abs(topocentric.declination - apparent.declination)).toBeLessThan(8.8 / 3600);
});

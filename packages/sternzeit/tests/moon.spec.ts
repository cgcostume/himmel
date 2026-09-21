import { expect, test } from "@playwright/test";
import * as approx from "../src/approx.js";
import * as precise from "../src/index.js";

// Meeus, "Astronomical Algorithms", example 47.a (1992-04-12.0 TD, JDE 2448724.5).
const JDE = 2448724.5;

test("moon.meanLongitude matches Meeus' worked example 47.a", () => {
    expect(precise.moon.meanLongitude(JDE)).toBeCloseTo(134.290182, 3);
});

test("moon.meanElongation matches Meeus' worked example 47.a", () => {
    expect(precise.moon.meanElongation(JDE)).toBeCloseTo(113.842304, 3);
});

test("moon.meanAnomaly matches Meeus' worked example 47.a", () => {
    expect(precise.moon.meanAnomaly(JDE)).toBeCloseTo(5.150833, 3);
});

test("moon.meanArgumentOfLatitude matches Meeus' worked example 47.a", () => {
    expect(precise.moon.meanArgumentOfLatitude(JDE)).toBeCloseTo(219.889721, 3);
});

test("moon.position matches Meeus' worked example 47.a", () => {
    const ecl = precise.moon.position(JDE);
    expect(ecl.longitude).toBeCloseTo(133.16265, 2);
    expect(ecl.latitude).toBeCloseTo(-3.22913, 2);
});

test("moon.distance matches Meeus' worked example 47.a", () => {
    expect(precise.moon.distance(JDE)).toBeCloseTo(368409.7, 0);
});

test("approx.moon.position roughly agrees with the precise result", () => {
    const preciseEcl = precise.moon.position(JDE);
    const approxEcl = approx.moon.position(JDE);

    expect(approxEcl.longitude).toBeCloseTo(preciseEcl.longitude, 0);
    expect(approxEcl.latitude).toBeCloseTo(preciseEcl.latitude, 0);
});

test("approx.moon.distance roughly agrees with the precise result", () => {
    const preciseDistance = precise.moon.distance(JDE);
    const approxDistance = approx.moon.distance(JDE);

    expect(Math.abs(approxDistance - preciseDistance)).toBeLessThan(2000);
});

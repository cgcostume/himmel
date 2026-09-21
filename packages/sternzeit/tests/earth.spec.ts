import { expect, test } from "@playwright/test";
import * as approx from "../src/approx.js";
import * as precise from "../src/index.js";

test("earth.meanObliquity matches the standard J2000.0 value (23°26'21.448\")", () => {
    expect(precise.earth.meanObliquity(precise.J2000)).toBeCloseTo(23 + 26 / 60 + 21.448 / 3600, 9);
});

test("earth.orbitEccentricityApprox is the constant from the approximate model", () => {
    expect(approx.earth.orbitEccentricity(precise.J2000)).toBeCloseTo(0.01671022, 8);
});

test("precise and approx earth/sun/moon namespaces expose the same call sites", () => {
    // Same date, different accuracy: switching the import should be the only thing that changes.
    const t = precise.J2000;

    expect(typeof precise.earth.orbitEccentricity(t)).toBe("number");
    expect(typeof approx.earth.orbitEccentricity(t)).toBe("number");
    expect(typeof precise.sun.apparentPosition(t).rightAscension).toBe("number");
    expect(typeof approx.sun.apparentPosition(t).rightAscension).toBe("number");
    expect(typeof precise.moon.apparentPosition(t).declination).toBe("number");
    expect(typeof approx.moon.apparentPosition(t).declination).toBe("number");
});

test("earth.atmosphericRefraction reproduces the textbook sea-level values", () => {
    // AA.15.4 (Saemundsson) takes the TRUE altitude and returns the lift to apparent, so the value at 0 is
    // ~29', not the ~34' quoted for an apparent altitude of 0 (AA.15.3, Bennett proper, which is the inverse
    // relation). The two are not interchangeable; anything warping an already-apparent view ray wants 15.3.
    expect(precise.earth.atmosphericRefraction(0) * 60).toBeCloseTo(28.98, 2);
    expect(precise.earth.atmosphericRefraction(90) * 60).toBeCloseTo(0.0, 6);
    // Monotonically decreasing with altitude, over the range Bennett's fit is meant for.
    for (let a = 0; a < 90; ++a) {
        expect(precise.earth.atmosphericRefraction(a + 1)).toBeLessThan(precise.earth.atmosphericRefraction(a));
    }
});

test("earth.atmosphericRefraction defaults leave Bennett's formula untouched", () => {
    // The conditions argument must be a pure multiplier, 1 at its own reference conditions.
    for (const a of [0, 1, 5, 15, 45, 90]) {
        expect(precise.earth.atmosphericRefraction(a, { observerHeightM: 0, temperatureC: 10 })).toBeCloseTo(
            precise.earth.atmosphericRefraction(a),
            12,
        );
    }
});

test("earth.airPressureRatio thins the air, and refraction with it, as the observer climbs", () => {
    expect(precise.earth.airPressureRatio(0)).toBe(1);
    expect(precise.earth.airPressureRatio(1000)).toBeCloseTo(0.888, 3);
    expect(precise.earth.airPressureRatio(10000)).toBeCloseTo(0.3056, 4);
    // At the top of the atmosphere there is effectively nothing left to bend the light.
    expect(precise.earth.airPressureRatio(precise.earth.ATMOSPHERE_THICKNESS_NON_UNIFORM_KM * 1000)).toBeLessThan(1e-4);

    // Horizon refraction at 1000 m: ~26', down from ~29' at sea level.
    expect(precise.earth.atmosphericRefraction(0, { observerHeightM: 1000 }) * 60).toBeCloseTo(25.74, 2);
    expect(precise.earth.atmosphericRefraction(0, { observerHeightM: 1000 })).toBeLessThan(
        precise.earth.atmosphericRefraction(0),
    );
});

test("earth.atmosphericRefraction increases in colder, denser air", () => {
    expect(precise.earth.atmosphericRefraction(0, { temperatureC: -20 })).toBeGreaterThan(
        precise.earth.atmosphericRefraction(0, { temperatureC: 30 }),
    );
});

test("earth.atmosphericRefractionFromApparent reproduces the textbook horizon value", () => {
    // AA.15.3, the apparent-altitude fit: ~34.5', which exceeds the Sun's own ~32' apparent diameter, so a Sun
    // that looks like it is touching the horizon has geometrically already set. Distinctly not 15.4's ~29'.
    expect(precise.earth.atmosphericRefractionFromApparent(0) * 60).toBeCloseTo(34.48, 2);
    expect(precise.earth.atmosphericRefractionFromApparent(90) * 60).toBeCloseTo(0.0, 6);
    expect(precise.earth.atmosphericRefractionFromApparent(0)).toBeGreaterThan(precise.earth.atmosphericRefraction(0));
});

test("earth's two refraction fits are inverses of each other", () => {
    // The pairing the renderer depends on: sternzeit lifts a true altitude to apparent, dunstkreis' WGSL twin
    // of the 15.3 fit takes an apparent view ray back to true. Round-tripping must land where it started.
    // The two are independent empirical fits, so they agree to a few arcseconds rather than exactly.
    for (const trueAltitude of [0, 0.5, 1, 2, 5, 10, 20, 45, 80, 90]) {
        const apparent = trueAltitude + precise.earth.atmosphericRefraction(trueAltitude);
        const back = apparent - precise.earth.atmosphericRefractionFromApparent(apparent);

        expect(Math.abs(back - trueAltitude) * 3600).toBeLessThan(5); // arcseconds
    }
});

test("earth.atmosphericRefractionFromApparent clamps below the horizon instead of diverging", () => {
    // The fit has a pole at -4.4°; rays pointing down must still return something finite and usable.
    for (const a of [-0.5, -1, -4.4, -10, -90]) {
        expect(precise.earth.atmosphericRefractionFromApparent(a)).toBe(
            precise.earth.atmosphericRefractionFromApparent(0),
        );
    }
});

test("both refraction fits take the same conditions scaling", () => {
    const conditions = { observerHeightM: 1000, temperatureC: -5 };
    const factor = precise.earth.atmosphericRefraction(10, conditions) / precise.earth.atmosphericRefraction(10);

    expect(
        precise.earth.atmosphericRefractionFromApparent(10, conditions) /
            precise.earth.atmosphericRefractionFromApparent(10),
    ).toBeCloseTo(factor, 12);
});

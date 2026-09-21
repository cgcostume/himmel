// See ../GLOSSARY.md for ecliptical/horizontal coordinates, apparent angular diameter, and eclipses.
import * as earth from "./earth.js";
import { angularSeparation, DEG_TO_RAD, normalizeDegrees, positionAngle, RAD_TO_DEG } from "./math.js";
import * as moon from "./moon.js";
import * as sun from "./sun.js";
import { type AstronomicalTime, type JulianDay, julianDayUT } from "./time.js";

/**
 * Piecewise-linear phase axis: `[0, inner]` maps to `[0, 0.5]` and `[inner, outer]` maps to `[0.5, 1]`, each
 * independently, not clamped past 1. Per Limberger et al., "Single-Pass Rendering of Day and Night Sky
 * Phenomena" (VMV 2012, Sec. 3.2): `inner`/`outer` (there, the umbra/penumbra radii) vary from eclipse to
 * eclipse, but a lookup-texture-style consumer needs the boundary between them at a *fixed* coordinate (0.5)
 * regardless, not one that drifts with the day's actual distances/radii.
 */
function phase(distance: number, inner: number, outer: number): number {
    return distance <= inner ? 0.5 * (distance / inner) : 0.5 + (0.5 * (distance - inner)) / (outer - inner);
}

/** The same distance against `outer` alone, as one global linear scale: 0 at center, 1 exactly at `outer`.
 *  Unlike `phase`, `inner` lands wherever inner/outer numerically falls, drifting eclipse to eclipse; useful
 *  when what's wanted is "how deep, proportionally" rather than a stable lookup coordinate. */
function linearPhase(distance: number, outer: number): number {
    return distance / outer;
}

export interface SolarEclipseState {
    /** Apparent center-to-center separation between Sun and Moon as seen by the observer, in degrees. */
    separation: number;
    /** Direction from the Sun's center to the Moon's center in the observer's local sky, in degrees measured
     *  from up (zenithward) through east, 0-360: which side of the Sun the Moon is covering it from. */
    positionAngle: number;
    /**
     * 0 (centered, deepest total/annular eclipse) to 1 (Sun/Moon discs just touching, first/last contact),
     * 0.5 exactly where the discs' edges align (the total/annular-to-partial boundary); above 1 means no
     * eclipse. See `phase` above. Total vs. annular isn't encoded here (it depends on whether the Moon's or
     * Sun's apparent disc is bigger, not on separation alone) - compare `sun.apparentAngularDiameter` and
     * `moon.apparentAngularDiameter` directly if that distinction is needed.
     */
    phase: number;
    /** See `linearPhase` above: separation as one global fraction of the partial-eclipse radius (Sun+Moon
     *  apparent radii), 0 to 1, not fixed to 0.5 at the total/annular boundary like `phase` is. */
    linearPhase: number;
}

function classifySolarEclipse(
    separation: number,
    positionAngleDeg: number,
    sunRadius: number,
    moonRadius: number,
): SolarEclipseState {
    const inner = Math.abs(sunRadius - moonRadius);
    const outer = sunRadius + moonRadius;

    return {
        separation,
        positionAngle: positionAngleDeg,
        phase: phase(separation, inner, outer),
        linearPhase: linearPhase(separation, outer),
    };
}

/**
 * Whether, and how much, the Moon apparently covers the Sun as seen by an observer at (latitude, longitude).
 * Purely angular (apparent positions and angular diameters); doesn't predict eclipse *paths*, only whether
 * one is visible from a given place at a given time.
 */
export function solarEclipseState(time: AstronomicalTime, latitude: number, longitude: number): SolarEclipseState {
    const t = julianDayUT(time);
    const sh = sun.horizontalPosition(time, latitude, longitude);
    const mh = moon.horizontalPosition(time, latitude, longitude);
    const separation = angularSeparation(sh.azimuth, sh.altitude, mh.azimuth, mh.altitude);
    const direction = positionAngle(sh.azimuth, sh.altitude, mh.azimuth, mh.altitude);

    return classifySolarEclipse(
        separation,
        direction,
        (sun.apparentAngularDiameter(t) * RAD_TO_DEG) / 2,
        (moon.apparentAngularDiameter(t) * RAD_TO_DEG) / 2,
    );
}

export function solarEclipseStateApprox(
    time: AstronomicalTime,
    latitude: number,
    longitude: number,
): SolarEclipseState {
    const t = julianDayUT(time);
    const sh = sun.horizontalPositionApprox(time, latitude, longitude);
    const mh = moon.horizontalPositionApprox(time, latitude, longitude);
    const separation = angularSeparation(sh.azimuth, sh.altitude, mh.azimuth, mh.altitude);
    const direction = positionAngle(sh.azimuth, sh.altitude, mh.azimuth, mh.altitude);

    return classifySolarEclipse(
        separation,
        direction,
        (sun.apparentAngularDiameterApprox(t) * RAD_TO_DEG) / 2,
        (moon.apparentAngularDiameterApprox(t) * RAD_TO_DEG) / 2,
    );
}

export interface LunarEclipseState {
    /** The Moon's angular distance from the axis of Earth's shadow, as seen geocentrically, in degrees. */
    separation: number;
    /** The Moon's linear distance from the axis of Earth's shadow at the Moon's own distance, in kilometers. */
    axisOffsetKm: number;
    /** Direction from the shadow axis to the Moon, in ecliptical degrees measured from ecliptic north through
     *  increasing longitude, 0-360: which side of Earth's shadow the Moon is biased toward. */
    positionAngle: number;
    /** 0 (Moon centered on the shadow axis, deepest possible eclipse) to 1 (Moon at the outer edge of the
     *  penumbra), 0.5 exactly at the umbra/penumbra boundary; above 1 outside the penumbra (no eclipse). See
     *  `phase` above. */
    phase: number;
    /** See `linearPhase` above: the Moon's axis offset as one global fraction of the penumbra's radius, 0 to
     *  1, not fixed to 0.5 at the umbra/penumbra boundary like `phase` is. */
    linearPhase: number;
}

/**
 * Earth's umbra/penumbra radii at a given distance beyond Earth, in kilometers, from the similar-triangle
 * geometry of the shadow cones the Sun casts behind the Earth. Geometric shadow only: doesn't include the
 * ~1-2% atmospheric enlargement of Earth's shadow used in precise eclipse predictions (Danjon's correction).
 */
function shadowRadiiKm(sunDistanceKm: number, distanceBeyondEarthKm: number): { umbra: number; penumbra: number } {
    const umbraHalfAngle = Math.atan((sun.MEAN_RADIUS_KM - earth.MEAN_RADIUS_KM) / sunDistanceKm);
    const penumbraHalfAngle = Math.atan((sun.MEAN_RADIUS_KM + earth.MEAN_RADIUS_KM) / sunDistanceKm);

    return {
        umbra: earth.MEAN_RADIUS_KM - distanceBeyondEarthKm * Math.tan(umbraHalfAngle),
        penumbra: earth.MEAN_RADIUS_KM + distanceBeyondEarthKm * Math.tan(penumbraHalfAngle),
    };
}

function classifyLunarEclipse(
    separation: number,
    axisOffsetKm: number,
    positionAngleDeg: number,
    umbraKm: number,
    penumbraKm: number,
): LunarEclipseState {
    const df = axisOffsetKm / moon.MEAN_RADIUS_KM;
    const epsilonU = umbraKm / moon.MEAN_RADIUS_KM;
    const epsilonP = penumbraKm / moon.MEAN_RADIUS_KM;

    return {
        separation,
        axisOffsetKm,
        positionAngle: positionAngleDeg,
        phase: phase(df, epsilonU, epsilonP),
        linearPhase: linearPhase(df, epsilonP),
    };
}

/**
 * Whether, and how much, the Moon passes through Earth's shadow. Purely geocentric (Sun-Earth-Moon geometry
 * only): unlike solarEclipseState, whether a lunar eclipse *occurs* doesn't depend on the observer, only
 * whether it's *visible* does (the Moon needs to be above the local horizon, see moon.horizontalPosition).
 */
export function lunarEclipseState(t: JulianDay): LunarEclipseState {
    const shadowAxisLongitude = normalizeDegrees(sun.trueLongitude(t) + 180);
    const moonPosition = moon.position(t);
    const offsetDeg = angularSeparation(moonPosition.longitude, moonPosition.latitude, shadowAxisLongitude, 0);
    const direction = positionAngle(shadowAxisLongitude, 0, moonPosition.longitude, moonPosition.latitude);

    const moonDistanceKm = moon.distance(t);
    const { umbra, penumbra } = shadowRadiiKm(sun.distance(t), moonDistanceKm);

    return classifyLunarEclipse(offsetDeg, offsetDeg * DEG_TO_RAD * moonDistanceKm, direction, umbra, penumbra);
}

export function lunarEclipseStateApprox(t: JulianDay): LunarEclipseState {
    // sun.ts has no trueLongitudeApprox (see approx.ts); meanLongitude ignores the equation of the center
    // (up to ~2 degrees), matching this variant's already-reduced precision elsewhere.
    const shadowAxisLongitude = normalizeDegrees(sun.meanLongitudeApprox(t) + 180);
    const moonPosition = moon.positionApprox(t);
    const offsetDeg = angularSeparation(moonPosition.longitude, moonPosition.latitude, shadowAxisLongitude, 0);
    const direction = positionAngle(shadowAxisLongitude, 0, moonPosition.longitude, moonPosition.latitude);

    const moonDistanceKm = moon.distanceApprox(t);
    const { umbra, penumbra } = shadowRadiiKm(sun.distanceApprox(t), moonDistanceKm);

    return classifyLunarEclipse(offsetDeg, offsetDeg * DEG_TO_RAD * moonDistanceKm, direction, umbra, penumbra);
}

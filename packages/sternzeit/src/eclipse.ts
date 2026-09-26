// Terms used here are explained in the himmelszelt site's glossary (site/src/data/glossary.json).
import type { Observer } from "./coords.js";
import * as earth from "./earth.js";
import { angularSeparation, DEG_TO_RAD, normalizeDegrees, positionAngle } from "./math.js";
import * as moon from "./moon.js";
import * as sun from "./sun.js";
import { type AstronomicalTime, type JulianDay, julianEphemerisDay } from "./time.js";

/**
 * The eclipse phase: a distance from the center, piecewise linear so that `[0, inner]` maps to `[0, 0.5]` and `[inner,
 * outer]` to `[0.5, 1]`, unclamped beyond. Per Limberger et al. 2012 (VMV, Sec. 3.2): inner and outer vary from eclipse
 * to eclipse, but a renderer looking the eclipse's colors up in a texture needs the boundary between them at the same
 * coordinate every time.
 */
function phase(distance: number, inner: number, outer: number): number {
    return distance <= inner ? 0.5 * (distance / inner) : 0.5 + (0.5 * (distance - inner)) / (outer - inner);
}

export interface SolarEclipseState {
    /** Apparent center-to-center separation between Sun and Moon as seen by the observer, in degrees. */
    separation: number;
    /** Direction from the Sun's center to the Moon's center in the observer's local sky, in degrees, 0-360: from up
     *  (towards the zenith) clockwise as the observer sees it, i.e. towards increasing azimuth. Which side of the Sun
     *  the Moon covers it from. */
    positionAngle: number;
    /**
     * How deep the eclipse is, not the Moon's phase (see `moon.phaseAngle` for that).
     * 0 (centered, deepest total/annular eclipse) to 1 (Sun/Moon discs just touching, first/last contact),
     * 0.5 exactly where the discs' edges align (the total/annular-to-partial boundary); above 1 means no
     * eclipse. The coordinate for a lookup texture, see `phase` above. Whether it is total or annular
     * depends on which disc is larger: compare `sun.apparentAngularDiameter` with `moon.topocentricAngularDiameter`.
     */
    phase: number;
    /**
     * The eclipse magnitude, as NASA's local circumstances give it: the fraction of the Sun's diameter the Moon covers,
     * along the line through both centers. 0 as the discs touch, 1 from totality on, (1 + k) / 2 at its center with k
     * the ratio of the diameters; negative with no eclipse. The catalogs' magnitude of a central eclipse is k itself.
     */
    magnitude: number;
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
        magnitude: (outer - separation) / (2 * sunRadius),
    };
}

/**
 * Whether, and how much, the Moon apparently covers the Sun as seen by the observer.
 * Purely angular (apparent positions and angular diameters); doesn't predict eclipse *paths*, only whether
 * one is visible from a given place at a given time.
 */
export function solarEclipseState(time: AstronomicalTime, observer: Observer): SolarEclipseState {
    const t = julianEphemerisDay(time);
    const sh = sun.horizontalPosition(time, observer);
    const mh = moon.horizontalPosition(time, observer);
    const separation = angularSeparation(sh.azimuth, sh.altitude, mh.azimuth, mh.altitude);
    const direction = positionAngle(sh.azimuth, sh.altitude, mh.azimuth, mh.altitude);

    return classifySolarEclipse(
        separation,
        direction,
        sun.apparentAngularDiameter(t) / 2,
        moon.topocentricAngularDiameter(time, observer) / 2,
    );
}

/** Approximation of {@link solarEclipseState}, from the approximate chain. */
export function solarEclipseStateApprox(time: AstronomicalTime, observer: Observer): SolarEclipseState {
    const t = julianEphemerisDay(time);
    const sh = sun.horizontalPositionApprox(time, observer);
    const mh = moon.horizontalPositionApprox(time, observer);
    const separation = angularSeparation(sh.azimuth, sh.altitude, mh.azimuth, mh.altitude);
    const direction = positionAngle(sh.azimuth, sh.altitude, mh.azimuth, mh.altitude);

    return classifySolarEclipse(
        separation,
        direction,
        sun.apparentAngularDiameterApprox(t) / 2,
        moon.topocentricAngularDiameterApprox(time, observer) / 2,
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
    /** How deep the eclipse is, not the Moon's phase (see `moon.phaseAngle` for that).
     *  0 (Moon centered on the shadow axis, deepest possible eclipse) to 1 (Moon at the outer edge of the
     *  penumbra), 0.5 exactly at the umbra/penumbra boundary; above 1 outside the penumbra (no eclipse). The
     *  coordinate for a lookup texture of the eclipse's colors, see `phase` above. */
    phase: number;
    /** The umbral magnitude as the catalogs give it: the fraction of the Moon's diameter inside the umbra. 1 or more is
     *  total, below 0 the Moon is outside it. Geometric shadow, so a little below the catalogs' enlarged one. */
    umbralMagnitude: number;
    /** The penumbral magnitude: the fraction of the Moon's diameter inside the penumbra. */
    penumbralMagnitude: number;
    /** Radius of Earth's umbra (core shadow) at the Moon's distance, in kilometers. */
    umbraRadiusKm: number;
    /** Radius of Earth's penumbra (partial shadow) at the Moon's distance, in kilometers. */
    penumbraRadiusKm: number;
}

/**
 * Earth's umbra/penumbra radii at a given distance beyond Earth, in kilometers, from the similar-triangle
 * geometry of the shadow cones the Sun casts behind the Earth. Geometric shadow only: doesn't include the
 * ~1-2% atmospheric enlargement of Earth's shadow used in precise eclipse predictions (Danjon's correction).
 */
function shadowRadii(sunDistanceKm: number, distanceBeyondEarthKm: number): { umbraKm: number; penumbraKm: number } {
    const umbraHalfAngle = Math.atan((sun.MEAN_RADIUS_KM - earth.MEAN_RADIUS_KM) / sunDistanceKm);
    const penumbraHalfAngle = Math.atan((sun.MEAN_RADIUS_KM + earth.MEAN_RADIUS_KM) / sunDistanceKm);

    return {
        umbraKm: earth.MEAN_RADIUS_KM - distanceBeyondEarthKm * Math.tan(umbraHalfAngle),
        penumbraKm: earth.MEAN_RADIUS_KM + distanceBeyondEarthKm * Math.tan(penumbraHalfAngle),
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
        umbralMagnitude: (umbraKm + moon.MEAN_RADIUS_KM - axisOffsetKm) / (2 * moon.MEAN_RADIUS_KM),
        penumbralMagnitude: (penumbraKm + moon.MEAN_RADIUS_KM - axisOffsetKm) / (2 * moon.MEAN_RADIUS_KM),
        umbraRadiusKm: umbraKm,
        penumbraRadiusKm: penumbraKm,
    };
}

/**
 * Whether, and how much, the Moon passes through Earth's shadow. Purely geocentric (Sun-Earth-Moon geometry
 * only): unlike solarEclipseState, whether a lunar eclipse *occurs* doesn't depend on the observer, only
 * whether it's *visible* does (the Moon needs to be above the local horizon, see moon.horizontalPosition).
 */
export function lunarEclipseState(t: JulianDay): LunarEclipseState {
    // The shadow points away from the apparent Sun: aberration is the light time the shadow's light was underway, and
    // both longitudes are then referred to the true equinox of the date.
    const shadowAxisLongitude = normalizeDegrees(sun.apparentLongitude(t) + 180);
    const geometric = moon.position(t);
    const moonPosition = { longitude: geometric.longitude + earth.longitudeNutation(t), latitude: geometric.latitude };
    const offsetDeg = angularSeparation(moonPosition.longitude, moonPosition.latitude, shadowAxisLongitude, 0);
    const direction = positionAngle(shadowAxisLongitude, 0, moonPosition.longitude, moonPosition.latitude);

    const moonDistanceKm = moon.distance(t);
    const { umbraKm, penumbraKm } = shadowRadii(sun.distance(t), moonDistanceKm);

    return classifyLunarEclipse(offsetDeg, offsetDeg * DEG_TO_RAD * moonDistanceKm, direction, umbraKm, penumbraKm);
}

/** Approximation of {@link lunarEclipseState}, from the approximate chain. */
export function lunarEclipseStateApprox(t: JulianDay): LunarEclipseState {
    const shadowAxisLongitude = normalizeDegrees(sun.apparentLongitudeApprox(t) + 180);
    const geometric = moon.positionApprox(t);
    const moonPosition = {
        longitude: geometric.longitude + earth.longitudeNutationApprox(t),
        latitude: geometric.latitude,
    };
    const offsetDeg = angularSeparation(moonPosition.longitude, moonPosition.latitude, shadowAxisLongitude, 0);
    const direction = positionAngle(shadowAxisLongitude, 0, moonPosition.longitude, moonPosition.latitude);

    const moonDistanceKm = moon.distanceApprox(t);
    const { umbraKm, penumbraKm } = shadowRadii(sun.distanceApprox(t), moonDistanceKm);

    return classifyLunarEclipse(offsetDeg, offsetDeg * DEG_TO_RAD * moonDistanceKm, direction, umbraKm, penumbraKm);
}

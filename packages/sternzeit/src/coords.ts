// See ../GLOSSARY.md for equatorial/ecliptic/horizontal coordinates, obliquity, and hour angle.
import { DEG_TO_RAD, normalizeDegrees, RAD_TO_DEG } from "./math.js";
import type { JulianDay } from "./time.js";

export interface EquatorialCoords {
    /** Right ascension (α), in degrees: angle east of the vernal equinox along the celestial equator. */
    rightAscension: number;
    /** Declination (δ), in degrees. Positive north of the celestial equator. */
    declination: number;
}

export interface EclipticalCoords {
    /** Ecliptical longitude (l), in degrees, measured from the vernal equinox along the ecliptic. */
    longitude: number;
    /** Ecliptical latitude (β), in degrees. Positive north of the ecliptic. */
    latitude: number;
}

export interface HorizontalCoords {
    /** Azimuth (h), in degrees, compass convention: measured clockwise from north through east, 0-360. */
    azimuth: number;
    /** Altitude (A), in degrees. Positive above, negative below the horizon. */
    altitude: number;
}

/** Ecliptical to equatorial coordinates, per Meeus' "Astronomical Algorithms" (13.3, 13.4). */
export function eclipticalToEquatorial(ecl: EclipticalCoords, obliquity: number): EquatorialCoords {
    const e = obliquity * DEG_TO_RAD;
    const l = ecl.longitude * DEG_TO_RAD;
    const b = ecl.latitude * DEG_TO_RAD;

    const cose = Math.cos(e);
    const sine = Math.sin(e);
    const sinl = Math.sin(l);

    return {
        rightAscension: normalizeDegrees(Math.atan2(sinl * cose - Math.tan(b) * sine, Math.cos(l)) * RAD_TO_DEG),
        declination: Math.asin(Math.sin(b) * cose + Math.cos(b) * sine * sinl) * RAD_TO_DEG,
    };
}

/**
 * Equatorial to horizontal coordinates, per Meeus' "Astronomical Algorithms" (12.5, 12.6).
 * `observersLongitude` is positive east (standard geographic convention: LST = GST + east longitude),
 * verified against the 2024-04-08 total solar eclipse via eclipse.ts's solarEclipseState. Meeus' own
 * azimuth formula is measured westward from south; 180 degrees is added below to return the compass
 * convention (from north through east) instead, matching every other azimuth a renderer or map expects.
 */
export function equatorialToHorizontal(
    equ: EquatorialCoords,
    siderealTime: JulianDay,
    observersLatitude: number,
    observersLongitude: number,
): HorizontalCoords {
    // Local hour angle: H = θ - α (AA.p88).
    const H = (siderealTime + observersLongitude - equ.rightAscension) * DEG_TO_RAD;
    const declination = equ.declination * DEG_TO_RAD;

    const cosH = Math.cos(H);
    const sinLat = Math.sin(observersLatitude * DEG_TO_RAD);
    const cosLat = Math.cos(observersLatitude * DEG_TO_RAD);

    return {
        altitude: Math.asin(sinLat * Math.sin(declination) + cosLat * Math.cos(declination) * cosH) * RAD_TO_DEG,
        azimuth: normalizeDegrees(
            Math.atan2(Math.sin(H), cosH * sinLat - Math.tan(declination) * cosLat) * RAD_TO_DEG + 180,
        ),
    };
}

/** Corrects a geocentric equatorial position for parallax as seen from an observer's location, per Meeus'
 *  "Astronomical Algorithms" (40.7-40.9). Uses the same hour-angle convention as equatorialToHorizontal.
 *  Shared by sun.ts and moon.ts: the Moon's parallax is large enough (~1 degree) to always matter, the Sun's
 *  is tiny (~8.8") but applying it too keeps their topocentric positions on the same footing for eclipse math. */
export function applyParallax(
    position: EquatorialCoords,
    parallax: number,
    siderealTime: JulianDay,
    observersLatitude: number,
    observersLongitude: number,
): EquatorialCoords {
    const H = (siderealTime + observersLongitude - position.rightAscension) * DEG_TO_RAD;
    const phi = observersLatitude * DEG_TO_RAD;
    const pi = parallax * DEG_TO_RAD;
    const delta = position.declination * DEG_TO_RAD;

    const sinPi = Math.sin(pi);
    const cosPhi = Math.cos(phi);
    const cosH = Math.cos(H);
    const cosDelta = Math.cos(delta);

    const deltaAlpha = Math.atan2(-cosPhi * sinPi * Math.sin(H), cosDelta - cosPhi * sinPi * cosH);
    const deltaPrime = Math.atan2(
        (Math.sin(delta) - Math.sin(phi) * sinPi) * Math.cos(deltaAlpha),
        cosDelta - cosPhi * sinPi * cosH,
    );

    return {
        rightAscension: normalizeDegrees(position.rightAscension + deltaAlpha * RAD_TO_DEG),
        declination: deltaPrime * RAD_TO_DEG,
    };
}

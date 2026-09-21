export function toInt(value: number): number {
    return Math.trunc(value);
}

export function frac(value: number): number {
    return value - Math.trunc(value);
}

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** Normalizes an angle in degrees to the range [0, 360). */
export function normalizeDegrees(deg: number): number {
    return deg - Math.floor(deg / 360) * 360;
}

/** Fraction of a day represented by an hour/minute/second triple. */
export function dayFraction(hour: number, minute: number, second: number): number {
    return (hour + (minute + second / 60) / 60) / 24;
}

export function arcsecondsToDegrees(arcseconds: number): number {
    return arcseconds / 3600;
}

/** Great-circle angular separation between two spherical points, all in degrees. Works for any coordinate
 *  system sharing an origin (equatorial, ecliptical, horizontal), so callers unpack their own field names. */
export function angularSeparation(
    longitude1: number,
    latitude1: number,
    longitude2: number,
    latitude2: number,
): number {
    const lat1 = latitude1 * DEG_TO_RAD;
    const lat2 = latitude2 * DEG_TO_RAD;
    const dLon = (longitude2 - longitude1) * DEG_TO_RAD;

    return Math.acos(Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon)) * RAD_TO_DEG;
}

/** Direction from point 1 to point 2, in degrees measured from point 1's "north" (increasing latitude)
 *  through "east" (increasing longitude), 0-360. Same formula as a great-circle compass bearing, applied to
 *  any coordinate system sharing an origin; works alongside angularSeparation to fully locate point 2
 *  relative to point 1, not just how far away it is. */
export function positionAngle(longitude1: number, latitude1: number, longitude2: number, latitude2: number): number {
    const lat1 = latitude1 * DEG_TO_RAD;
    const lat2 = latitude2 * DEG_TO_RAD;
    const dLon = (longitude2 - longitude1) * DEG_TO_RAD;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return normalizeDegrees(Math.atan2(y, x) * RAD_TO_DEG);
}

/** Mean distance from Earth to Sun, in kilometers: multiply an AU value by this to convert to km. */
export const ASTRONOMICAL_UNIT_KM = 149598000;

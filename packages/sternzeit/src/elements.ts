// Sun's mean anomaly and the Moon's mean ascending node longitude: split out of sun.ts/moon.ts because
// moon.ts's perturbation series needs the Sun's mean anomaly and sun.ts's apparent position needs the
// Moon's node, which would otherwise make the two modules import each other.
import { normalizeDegrees, RAD_TO_DEG } from "./math.js";
import { type JulianDay, julianCenturiesSinceStandardEquinox } from "./time.js";

/** Sun's mean anomaly, in degrees, per Meeus' "Astronomical Algorithms" (45.3). */
export function meanAnomaly(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = 357.5291092 + T * (35999.0502909 + T * (-0.0001536 + T * (1.0 / 24490000.0)));

    return normalizeDegrees(M);
}

/** ("A Physically-Based Night Sky Model" - 2001 - Wann Jensen et al.) */
export function meanAnomalyApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const M = (6.24 + 628.302 * T) * RAD_TO_DEG;

    return normalizeDegrees(M);
}

export function meanAscendingNodeLongitude(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const O = 125.04452 + T * (-1934.136261 + T * (0.0020708 + T * (1.0 / 450000.0)));

    return normalizeDegrees(O);
}

export function meanAscendingNodeLongitudeApprox(t: JulianDay): number {
    const T = julianCenturiesSinceStandardEquinox(t);
    const O = 125.04 + T * -1934.136;

    return normalizeDegrees(O);
}

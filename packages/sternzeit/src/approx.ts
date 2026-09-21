// biome-ignore-all assist/source/organizeImports: exports are hand-grouped by domain, not alphabetical, mirroring index.ts
import * as earthImpl from "./earth.js";
import * as moonImpl from "./moon.js";
import * as sunImpl from "./sun.js";
import * as eclipseImpl from "./eclipse.js";

// Math auxiliaries, same in both entry points (no precise/approx distinction applies to these).
export {
    angularSeparation,
    ASTRONOMICAL_UNIT_KM,
    DEG_TO_RAD,
    normalizeDegrees,
    positionAngle,
    RAD_TO_DEG,
} from "./math.js";

// Coordinate systems.
export type { EclipticalCoords, EquatorialCoords, HorizontalCoords } from "./coords.js";
export { eclipticalToEquatorial, equatorialToHorizontal } from "./coords.js";

// Time and Julian Day.
export type { AstronomicalTime, JulianDay } from "./time.js";
export { J2000, J2050, B1900, B1950, STANDARD_EQUINOX } from "./time.js"; // reference epochs
export {
    julianDay,
    julianDay0UT,
    julianDayUT,
    fromJulianDay,
    modifiedJulianDay,
    toUT,
    julianDaysSinceStandardEquinox,
    julianCenturiesSinceStandardEquinox,
} from "./time.js"; // Julian Day conversions

// Sidereal time.
export { meanSiderealTimeApprox as siderealTime } from "./siderealTime.js";

// Earth. Same shape as the precise `earth` namespace in `index.ts`, minus `viewDistanceWithinAtmosphere`'s
// refraction flag. MEAN_RADIUS_KM/ATMOSPHERE_THICKNESS_KM/ATMOSPHERE_THICKNESS_NON_UNIFORM_KM/
// APPARENT_MAGNITUDE_LIMIT/atmosphericRefraction have no approximate variant, same values either way.
export const earth = {
    MEAN_RADIUS_KM: earthImpl.MEAN_RADIUS_KM,
    ATMOSPHERE_THICKNESS_KM: earthImpl.ATMOSPHERE_THICKNESS_KM,
    ATMOSPHERE_THICKNESS_NON_UNIFORM_KM: earthImpl.ATMOSPHERE_THICKNESS_NON_UNIFORM_KM,
    APPARENT_MAGNITUDE_LIMIT: earthImpl.APPARENT_MAGNITUDE_LIMIT,
    PRESSURE_SCALE_HEIGHT_M: earthImpl.PRESSURE_SCALE_HEIGHT_M,
    airPressureRatio: earthImpl.airPressureRatio,
    atmosphericRefraction: earthImpl.atmosphericRefraction,
    atmosphericRefractionFromApparent: earthImpl.atmosphericRefractionFromApparent,
    orbitEccentricity: earthImpl.orbitEccentricityApprox,
    longitudeNutation: earthImpl.longitudeNutationApprox,
    obliquityNutation: earthImpl.obliquityNutationApprox,
    meanObliquity: earthImpl.meanObliquityApprox,
    trueObliquity: earthImpl.trueObliquityApprox,
    viewDistanceWithinAtmosphere: earthImpl.viewDistanceWithinAtmosphereApprox,
};

// Sun. Same shape as the precise `sun` namespace in `index.ts`, minus `center`/`trueAnomaly`/`trueLongitude`
// (no approximate variant of those exists).
export const sun = {
    MEAN_RADIUS_KM: sunImpl.MEAN_RADIUS_KM,
    meanAnomaly: sunImpl.meanAnomalyApprox,
    meanLongitude: sunImpl.meanLongitudeApprox,
    apparentPosition: sunImpl.apparentPositionApprox,
    equatorialHorizontalParallax: sunImpl.equatorialHorizontalParallaxApprox,
    topocentricPosition: sunImpl.topocentricPositionApprox,
    horizontalPosition: sunImpl.horizontalPositionApprox,
    distance: sunImpl.distanceApprox,
    apparentAngularDiameter: sunImpl.apparentAngularDiameterApprox,
};

// Moon. Same shape as the precise `moon` namespace in `index.ts`.
export type { MoonLibration } from "./moon.js";
export const moon = {
    MEAN_RADIUS_KM: moonImpl.MEAN_RADIUS_KM,
    meanLongitude: moonImpl.meanLongitudeApprox,
    meanElongation: moonImpl.meanElongationApprox,
    meanAnomaly: moonImpl.meanAnomalyApprox,
    meanArgumentOfLatitude: moonImpl.meanArgumentOfLatitudeApprox,
    meanAscendingNodeLongitude: moonImpl.meanAscendingNodeLongitudeApprox,
    position: moonImpl.positionApprox,
    apparentPosition: moonImpl.apparentPositionApprox,
    equatorialHorizontalParallax: moonImpl.equatorialHorizontalParallaxApprox,
    topocentricPosition: moonImpl.topocentricPositionApprox,
    horizontalPosition: moonImpl.horizontalPositionApprox,
    distance: moonImpl.distanceApprox,
    apparentAngularDiameter: moonImpl.apparentAngularDiameterApprox,
    opticalLibrations: moonImpl.opticalLibrationsApprox,
    parallacticAngle: moonImpl.parallacticAngleApprox,
    positionAngleOfAxis: moonImpl.positionAngleOfAxisApprox,
};

// Eclipses. Same shape as the precise `eclipse` namespace in `index.ts`.
export type { SolarEclipseState, LunarEclipseState } from "./eclipse.js";
export const eclipse = {
    solar: eclipseImpl.solarEclipseStateApprox,
    lunar: eclipseImpl.lunarEclipseStateApprox,
};

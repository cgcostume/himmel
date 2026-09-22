import * as precise from "@himmel/sternzeit";

// The refraction fit holds down to about a degree below the horizon; lower, it is taken as constant.
export const REFRACTION_FLOOR_DEG = -1;

/**
 * How far a body at `trueAltitude` (degrees) stands above the visible horizon of an observer `heightM` above the ground:
 * lifted by atmospheric refraction, while the horizon itself dips below the true horizontal. Every figure with a
 * horizon draws its bodies at this altitude, so rising and setting line up with it to the second.
 */
export function aboveVisibleHorizon(trueAltitude, heightM) {
    const conditions = { observerHeightM: heightM };
    const refraction = precise.earth.atmosphericRefraction(Math.max(trueAltitude, REFRACTION_FLOOR_DEG), conditions);
    return trueAltitude + refraction + precise.earth.horizonDip(heightM);
}

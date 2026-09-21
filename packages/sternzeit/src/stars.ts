// Planned, not implemented. Nothing here is exported from `index.ts`/`approx.ts` yet, so there is no public
// star API; see the README's status section. This file exists to pin down the shape of what is coming and to
// document the checked-in catalog's columns, which are already fixed by `src/data/brightstars.csv`.
//
// Ported from osgHimmel's `stars.cpp`/`starsgeode.cpp`, in roughly this order:
//
//  - `apparentPosition(t, ra2000, de2000, pmRa2000, pmDe2000)`: J2000 catalog position to equatorial
//    coordinates for the given date. Proper motion first (the star's own drift across the sky, arcsec/year),
//    then precession of the equinoxes (the slow wobble of the coordinate frame itself, ~50"/year, which
//    dominates over any single star's motion). Meeus ch. 20/21 and 23.
//  - `horizontalPosition(...)`: the above, plus `equatorialToHorizontal` with the observer's latitude,
//    longitude and sidereal time, exactly as `sun.ts`/`moon.ts` already do it.
//  - Colorimetry, all static per star, which is why the catalog ships precomputed sRGB rather than B-V:
//    `temperatureFromBV` (Ballesteros' formula), `planckianLocusInCieXYZ`, `xyzTristimulus`, `sRgbColor`.
//    Keep them anyway, so a consumer can recolor from a different catalog or a different white point.
//    Olson, "The Colors of the Stars" (1998).
//  - Apparent magnitude to radiance, the piece a renderer actually needs: the catalog's `vmag` is a
//    logarithmic, inverted, historical scale, and turning it into a linear radiance that composes with
//    `@himmel/dunstkreis`' physical units is the whole point of having it here rather than in the renderer.
//    Pairs with `earth.APPARENT_MAGNITUDE_LIMIT`.
//  - A loader for `data/brightstars.bin` (flat little-endian Float32Array, 8 fields per star, see
//    `data/README.md`). Has to stay optional and separately importable: it is ~290 KB, and a consumer who
//    only wants sun and moon math must not pay for it.
//
// Atmospheric refraction applies to stars too, and osgHimmel never did it (only the sun and moon got the
// `sunr`/`moonr` treatment). Whatever renders these should warp its rays with `@himmel/dunstkreis`' per-ray
// refraction, or apply `earth.atmosphericRefraction` here, but not both. See that package's README.

/**
 * One row of `data/brightstars.csv` / `data/brightstars.bin`, 9,093 stars from the Yale Bright Star Catalogue
 * (BSC5) by way of osgHimmel's `brightstars.cpp`. Field order matches the binary layout exactly.
 */
export interface BrightStar {
    /** Apparent visual magnitude. Logarithmic and inverted: lower is brighter, ~6.5 is the naked-eye limit. */
    vmag: number;
    /** Right ascension at equinox J2000.0, in degrees. */
    rightAscension: number;
    /** Declination at equinox J2000.0, in degrees. */
    declination: number;
    /** Annual proper motion in right ascension at J2000.0. */
    properMotionRightAscension: number;
    /** Annual proper motion in declination at J2000.0. */
    properMotionDeclination: number;
    /** Linear sRGB color, precomputed for osgHimmel from the star's B-V color index. */
    color: readonly [number, number, number];
}

/** Number of fields per star in `data/brightstars.bin`, i.e. its stride in a `Float32Array`. */
export const BRIGHT_STAR_FIELDS = 8;

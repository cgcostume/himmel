import * as precise from "@himmel/sternzeit";
import Zdog from "zdog";
import { COMPASS, cssColor, labelAboveY, svgText } from "./figure.js";
import { aboveVisibleHorizon } from "./horizon.js";
import { offPanelArrow, offPanelArrowSvg } from "./offpanel.js";
import { state } from "./state.js";
import "./export.js";

const { Illustration, Anchor, Shape, Ellipse, Vector } = Zdog;
const DEG = precise.DEG_TO_RAD;

// Schematic, not to scale: sizes/distances chosen for visibility, not physical proportion. MOON_DIST/
// SUN_DIST aren't simply EARTH_R*2 scaled: the whole scene auto-zooms to fit the viewport (see
// Illustration's onResize below), so a uniform scale-up of every constant would render identically after
// that zoom. Instead these keep the same clearance gaps as before EARTH_R doubled, so Earth reads as
// bigger relative to the sun/moon, not just bigger in an auto-zoom-cancelled absolute sense.
const EARTH_R = 80;
// Narrower gap than a strict distance scale would give (moon:sun is really ~1:390): keeps the sun where
// it was and brings the moon closer to it, still clearly nearer but not as separated as before.
const MOON_DIST = 320;
const SUN_DIST = 460;

// Disc *sizes* (unlike positions/distances above) ARE to real proportion: both discs are drawn from
// apparentAngularDiameter each frame (see frame() below), so unlike everything else in this schematic,
// their ratio matches what an observer would actually see, near 1:1 most of the time, and shifting with
// real perigee/apogee and perihelion/aphelion, exactly as the difference between annular and total solar
// eclipses does in reality. SUN_R is only a reference size, chosen to read well at this scene's scale, that
// APPARENT_SIZE_SCALE is derived from so the sun starts out at roughly its old, hand-picked diameter.
const SUN_R = 32;
const APPARENT_SIZE_SCALE = (SUN_R * 2) / (precise.sun.apparentAngularDiameter(precise.J2000) * precise.RAD_TO_DEG);

const KM_TO_SCENE = EARTH_R / precise.earth.MEAN_RADIUS_KM;
const ATMOSPHERE_SHELL_DIAMETER = 2 * (EARTH_R + precise.earth.ATMOSPHERE_THICKNESS_KM * KM_TO_SCENE);
const PAGE_ACCENT = cssColor("--accent", "#5aa9ff");
// Every stroke that was plain black on the old light page: the site's text color, so the scene follows the theme.
const INK = cssColor("--text", "#d6dae3");
// The Moon's color in every figure except the eclipse panels (which show how it really looks): muted grey.
const MOON_INK = cssColor("--muted", "#8a92a3");

function v(x, y, z) {
    return { x, y, z };
}
function vScale(a, s) {
    return v(a.x * s, a.y * s, a.z * s);
}

// Earth-centered equatorial frame: RA=0/dec=0 is the +X axis, the celestial equator is the XZ plane,
// +dec is -Y (Zdog is screen-convention y-down, so "up"/north is negative y). Used for every body
// (sun/moon apparentPosition) and, via siderealTime + longitude standing in for RA, for points on Earth's
// own surface, so a ground point's position here rotates in sync with the sky exactly as it does in reality.
function sphericalToVector(raDeg, decDeg, radius) {
    const ra = raDeg * DEG;
    const dec = decDeg * DEG;
    return v(radius * Math.cos(dec) * Math.cos(ra), -radius * Math.sin(dec), radius * Math.cos(dec) * Math.sin(ra));
}

// A circle's default normal is its local +Z (see equatorRing's rotate:{x:PI/2} comment above); this finds
// the rotate.x/rotate.y that points that normal at `dir` (any unit vector). Derived by inverting Zdog's own
// rotateY-then-rotateX rotation chain (rotateZ, then rotateY, then rotateX; see Vector.prototype.rotate in
// node_modules/zdog/dist/zdog.dist.js) applied to (0,0,1): the result is (-sin(ry), -cos(ry)*sin(rx),
// cos(ry)*cos(rx)); solved for rx/ry given a target. The twist around the normal (the remaining free
// parameter) doesn't matter since a circle is rotationally symmetric about it.
function rotateToFace(dir) {
    return { x: Math.atan2(-dir.y, dir.z), y: Math.asin(-dir.x), z: 0 };
}

// A camera-facing (billboarded) circle: rather than a fixed world-space normal like rotateToFace targets,
// this one needs to always present +Z in *screen* space, i.e. counter whatever the scene's own rotX/rotY
// currently are. Derived by working out what local normal, once carried through the scene's own
// rotateY(rotY)-then-rotateX(rotX) (illustration.rotate below), lands back on screen-facing (0,0,1): that
// target is (cos(rotX)*sin(rotY), sin(rotX), cos(rotX)*cos(rotY)), fed into rotateToFace like any other
// target direction (a circle's own twist around its normal still doesn't matter, so this reuses it as-is).
function billboardRotate(rotX, rotY) {
    const cx = Math.cos(rotX);
    return rotateToFace(v(cx * Math.sin(rotY), Math.sin(rotX), cx * Math.cos(rotY)));
}

// Mouse-wheel zoom, layered on top of the auto-fit zoom below rather than replacing it: baseZoom is
// whatever onResize computes to fit the viewport, zoomFactor is the user's own multiplier on top of that
// (1.0..8.0), and the two combine each frame (see frame()) into illustration.zoom. targetZoomFactor is set
// instantly by the wheel handler; zoomFactor eases toward it every frame for a soft, non-jumpy feel rather
// than snapping straight to each wheel tick.
const ZOOM_FACTOR_MIN = 1.0;
const ZOOM_FACTOR_MAX = 8.0;
let baseZoom = 1;
let zoomFactor = 1;
let targetZoomFactor = 1;
// Zdog's SVG renderer (unlike its canvas renderer) only bakes `zoom` into the <svg> viewBox at setSize()
// time; it doesn't rescale path coordinates per frame. So a plain `illustration.zoom = ...` between resizes
// has no visual effect until setSize() runs again with the current width/height, hence caching them here.
let stageWidth = 0;
let stageHeight = 0;

const illustration = new Illustration({
    element: "#stage",
    zoom: 1,
    resize: true,
    // setSizeSvg() computes the viewBox from `zoom` before this callback runs, so a plain assignment here
    // would leave a stale viewBox until the next resize; setSize() re-derives it with the new zoom. Uses
    // `this` (Zdog calls it as this.onResize(...)) rather than closing over `illustration`: onResize fires
    // synchronously during the `new Illustration(...)` call below, before that const binding exists.
    onResize: function (width, height) {
        stageWidth = width;
        stageHeight = height;
        baseZoom = (Math.min(width, height) / 2 / (SUN_DIST + SUN_R)) * 2.0;
        this.zoom = baseZoom * zoomFactor;
        this.setSize(width, height);
    },
});

// Earth is shown implicitly, not as a drawn sphere/grid: just the two circles that pass through the
// observer (their latitude ring and their meridian), crossing exactly at the observer marker. Both
// orientations are fixed (lat rings always have plane-normal Y, meridians always contain the Y axis, see
// sphericalToVector's comment); only diameter/translate/rotate change per frame to track lat/long.
const earthAnchor = new Anchor({ addTo: illustration });
// Three-tier line-style scheme, tracking how far a line is from "the answer": dotted = fixed reference,
// independent of both JD and location (equator, rotation axis, ecliptic pole below); dashed = construction
// lines derived from the inputs but not themselves the result (the observer's lat/long rings); solid = the
// actual current fact the rest exists to locate (the radius line + observer marker). Dash patterns are
// applied via raw SVG attributes each frame in frame(), Zdog itself has no dashed/dotted-stroke option.
const equatorRing = new Ellipse({
    addTo: earthAnchor,
    diameter: 2 * EARTH_R,
    rotate: { x: Math.PI / 2 },
    color: INK,
    stroke: 1,
    fill: false,
});
const axisLine = new Shape({
    addTo: earthAnchor,
    path: [v(0, -EARTH_R, 0), v(0, EARTH_R, 0)],
    stroke: 1,
    color: INK,
});
// The observer's own latitude/meridian rings: where they are right now.
const latitudeRing = new Ellipse({
    addTo: earthAnchor,
    diameter: 2 * EARTH_R,
    rotate: { x: Math.PI / 2 },
    color: INK,
    stroke: 1,
    fill: false,
});
const meridianRing = new Ellipse({ addTo: earthAnchor, diameter: 2 * EARTH_R, color: INK, stroke: 1, fill: false });
// The radius from center to the observer: the concrete result, solid.
const radiusLine = new Shape({ addTo: earthAnchor, path: [v(0, 0, 0), v(0, 0, 0)], stroke: 1, color: INK });
// Earth's center, so the radius line has a visible point of origin to read from.
const centerDot = new Shape({ addTo: earthAnchor, stroke: 3, color: INK });
// The two rings cross at two antipodal points; this marks which one is actually the observer.
const observerMarker = new Shape({ addTo: earthAnchor, stroke: 7, color: INK, translate: { z: 0.1 } });
// Ecliptic pole: the celestial pole (the solid vertical axis) rotated by the true obliquity about the X axis (the
// vernal equinox, our +X axis, is the ascending node of one plane on the other). Only the true one: the mean
// obliquity differs by the nutation, a few arcseconds, and would just draw on top of it.
const trueEclipticAxis = new Shape({ addTo: earthAnchor, path: [v(0, 0, 0), v(0, 0, 0)], stroke: 1, color: INK });
// The tilt itself, as a swept arc from the celestial pole to the true ecliptic pole, rather than a straight
// chord between them: a curve reads as "this many degrees of angle" more directly than a line does. Both
// axes extend through the origin in both directions (north and south pole), so the arc is mirrored too:
// trueObliquityArc for the north side, trueObliquityArcSouth for the (identical, negated) south side.
const trueObliquityArc = new Shape({ addTo: earthAnchor, path: [v(0, 0, 0)], closed: false, stroke: 1, color: INK });
const trueObliquityArcSouth = new Shape({
    addTo: earthAnchor,
    path: [v(0, 0, 0)],
    closed: false,
    stroke: 1,
    color: INK,
});
// Longitude nutation: the true equinox (where RA is actually measured from right now) wanders a little
// from the mean/fixed one (our +X axis) within the equatorial plane; marked on the equator ring's surface.
const longitudeNutationLine = new Shape({
    addTo: earthAnchor,
    path: [v(0, 0, 0), v(0, 0, 0)],
    stroke: 1,
    color: INK,
});
const trueEquinoxDot = new Shape({ addTo: earthAnchor, stroke: 3, color: INK });
// Earth's (equivalently, from here, the sun's apparent) orbital ellipse, real eccentricity (~0.0167), so
// this will read as very nearly circular, which is itself the honest answer. Centered on Earth rather than
// offset to the correct focus: that needs the orbit's orientation (longitude of perihelion), which nothing
// in this codebase computes, so this shows the shape/flatness, not the correct sun-at-focus positioning.
const orbitEllipse = new Ellipse({
    addTo: earthAnchor,
    rotate: { x: Math.PI / 2 },
    color: INK,
    stroke: 1,
    fill: false,
});
// The atmosphere shell as a constant, always-on presence, layered on top of everything else: a single
// billboarded circle (see billboardRotate) at the atmosphere's outer radius, rather than three fixed
// wireframe rings, so it always reads as a clean full disc regardless of how the scene is rotated. No
// view-distance-through-atmosphere ray visualization: that distance is too small a fraction of EARTH_R to
// read at this scene's scale.
const atmosphereShell = new Ellipse({
    addTo: earthAnchor,
    diameter: ATMOSPHERE_SHELL_DIAMETER,
    color: PAGE_ACCENT,
    stroke: 1,
    fill: false,
});

const sunAnchor = new Anchor({ addTo: illustration });
// A solid, billboarded outline, deliberately not dotted like atmosphereShell/moonDisc: with the sunrays
// below, the sun is the one body meant to read as a concrete, currently-there thing rather than a fixed
// reference construction, matching radiusLine's "solid = the actual answer" tier. Always presents a full
// circle to the viewer regardless of scene rotation, unlike earthAnchor's two-ring (outline + equator)
// treatment, which is oriented toward Earth, not the camera. Plain INK, same as everything else:
// yellow/grey didn't read well against the dotted stroke at this size.
const sunDisc = new Ellipse({ addTo: sunAnchor, diameter: SUN_R * 2, color: INK, stroke: 1, fill: false });
// Mirrors earthAnchor's centerDot: marks the exact point the body's apparentPosition refers to.
const sunCenterDot = new Shape({ addTo: sunAnchor, stroke: 3, color: INK });

// Sunrays: the one purely decorative touch in this otherwise data-driven scene, so the sun reads as the sun
// at a glance instead of just "the bigger of two identical outline circles" next to the moon (whose apparent
// size is now often close to the sun's, see APPARENT_SIZE_SCALE above). Short strokes radiating from just
// outside the disc's edge, camera-facing like the disc itself; a gap separates them from the outline so they
// don't visually fuse into it. Recomputed every frame in frame() below since sunDisc's own radius changes
// with apparentAngularDiameter. Dotted (see the dash-array loop in frame()), unlike the now-solid disc: the
// disc itself is the "concrete, currently-there" answer, the rays are just flourish around it.
const SUN_RAY_COUNT = 12;
const SUN_RAY_GAP = 8;
const SUN_RAY_LENGTH = 24;
const sunRays = Array.from(
    { length: SUN_RAY_COUNT },
    () => new Shape({ addTo: sunAnchor, path: [v(0, 0, 0), v(0, 0, 0)], stroke: 1, color: INK }),
);

const moonAnchor = new Anchor({ addTo: illustration });
const moonDisc = new Ellipse({
    addTo: moonAnchor,
    diameter: APPARENT_SIZE_SCALE * precise.moon.apparentAngularDiameter(precise.J2000) * precise.RAD_TO_DEG,
    color: MOON_INK,
    stroke: 1,
    fill: false,
});
const moonCenterDot = new Shape({ addTo: moonAnchor, stroke: 3, color: MOON_INK });

// Two small, flat (never rotated), transparent alt-az panels overlaid directly on top of the main scene:
// each anchors one body to x=0 (its own azimuth origin) and plots the other offset by azimuth difference,
// both against a fixed horizon line. Both axes use a tangent (rectilinear) mapping rather than a plain
// angle-linear one, the same distortion an ordinary (non-fisheye) camera lens has: positions stretch
// increasingly as they approach 90 degrees from the vertical/horizontal center, instead of spreading evenly
// by raw degrees. The horizon itself stays put regardless of either body's altitude: it's a fixed reference
// the tangent mapping is built around (see ALTAZ_LOOK_UP_DEG below for exactly where).
const ALTAZ_PANEL_SIZE = 140;
// A true tangent mapping can't reach 180 degrees (tan blows up at 90), so this picks a moderate wide-lens
// angle instead; shown in each panel's caption (see makeAltAzPanel) so the scale is never left to guess at.
const ALTAZ_FIELD_OF_VIEW_DEG = 120;
// The vertical half of that FOV is tilted up by this much rather than centered on the horizon: the zenith
// (altitude 90) is worth seeing (the sun/moon is often high up), while the sky far below the horizon (the
// unlit side of the world an observer never looks at) isn't. 30 up + 90 down from that shifted center covers
// -30 to +90 altitude, the same 120 degrees total, just spent where it's actually useful.
const ALTAZ_LOOK_UP_DEG = 30;
const ALTAZ_FOCAL_PX = ALTAZ_PANEL_SIZE / 2 / Math.tan((ALTAZ_FIELD_OF_VIEW_DEG / 2) * DEG);

// Tangent (rectilinear) mapping of a single axis: 0 stays at 0 (tan(0)=0), and the further from center, the
// more a fixed number of remaining degrees pushes the point outward, same as a real camera lens. Independent
// per axis (not a joint spherical projection): that's what keeps the horizon exactly fixed (at a height that
// depends only on the constant ALTAZ_LOOK_UP_DEG, never on either body's actual altitude), rather than tying
// it to the anchor's own direction.
//
// tan() has period 180 degrees, so past +/-90 it starts producing the SAME values it gave for angles 180
// degrees smaller (tan(-157) equals tan(23)): without the clamp below, a body nearly opposite the panel's
// center would wrap around and render as if it were nearly on top of it, exactly backwards. Anything at or
// past 90 degrees off-axis is outside any real camera's field of view anyway, so it's parked far off-panel.
function tangentPx(degreesFromCenter) {
    if (Math.abs(degreesFromCenter) >= 90) return Math.sign(degreesFromCenter || 1) * 1e5;
    return Math.tan(degreesFromCenter * DEG) * ALTAZ_FOCAL_PX;
}
// The horizon's fixed height, in panel units (0 = panel center, positive = downward): where the horizon line is drawn
// and the compass labels sit (see updateAltAzPanel).
const ALTAZ_HORIZON_Y = -tangentPx(-ALTAZ_LOOK_UP_DEG);
const ALTAZ_DOT_RADIUS = 5;
const ALTAZ_GRID_ALTITUDES = [30, 60];
// Mini versions of the main scene's sunrays (see SUN_RAY_COUNT above): cheaper to read at a glance than an
// "S"/"M" text label, and reuses a motif the viewer already knows means "this one's the sun" from the main
// scene, rather than introducing a new convention.
const ALTAZ_SUN_RAY_COUNT = 8;
const ALTAZ_SUN_RAY_GAP = 3;
const ALTAZ_SUN_RAY_LENGTH = 5;

// A fixed per-species look, regardless of anchor/other role: the sun is a white disc plus rays, the moon a muted
// disc. The anchor/other role is legible from position alone (the anchor always sits at dead-center horizontally).
function altAzBody({ x, y }, isSun) {
    if (!isSun) return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${ALTAZ_DOT_RADIUS}" class="altaz-moon"/>`;
    const inner = ALTAZ_DOT_RADIUS + ALTAZ_SUN_RAY_GAP;
    const outer = inner + ALTAZ_SUN_RAY_LENGTH;
    let svg = `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${ALTAZ_DOT_RADIUS}" class="altaz-sun"/>`;
    for (let i = 0; i < ALTAZ_SUN_RAY_COUNT; i++) {
        const [c, s] = [
            Math.cos((i / ALTAZ_SUN_RAY_COUNT) * 2 * Math.PI),
            Math.sin((i / ALTAZ_SUN_RAY_COUNT) * 2 * Math.PI),
        ];
        const [x1, y1, x2, y2] = [x + inner * c, y + inner * s, x + outer * c, y + outer * s].map((n) => n.toFixed(2));
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="altaz-sun-ray"/>`;
    }
    return svg;
}

function makeAltAzPanel(elementSelector, anchorIsSun) {
    const element = document.querySelector(elementSelector);
    const half = ALTAZ_PANEL_SIZE / 2;
    element.setAttribute("viewBox", `${-half} ${-half} ${ALTAZ_PANEL_SIZE} ${ALTAZ_PANEL_SIZE}`);
    // Appended here (not hardcoded in the markup) so the caption can never drift out of sync with
    // ALTAZ_FIELD_OF_VIEW_DEG above.
    const caption = element.closest(".altaz-panel")?.querySelector(".altaz-caption");
    if (caption) caption.textContent += `, ${ALTAZ_FIELD_OF_VIEW_DEG}° FOV, tilted ${ALTAZ_LOOK_UP_DEG}° up`;
    return { element, anchorIsSun, drawn: "" };
}
const sunView = makeAltAzPanel("#sunView", true);
const moonView = makeAltAzPanel("#moonView", false);

// Signed azimuth difference wrapped to [-180, 180]: the shorter way around the compass, so a moon just west
// of due north relative to a sun just east of it reads as a small gap, not a ~360-degree one.
function azimuthDelta(fromAzimuth, toAzimuth) {
    return ((((toAzimuth - fromAzimuth) % 360) + 540) % 360) - 180;
}

function updateAltAzPanel(panel, anchorHorizontal, otherHorizontal) {
    // The panel is drawn at whatever size the page gives it; arrows and labels keep their size in screen pixels.
    const unitsPerPx = ALTAZ_PANEL_SIZE / (panel.element.clientWidth || ALTAZ_PANEL_SIZE);
    // Redrawn only when something changed, not every frame of the main scene.
    const key = [
        anchorHorizontal.altitude,
        anchorHorizontal.azimuth,
        otherHorizontal.altitude,
        otherHorizontal.azimuth,
        unitsPerPx,
    ].join();
    if (key === panel.drawn) return;
    panel.drawn = key;

    // Anchor: x=0 by construction (it defines this panel's azimuth origin); y from its own true altitude
    // (shifted by ALTAZ_LOOK_UP_DEG, same as the horizon), tangent-mapped like everything else, so it moves
    // like any other point, not locked to panel center.
    const anchorPoint = { x: 0, y: -tangentPx(anchorHorizontal.altitude - ALTAZ_LOOK_UP_DEG) };
    const dAz = azimuthDelta(anchorHorizontal.azimuth, otherHorizontal.azimuth);
    const otherPoint = { x: tangentPx(dAz), y: -tangentPx(otherHorizontal.altitude - ALTAZ_LOOK_UP_DEG) };
    const [sunPoint, moonPoint] = panel.anchorIsSun ? [anchorPoint, otherPoint] : [otherPoint, anchorPoint];

    // The ground below the fixed horizon (see ALTAZ_LOOK_UP_DEG above), first, so everything else draws on top of it.
    const half = ALTAZ_PANEL_SIZE / 2;
    const y = ALTAZ_HORIZON_Y.toFixed(2);
    let svg = `<rect x="${-half}" y="${y}" width="${ALTAZ_PANEL_SIZE}" height="${(half - ALTAZ_HORIZON_Y).toFixed(2)}" class="figure-ground"/>`;
    // Altitude lines as in the analemma: 30 degrees sits at the center, 60 well above the middle of the upper half.
    for (const altitude of ALTAZ_GRID_ALTITUDES) {
        const gridY = (-tangentPx(altitude - ALTAZ_LOOK_UP_DEG)).toFixed(2);
        svg += `<line x1="${-half}" y1="${gridY}" x2="${half}" y2="${gridY}" class="figure-grid"/>`;
    }
    svg += `<line x1="${-half}" y1="${y}" x2="${half}" y2="${y}" class="figure-horizon"/>`;
    // The compass directions on the horizon, placed by azimuth with the same tangent mapping as the bodies: as the
    // panel follows its body across the sky, the directions pass by along the horizon.
    COMPASS.forEach((label, i) => {
        const d = azimuthDelta(anchorHorizontal.azimuth, i * 45);
        if (Math.abs(d) > ALTAZ_FIELD_OF_VIEW_DEG / 2) return;
        svg += svgText(tangentPx(d), labelAboveY(ALTAZ_HORIZON_Y, unitsPerPx), label, "figure-label", unitsPerPx);
    });
    // The sun before the moon, whichever is the anchor, so the moon renders in front whenever the two nearly overlap.
    svg += altAzBody(sunPoint, true) + altAzBody(moonPoint, false);
    // A body outside the panel, usually far below the horizon, gets the shared off-panel arrow (see offpanel.js).
    for (const [point, isSun] of [
        [sunPoint, true],
        [moonPoint, false],
    ]) {
        const arrow = offPanelArrow(point, half, unitsPerPx);
        if (arrow) svg += offPanelArrowSvg(arrow, isSun);
    }
    panel.element.innerHTML = svg;
}

// Zdog's SVG renderer scales stroke-width along with everything else in the viewBox (see the zoom comment
// above illustration's declaration): a stroke of `n` at zoom=1 renders as `n*zoom` screen pixels, so line
// weight would visibly thicken/thin as the wheel zoom changes. To keep every line's *screen* width constant
// regardless of zoom, each shape's stroke is captured here (its authored value, meant as "screen pixels at
// zoom=1") and divided by the current zoom every frame in frame() below.
const ALL_SHAPES = [
    equatorRing,
    axisLine,
    latitudeRing,
    meridianRing,
    radiusLine,
    centerDot,
    observerMarker,
    trueEclipticAxis,
    trueObliquityArc,
    trueObliquityArcSouth,
    longitudeNutationLine,
    trueEquinoxDot,
    orbitEllipse,
    atmosphereShell,
    sunDisc,
    sunCenterDot,
    ...sunRays,
    moonDisc,
    moonCenterDot,
];
const BASE_STROKE = new Map(ALL_SHAPES.map((shape) => [shape, shape.stroke]));

const stageEl = document.getElementById("stage");

// Manual drag-rotate (rather than Zdog's built-in dragRotate), since billboardRotate() needs the rotation as
// readable state, not hidden inside Zdog's Dragger.
let rotX = -0.3;
let rotY = 0.5;
let dragging = false;
let lastPointer = { x: 0, y: 0 };

stageEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastPointer = { x: e.clientX, y: e.clientY };
    stageEl.setPointerCapture(e.pointerId);
});
window.addEventListener("pointerup", () => {
    dragging = false;
});
stageEl.addEventListener("pointermove", (e) => {
    if (dragging) {
        const dx = e.clientX - lastPointer.x;
        const dy = e.clientY - lastPointer.y;
        lastPointer = { x: e.clientX, y: e.clientY };
        rotY += dx * 0.008;
        rotX += dy * 0.008;
    }
});
// preventDefault so the page itself doesn't scroll while zooming the scene; multiplicative (not additive)
// so each tick scales the current zoom rather than the raw pixel delta, keeping the feel consistent whether
// zoomed all the way in or out. Eased toward in frame() rather than applied instantly, for a soft feel.
stageEl.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        targetZoomFactor = Math.min(ZOOM_FACTOR_MAX, Math.max(ZOOM_FACTOR_MIN, targetZoomFactor * 1.0015 ** -e.deltaY));
    },
    { passive: false },
);

function frame() {
    zoomFactor += (targetZoomFactor - zoomFactor) * 0.15;
    illustration.zoom = baseZoom * zoomFactor;
    illustration.setSize(stageWidth, stageHeight);
    for (const shape of ALL_SHAPES) shape.stroke = BASE_STROKE.get(shape) / illustration.zoom;

    // Read once per animation frame from the shared state (see state.js), so the scene follows every set of controls.
    const { jd, latitude, longitude } = state;
    const time = precise.fromJulianDay(jd);

    const sunEqu = precise.sun.apparentPosition(jd);
    const moonEqu = precise.moon.apparentPosition(jd);
    const siderealTime = precise.siderealTime(time);
    const obliquity = precise.earth.trueObliquity(jd);

    const sunPos = sphericalToVector(sunEqu.rightAscension, sunEqu.declination, SUN_DIST);
    const moonPos = sphericalToVector(moonEqu.rightAscension, moonEqu.declination, MOON_DIST);
    const observerRa = siderealTime + longitude;
    const observerPos = sphericalToVector(observerRa, latitude, EARTH_R);

    const sunHorizontal = precise.sun.horizontalPosition(time, latitude, longitude);
    const moonHorizontal = precise.moon.horizontalPosition(time, latitude, longitude);
    // The locked views show sunrise and sunset to the second, so their altitudes are over the visible horizon: lifted by
    // refraction, the horizon lowered by the observer's height (see horizon.js). The horizon line stays where it is.
    const overHorizon = (h) => ({ ...h, altitude: aboveVisibleHorizon(h.altitude, state.heightM) });
    const sunSeen = overHorizon(sunHorizontal);
    const moonSeen = overHorizon(moonHorizontal);
    updateAltAzPanel(sunView, sunSeen, moonSeen);
    updateAltAzPanel(moonView, moonSeen, sunSeen);

    sunAnchor.translate = sunPos;
    sunDisc.rotate = billboardRotate(rotX, rotY);
    sunDisc.diameter = APPARENT_SIZE_SCALE * precise.sun.apparentAngularDiameter(jd) * precise.RAD_TO_DEG;
    sunDisc.updatePath();
    const sunRayInner = sunDisc.diameter / 2 + SUN_RAY_GAP;
    const sunRayOuter = sunRayInner + SUN_RAY_LENGTH;
    sunRays.forEach((ray, i) => {
        const rayAngle = (i / SUN_RAY_COUNT) * 2 * Math.PI;
        const cosA = Math.cos(rayAngle);
        const sinA = Math.sin(rayAngle);
        ray.rotate = billboardRotate(rotX, rotY);
        ray.path = [v(sunRayInner * cosA, sunRayInner * sinA, 0), v(sunRayOuter * cosA, sunRayOuter * sinA, 0)];
        ray.updatePath();
    });
    moonAnchor.translate = moonPos;
    moonDisc.rotate = billboardRotate(rotX, rotY);
    moonDisc.diameter = APPARENT_SIZE_SCALE * precise.moon.apparentAngularDiameter(jd) * precise.RAD_TO_DEG;
    moonDisc.updatePath();
    atmosphereShell.rotate = billboardRotate(rotX, rotY);
    // observerPos already has magnitude EARTH_R (sphericalToVector's radius arg), so this only needs a
    // plain 1.02x nudge above the surface, not a divide-by-EARTH_R (that previously collapsed the whole
    // vector down to magnitude ~1, putting the dot at the center instead of on the sphere).
    observerMarker.translate = vScale(observerPos, 1.02);
    latitudeRing.diameter = 2 * EARTH_R * Math.cos(latitude * DEG);
    latitudeRing.translate = { y: -EARTH_R * Math.sin(latitude * DEG) };
    latitudeRing.updatePath();
    meridianRing.rotate = { y: observerRa * DEG };
    radiusLine.path[1] = observerPos;
    radiusLine.updatePath();

    // Same rotate-the-Y-axis-by-obliquity-about-X derivation the ecliptic-plane ring used, applied to just
    // the pole direction instead of a whole ring.
    const eclipticPoleAt = (obliquityDeg) =>
        v(0, -Math.cos(obliquityDeg * DEG) * EARTH_R, Math.sin(obliquityDeg * DEG) * EARTH_R);
    const truePole = eclipticPoleAt(obliquity);
    trueEclipticAxis.path[0] = vScale(truePole, -1);
    trueEclipticAxis.path[1] = truePole;
    trueEclipticAxis.updatePath();

    const OBLIQUITY_ARC_SEGMENTS = 16;
    const northArcPath = Array.from({ length: OBLIQUITY_ARC_SEGMENTS + 1 }, (_, i) =>
        eclipticPoleAt((obliquity * i) / OBLIQUITY_ARC_SEGMENTS),
    );
    trueObliquityArc.path = northArcPath;
    trueObliquityArc.updatePath();
    trueObliquityArcSouth.path = northArcPath.map((p) => vScale(p, -1));
    trueObliquityArcSouth.updatePath();

    // The true equinox, shifted from the mean one (our +X axis) by longitudeNutation within the equatorial
    // plane; marked on the equator's surface (dec 0) rather than at the pole, since that's what "longitude"
    // (as opposed to obliquity, an angle *between* poles) refers to here.
    const longitudeNutation = precise.earth.longitudeNutation(jd);
    const trueEquinoxPoint = sphericalToVector(longitudeNutation, 0, EARTH_R);
    longitudeNutationLine.path[0] = sphericalToVector(0, 0, EARTH_R);
    longitudeNutationLine.path[1] = trueEquinoxPoint;
    longitudeNutationLine.updatePath();
    trueEquinoxDot.translate = vScale(trueEquinoxPoint, 1.02);

    const orbitEccentricity = precise.earth.orbitEccentricity(jd);
    orbitEllipse.width = 2 * SUN_DIST;
    orbitEllipse.height = 2 * SUN_DIST * Math.sqrt(1 - orbitEccentricity * orbitEccentricity);
    orbitEllipse.rotate = { x: Math.PI / 2 + obliquity * DEG };
    orbitEllipse.updatePath();

    illustration.rotate = { x: rotX, y: rotY, z: 0 };
    illustration.updateRenderGraph();
    annotateObserver(vScale(observerPos, 1.02));
    // svgElement only exists once a shape has rendered at least once, hence setting this here rather than
    // at construction; idempotent, so doing it every frame is fine. See the earthAnchor comment for the
    // three-tier rationale. radiusLine and longitudeNutationLine are deliberately left alone here: each is itself
    // an answer, so solid, the default; orbitEllipse joins the dotted fixed-reference tier instead, next to the
    // equator/axis/ecliptic-pole lines it's drawn alongside.
    // Dash lengths are in the same scene-space units as everything else, so without this they'd suffer the
    // same zoom-dependent-thickening problem stroke width did (see BASE_STROKE): the dot/gap length would
    // stay fixed in scene units while the viewBox shrinks, so each dot would visibly grow as you zoom in,
    // with the same fixed count around a given circle's fixed circumference. Dividing by zoom keeps each
    // dot's *screen* size constant, which means more of them fit around the same circumference as you zoom
    // in, i.e. dot density increases with zoom, matching finer scale with finer dotting.
    const dotDash = `${0.1 / illustration.zoom},${4 / illustration.zoom}`;
    const lineDash = `${3 / illustration.zoom},${3 / illustration.zoom}`;
    // Larger dashes (no dots): distinguishes the sun's orbit from the plain-dotted fixed-reference tier
    // (atmosphereShell, the earth rings, etc.), since it's worth a visually distinct line style, not
    // another dotted ring easily lost among the others.
    const dashDot = `${4 / illustration.zoom},${8 / illustration.zoom}`;
    for (const shape of [
        equatorRing,
        axisLine,
        trueEclipticAxis,
        trueObliquityArc,
        trueObliquityArcSouth,
        atmosphereShell,
        moonDisc,
        ...sunRays,
    ]) {
        shape.svgElement?.setAttribute("stroke-dasharray", dotDash);
        shape.svgElement?.setAttribute("stroke-linecap", "round");
    }
    orbitEllipse.svgElement?.setAttribute("stroke-dasharray", dashDot);
    orbitEllipse.svgElement?.setAttribute("stroke-linecap", "round");
    latitudeRing.svgElement?.setAttribute("stroke-dasharray", lineDash);
    meridianRing.svgElement?.setAttribute("stroke-dasharray", lineDash);

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// "observer": a label outside Earth, in the observer's direction on screen, with a straight arrow to the marker.
// Placed by projecting the marker the way Zdog does: rotated with the scene, scaled by the zoom, around the center.
const ANNOTATION_GAP_PX = 70;
const ANNOTATION_TIP_GAP_PX = 7;
const annotationLabel = document.querySelector('.scene-annotation[data-annotation="observer"]');
const annotationArrow = document.querySelector('.annotation-arrow[data-annotation="observer"]');
const annotationHead = document.querySelector('.annotation-arrowhead[data-annotation="observer"]');

function annotateObserver(point) {
    const p = new Vector(point).rotate(illustration.rotate);
    const zoom = illustration.zoom;
    const [cx, cy] = [stageWidth / 2, stageHeight / 2];
    const [px, py] = [cx + p.x * zoom, cy + p.y * zoom];
    const length = Math.hypot(p.x, p.y) || 1;
    const [ux, uy] = length > 1e-3 ? [p.x / length, p.y / length] : [0, -1];
    const reach = EARTH_R * zoom + ANNOTATION_GAP_PX;
    const [lx, ly] = [cx + ux * reach, cy + uy * reach];
    annotationLabel.style.left = `${lx}px`;
    annotationLabel.style.top = `${ly}px`;
    // A straight line from just short of the label to just short of the marker.
    const [sx, sy] = [lx - ux * 12, ly - uy * 12];
    const toTip = Math.hypot(px - sx, py - sy) || 1;
    const [dx, dy] = [(px - sx) / toTip, (py - sy) / toTip];
    const [tx, ty] = [px - dx * ANNOTATION_TIP_GAP_PX, py - dy * ANNOTATION_TIP_GAP_PX];
    annotationArrow.setAttribute("d", `M ${sx} ${sy} L ${tx} ${ty}`);
    const [hx, hy] = [tx - dx * 7, ty - dy * 7];
    annotationHead.setAttribute(
        "points",
        `${tx},${ty} ${hx - dy * 3.5},${hy + dx * 3.5} ${hx + dy * 3.5},${hy - dx * 3.5}`,
    );
}

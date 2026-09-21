import * as precise from "../dist/index.js";

const { Illustration, Anchor, Shape, Ellipse } = window.Zdog;
const DEG = Math.PI / 180;

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
const PAGE_ACCENT = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#007fff";

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
    color: "#000",
    stroke: 1,
    fill: false,
});
const axisLine = new Shape({
    addTo: earthAnchor,
    path: [v(0, -EARTH_R, 0), v(0, EARTH_R, 0)],
    stroke: 1,
    color: "#000",
});
// The observer's own latitude/meridian rings: where they are right now.
const latitudeRing = new Ellipse({
    addTo: earthAnchor,
    diameter: 2 * EARTH_R,
    rotate: { x: Math.PI / 2 },
    color: "#000",
    stroke: 1,
    fill: false,
});
const meridianRing = new Ellipse({ addTo: earthAnchor, diameter: 2 * EARTH_R, color: "#000", stroke: 1, fill: false });
// The radius from center to the observer: the concrete result, solid.
const radiusLine = new Shape({ addTo: earthAnchor, path: [v(0, 0, 0), v(0, 0, 0)], stroke: 1, color: "#000" });
// Earth's center, so the radius line has a visible point of origin to read from.
const centerDot = new Shape({ addTo: earthAnchor, stroke: 3, color: "#000" });
// The two rings cross at two antipodal points; this marks which one is actually the observer.
const observerMarker = new Shape({ addTo: earthAnchor, stroke: 7, color: "#000", translate: { z: 0.1 } });
// Ecliptic pole: the celestial pole (the solid vertical axis) rotated by obliquity about the X axis (the
// vernal equinox, our +X axis, is the ascending node of one plane on the other) — true and mean obliquity
// give slightly different angles, hence two lines; obliquityNutationLine is just the (tiny) gap between
// their pole tips, the nutation itself made visible rather than left as a number.
const trueEclipticAxis = new Shape({ addTo: earthAnchor, path: [v(0, 0, 0), v(0, 0, 0)], stroke: 1, color: "#000" });
const meanEclipticAxis = new Shape({ addTo: earthAnchor, path: [v(0, 0, 0), v(0, 0, 0)], stroke: 1, color: "#000" });
// The tilt itself, as a swept arc from the celestial pole to the true ecliptic pole, rather than a straight
// chord between them: a curve reads as "this many degrees of angle" more directly than a line does. Both
// axes extend through the origin in both directions (north and south pole), so the arc is mirrored too:
// trueObliquityArc for the north side, trueObliquityArcSouth for the (identical, negated) south side.
const trueObliquityArc = new Shape({ addTo: earthAnchor, path: [v(0, 0, 0)], closed: false, stroke: 1, color: "#000" });
const trueObliquityArcSouth = new Shape({
    addTo: earthAnchor,
    path: [v(0, 0, 0)],
    closed: false,
    stroke: 1,
    color: "#000",
});
// meanObliquity gets no arc of its own: it differs from trueObliquity by only the nutation wobble (a few
// arcseconds), so a second arc swept from the same 0deg baseline would sit almost perfectly on top of
// trueObliquityArc, reading as one arc doubled/darkened rather than two distinct ones. Its own axis line is
// enough to mark "the tilted axis"; the angle itself is read off trueObliquityArc.
const obliquityNutationLine = new Shape({
    addTo: earthAnchor,
    path: [v(0, 0, 0), v(0, 0, 0)],
    stroke: 1,
    color: "#000",
});
// Longitude nutation: the true equinox (where RA is actually measured from right now) wanders a little
// from the mean/fixed one (our +X axis) within the equatorial plane; marked on the equator ring's surface.
const longitudeNutationLine = new Shape({
    addTo: earthAnchor,
    path: [v(0, 0, 0), v(0, 0, 0)],
    stroke: 1,
    color: "#000",
});
const trueEquinoxDot = new Shape({ addTo: earthAnchor, stroke: 3, color: "#000" });
// Earth's (equivalently, from here, the sun's apparent) orbital ellipse, real eccentricity (~0.0167), so
// this will read as very nearly circular, which is itself the honest answer. Centered on Earth rather than
// offset to the correct focus: that needs the orbit's orientation (longitude of perihelion), which nothing
// in this codebase computes, so this shows the shape/flatness, not the correct sun-at-focus positioning.
const orbitEllipse = new Ellipse({
    addTo: earthAnchor,
    rotate: { x: Math.PI / 2 },
    color: "#000",
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
// treatment, which is oriented toward Earth, not the camera. Plain black, same as everything else:
// yellow/grey didn't read well against the dotted stroke at this size.
const sunDisc = new Ellipse({ addTo: sunAnchor, diameter: SUN_R * 2, color: "#000", stroke: 1, fill: false });
// Mirrors earthAnchor's centerDot: a fixed point at the body's own center, so apparentPosition/distance rows
// have an exact point to highlight rather than only the disc's outline.
const sunCenterDot = new Shape({ addTo: sunAnchor, stroke: 3, color: "#000" });

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
    () => new Shape({ addTo: sunAnchor, path: [v(0, 0, 0), v(0, 0, 0)], stroke: 1, color: "#000" }),
);

const moonAnchor = new Anchor({ addTo: illustration });
const moonDisc = new Ellipse({
    addTo: moonAnchor,
    diameter: APPARENT_SIZE_SCALE * precise.moon.apparentAngularDiameter(precise.J2000) * precise.RAD_TO_DEG,
    color: "#000",
    stroke: 1,
    fill: false,
});
const moonCenterDot = new Shape({ addTo: moonAnchor, stroke: 3, color: "#000" });

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
// The horizon's fixed screen height, in panel-local pixels (0 = panel center, positive = downward): reused
// both to draw the horizon line itself and to place the caption below it (see makeAltAzPanel).
const ALTAZ_HORIZON_Y = -tangentPx(-ALTAZ_LOOK_UP_DEG);
const ALTAZ_DOT_DIAMETER = 10;
// Mini versions of the main scene's sunrays (see SUN_RAY_COUNT above): cheaper to read at a glance than an
// "S"/"M" text label, and reuses a motif the viewer already knows means "this one's the sun" from the main
// scene, rather than introducing a new convention.
const ALTAZ_SUN_RAY_COUNT = 8;
const ALTAZ_SUN_RAY_GAP = 3;
const ALTAZ_SUN_RAY_LENGTH = 5;

// A fixed per-species look, regardless of anchor/other role: the sun is a solid-outlined, unfilled ring plus
// rays (below); the moon is a plain solid black disc. The anchor/other role is instead legible from position
// alone (the anchor always sits at dead-center, see updateAltAzPanel), so it doesn't need its own styling too.
function makeAltAzDot(panelIllustration, isSun) {
    const dot = new Ellipse({
        addTo: panelIllustration,
        diameter: ALTAZ_DOT_DIAMETER,
        color: "#000",
        stroke: 1,
        fill: !isSun,
    });
    const rays = isSun
        ? Array.from(
              { length: ALTAZ_SUN_RAY_COUNT },
              () => new Shape({ addTo: panelIllustration, path: [v(0, 0, 0), v(0, 0, 0)], stroke: 1, color: "#000" }),
          )
        : [];
    return { dot, rays, isSun };
}

function makeAltAzPanel(elementSelector, anchorIsSun) {
    // Appended here (not hardcoded in index.html) so the caption can never drift out of sync with
    // ALTAZ_FIELD_OF_VIEW_DEG above.
    const caption = document.querySelector(elementSelector).closest(".altaz-panel")?.querySelector(".altaz-caption");
    if (caption) {
        caption.textContent += ` (${ALTAZ_FIELD_OF_VIEW_DEG}° FOV)`;
        // Directly below the horizon line itself (a small fixed gap under it), in the part of the view below
        // the ground, the least useful part of the picture (an observer never looks there), so the caption
        // goes where it displaces the least without drifting far from the line it's labeling.
        const horizonTopPercent = ((ALTAZ_PANEL_SIZE / 2 + ALTAZ_HORIZON_Y) / ALTAZ_PANEL_SIZE) * 100;
        caption.style.top = `calc(${horizonTopPercent}% + 0.3rem)`;
    }
    const panelIllustration = new Illustration({ element: elementSelector, zoom: 1 });
    panelIllustration.setSize(ALTAZ_PANEL_SIZE, ALTAZ_PANEL_SIZE);
    // Fixed forever at this height (see ALTAZ_LOOK_UP_DEG above): unlike the two dots, never touched in
    // updateAltAzPanel. PAGE_ACCENT rather than black: the one line in these panels worth calling out as
    // "the ground", distinct from the two bodies.
    const horizon = new Shape({
        addTo: panelIllustration,
        path: [v(-1e5, ALTAZ_HORIZON_Y, 0), v(1e5, ALTAZ_HORIZON_Y, 0)],
        stroke: 1,
        color: PAGE_ACCENT,
    });
    // The sun's shapes are always added before the moon's, regardless of which one plays anchor/other in
    // this panel, so the moon renders on top whenever the two nearly overlap (an occultation/eclipse should
    // show the moon in front), not whichever body happens to be this panel's anchor.
    const sunDot = makeAltAzDot(panelIllustration, true);
    const moonDot = makeAltAzDot(panelIllustration, false);
    const anchor = anchorIsSun ? sunDot : moonDot;
    const other = anchorIsSun ? moonDot : sunDot;
    return { illustration: panelIllustration, horizon, anchor, other };
}
const sunView = makeAltAzPanel("#sunView", true);
const moonView = makeAltAzPanel("#moonView", false);

// Signed azimuth difference wrapped to [-180, 180]: the shorter way around the compass, so a moon just west
// of due north relative to a sun just east of it reads as a small gap, not a ~360-degree one.
function azimuthDelta(fromAzimuth, toAzimuth) {
    return ((((toAzimuth - fromAzimuth) % 360) + 540) % 360) - 180;
}

function updateAltAzDotRays(dotEntry, center) {
    if (dotEntry.rays.length === 0) return;
    const inner = ALTAZ_DOT_DIAMETER / 2 + ALTAZ_SUN_RAY_GAP;
    const outer = inner + ALTAZ_SUN_RAY_LENGTH;
    dotEntry.rays.forEach((ray, i) => {
        const angle = (i / dotEntry.rays.length) * 2 * Math.PI;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        ray.path = [
            v(center.x + inner * cosA, center.y + inner * sinA, 0),
            v(center.x + outer * cosA, center.y + outer * sinA, 0),
        ];
        ray.updatePath();
    });
}

function updateAltAzPanel(panel, anchorHorizontal, otherHorizontal) {
    // Anchor: x=0 by construction (it defines this panel's azimuth origin); y from its own true altitude
    // (shifted by ALTAZ_LOOK_UP_DEG, same as the horizon), tangent-mapped like everything else, so it moves
    // like any other point, not locked to panel center.
    const anchorPoint = { x: 0, y: -tangentPx(anchorHorizontal.altitude - ALTAZ_LOOK_UP_DEG) };
    const dAz = azimuthDelta(anchorHorizontal.azimuth, otherHorizontal.azimuth);
    const otherPoint = { x: tangentPx(dAz), y: -tangentPx(otherHorizontal.altitude - ALTAZ_LOOK_UP_DEG) };
    panel.anchor.dot.translate = anchorPoint;
    panel.other.dot.translate = otherPoint;
    updateAltAzDotRays(panel.anchor, anchorPoint);
    updateAltAzDotRays(panel.other, otherPoint);
    panel.illustration.updateRenderGraph();
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
    meanEclipticAxis,
    trueObliquityArc,
    trueObliquityArcSouth,
    obliquityNutationLine,
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
// jd/latitude/longitude are index.html's own toolbar inputs (index.js owns writing to them: "now",
// "live", geolocate); this scene only ever reads their current value, once per animation frame, so it
// stays in sync with whatever drives them without needing its own copy of that wiring.
const jdInput = document.getElementById("jd");
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");

// Manual drag-rotate (rather than Zdog's built-in dragRotate); also used by billboardRotate() and to
// hit-test hover, so it needs to be readable state, not hidden inside Zdog's Dragger.
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

// The reverse direction: index.js dispatches this when the pointer enters/leaves an inspector table row, so
// hovering a row highlights (see HIGHLIGHTABLE/SHAPE_MAP below) the scene element(s) it corresponds to.
let hovered = null;
window.addEventListener("inspector:hover", (event) => {
    hovered = event.detail;
});

// A dedicated magenta for scene highlights, distinct from the page's azure --accent: blue is easy to lose
// against the scene's own accent-colored atmosphere shell and dark strokes, magenta reads clearly against both.
const HIGHLIGHT_COLOR = "#e6007e";
// Maps a hovered row's domain + export name to the exact shape(s) it represents in the scene, so hovering
// highlights precisely what that row draws rather than the whole body. Field-level rows (e.g.
// apparentPosition.rightAscension) key on just the name, same shapes regardless of which field.
const SHAPE_MAP = {
    "earth.MEAN_RADIUS_KM": [equatorRing],
    "earth.ATMOSPHERE_THICKNESS_KM": [atmosphereShell],
    "earth.longitudeNutation": [longitudeNutationLine, trueEquinoxDot],
    // An obliquity is the angle *between* two axes, so the rotation axis highlights alongside the tilted
    // ecliptic axis; no arc for meanObliquity specifically, see the comment at its declaration.
    "earth.meanObliquity": [axisLine, meanEclipticAxis],
    "earth.trueObliquity": [axisLine, trueEclipticAxis, trueObliquityArc, trueObliquityArcSouth],
    "earth.obliquityNutation": [obliquityNutationLine, meanEclipticAxis, trueEclipticAxis],
    "earth.orbitEccentricity": [orbitEllipse],
    "earth.siderealTime": [meridianRing, radiusLine, observerMarker],
    "sun.apparentPosition": [sunCenterDot],
    "sun.distance": [sunDisc, ...sunRays],
    "moon.apparentPosition": [moonCenterDot],
    "moon.distance": [moonDisc],
};
// Every highlightable shape, paired with its resting (non-hovered) color, restored each frame before that
// frame's highlight (if any) is applied on top. The atmosphere shell rests at the page's own accent color,
// its permanent, always-on look; everything else defaults to plain black.
const REST_COLORS = new Map([[atmosphereShell, PAGE_ACCENT]]);
const HIGHLIGHTABLE = [...new Set(Object.values(SHAPE_MAP).flat())].map((shape) => [
    shape,
    REST_COLORS.get(shape) ?? "#000",
]);

function frame() {
    zoomFactor += (targetZoomFactor - zoomFactor) * 0.15;
    illustration.zoom = baseZoom * zoomFactor;
    illustration.setSize(stageWidth, stageHeight);
    for (const shape of ALL_SHAPES) shape.stroke = BASE_STROKE.get(shape) / illustration.zoom;

    const jd = Number(jdInput.value);
    const latitude = Number(latitudeInput.value);
    const longitude = Number(longitudeInput.value);
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
    updateAltAzPanel(sunView, sunHorizontal, moonHorizontal);
    updateAltAzPanel(moonView, moonHorizontal, sunHorizontal);

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

    const meanObliquity = precise.earth.meanObliquity(jd);
    const meanPole = eclipticPoleAt(meanObliquity);
    meanEclipticAxis.path[0] = vScale(meanPole, -1);
    meanEclipticAxis.path[1] = meanPole;
    meanEclipticAxis.updatePath();

    obliquityNutationLine.path[0] = meanPole;
    obliquityNutationLine.path[1] = truePole;
    obliquityNutationLine.updatePath();

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

    // Table row -> scene only; no reverse direction (hovering the scene doesn't highlight a table row). A
    // row hover with no dedicated SHAPE_MAP entry highlights nothing at all, rather than falling back to
    // "the whole body": that fallback used to make every earth row look like it does something, when most
    // don't draw anything specific.
    const activeShapes = (hovered && SHAPE_MAP[`${hovered.domain}.${hovered.name}`]) ?? [];
    for (const [shape, restColor] of HIGHLIGHTABLE)
        shape.color = activeShapes.includes(shape) ? HIGHLIGHT_COLOR : restColor;

    illustration.rotate = { x: rotX, y: rotY, z: 0 };
    illustration.updateRenderGraph();
    // svgElement only exists once a shape has rendered at least once, hence setting this here rather than
    // at construction; idempotent, so doing it every frame is fine. See the earthAnchor comment for the
    // three-tier rationale. radiusLine, obliquityNutationLine, and longitudeNutationLine are deliberately
    // left alone here: each is itself the "answer" its checkbox reveals, so solid, the default, same as
    // radiusLine's tier; orbitEllipse joins the dotted fixed-reference tier instead, next to the
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
        meanEclipticAxis,
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

    // The alt-az panels have their own fixed zoom (never changes, see makeAltAzPanel), so their dash lengths
    // need no zoom-compensation the way the main scene's dotDash/lineDash above do. Only the sun's rays are
    // dashed; both dots are always solid outlines now (see makeAltAzDot).
    for (const panel of [sunView, moonView]) {
        for (const ray of panel.anchor.rays) ray.svgElement?.setAttribute("stroke-dasharray", "0.1,3");
        for (const ray of panel.other.rays) ray.svgElement?.setAttribute("stroke-dasharray", "0.1,3");
    }

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

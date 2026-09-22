import * as precise from "@himmel/sternzeit";
import Zdog from "zdog";
import { COMPASS, cssColor, labelAboveY, svgText } from "./figure.js";
import { aboveVisibleHorizon } from "./horizon.js";
import { onChange, state } from "./state.js";
import "./export.js";

const { Illustration, Anchor, Shape, Ellipse, Vector } = Zdog;
const DEG = precise.DEG_TO_RAD;

// The sky dome's radius in scene units; the whole scene is zoomed to fit its frame.
const R = 100;
// Paths cover the local mean solar day of the chosen moment, midnight to midnight, sampled every 10 minutes: one dot
// per hour on the Sun's.
const SAMPLES_PER_HOUR = 6;
const HOURS = 24;
// The analemma: the Sun at the same time of day, on every day of the half year before and after the moment.
const ANALEMMA_DAYS = 182;
// Dots along the analemma every this many days, so its uneven speed shows.
const ANALEMMA_TICK_DAYS = 14;
// Half the analemma panel's width in degrees; its height always spans the full 180 degrees from zenith to nadir.
const ANALEMMA_HALF_WIDTH = 35;
// The view is kept above the horizon plane (the ground layer only veils what is below it from above).
const TILT_MIN = -85 * DEG;
const TILT_MAX = -8 * DEG;
const DRAG_RADIANS_PER_PX = 0.008;

const INK = cssColor("--text", "#d6dae3");
const MUTED = cssColor("--muted", "#8a92a3");
const SURFACE = cssColor("--surface", "#12151c");
const ACCENT = cssColor("--accent", "#5aa9ff");

const frameEl = document.querySelector(".dome-scene");
const compassEl = frameEl.querySelector(".dome-compass");
const analemmaSvg = frameEl.querySelector(".analemma-panel > svg");
const analemmaNote = frameEl.querySelector('[data-field="analemmaNote"]');

// Stroke widths and dash patterns in screen pixels; converted to scene units whenever the zoom changes.
const styles = new Map();
const DOTTED = [0.1, 4];
const DASHED = [3, 3];
let zoom = 1;
let stageWidth = 0;
let stageHeight = 0;
// Seen from the southeast and a little above, so a day arc, a circle tilted towards the south, shows as an ellipse.
const rotation = { x: -20 * DEG, y: 40 * DEG, z: 0 };

function styled(shape, strokePx, dash = null) {
    styles.set(shape, { strokePx, dash });
    shape.stroke = strokePx / zoom;
    return shape;
}

// Zdog sorts shapes by their center only, which gets a dome's near and far sides wrong. Three stacked illustrations
// sort by construction instead: whatever is below the horizon, the translucent ground, whatever is above.
function layer(name) {
    return new Illustration({
        element: frameEl.querySelector(`.dome-layer[data-layer="${name}"]`),
        resize: true,
        rotate: rotation,
        onResize: function (width, height) {
            stageWidth = width;
            stageHeight = height;
            zoom = Math.min(width / 2 / (R * 1.35), height / 2 / (R * 1.1));
            this.zoom = zoom;
            this.setSize(width, height);
            for (const [shape, { strokePx }] of styles) shape.stroke = strokePx / zoom;
        },
    });
}
const below = layer("below");
const ground = layer("ground");
const above = layer("above");
const layers = [below, ground, above];

// Every altitude here is over the visible horizon, as in the other figures: lifted by refraction, the horizon lowered by
// the observer's height (see horizon.js). So rising and setting line up with the horizon ring and line to the second.
function seen(body, time, latitude, longitude) {
    const horizontal = body.horizontalPosition(time, latitude, longitude);
    return { ...horizontal, altitude: aboveVisibleHorizon(horizontal.altitude, state.heightM) };
}

// ENU to Zdog, which is y down and z towards the viewer: x east, y up (negated), z north (negated, away from the viewer).
function skyPoint(horizontal, radius = R) {
    const [e, n, u] = precise.horizontalToDirection(horizontal);
    return { x: e * radius, y: -u * radius, z: -n * radius };
}

// Fixed references: the ground and the horizon, and dotted, two altitude circles, the meridian and the prime vertical.
new Ellipse({ addTo: ground, diameter: 2 * R, rotate: { x: Math.PI / 2 }, color: SURFACE, fill: true, stroke: false });
styled(new Ellipse({ addTo: ground, diameter: 2 * R, rotate: { x: Math.PI / 2 }, color: ACCENT }), 1);
for (const altitude of [30, 60]) {
    const ring = new Ellipse({
        addTo: above,
        diameter: 2 * R * Math.cos(altitude * DEG),
        translate: { y: -R * Math.sin(altitude * DEG) },
        rotate: { x: Math.PI / 2 },
        color: MUTED,
    });
    styled(ring, 1, DOTTED);
}
// Half a great circle from the horizon at `azimuth` over the zenith to the opposite horizon.
const overhead = (azimuth) =>
    Array.from({ length: 37 }, (_, i) =>
        skyPoint(i <= 18 ? { azimuth, altitude: i * 5 } : { azimuth: azimuth + 180, altitude: 180 - i * 5 }),
    );
styled(new Shape({ addTo: above, path: overhead(0), closed: false, color: MUTED }), 1, DOTTED);
styled(new Shape({ addTo: above, path: overhead(90), closed: false, color: MUTED }), 1, DOTTED);
styled(new Shape({ addTo: above, color: INK }), 4);

// The day's paths and the two bodies, rebuilt whenever the moment or place changes.
const dynamic = [new Anchor({ addTo: below }), new Anchor({ addTo: above })];

const compassLabels = COMPASS.map((text, i) => {
    const label = document.createElement("span");
    label.className = "dome-compass-label";
    label.dataset.exportText = "";
    label.textContent = text;
    compassEl.append(label);
    return { label, point: skyPoint({ azimuth: i * 45, altitude: 0 }, R * 1.12) };
});

/** Julian Day of local mean solar noon on the moment's day: JDs are integers at noon UT, shifted by the longitude. */
const localNoon = (jd, longitude) => Math.round(jd + longitude / 360) - longitude / 360;

function samplePath(body, noon, latitude, longitude) {
    const count = HOURS * SAMPLES_PER_HOUR;
    return Array.from({ length: count + 1 }, (_, i) =>
        seen(body, precise.fromJulianDay(noon + (i - count / 2) / count), latitude, longitude),
    );
}

/** Splits a path into runs above and below the horizon; consecutive runs share their boundary sample. */
function runsByHorizon(samples) {
    const runs = [];
    for (const sample of samples) {
        const up = sample.altitude >= 0;
        const last = runs.at(-1);
        if (last?.up === up) last.samples.push(sample);
        else runs.push({ up, samples: last ? [last.samples.at(-1), sample] : [sample] });
    }
    return runs;
}

const anchorFor = (altitude) => dynamic[altitude >= 0 ? 1 : 0];

function addPath(samples, color, strokePx, dashBelow) {
    for (const run of runsByHorizon(samples)) {
        const path = run.samples.map((s) => skyPoint(s));
        const shape = new Shape({ addTo: dynamic[run.up ? 1 : 0], path, closed: false, color });
        styled(shape, strokePx, run.up ? null : dashBelow);
    }
}

// Arrowheads along each path, pointing forward in time: one every 6 hours, starting at 3 in the morning.
const ARROW_EVERY = 6 * SAMPLES_PER_HOUR;
const ARROW_OFFSET = 3 * SAMPLES_PER_HOUR;
const ARROW_LENGTH = 6;
const ARROW_HALF_WIDTH = 3;

/** A flat arrowhead at sample `i`, lying in the dome's surface and pointing towards sample `i + 1`. */
function addArrow(samples, i, color) {
    const tip = skyPoint(samples[i]);
    const next = skyPoint(samples[i + 1]);
    const d = new Vector(next).subtract(tip);
    d.multiply(1 / d.magnitude());
    // Perpendicular to both the path and the radius: sideways within the dome's surface.
    const side = new Vector({
        x: d.y * tip.z - d.z * tip.y,
        y: d.z * tip.x - d.x * tip.z,
        z: d.x * tip.y - d.y * tip.x,
    });
    side.multiply(ARROW_HALF_WIDTH / side.magnitude());
    const back = new Vector(tip).subtract(new Vector(d).multiply(ARROW_LENGTH));
    const path = [tip, new Vector(back).add(side), new Vector(back).subtract(side)];
    styled(new Shape({ addTo: anchorFor(samples[i].altitude), path, fill: true, color }), 1);
}

function addArrows(samples, color) {
    for (let i = ARROW_OFFSET; i < samples.length - 1; i += ARROW_EVERY) addArrow(samples, i, color);
}

function addDot(horizontal, color, strokePx) {
    styled(new Shape({ addTo: anchorFor(horizontal.altitude), translate: skyPoint(horizontal), color }), strokePx);
}

function rebuildPaths() {
    const { jd, latitude, longitude } = state;
    for (const anchor of dynamic) {
        for (const child of [...anchor.children]) {
            styles.delete(child);
            child.remove();
        }
    }
    const noon = localNoon(jd, longitude);
    const sunSamples = samplePath(precise.sun, noon, latitude, longitude);
    const moonSamples = samplePath(precise.moon, noon, latitude, longitude);
    addPath(moonSamples, MUTED, 1, DASHED);
    addPath(sunSamples, INK, 1.5, DOTTED);
    addArrows(moonSamples, MUTED);
    addArrows(sunSamples, INK);
    sunSamples.forEach((sample, i) => {
        if (i % SAMPLES_PER_HOUR === 0 && sample.altitude >= 0) addDot(sample, INK, 4);
    });
    const time = precise.fromJulianDay(jd);
    addDot(seen(precise.moon, time, latitude, longitude), MUTED, 9);
    addDot(seen(precise.sun, time, latitude, longitude), INK, 12);
}

function renderAnalemma() {
    const { jd, latitude, longitude } = state;
    const today = seen(precise.sun, precise.fromJulianDay(jd), latitude, longitude);
    // Azimuths relative to today's, unwrapped, and shrunk by cos(altitude) so both axes are true angles on the sky.
    const points = [];
    for (let day = -ANALEMMA_DAYS; day <= ANALEMMA_DAYS; day++) {
        const { azimuth, altitude } = seen(precise.sun, precise.fromJulianDay(jd + day), latitude, longitude);
        const deltaAzimuth = ((azimuth - today.azimuth + 540) % 360) - 180;
        points.push({ day, x: deltaAzimuth * Math.cos(altitude * DEG), y: -altitude });
    }
    // A fixed scale, zenith to nadir with the horizon in the middle, so analemmas from different places compare directly.
    // The viewBox is fitted into the panel keeping its aspect ratio, so the larger of the two scales applies.
    const unitsPerPx = Math.max(
        (2 * ANALEMMA_HALF_WIDTH) / (analemmaSvg.clientWidth || 1),
        180 / (analemmaSvg.clientHeight || 1),
    );
    const xs = points.map((p) => p.x);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    analemmaSvg.setAttribute("viewBox", `${centerX - ANALEMMA_HALF_WIDTH} -90 ${2 * ANALEMMA_HALF_WIDTH} 180`);

    const f = (n) => n.toFixed(3);
    // The panel may be wider than the viewBox's aspect ratio, so the ground and lines reach well past it.
    const [left, right] = [centerX - 1000, centerX + 1000];
    let svg = `<rect x="${f(left)}" y="0" width="${f(right - left)}" height="1090" class="figure-ground"/>`;
    for (const altitude of [-60, -30, 30, 60]) {
        svg += `<line x1="${f(left)}" y1="${altitude}" x2="${f(right)}" y2="${altitude}" class="figure-grid"/>`;
    }
    svg += `<line x1="${f(left)}" y1="0" x2="${f(right)}" y2="0" class="figure-horizon"/>`;
    // The compass directions on the horizon, where the x axis is plain azimuth (cos 0 = 1), relative to today's; only
    // those that fit whole into the panel, which shows its width in pixels times unitsPerPx.
    const labelReach = ((analemmaSvg.clientWidth || 1) / 2 - 12) * unitsPerPx;
    COMPASS.forEach((label, i) => {
        const x = ((i * 45 - today.azimuth + 540) % 360) - 180;
        if (Math.abs(x - centerX) < labelReach)
            svg += svgText(x, labelAboveY(0, unitsPerPx), label, "figure-label", unitsPerPx);
    });
    svg += `<polyline points="${points.map((p) => `${f(p.x)},${f(p.y)}`).join(" ")}" class="analemma-line"/>`;
    for (const p of points) {
        if (p.day % ANALEMMA_TICK_DAYS !== 0 || p.day === 0) continue;
        svg += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="0.9" class="analemma-tick"/>`;
    }
    svg += `<circle cx="0" cy="${f(-today.altitude)}" r="2.4" class="analemma-sun"/>`;
    analemmaSvg.innerHTML = svg;
    analemmaNote.textContent = points.every((p) => p.y > 0) ? ", below the horizon at this hour" : "";
}

function placeCompass() {
    for (const { label, point } of compassLabels) {
        const p = new Vector(point).rotate(rotation);
        label.style.left = `${stageWidth / 2 + p.x * zoom}px`;
        label.style.top = `${stageHeight / 2 + p.y * zoom}px`;
        label.style.opacity = p.z < 0 ? 0.45 : 1;
    }
}

let dragFrom = null;
frameEl.addEventListener("pointerdown", (event) => {
    dragFrom = { x: event.clientX, y: event.clientY };
    frameEl.setPointerCapture(event.pointerId);
});
frameEl.addEventListener("pointermove", (event) => {
    if (!dragFrom) return;
    rotation.y -= (event.clientX - dragFrom.x) * DRAG_RADIANS_PER_PX;
    rotation.x = Math.min(
        TILT_MAX,
        Math.max(TILT_MIN, rotation.x - (event.clientY - dragFrom.y) * DRAG_RADIANS_PER_PX),
    );
    dragFrom = { x: event.clientX, y: event.clientY };
});
frameEl.addEventListener("pointerup", () => {
    dragFrom = null;
});

function frame() {
    for (const illustration of layers) {
        illustration.rotate.set(rotation);
        illustration.updateRenderGraph();
    }
    for (const [shape, { dash }] of styles) {
        if (!dash || !shape.svgElement) continue;
        shape.svgElement.setAttribute("stroke-dasharray", `${dash[0] / zoom},${dash[1] / zoom}`);
        shape.svgElement.setAttribute("stroke-linecap", "round");
    }
    placeCompass();
    requestAnimationFrame(frame);
}

function update() {
    rebuildPaths();
    renderAnalemma();
}

onChange(update);
// The analemma's text keeps the page's small size in screen pixels, so a resized panel redraws it.
new ResizeObserver(renderAnalemma).observe(analemmaSvg);
update();
requestAnimationFrame(frame);

import * as precise from "@himmel/sternzeit";
import { svgText, topLabelY } from "./figure.js";
import { aboveVisibleHorizon } from "./horizon.js";
import { offPanelArrowFromCenter } from "./offpanel.js";
import { onChange, state, update } from "./state.js";

// Both panels share a 200 x 200 viewBox centered on the origin: the Sun, or the axis of Earth's shadow, sits in the middle.
const HALF = 100;
// Solar panel: the Sun's disc gets this radius, so the discs still fit when they just touch (Moon up to ~7% larger).
const SUN_RADIUS_UNITS = 30;
// Lunar panel: kilometers at the Moon's distance per unit, so the penumbra (~8,200 km) fills most of the panel.
const KM_PER_UNIT = 110;
// Off-panel bodies get the shared off-panel arrow instead (see offpanel.js), sized in screen pixels.
let unitsPerPx = 1;
// A Sun hidden completely shows its corona: a photograph of the total eclipse of 20 April 2023 from Exmouth, Western
// Australia (modified from one by Phil Hart). Its black disc is laid exactly over the Sun's;
// screen-blended so the photo's black adds nothing to the panel, and faded out towards its edges so the square never shows.
const CORONA_IMAGE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/corona-2023-04-20-exmouth.webp`;
// The photo's black disc, measured in its 1254 px original: not quite centered, and a little taller than wide where the
// Moon covered the Sun off-center; its mean diameter is used.
const CORONA_PHOTO_PX = 1254;
const CORONA_DISC_CENTER_PX = [625.5, 606.5];
const CORONA_DISC_DIAMETER_PX = 419;

// The two examples the chapter text mentions, each from a place where it was visible.
const JUMPS = {
    solar: { jd: 2461265.2708333, latitude: 42.34, longitude: -3.7, live: false },
    lunar: { jd: 2457293.6173611, latitude: 52.3920607, longitude: 13.0925765, live: false },
};

let idCount = 0;

/** The corona photograph, scaled and centered so its disc covers exactly the Sun's. */
function corona() {
    const scale = (2 * SUN_RADIUS_UNITS) / CORONA_DISC_DIAMETER_PX;
    const size = CORONA_PHOTO_PX * scale;
    const [x, y] = CORONA_DISC_CENTER_PX.map((px) => -px * scale);
    const id = ++idCount;
    return `<radialGradient id="corona-fade-${id}"><stop offset="0.55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
        <mask id="corona-mask-${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" fill="url(#corona-fade-${id})"/></mask>
        <image href="${CORONA_IMAGE}" x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" mask="url(#corona-mask-${id})" class="eclipse-corona"/>`;
}
const f = (n) => n.toFixed(2);
const circle = (x, y, r, cls, extra = "") => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" class="${cls}" ${extra}/>`;

/** A body outside the panel: an arrow along the rim pointing towards it, its distance labeled at the bottom (top, if the arrow points down). */
function offPanelMoon(dx, dy) {
    // Along the direction from the panel's center (the Sun, or the shadow's axis) to the Moon, at the panel's edge.
    const arrow = offPanelArrowFromCenter({ x: dx, y: dy }, HALF, unitsPerPx);
    const points = (list) => list.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
    const [a, b] = arrow.shaft;
    return `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" class="eclipse-arrow"/>
        <polygon points="${points(arrow.head)}" class="eclipse-arrowhead"/>
        ${circle(arrow.tail.x, arrow.tail.y, arrow.tailDiameter / 2, "eclipse-arrowhead")}`;
}

function renderSolar(jd) {
    const time = precise.fromJulianDay(jd);
    const eclipse = precise.eclipse.solar(time, state.latitude, state.longitude);
    const sunAltitude = precise.sun.horizontalPosition(time, state.latitude, state.longitude).altitude;
    const sunRadiusDeg = (precise.sun.apparentAngularDiameter(jd) * precise.RAD_TO_DEG) / 2;
    const moonRadiusDeg = (precise.moon.apparentAngularDiameter(jd) * precise.RAD_TO_DEG) / 2;
    const scale = SUN_RADIUS_UNITS / sunRadiusDeg;
    const moonRadius = moonRadiusDeg * scale;

    // Position angle is measured from the zenith towards increasing azimuth, which is to the right for anyone facing the Sun.
    const angle = eclipse.positionAngle * precise.DEG_TO_RAD;
    const distance = eclipse.separation * scale;
    const [mx, my] = [Math.sin(angle) * distance, -Math.cos(angle) * distance];

    const inner = Math.abs(sunRadiusDeg - moonRadiusDeg);
    const outer = sunRadiusDeg + moonRadiusDeg;
    const total = eclipse.separation <= inner && moonRadiusDeg > sunRadiusDeg;

    let svg = "";
    if (total) {
        svg += corona();
    }
    svg += circle(0, 0, SUN_RADIUS_UNITS, "eclipse-sun");
    const onPanel = distance < HALF * Math.SQRT2 + moonRadius;
    if (onPanel) svg += circle(mx, my, moonRadius, "eclipse-moon-new");

    // The Sun sits at the center, so the visible horizon is the Sun's apparent altitude over it below; refraction lifts
    // the Sun, the observer's height lowers the horizon. The ground veils whatever is beneath.
    const sunAbove = aboveVisibleHorizon(sunAltitude, state.heightM);
    const horizon = sunAbove * scale;
    if (horizon < HALF) {
        const top = Math.max(horizon, -HALF);
        svg += `<rect x="${-HALF}" y="${f(top)}" width="${2 * HALF}" height="${f(HALF - top)}" class="eclipse-veil"/>`;
        if (horizon > -HALF)
            svg += `<line x1="${-HALF}" y1="${f(horizon)}" x2="${HALF}" y2="${f(horizon)}" class="eclipse-horizon"/>`;
        else svg += svgText(0, topLabelY(HALF, unitsPerPx), "below the horizon", "eclipse-veil-label", unitsPerPx);
    }
    if (!onPanel) svg += offPanelMoon(mx, my);

    let status;
    if (eclipse.separation <= inner) status = total ? "total, only the corona is left" : "annular";
    else if (eclipse.separation < outer) {
        const covered = (outer - eclipse.separation) / (2 * sunRadiusDeg);
        status = `partial, ${Math.round(covered * 100)}% of the Sun's diameter covered`;
    } else status = `none, the Moon is ${eclipse.separation.toFixed(1)}° away`;
    if (sunAbove < 0) status += " (the Sun is below the horizon)";
    return { svg, status };
}

function renderLunar(jd) {
    const eclipse = precise.eclipse.lunar(jd);
    const moonRadius = precise.moon.MEAN_RADIUS_KM / KM_PER_UNIT;
    const umbra = eclipse.umbraRadiusKm / KM_PER_UNIT;
    const penumbra = eclipse.penumbraRadiusKm / KM_PER_UNIT;

    // Ecliptic position angle, from north through increasing longitude (east), which is to the left on the sky.
    const angle = eclipse.positionAngle * precise.DEG_TO_RAD;
    const distance = eclipse.axisOffsetKm / KM_PER_UNIT;
    const [mx, my] = [-Math.sin(angle) * distance, -Math.cos(angle) * distance];

    const clip = `eclipse-moon-clip-${++idCount}`;
    let svg = circle(0, 0, penumbra, "eclipse-penumbra") + circle(0, 0, umbra, "eclipse-umbra");
    const onPanelLunar = distance < HALF * Math.SQRT2 + moonRadius;
    if (onPanelLunar) {
        svg += `<clipPath id="${clip}">${circle(mx, my, moonRadius, "")}</clipPath>`;
        svg += circle(mx, my, moonRadius, "eclipse-moon-full");
        // The shadow, only where it falls on the Moon: a dimming that deepens across the penumbra, then the umbra's
        // red, darkest at its center, coppery towards its edge where more sunset light reaches in.
        const [pid, uid] = [`eclipse-penumbra-shade-${idCount}`, `eclipse-umbra-red-${idCount}`];
        const edge = (umbra / penumbra).toFixed(3);
        svg += `<radialGradient id="${pid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${penumbra}">`;
        svg += `<stop offset="${edge}" class="eclipse-penumbra-inner"/><stop offset="1" class="eclipse-penumbra-outer"/></radialGradient>`;
        svg += `<radialGradient id="${uid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${umbra}">`;
        svg += `<stop offset="0" class="eclipse-umbra-core"/><stop offset="0.7" class="eclipse-umbra-mid"/>`;
        svg += `<stop offset="1" class="eclipse-umbra-rim"/></radialGradient>`;
        svg += `<g clip-path="url(#${clip})"><circle r="${penumbra}" fill="url(#${pid})"/>`;
        svg += `<circle r="${umbra}" fill="url(#${uid})"/></g>`;
    }
    const arrow = onPanelLunar ? "" : offPanelMoon(mx, my);
    svg += circle(0, 0, penumbra, "eclipse-edge") + circle(0, 0, umbra, "eclipse-edge");
    svg += svgText(0, -umbra + 9, "umbra", "eclipse-label", unitsPerPx);
    svg += svgText(0, -penumbra + 9, "penumbra", "eclipse-label", unitsPerPx);

    const km = eclipse.axisOffsetKm;
    const moonKm = precise.moon.MEAN_RADIUS_KM;
    let status;
    if (km + moonKm <= eclipse.umbraRadiusKm) status = "total, the Moon is entirely inside the umbra";
    else if (km - moonKm < eclipse.umbraRadiusKm) {
        const inside = (eclipse.umbraRadiusKm + moonKm - km) / (2 * moonKm);
        status = `partial, ${Math.round(inside * 100)}% of the Moon's diameter in the umbra`;
    } else if (km - moonKm < eclipse.penumbraRadiusKm) status = "penumbral, the Moon dims only slightly";
    else status = `none, the Moon is ${eclipse.separation.toFixed(1)}° from the shadow axis`;

    // An eclipse happens for everyone at once, but only those with the Moon above their horizon get to see it.
    const moonAltitude = precise.moon.horizontalPosition(
        precise.fromJulianDay(jd),
        state.latitude,
        state.longitude,
    ).altitude;
    if (aboveVisibleHorizon(moonAltitude, state.heightM) < 0) {
        svg += `<rect x="${-HALF}" y="${-HALF}" width="${2 * HALF}" height="${2 * HALF}" class="eclipse-veil"/>`;
        svg += svgText(0, topLabelY(HALF, unitsPerPx), "below the horizon", "eclipse-veil-label", unitsPerPx);
        status += " (the Moon is below the horizon at the chosen place)";
    }
    return { svg: svg + arrow, status };
}

const RENDERERS = { solar: renderSolar, lunar: renderLunar };
const views = document.querySelectorAll(".eclipse-view[data-kind]");

function render() {
    for (const view of views) {
        unitsPerPx = (2 * HALF) / (view.querySelector("svg").clientWidth || 2 * HALF);
        const { svg, status } = RENDERERS[view.dataset.kind](state.jd);
        view.querySelector("svg").innerHTML = svg;
        view.querySelector('[data-field="status"]').textContent = status;
    }
}

for (const button of document.querySelectorAll(".eclipse-view [data-jump]")) {
    button.addEventListener("click", () => update(JUMPS[button.dataset.jump]));
}

onChange(render);
// The arrows are sized in screen pixels, so a resized panel redraws them.
new ResizeObserver(render).observe(views[0]);
render();

// Text inside the figures' SVGs, at the page's small text size (--text-small, 0.75rem, like the compass labels)
// whatever size the SVG is drawn at: each figure passes how many of its own units one screen pixel is.
const SMALL_TEXT_PX = 12;

/** Text made safe for HTML and SVG, in element content and in quoted attributes alike. */
export const escapeText = (text) => String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** A color of the page's theme, from its custom property, for figures drawn by script (Zdog takes no CSS). */
export const cssColor = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** The eight compass directions, from north through east, 45 degrees apart. */
export const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function svgText(x, y, text, cls, unitsPerPx) {
    const size = (SMALL_TEXT_PX * unitsPerPx).toFixed(2);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size}" class="${cls}">${escapeText(text)}</text>`;
}

// A label at the top of a figure, as far below its upper edge as the panel captions sit below their panels (0.5rem).
const TOP_PADDING_PX = 8;

/** The y of a middle-aligned label just inside the top of a panel whose half size is `half`, in panel units. */
function topLabelY(half, unitsPerPx) {
    return -half + (TOP_PADDING_PX + SMALL_TEXT_PX / 2) * unitsPerPx;
}

/** The y of a middle-aligned label sitting just above a line at `y`, such as a compass direction on the horizon. */
export function labelAboveY(y, unitsPerPx) {
    return y - (2 + SMALL_TEXT_PX / 2) * unitsPerPx;
}

/**
 * The visible horizon at `y` across a square panel of half size `half`, the ground beneath veiling what it hides; or,
 * with the horizon above the panel, the whole panel veiled and a note saying so.
 */
export function veiledHorizon(y, half, unitsPerPx) {
    if (y >= half) return "";
    const top = Math.max(y, -half);
    const veil = `<rect x="${-half}" y="${top.toFixed(2)}" width="${2 * half}" height="${(half - top).toFixed(2)}" class="figure-veil"/>`;
    if (y <= -half)
        return veil + svgText(0, topLabelY(half, unitsPerPx), "below the horizon", "figure-note", unitsPerPx);
    return `${veil}<line x1="${-half}" y1="${y.toFixed(2)}" x2="${half}" y2="${y.toFixed(2)}" class="figure-horizon"/>`;
}

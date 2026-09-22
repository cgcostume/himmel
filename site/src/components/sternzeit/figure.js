// Text inside the figures' SVGs, at the page's small text size (--text-small, 0.75rem, like the compass labels)
// whatever size the SVG is drawn at: each figure passes how many of its own units one screen pixel is.
const SMALL_TEXT_PX = 12;

const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function svgText(x, y, text, cls, unitsPerPx) {
    const size = (SMALL_TEXT_PX * unitsPerPx).toFixed(2);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size}" class="${cls}">${escape(text)}</text>`;
}

// A label at the top of a figure, as far below its upper edge as the panel captions sit below their panels (0.5rem).
const TOP_PADDING_PX = 8;

/** The y of a middle-aligned label just inside the top of a panel whose half size is `half`, in panel units. */
export function topLabelY(half, unitsPerPx) {
    return -half + (TOP_PADDING_PX + SMALL_TEXT_PX / 2) * unitsPerPx;
}

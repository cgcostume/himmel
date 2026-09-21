import glossary from "../data/glossary.json";

/**
 * The site-wide glossary (src/data/glossary.json: term -> definition, both with inline markdown), the single
 * source for every tooltip, in the text (Term.astro) and in the tables (built in the browser). No node imports,
 * so it bundles into client scripts as is.
 */
export interface GlossaryEntry {
    term: string;
    html: string;
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Just the inline markdown the glossary uses: code spans, bold and italics. */
export function inlineMarkdown(text: string): string {
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*([^*]+)\*/g, "$1<em>$2</em>")
        .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");
}

// Every name an entry answers to, lowercased: the term before any parenthesis, split on " / ".
const byName = new Map<string, GlossaryEntry>();
for (const [term, definition] of Object.entries(glossary as Record<string, string>)) {
    const entry = { term: term.replace(/`/g, ""), html: inlineMarkdown(definition) };
    for (const name of term.replace(/\s*\(.*$/, "").split(" / "))
        byName.set(name.replace(/`/g, "").trim().toLowerCase(), entry);
}

/** Finds an entry by one of its names, case-insensitively; throws so a typo fails the build instead of the page. */
export function findEntry(name: string): GlossaryEntry {
    const entry = byName.get(name.toLowerCase());
    if (!entry) throw new Error(`"${name}" is not in the glossary`);
    return entry;
}

/** Like findEntry, but for the browser: undefined instead of throwing. */
export const lookupEntry = (name: string): GlossaryEntry | undefined => byName.get(name.toLowerCase());

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** One `- **Term**: definition` entry of a package's GLOSSARY.md, the single source for tooltips and glossary pages. */
export interface GlossaryEntry {
    id: string;
    term: string;
    /** Lowercased names a `<Term of="...">` may use: the part before any parenthesis, split on " / ". */
    names: string[];
    html: string;
}

export interface GlossarySection {
    title: string;
    entries: GlossaryEntry[];
}

export interface Glossary {
    intro: string;
    sections: GlossarySection[];
}

// Relative to the site root (Astro runs from there), not to this module, which ends up in a bundled chunk.
const path = (lib: string) => resolve(process.cwd(), "../packages", lib, "GLOSSARY.md");

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Just the inline markdown the glossaries use: code spans, bold and italics. */
export function inlineMarkdown(text: string): string {
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*([^*]+)\*/g, "$1<em>$2</em>")
        .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");
}

const slug = (text: string) =>
    text
        .toLowerCase()
        .replace(/`/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");

/** Parsed on every call, no cache: cheap enough, and the dev server then picks up GLOSSARY.md edits right away. */
export function loadGlossary(lib: string): Glossary | null {
    const file = path(lib);
    return existsSync(file) ? parse(readFileSync(file, "utf8")) : null;
}

function parse(markdown: string): Glossary {
    const sections: GlossarySection[] = [];
    const introLines: string[] = [];
    let current: { term: string; lines: string[] } | null = null;

    const flush = () => {
        if (!current) return;
        const section = sections.at(-1);
        if (!section) throw new Error(`glossary entry "${current.term}" outside of a section`);
        const base = current.term.replace(/\s*\(.*$/, "");
        section.entries.push({
            id: slug(base),
            term: current.term,
            names: base.split(" / ").map((name) => name.replace(/`/g, "").trim().toLowerCase()),
            html: inlineMarkdown(current.lines.join(" ")),
        });
        current = null;
    };

    for (const line of markdown.split("\n")) {
        const entry = line.match(/^- \*\*(.+?)\*\*:\s*(.*)$/);
        if (line.startsWith("## ")) {
            flush();
            sections.push({ title: line.slice(3).trim(), entries: [] });
        } else if (entry?.[1] !== undefined) {
            flush();
            current = { term: entry[1], lines: [entry[2] ?? ""] };
        } else if (current && /^\s+\S/.test(line)) {
            current.lines.push(line.trim());
        } else if (!line.trim()) {
            flush();
        } else if (!line.startsWith("# ") && sections.length === 0) {
            introLines.push(line.trim());
        }
    }
    flush();
    return { intro: inlineMarkdown(introLines.join(" ")), sections };
}

/** Finds an entry by one of its names, case-insensitively; throws so a typo fails the build instead of the page. */
export function findEntry(lib: string, name: string): GlossaryEntry {
    const glossary = loadGlossary(lib);
    if (!glossary) throw new Error(`no glossary for "${lib}"`);
    const wanted = name.toLowerCase();
    for (const section of glossary.sections) {
        const entry = section.entries.find((e) => e.names.includes(wanted));
        if (entry) return entry;
    }
    throw new Error(`"${name}" is not in the ${lib} glossary`);
}

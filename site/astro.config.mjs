import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

const source = (path) => fileURLToPath(new URL(`../packages/${path}`, import.meta.url));

// Static output only: served locally by `pnpm dev` and deployed as plain files to GitHub Pages under /himmel.
export default defineConfig({
    site: "https://cgcostume.github.io",
    base: "/himmel",
    output: "static",
    integrations: [mdx()],
    markdown: {
        shikiConfig: {
            // Drops the theme's inline background, so code blocks take the site's own (see pre in global.css).
            transformers: [
                {
                    pre(node) {
                        node.properties.style = String(node.properties.style ?? "").replace(
                            /background-color:[^;]+;?/,
                            "",
                        );
                    },
                },
            ],
        },
    },
    vite: {
        // The site always shows the libraries' current source, no package build needed in between.
        resolve: {
            alias: [
                { find: /^@himmel\/sternzeit$/, replacement: source("sternzeit/src/index.ts") },
                { find: /^@himmel\/sternzeit\/approx$/, replacement: source("sternzeit/src/approx.ts") },
            ],
        },
    },
});

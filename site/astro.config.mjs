import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

// Static output only: served locally by `pnpm dev` and deployed as plain files to GitHub Pages under /himmel.
export default defineConfig({
    site: "https://cgcostume.github.io",
    base: "/himmel",
    output: "static",
    integrations: [mdx()],
});

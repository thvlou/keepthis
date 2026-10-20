// Copies axe-core's prebuilt browser bundle into dist/ after the Vite build,
// so chrome.scripting.executeScript({ files: ["axe.min.js"] }) can inject it
// into the target page. Not checked into public/ — regenerated from
// node_modules on every build instead of committing a third-party binary.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(rootDir, "node_modules", "axe-core", "axe.min.js");
const dest = path.join(rootDir, "dist", "axe.min.js");

copyFileSync(src, dest);
console.log("Copied axe-core bundle to dist/axe.min.js");

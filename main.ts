// Night Drive Cover Studio — gta6-cover-art-01 entry program (Node 22,
// standard library only, erasable TypeScript). It copies app/ and
// screenshots/ from beside this file into /output (or MAKEFUN_OUTPUT_DIR
// outside the grader) and writes /output/dossier.json with the vendored
// make.fun library. The grader reads /output as another user, so every
// output file is made world-readable (0o644) and every output directory
// world-readable + executable (0o755) after copying: cpSync keeps the
// source modes, and a 0o600 source file would otherwise be unreadable
// and the entry rejected. /output itself is a bind mount and is never
// removed — only its contents are cleared first.

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

/** Empty the contents of a directory without removing the directory itself. */
function emptyOutputDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const child = join(dir, name);
    // cpSync can carry a read-only mode over; add the write bit first so
    // the removal never fails on a read-only child.
    try {
      chmodSync(child, 0o755);
    } catch {
      // A file or a dangling entry: keep going, rmSync reports real errors.
    }
    rmSync(child, { recursive: true, force: true });
  }
}

/** Make dir itself 0o755, every file under it 0o644 and every directory under it 0o755, recursively. */
function makeReadable(dir: string): void {
  chmodSync(dir, 0o755);
  for (const name of readdirSync(dir)) {
    const child = join(dir, name);
    const st = statSync(child);
    if (st.isDirectory()) {
      makeReadable(child);
    } else if (st.isFile()) {
      chmodSync(child, 0o644);
    }
  }
}

emptyOutputDir(out);
cpSync(join(here, "app"), join(out, "app"), { recursive: true });
mkdirSync(join(out, "screenshots"), { recursive: true });
if (existsSync(join(here, "screenshots"))) {
  cpSync(join(here, "screenshots"), join(out, "screenshots"), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB
// of app files in all, or a path under app/ over 1000 bytes: app/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, "dossier.json"),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

chmodSync(join(out, "dossier.json"), 0o644);
makeReadable(join(out, "app"));
makeReadable(join(out, "screenshots"));
chmodSync(out, 0o755);

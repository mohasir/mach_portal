// Generates src/data/us/{regions,localities/<XX>}.json from OpenStreetMap/Nominatim
// place exports (place_city, place-town, place-village; hamlets are ignored), one
// NDJSON row per place. The source files were deleted from the repo together with
// the commit that introduced @repo/geo; they were added in 68471f0 and can be
// restored from the commit right before that deletion, e.g.:
//   D=$(git log --diff-filter=D --format=%H -1 -- apps/web/src/data/us/place_city.ndjson)
//   mkdir -p /tmp/us-src && for f in place_city place-town place-village; do
//     git show "$D^:apps/web/src/data/us/$f.ndjson" > "/tmp/us-src/$f.ndjson"; done
// Rerun (the source directory is a required argument):
//   pnpm --filter @repo/geo exec tsx scripts/generate-us.ts /tmp/us-src
// Names are sorted with localeCompare(..., 'en'), the comparator the tests assert.

import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// The .ndjson sources are no longer in the repo; pass the directory that holds them.
const SOURCE_DIR = process.argv[2];
const OUT_DIR = join(here, '../src/data/us');

const STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

interface Row {
  name?: string;
  type?: string;
  inferred_type?: string;
  address?: { city?: string; state?: string; 'ISO3166-2-lvl4'?: string };
}

async function main() {
  if (!SOURCE_DIR) throw new Error('Usage: generate-us.ts <dir with place_*.ndjson files>');
  // Hamlets are excluded: their names are mostly unincorporated-area noise.
  const files = (await readdir(SOURCE_DIR)).filter(
    (f) => f.endsWith('.ndjson') && !f.includes('hamlet'),
  );
  const byState = new Map<string, Set<string>>(Object.keys(STATES).map((c) => [c, new Set()]));
  let skipped = 0;

  for (const file of files) {
    const lines = createInterface({ input: createReadStream(join(SOURCE_DIR, file)) });
    for await (const line of lines) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as Row;
      const code = row.address?.['ISO3166-2-lvl4']?.replace(/^US-/, '');
      const set = code ? byState.get(code) : undefined;
      if (!set) {
        skipped++;
        continue;
      }
      if (row.type === 'hamlet' || row.inferred_type === 'hamlet') continue;
      const name = row.name?.trim();
      if (name) set.add(name);
    }
  }

  await rm(join(OUT_DIR, 'localities'), { recursive: true, force: true });
  await mkdir(join(OUT_DIR, 'localities'), { recursive: true });
  const regions = Object.entries(STATES)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  await writeFile(join(OUT_DIR, 'regions.json'), JSON.stringify(regions, null, 2) + '\n');

  for (const [code, set] of byState) {
    const names = [...set].sort((a, b) => a.localeCompare(b, 'en'));
    if (names.length === 0) throw new Error(`No localities for ${code}`);
    await writeFile(join(OUT_DIR, 'localities', `${code}.json`), JSON.stringify(names) + '\n');
    console.log(code, names.length);
  }
  console.log(`rows outside the 50 states + DC (skipped): ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

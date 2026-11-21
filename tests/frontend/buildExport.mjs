/** Build module xuất bảng công (TS) và nạp bằng CJS để test không cần ts-node. */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, '../..');
export const fe = path.join(repo, 'hkt/frontend');

function load(entry, name) {
  const out = path.join(os.tmpdir(), name);
  execFileSync(
    path.join(fe, 'node_modules/.bin/esbuild'),
    [path.join(fe, 'src/modules/attendance/timesheet', entry),
     '--bundle', '--format=cjs', '--platform=node', `--outfile=${out}`],
    { cwd: fe, stdio: 'pipe' },
  );
  const require = createRequire(import.meta.url);
  delete require.cache[out];
  return require(out);
}

export const loadExportModule = () => load('timesheetExport.ts', 'timesheetExport.test.cjs');
export const loadXlsxModule = () => load('timesheetXlsx.ts', 'timesheetXlsx.test.cjs');

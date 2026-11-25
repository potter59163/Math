import { describe, expect, it, vi } from 'vitest';
import { matrixClass, withVectors, type Tables } from './research-export.fixtures';
import { exportBeforeVectors } from './research-export.frozen.mjs';

// Runs the real `npm run export` script with MongoDB and the disk swapped for memory. The snapshots
// were written by the script as it was before vectors (dceb45e), so a class with matrices only must
// still get these files to the byte.

const io = vi.hoisted(() => ({ tables: {} as Tables, transcript: [] as string[] }));

vi.mock('mongodb', () => ({
  MongoClient: class {
    db() {
      return {
        collection: (name: string) => ({
          find: () => ({ toArray: async () => io.tables[name] ?? [] }),
        }),
      };
    }
    async close() {
      io.transcript.push('--- closed ---\n');
    }
  },
}));

vi.mock('node:fs', () => ({
  mkdirSync: (path: string) => {
    io.transcript.push(`--- mkdir ${path} ---\n`);
  },
  writeFileSync: (path: string, text: string) => {
    io.transcript.push(`--- ${path} ---\n${text}`);
  },
}));

/** Everything the script did, in order: folders made, files written and what it printed. */
async function runExport(tables: Tables, cohort?: string): Promise<string> {
  io.tables = tables;
  io.transcript = [];
  const { argv } = process;
  const uri = process.env.MONGODB_URI;
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  process.argv = [...argv.slice(0, 2), ...(cohort === undefined ? [] : [cohort])];
  process.env.MONGODB_URI = 'mongodb://memory.test';
  try {
    vi.resetModules();
    await import('./export-data.mjs');
    const printed = log.mock.calls.map((call) => `${call.join(' ')}\n`);
    return [...io.transcript, '--- printed ---\n', ...printed].join('');
  } finally {
    log.mockRestore();
    process.argv = argv;
    if (uri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = uri;
  }
}

/** What the script leaves for these files, as `runExport` records it. */
function transcriptOf(
  { files, students }: { files: Map<string, string>; students: number },
  cohort?: string,
): string {
  const written = [...files].map(([name, text]) => `--- exports/${name} ---\n${text}`);
  const printed = `Exported ${students} students${cohort ? ` from ${cohort}` : ''} to exports/\n`;
  return [
    '--- mkdir exports ---\n',
    ...written,
    '--- closed ---\n',
    '--- printed ---\n',
    printed,
  ].join('');
}

describe('npm run export', () => {
  it('is what the frozen copy of the export before vectors gives', async () => {
    for (const cohort of [undefined, 'm5-1', 'm5-2', 'nobody']) {
      expect(await runExport(matrixClass(), cohort)).toBe(
        transcriptOf(exportBeforeVectors(matrixClass(), cohort), cohort),
      );
    }
  });

  it('writes every student who gave consent, as it did before vectors', async () => {
    await expect(await runExport(matrixClass())).toMatchFileSnapshot(
      './__snapshots__/export-data.all.txt',
    );
  });

  it('writes one cohort, as it did before vectors', async () => {
    await expect(await runExport(matrixClass(), 'm5-1')).toMatchFileSnapshot(
      './__snapshots__/export-data.cohort.txt',
    );
  });

  it('writes headers alone, and no research_wide.csv, when there is no one to export', async () => {
    await expect(await runExport({})).toMatchFileSnapshot('./__snapshots__/export-data.empty.txt');
  });

  // docs/VECTORS.md §6.2: the research is about matrices, so vector work stays out of these files.
  it('writes the same files once the class has started vectors', async () => {
    for (const cohort of [undefined, 'm5-1']) {
      expect(await runExport(withVectors(), cohort)).toBe(await runExport(matrixClass(), cohort));
    }
  });
});

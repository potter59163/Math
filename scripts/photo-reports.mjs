// What Potter needs to look after the photos on the leaderboard (SPEC §15): which ones were reported,
// which came down, and who shows no more. The command is scripts/review-photos.mjs: npm run photos.
// Reporters are never named here either. They show as letters, new on every run, which is enough to
// see a few students reporting everyone.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** CONFIG.photoReports of lib/config.ts, which a script cannot import: the test holds the two together. */
export const RULES = { toHide: 3, perReporterPerWeek: 5, maxTakedowns: 2 };

/** Short enough to type, long enough to mean one student among a school. */
export const HANDLE_LENGTH = 8;
export const handleOf = (id) => String(id).slice(0, HANDLE_LENGTH);

function stateOf(profile) {
  if (profile.photo_locked) return 'locked';
  if (!profile.photo_at) return 'no photo';
  if (profile.photo_reported_at) return 'taken down';
  if (profile.show_photo && profile.show_on_leaderboard !== false) return 'shown';
  return 'private';
}

/**
 * One row for every student whose present photo has a report, whose photo reports took down, or who is
 * locked: the most reported first. With `everyone`, also each student whose photo is on the board, so
 * one nobody has reported yet can be found. `busiest` are the reporters of the last seven days, as letters.
 */
export function summarize({ profiles, reports }, now, rules, { everyone = false } = {}) {
  const byPhoto = new Map();
  for (const report of reports) {
    const kept = byPhoto.get(report.photo_key) ?? [];
    kept.push(report);
    byPhoto.set(report.photo_key, kept);
  }
  const rows = profiles
    .map((profile) => {
      const mine = (profile.photo_key && byPhoto.get(profile.photo_key)) || [];
      const last = mine.reduce((latest, { created_at }) => Math.max(latest, +created_at), 0);
      return {
        handle: handleOf(profile._id),
        name: profile.display_name ?? '',
        group: profile.cohort ?? '-',
        state: stateOf(profile),
        reports: new Set(mine.map(({ reporter_id }) => reporter_id)).size,
        takedowns: profile.photo_takedowns ?? 0,
        last: last ? new Date(last).toISOString() : null,
      };
    })
    .filter(
      ({ reports: n, state, takedowns }) =>
        n > 0 || takedowns > 0 || state === 'locked' || (everyone && state === 'shown'),
    )
    .sort(
      (a, b) =>
        b.reports - a.reports || b.takedowns - a.takedowns || a.handle.localeCompare(b.handle),
    );

  const perReporter = new Map();
  for (const { reporter_id, created_at } of reports) {
    if (+now - +created_at <= WEEK_MS) {
      perReporter.set(reporter_id, (perReporter.get(reporter_id) ?? 0) + 1);
    }
  }
  const busiest = [...perReporter.values()]
    .sort((a, b) => b - a)
    .map((count, index) => ({ reporter: String.fromCharCode(65 + (index % 26)), count }));
  return { rows, busiest, rules };
}

const WIDTHS = [8, 10, 7, 10, 14];
/** Columns two spaces apart whatever they hold, with the name, of any length, last. */
const line = (cells, name) =>
  `${cells.map((text, index) => String(text).padEnd(WIDTHS[index])).join('  ')}  ${name}`;

export function render({ rows, busiest, rules }) {
  const lines = [];
  if (rows.length === 0) {
    lines.push('No photo has been reported.');
  } else {
    lines.push(line(['id', 'state', 'reports', 'taken down', 'class'], 'name'));
    for (const row of rows) {
      lines.push(
        line(
          [
            row.handle,
            row.state,
            `${row.reports}/${rules.toHide}`,
            `${row.takedowns}/${rules.maxTakedowns}`,
            row.group,
          ],
          row.name,
        ),
      );
    }
  }
  const full = busiest.filter(({ count }) => count >= rules.perReporterPerWeek).length;
  if (busiest.length > 0) {
    lines.push('');
    lines.push(
      `Reports in the last 7 days, by reporter (never named): ${busiest
        .map(({ reporter, count }) => `${reporter} ${count}`)
        .join(', ')}`,
    );
    if (full >= rules.toHide) {
      lines.push(
        `${full} reporters used all ${rules.perReporterPerWeek} of their reports this week: look at whether the photos they took down deserved it.`,
      );
    }
  }
  lines.push('');
  lines.push('npm run photos -- shown        also list every photo that is on the board now');
  lines.push("npm run photos -- hide <id>    take that student's photo off the board now");
  lines.push('npm run photos -- lock <id>    show no more photos of that student');
  lines.push(
    'npm run photos -- clear <id>   forget the reports and let that student show photos again',
  );
  return lines.join('\n');
}

/** The one student a handle means, or why there is none: handles are typed by hand. */
export function findStudent(profiles, handle) {
  const wanted = String(handle ?? '').trim();
  if (wanted.length < 6) return { error: 'Give at least 6 characters of the id.' };
  const found = profiles.filter(({ _id }) => String(_id).startsWith(wanted));
  if (found.length === 0) return { error: `No student has an id that begins with ${wanted}.` };
  if (found.length > 1)
    return {
      error: `${found.length} students have an id that begins with ${wanted}: give more of it.`,
    };
  return { profile: found[0] };
}

/**
 * What each command writes to the student's profile, in the words of lib/server/store.ts: a takedown is
 * what `reportPhoto` does when enough students have reported, done here by hand.
 */
export function changeFor(command, profile, now, rules) {
  switch (command) {
    case 'hide': {
      const takedowns = (profile.photo_takedowns ?? 0) + 1;
      return {
        $set: {
          show_photo: false,
          photo_reported_at: now,
          photo_takedowns: takedowns,
          ...(takedowns >= rules.maxTakedowns && { photo_locked: true }),
        },
      };
    }
    case 'lock':
      return { $set: { show_photo: false, photo_locked: true } };
    case 'clear':
      return { $unset: { photo_reported_at: '', photo_takedowns: '', photo_locked: '' } };
    default:
      return null;
  }
}

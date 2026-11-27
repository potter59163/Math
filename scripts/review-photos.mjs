// Looks after the photos on the leaderboard. Run by whoever holds the database address:
//   npm run photos                 the photos that were reported, and who shows no more
//   npm run photos -- shown        those, and every photo that is on the board now
//   npm run photos -- hide <id>    take a student's photo off the board now
//   npm run photos -- lock <id>    show no more photos of a student
//   npm run photos -- clear <id>   forget the reports and let a student show photos again
// The rules (how many reports, how many takedowns) are CONFIG.photoReports in lib/config.ts.
import { MongoClient } from 'mongodb';
import { changeFor, findStudent, render, RULES, summarize } from './photo-reports.mjs';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI in .env.local');

const [command = 'list', handle] = process.argv.slice(2);
const client = new MongoClient(uri);
const db = client.db(process.env.MONGODB_DB || 'kidma');
const profiles = db.collection('profiles');
const reports = db.collection('photo_reports');

try {
  const now = new Date();
  const students = await profiles
    .find(
      { consent_at: { $exists: true } },
      {
        projection: {
          display_name: 1,
          cohort: 1,
          show_on_leaderboard: 1,
          photo_at: 1,
          photo_key: 1,
          show_photo: 1,
          photo_reported_at: 1,
          photo_takedowns: 1,
          photo_locked: 1,
        },
      },
    )
    .toArray();

  if (command === 'list' || command === 'shown') {
    const all = await reports.find().toArray();
    const everyone = command === 'shown';
    console.log(render(summarize({ profiles: students, reports: all }, now, RULES, { everyone })));
  } else {
    const { profile, error } = findStudent(students, handle);
    const change = profile && changeFor(command, profile, now, RULES);
    if (error) {
      console.error(error);
      process.exitCode = 1;
    } else if (!change) {
      console.error(`Unknown command "${command}". Use list, shown, hide, lock or clear.`);
      process.exitCode = 1;
    } else {
      await profiles.updateOne(
        { _id: profile._id },
        { ...change, $currentDate: { updated_at: true } },
      );
      if (command === 'clear') await reports.deleteMany({ owner_id: profile._id });
      console.log(`${command}: ${profile.display_name} (${String(profile._id).slice(0, 8)})`);
    }
  }
} finally {
  await client.close();
}

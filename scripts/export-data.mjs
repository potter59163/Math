// Research export (RESEARCH §5). Run by whoever holds the database address: npm run export -- <cohort>
// Writes exports/<table>.csv and exports/research_wide.csv, which research-export.mjs works out. No name
// or Google account leaves the database: each student becomes S-1, S-2 and so on, in the order they joined.
import { mkdirSync, writeFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { COLLECTIONS, researchExport } from './research-export.mjs';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI in .env.local');

const cohort = process.argv[2];
const client = new MongoClient(uri);
const db = client.db(process.env.MONGODB_DB || 'kidma');

const tables = {};
for (const name of COLLECTIONS) tables[name] = await db.collection(name).find().toArray();
const { files, students } = researchExport(tables, cohort);

mkdirSync('exports', { recursive: true });
for (const [name, text] of files) writeFileSync(`exports/${name}`, text);
await client.close();
console.log(`Exported ${students} students${cohort ? ` from ${cohort}` : ''} to exports/`);

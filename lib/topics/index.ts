import { CONFIG } from '@/lib/config';
import { matrixPack } from './matrix/pack';
import type {
  MisconceptionId,
  SkillId,
  TopicId,
  TopicMisconception,
  TopicPack,
  TopicSkill,
  UnitId,
} from './types';

// The topic registry (docs/VECTORS.md §6.1). Everything outside lib/topics/ reaches a topic through
// here. Ids never collide across packs, so a skill, a misconception or a unit also names its pack.

export type * from './types';

/** Registration order is the order topics are offered in, and matrices come first. */
const PACKS: readonly TopicPack[] = [matrixPack];

/** What a student learns until they choose otherwise, and what every profile from before topics means. */
export const DEFAULT_TOPIC: TopicId = 'matrix';

const byTopic = new Map<string, TopicPack>(PACKS.map((pack) => [pack.id, pack]));

function indexBy<K>(keysOf: (pack: TopicPack) => readonly K[]): Map<K, TopicPack> {
  const index = new Map<K, TopicPack>();
  for (const pack of PACKS) {
    for (const key of keysOf(pack)) {
      if (index.has(key)) throw new Error(`topics: ${String(key)} is in two packs`);
      index.set(key, pack);
    }
  }
  return index;
}

const bySkill = indexBy((pack) => pack.skills.map(({ id }) => id));
const byMisconception = indexBy((pack) => pack.catalog.map(({ id }) => id));
const byUnit = indexBy((pack) => pack.units.map(({ id }) => id));

export function registeredTopics(): TopicId[] {
  return PACKS.map(({ id }) => id);
}

export function isRegisteredTopic(topic: unknown): topic is TopicId {
  return typeof topic === 'string' && byTopic.has(topic);
}

/** Throws on a topic that is not registered. */
export function packOf(topic: string): TopicPack {
  const pack = byTopic.get(topic);
  if (!pack) throw new Error(`packOf: unknown topic ${topic}`);
  return pack;
}

/** The topics a student may be offered: registered, and switched on in CONFIG.topics. */
export function enabledTopics(enabled: readonly string[] = CONFIG.topics): TopicId[] {
  const offered = registeredTopics().filter((topic) => enabled.includes(topic));
  return offered.length > 0 ? offered : [DEFAULT_TOPIC];
}

/**
 * The topic a student is learning. A profile from before topics is on matrices, and one set to a topic
 * that is now switched off or gone is on the first topic still offered.
 */
export function activeTopicOf(
  student: { activeTopic?: string },
  enabled: readonly string[] = CONFIG.topics,
): TopicId {
  const offered = enabledTopics(enabled);
  const wanted = student.activeTopic ?? DEFAULT_TOPIC;
  return offered.find((topic) => topic === wanted) ?? offered[0];
}

/** Throws on an unknown skill. */
export function packOfSkill(skill: SkillId): TopicPack {
  const pack = bySkill.get(skill);
  if (!pack) throw new Error(`packOfSkill: unknown skill ${skill}`);
  return pack;
}

/** Throws on an unknown misconception. */
export function packOfMisconception(id: MisconceptionId): TopicPack {
  const pack = byMisconception.get(id);
  if (!pack) throw new Error(`packOfMisconception: unknown misconception ${id}`);
  return pack;
}

/** Throws on an unknown unit. */
export function packOfUnit(unit: UnitId): TopicPack {
  const pack = byUnit.get(unit);
  if (!pack) throw new Error(`packOfUnit: unknown unit ${unit}`);
  return pack;
}

export const isKnownSkill = (skill: string): boolean => bySkill.has(skill);

/** Any registered topic's skill. Throws on an unknown one. */
export function skillOf(id: SkillId): TopicSkill {
  return packOfSkill(id).skillById(id);
}

/** Any registered topic's misconception. Throws on an unknown one. */
export function misconceptionOf(id: MisconceptionId): TopicMisconception {
  return packOfMisconception(id).catalogEntry(id);
}

/** Every registered skill: each pack in teaching order, packs in registration order. */
export function allSkills(): TopicSkill[] {
  return PACKS.flatMap(({ skills }) => skills);
}

/** Every registered misconception: each pack in catalog order, packs in registration order. */
export function allMisconceptions(): TopicMisconception[] {
  return PACKS.flatMap(({ catalog }) => catalog);
}

/** "หน่วยที่ {{n}}" of any registered unit. */
export function unitOf(unit: UnitId): { label: string; titleTh: string } {
  const found = packOfUnit(unit).units.find(({ id }) => id === unit);
  if (!found) throw new Error(`unitOf: unknown unit ${unit}`);
  return found;
}

export const misconceptionShortOf = (id: MisconceptionId): string =>
  packOfMisconception(id).copy.misconceptionShort(id);

import type { Answer, Classification, Item, ItemKind, ItemRef, Level } from '@/lib/core/types';
import type { PretestResult, Student, ThemeId } from '@/lib/learner/types';
import type { ScenePurpose, SceneSpec as MatrixSceneSpec } from '@/lib/topics/matrix/scenes/types';

// What the app needs from a topic. Everything outside lib/topics/<topic>/ reaches a topic through a
// TopicPack (`packOf(ref.topic)`), so a second topic can bring its own items, forms, answer kinds and
// clips without the learner model, the director or the server knowing about them (docs/VECTORS.md §6).

/** Every topic the app knows of. Only the registered ones in lib/topics/index.ts can be used. */
export type TopicId = 'matrix' | 'vector';

/**
 * Ids are plain strings that never collide across topics, so a profile keeps one flat map of skills and
 * one of misconceptions with no migration: matrix skills are bare (`dim`), vector skills start with
 * `v_`, and vector misconceptions with `V`. Units are 1–5 for matrices and 11–15 for vectors.
 */
export type SkillId = string;
export type MisconceptionId = string;
export type UnitId = number;

export interface TopicSkill {
  id: SkillId;
  unit: UnitId;
  nameTh: string;
  prereq: readonly SkillId[];
  /** Highest level with a generator. */
  maxLevel: Level;
}

export interface TopicUnit {
  id: UnitId;
  /** What "หน่วยที่ {{n}}" shows: `3` for matrices, `V3` for vectors. */
  label: string;
  titleTh: string;
}

export interface TopicMisconception {
  id: MisconceptionId;
  nameTh: string;
  /** The skills whose items can show it. */
  skills: readonly SkillId[];
}

export interface GenerateRequest {
  skill: SkillId;
  difficulty: Level;
  seed: number;
  target?: MisconceptionId;
  targetVariant?: string;
}

/** A misconception as one answer showed it. */
export interface Caught {
  id: MisconceptionId;
  variant?: string;
}

/** Every topic's clips. A pack with its own templates adds its spec here, and SceneStage a case. */
export type SceneSpec = MatrixSceneSpec;
export type TemplateId = SceneSpec['template'];
export type { ScenePurpose };

/**
 * The tokens a student's text may hold (AI_DIRECTOR §4.4). The LLM writes the name and the pack fills
 * the value from its engine. A pack that needs other names adds them here.
 */
export type TokenName =
  | 'i'
  | 'j'
  | 'dimsA'
  | 'dimsB'
  | 'aCell'
  | 'bCell'
  | 'studentCell'
  | 'studentAnswer'
  | 'k'
  | 'correctCell'
  | 'correctAnswer'
  | 'det';

/** Tokens that would give the answer away while the item is open. */
export const REVEALING_TOKENS: readonly TokenName[] = ['correctCell', 'correctAnswer', 'det'];

export type TokenValues = Partial<Record<TokenName, string>>;

export interface TokenOptions {
  /** True only after the item is closed (AI_DIRECTOR §2). */
  revealAllowed: boolean;
}

/** One line of a worked solution, with its wording already filled in. */
export interface WorkedLine {
  text: string;
  latex: string;
}

export interface ConceptSceneOptions {
  seed: number;
  level?: Level;
  /** The item being worked on, which the example must not give away. */
  avoid?: Item;
  purpose?: Extract<ScenePurpose, 'concept' | 'request'>;
}

export interface MarkedResponse {
  itemNo: number;
  item: Item;
  answer: Answer | null;
  classification: Classification | null;
  correct: boolean;
}

/** A fixed pre/post test (RESEARCH §4). Only the matrix one is wired into the app. */
export interface TopicAssessment {
  forms: readonly string[];
  formFor(userId: string, phase: 'pre' | 'post'): string;
  items(form: string): Item[];
  mark(form: string, answers: ReadonlyMap<number, Answer | null>): MarkedResponse[];
  score(marked: readonly MarkedResponse[]): { score: number; total: number };
  pretestResults(marked: readonly MarkedResponse[]): Partial<Record<SkillId, PretestResult>>;
}

export interface TopicPack {
  id: TopicId;
  /** The lessons header and the topic tab. */
  titleTh: string;
  /** The line under the header. */
  noteTh: string;
  /** In teaching order. */
  units: readonly TopicUnit[];
  /**
   * The units this student has open. Stored `student.units` predates topics and means matrix units, so
   * a pack whose units are not in it opens them all.
   */
  openUnits(student: Pick<Student, 'units'>): readonly UnitId[];

  /** In teaching order, prereqs first. */
  skills: readonly TopicSkill[];
  /** Throws on an id this pack does not have. */
  skillById(id: SkillId): TopicSkill;
  levelsOf(id: SkillId): Level[];

  /** Per pack, so a change to one topic's generators never orphans another topic's open items. */
  generatorVersion: number;
  /** Throws if no valid item can be built, which is a generator bug. */
  generate(request: GenerateRequest): Item;
  /** Rebuilds an item from its ref. Throws on a ref from another generator version. */
  regenerate(ref: ItemRef): Item;

  /** Catalog order decides ties and the order misconceptions are listed in. */
  catalog: readonly TopicMisconception[];
  catalogEntry(id: MisconceptionId): TopicMisconception;
  probeLevel(skill: SkillId, id: MisconceptionId, level: Level, variant?: string): Level;
  probeLevels(skill: SkillId, id: MisconceptionId, variant?: string): Level[];
  variantsOf(id: MisconceptionId): (string | undefined)[];

  /** The whole solution, for the dev lab and the reveal clip. */
  workedSteps(item: Item): WorkedLine[];
  hints: {
    /** SPEC §9 L1: a nudge about the form of the question. */
    l1(item: Item): string;
    /** SPEC §9 L2 when no open misconception applies: the first step in words. */
    firstStep(item: Item): string;
    /** SPEC §9 L3: one cell or one step, never the finished answer. */
    step(item: Item): WorkedLine;
  };

  scenes: {
    /** The first clip of a unit. */
    intro(unit: UnitId, options: { seed?: number; theme?: ThemeId }): SceneSpec;
    concept(skill: SkillId, options: ConceptSceneOptions): SceneSpec;
    remediate(item: Item, answer: Answer, caught: Caught, theme?: ThemeId): SceneSpec;
    reveal(item: Item): SceneSpec;
    /** "ดูวิธีทำ" opens the misconception's own clip when it is a worked solution. */
    hasWorkedScene(caught: Caught, kind: ItemKind): boolean;
  };

  /** The values of the tokens for this item and answer. A token with no meaning here has none. */
  tokens(item: Item, answer: Answer | undefined, options: TokenOptions): TokenValues;

  /** What the tutor is told about this topic (AI_DIRECTOR §4.6–4.7). No digits anywhere. */
  llm: {
    /** "ตอนนี้กำลังสอนเรื่อง…" */
    topicWord: string;
    /** The end of rule 5: what the message may talk about. */
    focusRule: string;
    /** The few-shot examples at the end of the system prompt. */
    examples: string;
    /** A skill's name without a number in it, such as det_small for det2. */
    skillWord(id: SkillId): string;
    /** A template's name as the tutor reads it. */
    sceneWord(template: TemplateId): string;
    /** Extra fields of `lastAttempt`, from the tokens the item allows. */
    attemptContext(tokens: readonly TokenName[]): Record<string, unknown>;
  };

  copy: {
    /** The question an item asks, filled in, as plain text. */
    prompt(item: Item): string;
    /** A choice option's label as plain text. Its topic's components may draw it more richly. */
    choiceLabel(labelKey: string): string;
    /** At most 16 code units, for path notes (AI_DIRECTOR §3.2). */
    misconceptionShort(id: MisconceptionId): string;
    /** SPEC §9 L2 for a known misconception. */
    misconceptionHint(id: MisconceptionId): string;
    /** The feedback card's line. Never contains the right answer. */
    misconceptionFeedback(id: MisconceptionId, variant?: string): string;
    /** The feedback card's line for one wrong cell or component, 1-based. */
    slip(cell: [number, number]): string;
  };

  assessment?: TopicAssessment;
}

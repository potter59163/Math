import { describe, expect, it } from 'vitest';
import { th } from '@/lib/content/th';
import { thVector } from '@/lib/content/th.vector';
import { classify } from '@/lib/core/classify';
import { parseAnswer } from '@/lib/core/parse';
import { Surd } from '@/lib/core/surd';
import type { Answer } from '@/lib/core/types';
import { hasNumberInWords } from '@/lib/director/llm/validate';
import { systemPrompt } from '@/lib/director/llm/prompt';
import { packOf, packOfMisconception, packOfSkill, packOfUnit, unitOf } from '@/lib/topics';
import { choiceLatex, givenLatex, promptParts, answerAffix, simplifiedForm } from './display';
import { givenVectors } from './format';
import { assemble, generate, regenerate, VECTOR_GENERATOR_VERSION } from './generators';
import { vec } from './ops';
import { CATALOG, probeLevels } from './misconceptions';
import { SKILLS, levelsOf, type SkillId } from './skills';
import type { VectorItem } from './types';

const pack = packOf('vector');
const DIGITS = /[0-9๐-๙⁰¹²³⁴-⁹₀-₉]/;

const itemsOf = (skill: SkillId) =>
  levelsOf(skill).flatMap((difficulty) =>
    [1, 2, 3].map((seed) => generate({ skill, difficulty, seed })),
  );
const allItems = SKILLS.flatMap(({ id }) => itemsOf(id));

describe('the vector pack in the registry', () => {
  it('is found by its skills, misconceptions and units', () => {
    expect(packOfSkill('v_points')).toBe(pack);
    expect(packOfMisconception('V05_POINTS_REVERSED')).toBe(pack);
    expect(packOfUnit(13)).toBe(pack);
    expect(pack.skills).toBe(SKILLS);
    expect(pack.catalog).toBe(CATALOG);
  });

  it('shows its units 11–15 as V1–V5 with the Thai titles', () => {
    expect(pack.units.map(({ id, label }) => [id, label])).toEqual([
      [11, 'V1'],
      [12, 'V2'],
      [13, 'V3'],
      [14, 'V4'],
      [15, 'V5'],
    ]);
    expect(unitOf(13)).toEqual({ id: 13, label: 'V3', titleTh: thVector.units[13] });
    expect(pack.titleTh).toBe('เวกเตอร์');
  });

  it('opens every vector unit for a student whose stored units are matrix units', () => {
    expect(pack.openUnits({ units: [1, 2, 3, 4, 5] })).toEqual([11, 12, 13, 14, 15]);
    expect(pack.openUnits({ units: [3, 12] })).toEqual([12]);
  });

  it('has its own generator version, and leaves the matrix one alone', () => {
    expect(pack.generatorVersion).toBe(VECTOR_GENERATOR_VERSION);
    expect(pack.generatorVersion).toBe(1);
    expect(packOf('matrix').generatorVersion).toBe(2);
  });

  it('builds and rebuilds the same items as the vector generators', () => {
    const request = {
      skill: 'v_magnitude',
      difficulty: 3,
      seed: 9,
      target: 'V11_MAG_ADDITIVE',
    } as const;
    const item = pack.generate(request);
    expect(item).toEqual(generate(request));
    expect(pack.regenerate(item.ref)).toEqual(regenerate(generate(request).ref));
    expect(item.ref).toMatchObject({ topic: 'vector', gv: 1 });
  });

  it('probes at the levels of VECTORS §4.1', () => {
    expect(pack.probeLevels('v_magnitude', 'V11_MAG_ADDITIVE')).toEqual([3]);
    expect(pack.probeLevel('v_magnitude', 'V11_MAG_ADDITIVE', 1)).toBe(3);
    expect(pack.probeLevels('v_dot', 'V14_DOT_AS_DET')).toEqual(
      probeLevels('v_dot', 'V14_DOT_AS_DET'),
    );
  });

  it('refuses an item of another topic', () => {
    const matrixItem = packOf('matrix').generate({ skill: 'dim', difficulty: 1, seed: 1 });
    expect(() => pack.workedSteps(matrixItem)).toThrow(/got a matrix item/);
  });
});

describe('the vector copy, through the pack', () => {
  it('is reachable as th.vector', () => {
    expect(th.vector).toBe(thVector);
  });

  it('fills every prompt and names every choice', () => {
    for (const item of allItems) {
      expect(pack.copy.prompt(item)).not.toMatch(/\{\{|\}\}/);
      for (const { labelKey } of item.options ?? []) {
        expect(pack.copy.choiceLabel(labelKey).length).toBeGreaterThan(0);
      }
    }
  });

  it('words a slip as a component, never a row and a column', () => {
    expect(pack.copy.slip([2, 1])).toBe('ผิดแค่องค์ประกอบที่ 2');
    expect(pack.copy.slip([2, 1])).not.toMatch(/แถว|หลัก/);
  });

  it('has a feedback line for every misconception: what the answer did, and its L2 hint', () => {
    for (const { id } of CATALOG) {
      const line = pack.copy.misconceptionFeedback(id);
      expect(line).toContain(thVector.misconceptionNames[id]);
      expect(line).toContain(thVector.hints[id]);
      expect(pack.copy.misconceptionShort(id).length).toBeLessThanOrEqual(16);
    }
  });

  it('gives every item an L1 hint, a first step, and an L3 step that is not the answer', () => {
    for (const item of allItems) {
      expect(pack.hints.l1(item).length).toBeGreaterThan(0);
      expect(pack.hints.firstStep(item).length).toBeGreaterThan(0);
      const lines = pack.workedSteps(item);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every(({ text }) => !/\{\{/.test(text))).toBe(true);
      expect(pack.hints.step(item).text.length).toBeGreaterThan(0);
    }
  });
});

describe('the vector tokens', () => {
  const item = generate({
    skill: 'v_points',
    difficulty: 2,
    seed: 4,
    target: 'V05_POINTS_REVERSED',
  });
  const reversed = item.diagnostics[0].answer;

  it('name a component and the answers, and hold the right answer back until it is closed', () => {
    if (reversed.kind !== 'vector') throw new Error('expected a vector diagnostic');
    const open = pack.tokens(item, reversed, { revealAllowed: false });
    expect(open.i).toBe('1');
    expect(open.studentAnswer).toMatch(/^\(.*\)$/);
    expect(open.correctAnswer).toBeUndefined();
    expect(pack.tokens(item, reversed, { revealAllowed: true }).correctAnswer).toBeDefined();
  });

  it('give no cell tokens, so no line about a row and a column can be chosen', () => {
    const values = pack.tokens(item, reversed as never, { revealAllowed: true });
    expect(values.j).toBeUndefined();
    expect(values.studentCell).toBeUndefined();
  });
});

describe('what the tutor is told about vectors', () => {
  it('says the topic is vectors, and the matrix prompt still says matrices', () => {
    expect(systemPrompt('Kidma', 'vector')).toContain('ตอนนี้กำลังสอนเรื่องเวกเตอร์');
    expect(systemPrompt('Kidma', 'vector')).not.toContain('เมทริกซ์ใน lastAttempt');
    expect(systemPrompt('Kidma', 'matrix')).toContain('ตอนนี้กำลังสอนเรื่องเมทริกซ์');
  });

  it('has few-shot examples whose words for the student hold no number', () => {
    const examples = pack.llm.examples
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { message: string; narration?: { text: string }[] });
    expect(examples.length).toBeGreaterThanOrEqual(1);
    expect(examples.length).toBeLessThanOrEqual(2);
    for (const { message, narration = [] } of examples) {
      for (const text of [message, ...narration.map((line) => line.text)]) {
        expect(text).not.toMatch(DIGITS);
        expect(hasNumberInWords(text)).toBe(false);
      }
    }
  });

  it('reads skill names with no digits', () => {
    for (const { id, nameTh } of SKILLS) {
      expect(pack.llm.skillWord(id)).not.toMatch(DIGITS);
      expect(nameTh).not.toMatch(DIGITS);
    }
  });
});

describe('the stand-in clips', () => {
  it('build every kind of clip for every skill as a worked solution', () => {
    for (const { id, unit } of SKILLS) {
      const [item] = itemsOf(id);
      const answer = item.diagnostics[0]?.answer ?? item.correct;
      const specs = [
        pack.scenes.intro(unit, { seed: 1 }),
        pack.scenes.concept(id, { seed: 2, level: 1, avoid: item }),
        pack.scenes.reveal(item),
        ...(answer.kind !== 'any_matrix'
          ? [pack.scenes.remediate(item, answer, { id: item.diagnostics[0]?.id ?? 'x' })]
          : []),
      ];
      for (const spec of specs) {
        expect(spec.template).toBe('worked_solution');
        expect(spec.beats.length).toBeGreaterThan(0);
        expect(spec.beats.length).toBeLessThanOrEqual(6);
        if (spec.template !== 'worked_solution') continue;
        const total = Object.values(spec.beatMs).reduce((sum: number, ms) => sum + (ms ?? 0), 0);
        expect(total).toBeLessThanOrEqual(22000);
        for (const step of spec.params.steps) expect(spec.beats).toContain(step.beat);
      }
    }
  });
});

describe('showing a vector item', () => {
  const find = (form: VectorItem['data']['form']) => {
    const found = allItems.find(({ data }) => data.form === form);
    if (!found) throw new Error(`no ${form} item`);
    return found;
  };

  it('writes givens as points, column vectors, or ai + bj + ck', () => {
    const points = givenVectors(find('points').data).map(givenLatex);
    expect(points[0]).toMatch(/^A\\left\(/);
    const column = givenVectors(find('dot').data).map(givenLatex);
    expect(column[0]).toMatch(/^u = \\begin\{bmatrix\}/);
    expect(
      givenLatex({
        label: 'u',
        kind: 'vector',
        value: [Surd.ONE.coeff, Surd.ONE.coeff.neg(), Surd.ZERO.coeff],
        notation: 'ijk',
      }),
    ).toBe('u = \\mathbf{i} - \\mathbf{j}');
  });

  it('puts an arrow over every named vector on a choice, and leaves other choices as words', () => {
    expect(choiceLatex('AB')).toBe('\\overrightarrow{AB}');
    expect(choiceLatex('2MN')).toBe('2\\overrightarrow{MN}');
    expect(choiceLatex('1/2BC')).toBe('\\tfrac{1}{2}\\overrightarrow{BC}');
    expect(choiceLatex('q_velocity')).toBeNull();
  });

  it('puts the arrows in a figure question, and fills the rest as words', () => {
    const equal = find('figure_equal');
    const parts = promptParts(equal);
    expect(parts.some((part) => 'latex' in part && part.latex.includes('overrightarrow'))).toBe(
      true,
    );
    const words = promptParts(find('magnitude'));
    expect(words).toEqual([{ text: pack.copy.prompt(find('magnitude')) }]);
  });

  it('writes θ = □ องศา on an angle item, and k = □ where an unknown is asked for', () => {
    const angle = find('angle');
    expect(angle.kind).toBe('scalar');
    expect(answerAffix(angle)).toEqual({ before: 'θ =', after: 'องศา' });
    expect(answerAffix(find('perp'))).toEqual({ before: 'k =' });
    expect(answerAffix(find('magnitude'))).toBeNull();
  });

  it('shows the simplest form of a right answer typed another way (VECTORS §3.3)', () => {
    const magnitude = { kind: 'surd', value: Surd.parse('2√2') } as const;
    expect(simplifiedForm(['√8'], magnitude)).toBe('2√2');
    expect(simplifiedForm(['2√2'], magnitude)).toBeNull();
    const half = { kind: 'surd', value: Surd.parse('1/2√2') } as const;
    expect(simplifiedForm(['1/√2'], half)).toBe('√2/2');
    expect(simplifiedForm(['√2/2'], half)).toBeNull();
    const unit = {
      kind: 'vector',
      value: [Surd.parse('1/2√2'), Surd.parse('-1/2√2'), Surd.ZERO],
    } satisfies Answer;
    expect(simplifiedForm(['1/√2', '-√2/2', '0'], unit)).toBe('(√2/2, −√2/2, 0)');
  });

  it('counts an unsimplified root as right, as the classifier does', () => {
    const item = assemble('v_magnitude', 1, { form: 'magnitude', v: vec(2, 2) });
    const typed = parseAnswer('surd', { type: 'number', text: '√8' });
    if (!typed.ok) throw new Error('√8 should parse');
    expect(classify(item, typed.value)).toEqual({ type: 'correct' });
    expect(simplifiedForm(['√8'], typed.value)).toBe('2√2');
  });
});

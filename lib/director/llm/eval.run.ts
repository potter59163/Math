import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { commitAttempt, prepareAttempt } from '@/lib/director/rules';
import { newProfile } from '@/lib/director/turn';
import { misconceptionAnswer, slipAnswer, unknownAnswer } from '@/lib/sim/answers';
import { generate } from '@/lib/topics/matrix/generators';
import type { MisconceptionId } from '@/lib/topics/matrix/types';
import { generate as generateVector } from '@/lib/topics/vector/generators';
import type { TopicId } from '@/lib/topics/types';
import { llmConfig } from './config';
import { decideWithLlm } from './decide';
import { createProvider, type LlmProvider } from './providers';

// AI_DIRECTOR §6: every scenario three times against the real provider. It costs real money, and so it
// runs only by asking for it: LLM_PROVIDER=anthropic LLM_API_KEY=... npm run eval:director
// Vector scenarios need vectors switched on: NEXT_PUBLIC_TOPICS=matrix,vector.

const AT = 1_800_000_000_000;
const ROUNDS = 3;

type AttemptItem = Parameters<typeof prepareAttempt>[1]['item'];

interface Scenario {
  name: string;
  item: AttemptItem;
  answer: Parameters<typeof prepareAttempt>[1]['answer'];
  topic?: TopicId;
}

function caught(
  id: MisconceptionId,
  skill: Parameters<typeof generate>[0]['skill'],
  level: 1 | 2,
): Scenario {
  const item = generate({ skill, difficulty: level, seed: 7, target: id });
  return { name: `first catch of ${id}`, item, answer: misconceptionAnswer(item, id)! };
}

function right(skill: Parameters<typeof generate>[0]['skill'], level: 1 | 2 | 3): Scenario {
  const item = generate({ skill, difficulty: level, seed: 11 });
  return { name: `right on ${skill} L${level}`, item, answer: item.correct };
}

const scenarios: Scenario[] = [
  caught('M01_DIM_SWAP', 'dim', 1),
  caught('M09_MULT_ELEMENTWISE', 'mult', 1),
  caught('M12_DET2_FORMULA', 'det2', 1),
  caught('M13_DET3_SIGN', 'det3', 2),
  caught('M20_INV2_RECIPE', 'inv2', 2),
  caught('M05_SUB_REVERSED', 'addsub', 2),
  ...(['mult', 'transpose', 'scalar'] as const).map((skill) => {
    const item = generate({ skill, difficulty: 1, seed: 13 });
    return { name: `slip on ${skill}`, item, answer: slipAnswer(item) };
  }),
  ...(['det2', 'mult', 'inv2'] as const).map((skill) => {
    const item = generate({ skill, difficulty: 1, seed: 17 });
    return { name: `unknown on ${skill}`, item, answer: unknownAnswer(item) };
  }),
  right('dim', 1),
  right('mult', 2),
  right('det3', 2),
  right('inv2', 1),
  right('scalar', 2),
  right('transpose', 3),
  right('addsub', 1),
  right('det2', 2),
];

type VectorRequest = Parameters<typeof generateVector>[0];

function caughtVector(
  id: NonNullable<VectorRequest['target']>,
  skill: VectorRequest['skill'],
  level: 1 | 2,
): Scenario {
  const item = generateVector({ skill, difficulty: level, seed: 7, target: id });
  return {
    name: `first catch of ${id}`,
    item,
    answer: misconceptionAnswer(item, id)!,
    topic: 'vector',
  };
}

function rightVector(skill: VectorRequest['skill'], level: 1 | 2 | 3): Scenario {
  const item = generateVector({ skill, difficulty: level, seed: 11 });
  return { name: `right on ${skill} L${level}`, item, answer: item.correct, topic: 'vector' };
}

// The vector topic (docs/VECTORS.md), asked the same way, so the tutor's Thai and its choices are seen on
// roots, arrows and figures before students meet them.
const vectorScenarios: Scenario[] = [
  caughtVector('V09_MAG_NO_ROOT', 'v_magnitude', 1),
  caughtVector('V14_DOT_AS_DET', 'v_dot', 1),
  caughtVector('V20_CROSS_MIDDLE_SIGN', 'v_cross', 1),
  caughtVector('V06_SCALAR_PARTIAL', 'v_linear', 1),
  caughtVector('V02_EQUAL_IGNORES_DIRECTION', 'v_quantity', 2),
  (() => {
    const item = generateVector({ skill: 'v_points', difficulty: 2, seed: 13 });
    return { name: 'slip on v_points', item, answer: slipAnswer(item), topic: 'vector' as const };
  })(),
  rightVector('v_unit', 2),
  rightVector('v_angle', 2),
];

if (process.env.NEXT_PUBLIC_TOPICS?.includes('vector')) scenarios.push(...vectorScenarios);

it('director eval', async () => {
  const config = llmConfig();
  if (!config) throw new Error('Set LLM_PROVIDER=anthropic and LLM_API_KEY to run the eval.');
  const real = createProvider(config);
  let lastAnswer = '';
  const provider: LlmProvider = {
    completeJson: async (args) => {
      lastAnswer = await real.completeJson(args);
      return lastAnswer;
    },
  };
  const lines: string[] = [
    `# Director eval\n\nModel ${config.model}, thinking ${config.thinking ?? 'off'}\n`,
  ];
  const latencies: number[] = [];
  let valid = 0;
  let total = 0;
  const reasons = new Map<string, number>();

  for (const { name, item, answer, topic = 'matrix' } of scenarios) {
    lines.push(`## ${name}\n`);
    for (let round = 0; round < ROUNDS; round += 1) {
      lastAnswer = '';
      const student = newProfile({
        id: `eval-${round}`,
        units: [1, 2, 3, 4, 5],
        theme: 'game',
        activeTopic: topic,
      });
      const prepared = prepareAttempt(student, {
        item,
        answer,
        hintLevel: 0,
        timeMs: 30000,
        at: AT,
      });
      const decided = await decideWithLlm(prepared, {
        timeMs: 30000,
        hintLevel: 0,
        provider,
        timeoutMs: config.timeoutMs,
        now: Date.now,
      });
      total += 1;
      if (decided?.tutor.latencyMs !== undefined) latencies.push(decided.tutor.latencyMs);
      if (decided?.mode === 'llm') {
        valid += 1;
        const { turn } = commitAttempt({ ...prepared, mode: 'llm' }, decided.choice, decided.tutor);
        lines.push(`- ${turn.choice}: ${turn.message}`);
        for (const [beat, text] of Object.entries(turn.scenes[0]?.narration ?? {})) {
          lines.push(`  - ${beat}: ${text}`);
        }
        lines.push(`  - เหตุผล: ${turn.reason}`);
      } else {
        const reason = decided?.tutor.fallbackReason ?? 'none';
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
        lines.push(`- fell back: ${reason}`);
        if (lastAnswer) lines.push(`  - ตอบมาว่า: ${lastAnswer}`);
      }
    }
    lines.push('');
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const at = (share: number) => sorted[Math.floor((sorted.length - 1) * share)] ?? 0;
  const summary = [
    `Valid ${valid}/${total} (${((100 * valid) / total).toFixed(1)}%), target at least 95%`,
    `Latency p50 ${at(0.5)} ms, p75 ${at(0.75)} ms, p90 ${at(0.9)} ms, p95 ${at(0.95)} ms, limit ${config.timeoutMs} ms`,
    `Fallbacks: ${[...reasons].map(([reason, count]) => `${reason} ${count}`).join(', ') || 'none'}`,
    '',
    'Give each message below a score from 1 to 5 for correctness and tone (AI_DIRECTOR §6).',
    '',
  ];
  lines.splice(1, 0, ...summary);
  writeFileSync('eval-report.md', lines.join('\n'));
  console.log(summary.slice(0, 3).join('\n'));
}, 0);

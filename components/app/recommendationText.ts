import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Recommendation } from '@/lib/learner/recommend';
import { misconceptionShortOf, skillOf } from '@/lib/topics';

export interface Copy {
  template: string;
  values: Record<string, string>;
}

/** คิว's sentence for a recommendation as a template and its values, so names can be kept whole. */
export function recommendationCopy(recommendation: Recommendation): Copy {
  const copy = th.learn.recommend;
  switch (recommendation.kind) {
    case 'done':
      return { template: copy.done, values: {} };
    case 'fix':
      return {
        template: copy.fix,
        values: { m: misconceptionShortOf(recommendation.misconception) },
      };
    case 'nextCheck':
      return {
        template: copy.nextCheck,
        values: {
          skill: skillOf(recommendation.skill).nameTh,
          m: misconceptionShortOf(recommendation.misconception),
        },
      };
    case 'pretest': {
      const skill = skillOf(recommendation.skill).nameTh;
      const n = String(recommendation.known);
      if (recommendation.start === 'check' && recommendation.misconception) {
        return {
          template: copy.pretestCheck,
          values: { skill, m: misconceptionShortOf(recommendation.misconception) },
        };
      }
      if (recommendation.start === 'quick')
        return { template: copy.pretestQuick, values: { skill, n } };
      return recommendation.known > 0
        ? { template: copy.pretestLearn, values: { skill, n } }
        : { template: copy.pretestLearnNone, values: { skill } };
    }
    default:
      return {
        template: copy[recommendation.kind],
        values: { skill: skillOf(recommendation.skill).nameTh },
      };
  }
}

/** The same sentence as plain text. */
export function recommendationText(recommendation: Recommendation): string {
  const { template, values } = recommendationCopy(recommendation);
  return fillTokens(template, values);
}

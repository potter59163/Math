import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cohortFromLink } from '@/lib/sync/types';
import { welcomeRequest } from './schemas';

const welcome = (cohort: string | null) => ({
  displayName: 'ทดสอบ',
  avatar: 'sigma',
  theme: 'game',
  consent: true,
  ...(cohort && { cohort }),
});

describe('a trial link', () => {
  it.each(['m5-1', 'ห้องA', 'ม.5/1'])('keeps %s as the group', (label) => {
    expect(cohortFromLink(label)).toBe(label);
    expect(welcomeRequest.safeParse(welcome(label)).success).toBe(true);
  });

  it('drops what could not be kept', () => {
    expect(cohortFromLink(null)).toBeNull();
    expect(cohortFromLink('   ')).toBeNull();
    expect(cohortFromLink('x'.repeat(33))).toBeNull();
    expect(cohortFromLink('a\u0000b')).toBeNull();
  });

  it('never stops a student at the welcome screen, whatever the link holds', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 40 }), (text) => {
        const fromLink = new URLSearchParams([['cohort', text]]).get('cohort');
        expect(welcomeRequest.safeParse(welcome(cohortFromLink(fromLink))).success).toBe(true);
      }),
    );
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Mascot, type MascotMood } from './Mascot';

const MOODS: MascotMood[] = ['happy', 'thinking', 'cheer', 'party', 'oops', 'comfort', 'asleep'];
const FROWN = 'M26 47q6-6 12 0';
const SMILE = 'M25 43q7 6 14 0';

const draw = (mood: MascotMood, still = false) =>
  renderToStaticMarkup(<Mascot mood={mood} still={still} />);
const count = (markup: string, part: string) => markup.split(part).length - 1;

describe('Mascot', () => {
  it('is decoration in every mood, hidden from screen readers', () => {
    for (const mood of MOODS) expect(draw(mood)).toContain('aria-hidden="true"');
  });

  it('breathes and blinks while it waits', () => {
    const markup = draw('happy');
    expect(markup).toContain('animate-mascot-breathe');
    expect(markup).toContain('animate-mascot-blink');
  });

  it('moves only for a student who has not asked for less motion', () => {
    for (const mood of MOODS) {
      const markup = draw(mood);
      expect(count(markup, 'animate-')).toBeGreaterThan(0);
      expect(count(markup, 'motion-safe:animate-')).toBe(count(markup, 'animate-'));
    }
  });

  it('starts each mood with a move of its own', () => {
    expect(draw('cheer')).toContain('animate-mascot-hop');
    expect(draw('party')).toContain('animate-mascot-party');
    expect(draw('oops')).toContain('animate-mascot-shake');
    expect(draw('comfort')).toContain('animate-mascot-comfort');
    expect(draw('thinking')).toContain('animate-mascot-sway');
    for (const move of ['hop', 'party', 'shake', 'comfort', 'sway']) {
      expect(draw('happy')).not.toContain(`animate-mascot-${move}`);
    }
  });

  it('draws nothing that moves when it is asked to keep still', () => {
    for (const mood of MOODS) expect(draw(mood, true)).not.toContain('animate-');
  });

  it('lets the frown of a wrong answer give way to a smile, and shows the smile alone without motion', () => {
    const moving = draw('comfort');
    expect(moving).toContain(FROWN);
    expect(moving).toContain(SMILE);
    // Without the animation the frown keeps this class and stays unseen.
    expect(moving).toMatch(new RegExp(`d="${FROWN}"[^>]*class="opacity-0 `));
    const still = draw('comfort', true);
    expect(still).not.toContain(FROWN);
    expect(still).toContain(SMILE);
  });

  it('keeps a plain frown for a notice that something failed', () => {
    const markup = draw('oops');
    expect(markup).toContain(FROWN);
    expect(markup).not.toContain(SMILE);
  });

  it('sleeps with its eyes shut, and throws sparks only at a party', () => {
    expect(draw('asleep')).not.toContain('<circle');
    expect(draw('asleep')).not.toContain('animate-mascot-blink');
    expect(draw('asleep')).toContain('animate-mascot-zed');
    expect(draw('party')).toContain('animate-spark');
    expect(draw('party')).toContain('motion-reduce:hidden');
    expect(draw('cheer')).not.toContain('animate-spark');
  });
});

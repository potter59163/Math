import { it } from 'vitest';
import { recordTopic } from './voice.record';
import { MATRIX_VOICE } from './voice.take';

// `npm run voice` (or `npm run voice -- matrix` for this topic alone) with ELEVENLABS_API_KEY set:
// spends credits, so it stays out of `npm run check`. It prints what it would spend first, and
// `npm run voice:dry` stops there. A take whose lines have not changed is left exactly as it is.

it('records and cuts every matrix take that has changed', async () => {
  await recordTopic(MATRIX_VOICE);
});

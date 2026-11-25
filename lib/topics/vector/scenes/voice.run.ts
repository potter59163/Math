import { it } from 'vitest';
import { recordTopic } from '@/lib/topics/matrix/scenes/voice.record';
import { VECTOR_VOICE } from './voice';

// `npm run voice -- vector` with ELEVENLABS_API_KEY set records the vector takes (v_*) into their own
// manifest and folder, so no matrix line is recorded or moved. It prints the credits it would spend
// before it spends any, and `npm run voice:dry -- vector` stops there.

it('records and cuts every vector take that has changed', async () => {
  await recordTopic(VECTOR_VOICE);
});

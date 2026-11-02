'use client';

import { useEffect } from 'react';
import { clipVoice } from './voice';

/**
 * A phone will not play sound until a tap has played something, and the tap that opens a lesson comes
 * long before its first clip. So the first tap anywhere plays a moment of silence, and clips can speak.
 */
export function VoiceUnlock() {
  useEffect(() => {
    const unlock = () => clipVoice.unlock();
    const options = { capture: true, once: true };
    window.addEventListener('click', unlock, options);
    window.addEventListener('keydown', unlock, options);
    return () => {
      window.removeEventListener('click', unlock, options);
      window.removeEventListener('keydown', unlock, options);
    };
  }, []);
  return null;
}

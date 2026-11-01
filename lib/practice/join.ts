import { parseNumber } from '@/lib/core/parse';
import { ALL_UNITS } from '@/lib/learner/progress';
import type { LocalStudent, UnitId } from '@/lib/learner/types';

const CLASS_CODE = /^[A-Z0-9]{6}$/;
const MAX_SEAT = 99;
const MAX_NICKNAME_UNITS = 20;

export interface JoinForm {
  code: string;
  seat: string;
  nickname: string;
}

export interface JoinErrors {
  code?: 'invalid';
  seat?: 'invalid';
  nickname?: 'too_long';
}

export type JoinResult = { ok: true; student: LocalStudent } | { ok: false; errors: JoinErrors };

function parseSeat(text: string): number | null {
  const parsed = parseNumber(text);
  if (!parsed.ok || !parsed.value.isInteger()) return null;
  const seat = parsed.value.n;
  return seat >= 1 && seat <= MAX_SEAT ? seat : null;
}

/** Local join for Phase 2: nothing leaves the device, so there is no PIN to check yet. */
export function parseJoin(form: JoinForm, units: UnitId[] | null): JoinResult {
  const code = form.code.trim().toUpperCase();
  const seat = parseSeat(form.seat);
  const nickname = form.nickname.trim();

  const errors: JoinErrors = {};
  if (!CLASS_CODE.test(code)) errors.code = 'invalid';
  if (seat === null) errors.seat = 'invalid';
  if (nickname.length > MAX_NICKNAME_UNITS) errors.nickname = 'too_long';
  if (seat === null || Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    student: {
      id: `${code}-${seat}`,
      classCode: code,
      seatNo: seat,
      ...(nickname && { nickname }),
      units: units ?? [...ALL_UNITS],
    },
  };
}

/** Reads `?units=3,4` from /join, the stand-in for settings.unitsEnabled until Phase 5. */
export function parseUnits(param: string | null): UnitId[] | null {
  if (!param) return null;
  const units = new Set<UnitId>();
  for (const part of param.split(',')) {
    const unit = ALL_UNITS.find((candidate) => String(candidate) === part.trim());
    if (unit === undefined) return null;
    units.add(unit);
  }
  return [...units].sort((a, b) => a - b);
}

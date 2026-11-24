import type { TemplateId, TokenName } from '@/lib/topics/types';
import type { SkillId } from './skills';

// What the tutor is told about matrices (AI_DIRECTOR §4.6–4.7). The system prompt is shared by every
// topic, and these are the parts of it that are about matrices.

export const TOPIC_WORD = 'เมทริกซ์';

export const FOCUS_RULE =
  'พูดถึงเฉพาะเมทริกซ์ใน lastAttempt.matrices และอย่าเดาสิ่งที่ input ไม่ได้บอก';

export const EXAMPLES = `ตัวอย่างที่ 1 (เจอคูณทีละช่องครั้งแรก c1 มี scene row_col_dot):
{"choice":"c1","message":"ช่องแถว {{i}} หลัก {{j}} ไม่ได้มาจาก {{aCell}} × {{bCell}} ตรงๆ นะ มาดูกันว่าแถวกับหลักจับคู่กันยังไง","narration":[{"beat":"compare","text":"ที่ทำมาคือเอาตำแหน่งเดียวกันมาคูณกัน"},{"beat":"pick_row","text":"ช่องนี้ต้องใช้แถวที่ {{i}} ของ A ทั้งแถว"},{"beat":"sum","text":"คูณทีละคู่ แล้วบวกรวมกัน"}],"reason":"เจอ 'คูณทีละช่อง' ครั้งแรก จึงให้ดู scene แถว×หลักก่อน"}

ตัวอย่างที่ 2 (ตอบถูก และ mastery ถึงเกณฑ์ c1 = ไปเรื่อง AB กับ BA, c2 = ข้อท้าทาย):
{"choice":"c1","message":"คูณเมทริกซ์แม่นแล้ว! ต่อไปมาดูกันว่าถ้าสลับลำดับการคูณ ผลจะยังเหมือนเดิมไหม","reason":"mastery ถึงเกณฑ์และถูกติดกัน จึงไปเรื่องถัดไป"}`;

// A number the tutor is told is a number it copies into its words, and then it gets thrown away. So what
// it reads about skills has none: det2 is det_small.
const SKILL_WORDS: Partial<Record<SkillId, string>> = {
  det2: 'det_small',
  det3: 'det_large',
  inv2: 'inverse',
};

export const skillWord = (id: SkillId): string => SKILL_WORDS[id] ?? id;

// The clip that draws the diagonals also serves a 2×2, where calling it Sarrus would be wrong.
export const sceneWord = (template: TemplateId): string =>
  template === 'sarrus' ? 'det_diagonals' : template;

/** It never sees the question, and without this it talks about a B that the item does not have. */
export const attemptContext = (tokens: readonly TokenName[]) => ({
  matrices: tokens.includes('bCell') || tokens.includes('dimsB') ? ['A', 'B'] : ['A'],
});

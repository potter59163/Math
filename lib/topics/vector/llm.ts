import type { TemplateId, TokenName } from '@/lib/topics/types';
import type { SkillId } from './skills';

// What the tutor is told about vectors (AI_DIRECTOR §4.6–4.7). The system prompt is shared by every
// topic, and these are the parts of it that are about vectors. The tutor never sees the question, so
// the focus rule keeps it to what the input says. A number word like "สอง" in "รากที่สอง" would fail the
// validator too, so the examples talk around them.

export const TOPIC_WORD = 'เวกเตอร์';

export const FOCUS_RULE =
  'พูดถึงเฉพาะสิ่งที่ lastAttempt บอก ห้ามเดาเวกเตอร์หรือจุดในโจทย์ ถ้าใช้ {{i}} ให้เรียกว่า "องค์ประกอบที่ {{i}}" ไม่ใช่แถวหรือหลัก';

export const EXAMPLES = `ตัวอย่างที่ 1 (เจอลืมถอดรากครั้งแรก c1 มี scene worked_solution):
{"choice":"c1","message":"ยกกำลังแล้วบวกกันมาถูกทางแล้ว แต่ขนาดของเวกเตอร์ยังต้องถอดรากอีกขั้นนะ มาดูวิธีทำทีละขั้นกัน","reason":"เจอ 'ลืมถอดราก' ครั้งแรก จึงให้ดูวิธีทำก่อนแล้วให้ข้อทดสอบ"}

ตัวอย่างที่ 2 (ตอบถูก และ mastery ถึงเกณฑ์ c1 = ไปเรื่องผลคูณเชิงสเกลาร์, c2 = ข้อท้าทาย):
{"choice":"c1","message":"บวกลบเวกเตอร์ทีละองค์ประกอบได้แม่นแล้ว! ต่อไปมาลองผลคูณเชิงสเกลาร์ ที่คูณเวกเตอร์กันแล้วได้ออกมาเป็นจำนวนกัน","reason":"mastery ถึงเกณฑ์และถูกติดกัน จึงไปเรื่องถัดไป"}`;

// Vector skill ids hold no digits, so the tutor reads them as they are.
export const skillWord = (id: SkillId): string => id;

export const sceneWord = (template: TemplateId): string => template;

/** It never sees the question, so it is told what {{i}} counts when the item has one. */
export const attemptContext = (tokens: readonly TokenName[]) =>
  tokens.includes('i') ? { focus: 'component' } : {};

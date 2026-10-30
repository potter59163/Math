# AI Director

## 1. แบ่งหน้าที่

| ส่วน | ทำอะไร | ทำไมต้องเป็นส่วนนี้ |
|---|---|---|
| **Engine** | สร้างโจทย์ คำนวณเฉลย ตรวจคำตอบ วินิจฉัย ทำ worked steps ใส่ตัวเลขลง scene | ต้องถูก 100% และทำซ้ำได้ |
| **Rules director** | อัปเดต profile เสนอ candidates 2–4 ทางพร้อม score และเหตุผล ตัดสินเองได้ทั้งหมดถ้าไม่มี LLM | ปลอดภัย คาดเดาได้ ใช้ได้แม้ไม่มีเน็ตไป LLM |
| **LLM ("คิว")** | เลือก 1 candidate เขียนข้อความถึงนักเรียน เขียน narration ของ scene ให้ตรงกับความผิดของคนนั้น และเขียนเหตุผลให้ครู | ภาษาเป็นธรรมชาติ ใช้บริบทได้ละเอียดกว่ากฎ |

**ถ้ากรรมการถามว่า "ทำไมไม่ให้ AI ตรวจหรือสอนทั้งหมด":**
- LLM คิดเลขพลาดได้ และตรวจย้อนหลังยาก
- มี latency และค่าใช้จ่าย
- อาจล่มกลางคาบ

เราจึงให้ AI ตัดสินใจเรื่องการสอน แต่ตัวเลขทุกตัวผ่าน engine และทุกการตัดสินใจมีเหตุผลบันทึกไว้

---

## 2. Trigger: director ถูกเรียกเมื่อไหร่
- `session_start`: เปิด session
  - เริ่มที่ skill แรกที่ยังไม่ผ่านใน unit ที่เปิด
  - ถ้า pre-test พบ misconception ใน skill นั้น ข้อแรกจะเป็น probe
  - ถ้าข้อ pre-test ของ skill นั้นถูก ข้อแรกเป็น L2 (SPEC §7.1)
  - ถ้ายังไม่เคยดูคลิปนำของ skill นั้น ให้เล่นก่อนข้อแรก (SPEC §4)
- `after_attempt`: หลังส่งคำตอบทุกข้อ (1 call ต่อข้อ) item ปิดแล้ว จึงเฉลยได้ (`revealAllowed = true`)
- `student_request`: กด "ไม่เข้าใจ" ระหว่างทำข้อ
  - ห้ามเฉลย (`revealAllowed = false`)
  - scene ใช้ตัวอย่างพี่น้อง (seed ใหม่) แทนตัวเลขของข้อปัจจุบัน

---

## 3. Rules: สร้าง candidates (`lib/director/candidates.ts`)
ให้ `s` = skill ล่าสุด, `L` = level ของ s หลังปรับตาม SPEC §7.3 แล้ว, `last` = classification ล่าสุด ผลลัพธ์คือ candidates ที่ไม่ซ้ำกัน ไม่เกิน 4 ตัว เรียงตาม score แต่ละตัวมี `ruleReason` ภาษาไทยสำหรับครู (มีตัวเลขได้)

| กฎ | เงื่อนไข | candidates (score) |
|---|---|---|
| **R7 ติด** | ผิด attempt แรกติดกัน 3 ข้อใน s | worked_solution → item(s, L1) **.97** + แจ้งเตือนครู |
| **R6 ทบทวน** | ครบ 6 ข้อนับจากทบทวนครั้งก่อน, last = correct, ไม่อยู่ระหว่างแก้ misconception, และมี skill ที่ผ่านแล้วแต่ไม่เจอใน 10 ข้อ | review item(skill นั้น, L2) **.95** |
| **R1 misconception m** | last = misconception | scene(sceneFor(m), compare) → probe(s, L, target m) **.90** · probe(s, L, m) ไม่มี scene **.70** (**.92** ถ้าเคยดู scene ของ m ≥ 2 ครั้ง) · worked_solution → probe(s, max(L−1,1), m) **.60** |
| **R2 slip** | last = slip | item(s, L) **.80** · item(s, L) + hint L1 แนบ **.50** |
| **R3 ไม่รู้สาเหตุ** | last = unknown / shape_error | worked_solution → item(s, max(L−1,1)) **.80** · concept scene ของ s (SCENES §5.1) → item(s, L) **.60** |
| **R4 ผ่าน skill** | last = correct, mastered(s) และไม่มี m ที่ suspected/active ใน s | advance → skill ถัดไปที่ prereq ครบ (+ คลิปนำตาม SPEC §4) **.90** · ถ้าไม่มี skill ถัดไป: review item(skill ที่ไม่เจอนานสุด, L2) **.90** · challenge item(s, L3) **.50** (ถ้า s มี L3) |
| **R5 ยังไม่ผ่าน** | last = correct และ (ยังไม่ mastered หรือมี m ที่ suspected/active ใน s) | มี m ที่ suspected/active ใน s → probe(s, L, m) **.85** · item(s, L) **.80** (L ปรับขึ้นแล้วถ้าเข้าเงื่อนไขใน SPEC §7.3) |

- **ลำดับประเมิน:** R7 → R6 → (R1 | R2 | R3 | R4 | R5) ตาม `last`
- **รวม candidates:** ถ้า R7 หรือ R6 เข้าเงื่อนไข ให้ใส่ candidate ของมันร่วมกับของกฎหลัก แล้วเรียงตาม score
- **"probe":** item ที่มี `target` → generator สร้างข้อที่ candidate ของ m แยกได้ชัด
  - ระดับจริงมาจาก `probeLevel(s, m, L)` (MISCONCEPTIONS §4.1) ไม่ใช่ L ตรงๆ เพราะบางระดับไม่มีโจทย์แบบนั้น
- **advance:** ห้ามไป skill ที่ prereq ยังไม่ mastered (มี test) ส่วน prereq ที่อยู่ใน unit ที่ครูปิดให้ถือว่าผ่านแล้ว

### 3.1 Fixed path (กลุ่มควบคุม ใช้เฉพาะเมื่อเปิด `ab_split`)
- ทุก skill ตามลำดับ: คลิปนำ (SPEC §4 แต่ไม่ข้ามให้เอง) → 5 ข้อที่ระดับ [1,1,2,2,3] (skill ที่ไม่มี L3 ใช้ L2 แทน) → ไป skill ถัดไป
- **ตอบผิด:** แสดง feedback ทั่วไป + `worked_solution` เท่านั้น
- **ไม่มี:** probe, การปรับความยาก, การทบทวน, LLM, เหตุผลใน `PathStrip`
- ใช้เวลาเท่ากับกลุ่ม adaptive (ครูคุมเวลา) แล้วเทียบผลที่เวลาเท่ากัน

### 3.2 เส้นทางส่วนตัว (`pathStep`)
`NextTurn` มี `pathStep = { kind, skill, level, note }` เพื่อให้นักเรียนเห็นว่าขั้นนี้ถูกเลือกมาเพื่อตัวเอง
- **ที่มา:** server สร้าง `note` จาก candidate ที่ถูกเลือก โดยใช้ข้อความใน `lib/content/th.ts` ไม่ให้ LLM เขียน จึงทำงานเหมือนกันทั้งโหมด llm และ rules
- **ข้อจำกัด:** `note` ไม่เกิน 40 code units (1 บรรทัดที่ 360px) ไม่มีตัวเลข ไม่เฉลย และไม่ตัดสินตัวนักเรียน
- **การบันทึก:** เก็บใน `decisions.path_note` ให้หน้า `/learn` แสดงย้อนหลังได้

**ข้อความ (ร่าง ให้ Potter และครูตรวจ):**

| ขั้นที่เลือก | `note` |
|---|---|
| probe ของ m | เพิ่มข้อนี้เพราะเมื่อกี้{ชื่อสั้นของ m} |
| probe จาก pre-test | ตอน pre-test {ชื่อสั้นของ m} |
| scene แก้ความเข้าใจผิด m | พาดูคลิปนี้เพราะเมื่อกี้{ชื่อสั้นของ m} |
| ข้อระดับสูงขึ้น | ตอบถูกต่อเนื่อง เลยเพิ่มความท้าทาย |
| ข้อระดับต่ำลง | ปรับให้ง่ายลงก่อน แล้วค่อยไปต่อ |
| ข้อระดับเดิม | ฝึกอีกข้อให้แม่นขึ้น |
| วิธีทำทีละขั้น | พาดูทีละขั้นก่อนลองอีกข้อ |
| ข้อทบทวน | เรื่องนี้ผ่านมาสักพัก มาทบทวนกัน |
| ไปด่านต่อ | ผ่านเรื่องนี้แล้ว ไปเรื่องถัดไป |
| ข้ามคลิปนำเพราะ pre-test ถูก | เรื่องนี้ทำได้แล้ว เลยข้ามคลิปให้ |
| คลิปจากปุ่ม "ไม่เข้าใจ" | เปิดคลิปนี้ตามที่ขอ |

**ชื่อสั้นของ misconception (ไม่เกิน 16 code units):**
M01 ตอบมิติสลับกัน · M02 อ่านแถวหลักสลับ · M03 หมุนแทนการสะท้อน · M04 บวกต่างมิติ · M05 ลบสลับลำดับ · M07 คูณ k ไม่ครบช่อง · M08 ใช้กฎมิติผิด · M09 คูณทีละช่อง · M10 จับแถวคู่แถว · M11 คิดว่า AB = BA · M12 ใช้สูตร det ผิด · M13 เครื่องหมายผิด · M14 ลืมยกกำลัง k · M15 แยก det ของผลบวก · M18 ไม่ได้ดู det · M19 ดูแค่เลขศูนย์ · M20 ขาดขั้นอินเวอร์ส · M21 กลับเศษทีละช่อง

---

## 4. LLM contract

### 4.1 Input (`buildDirectorInput`)
ส่งเฉพาะที่จำเป็น เลือก ≤ 5 skills (ปัจจุบัน + prereq + ที่เพิ่งเจอ) ไม่มีข้อมูลระบุตัวตน
```json
{
  "trigger": "after_attempt",
  "revealAllowed": true,
  "session": { "itemsDone": 12, "minutes": 9 },
  "lastAttempt": { "skill": "mult", "level": 1, "result": "misconception",
                   "misconception": { "id": "M09_MULT_ELEMENTWISE", "nameTh": "คูณทีละช่อง" },
                   "timeSec": 41, "hintLevel": 0 },
  "skills": [{ "id": "mult", "nameTh": "คูณเมทริกซ์", "mastery": 0.31, "level": 1, "recentFirstTry": "✓✗" }],
  "misconceptions": [{ "id": "M09_MULT_ELEMENTWISE", "nameTh": "คูณทีละช่อง", "status": "suspected", "count": 1 }],
  "candidates": [
    { "id": "c1", "scene": "row_col_dot", "beats": ["compare","pick_row","pick_col","pair","multiply","sum","place"],
      "next": { "skill": "mult", "level": 1, "purpose": "probe", "target": "M09_MULT_ELEMENTWISE" },
      "ruleReason": "เจอคูณทีละช่องครั้งแรก → อธิบายด้วย scene แล้วให้ข้อทดสอบ" },
    { "id": "c2", "next": { "skill": "mult", "level": 1, "purpose": "probe", "target": "M09_MULT_ELEMENTWISE" },
      "ruleReason": "ให้ข้อทดสอบซ้ำโดยไม่อธิบาย" },
    { "id": "c3", "scene": "worked_solution",
      "next": { "skill": "mult", "level": 1, "purpose": "probe", "target": "M09_MULT_ELEMENTWISE" },
      "ruleReason": "ดูวิธีทำทีละขั้นแล้วให้ข้อทดสอบ" }
  ],
  "allowedTokens": ["i","j","aCell","bCell","studentCell","correctCell","dimsA","dimsB"]
}
```

### 4.2 Output schema (Zod)
```ts
export const LlmDecision = z.object({
  choice: z.string().regex(/^c[1-4]$/),
  message: z.string().min(1).max(160),              // ถึงนักเรียน
  narration: z.array(z.object({
    beat: z.string(),
    text: z.string().min(1).max(80),
  })).max(6).optional(),                             // เฉพาะ candidate ที่มี scene
  reason: z.string().min(1).max(200),               // ถึงครู
}).strict();
```

### 4.3 `validateDecision` (ไม่ผ่านข้อใดข้อหนึ่ง → fallback)
1. parse JSON + Zod → `schema_invalid`
2. `choice` อยู่ใน candidates → `choice_invalid`
3. `message` และ `narration[].text` ห้ามมีตัวเลข `/[0-9๐-๙]/` → `digit_violation` (`reason` ของครูมีตัวเลขได้)
4. token ทุกตัว `{{name}}` อยู่ใน `allowedTokens` · ถ้า `revealAllowed = false` ห้ามใช้ token ที่เฉลย → `token_violation`
5. ห้ามมี `{` หรือ `}` ที่ไม่ใช่ token
6. `narration[].beat` อยู่ใน beats ของ scene ที่เลือก และถ้า candidate ไม่มี scene ต้องไม่มี narration → `beat_invalid`
7. ผ่าน → server แทนค่า token แล้วสร้าง `NextTurn`

`fallback_reason` ที่เป็นไปได้: `disabled`, `timeout`, `rate_limited`, `provider_error`, `schema_invalid`, `choice_invalid`, `digit_violation`, `token_violation`, `beat_invalid`

### 4.4 Tokens (server คำนวณจาก item + คำตอบ)
| token | ความหมาย | เฉลย? |
|---|---|---|
| `{{i}}`, `{{j}}` | ช่องที่โฟกัส (1-based): ช่องแรกที่ผิด หรือช่องที่ diagnostic ต่างชัดที่สุด | ไม่ |
| `{{dimsA}}`, `{{dimsB}}` | เช่น "2×3" | ไม่ |
| `{{aCell}}`, `{{bCell}}` | ค่าใน A และ B ที่ตำแหน่ง (i, j) | ไม่ |
| `{{studentCell}}`, `{{studentAnswer}}` | ค่าที่นักเรียนตอบ | ไม่ |
| `{{k}}` | สเกลาร์ในโจทย์ | ไม่ |
| `{{correctCell}}`, `{{correctAnswer}}`, `{{det}}` | ค่าที่ถูก | **ใช่** (ใช้ได้เฉพาะเมื่อ revealAllowed) |

### 4.5 Latency และ fallback
1. client จัดประเภทคำตอบเองแล้วแสดง `FeedbackCard` ทันที (< 100 ms)
2. client ส่ง `POST /api/attempt`
3. server:
   - regenerate และ re-classify
   - อัปเดต profile และสร้าง candidates
   - ถ้าเปิด LLM และนักเรียนอยู่กลุ่ม adaptive → เรียก LLM ภายใน `LLM_TIMEOUT_MS` (4000)
4. ไม่ผ่าน / timeout / 429 → ใช้ทาง rules + ข้อความ default แล้ว log `fallback_reason`
5. `TutorBubble` cross-fade เป็นข้อความใหม่โดยไม่ทำให้ layout ขยับ

### 4.6 System prompt (ร่าง ปรับได้จากผล eval)
```
คุณคือ "{{tutorName}}" ติวเตอร์คณิตศาสตร์เรื่องเมทริกซ์ของนักเรียน ม.ปลาย ในแอป {{appName}}
งานของคุณ: เลือกขั้นต่อไปที่ดีที่สุดสำหรับนักเรียนคนนี้จาก candidates ที่ระบบให้มา แล้วเขียนข้อความสั้นๆ ถึงนักเรียน

กฎเด็ดขาด
1. ห้ามคำนวณ และห้ามเขียนตัวเลขใดๆ เอง (รวมเลขไทย) ใน message และ narration
   ถ้าต้องอ้างค่าหรือตำแหน่ง ให้ใช้ token ใน allowedTokens เท่านั้น เช่น {{i}}, {{aCell}}
2. choice ต้องเป็น id ที่อยู่ใน candidates
3. ถ้า revealAllowed เป็น false ห้ามใช้ token ที่เป็นคำตอบ
4. message ยาวไม่เกิน 2 ประโยค ภาษาไทยเป็นกันเอง สุภาพ ไม่ลงท้ายครับ/ค่ะ ใช้ "นะ" "กัน" ได้ อีโมจิไม่เกิน 1 ตัว
5. ถ้าผิด ให้ชี้ว่า "คลาดเคลื่อนตรงไหน" โดยอิงสิ่งที่นักเรียนทำจริง ห้ามตำหนิ ห้ามพูดว่าเก่งหรือไม่เก่ง
   ถ้าชม ให้ชมวิธีคิดหรือความพยายาม
6. narration ใส่ได้เฉพาะ beats ของ scene ที่เลือก beat ละ 1 บรรทัดสั้น
7. reason (สำหรับครู) อธิบายว่าเลือกเพราะอะไร โดยอ้างข้อมูลใน input
8. ตอบเป็น JSON ตาม schema เท่านั้น ห้ามมีข้อความอื่น

แนวการสอน
- เพิ่งเจอความเข้าใจผิดครั้งแรก → ให้เห็นจุดที่คลาดเคลื่อนด้วยตัวอย่างของเขาเอง แล้วให้ข้อทดสอบ
- เจอความเข้าใจผิดเดิมซ้ำ → เปลี่ยนวิธีอธิบาย (scene อื่นหรือวิธีทำทีละขั้น) และลดความยาก
- ถูกติดกันและเร็ว → เพิ่มความท้าทายหรือไปด่านต่อ
- รักษาอัตราตอบถูกให้อยู่ราว 70–85%
```

### 4.7 Few-shot
**ตัวอย่างที่ 1** (ใช้ input ใน §4.1):
```json
{"choice":"c1",
 "message":"ช่องแถว {{i}} หลัก {{j}} ไม่ได้มาจาก {{aCell}} × {{bCell}} ตรงๆ นะ มาดูกันว่าแถวกับหลักจับคู่กันยังไง",
 "narration":[
  {"beat":"compare","text":"ที่ทำมาคือเอาตัวเลขตำแหน่งเดียวกันมาคูณกัน"},
  {"beat":"pick_row","text":"ช่องนี้ต้องใช้แถวที่ {{i}} ของ A ทั้งแถว"},
  {"beat":"pick_col","text":"จับคู่กับหลักที่ {{j}} ของ B ทั้งหลัก"},
  {"beat":"sum","text":"คูณทีละคู่ แล้วบวกรวมกัน"}],
 "reason":"คำตอบตรงกับ 'คูณทีละช่อง' เป็นครั้งแรกใน skill นี้ จึงอธิบายด้วย scene แถว×หลักก่อนให้ข้อทดสอบ"}
```
**ตัวอย่างที่ 2** (ตอบถูก และ mastery ถึงเกณฑ์ · c1 = advance ไป `mult_noncomm`, c2 = challenge):
```json
{"choice":"c1",
 "message":"คูณเมทริกซ์แม่นแล้ว! ต่อไปมาดูกันว่าถ้าสลับลำดับการคูณ ผลจะยังเหมือนเดิมไหม",
 "reason":"mastery ของการคูณถึงเกณฑ์และตอบถูกครั้งแรกติดกันหลายข้อ จึงไปเรื่อง AB กับ BA"}
```

---

## 5. Logging
ทุกการตัดสินใจเขียนลงตาราง `decisions`
- **ข้อมูลที่บันทึก:** trigger, mode, candidates, choice, message, narration, reason, latency_ms, fallback_reason
- **ครูเห็น:** ใน dashboard
- **นักวิจัยใช้วัด:**
  - fallback rate
  - LLM เลือกต่างจาก rules บ่อยแค่ไหน
  - latency p50/p95

---

## 6. Eval (`npm run eval:director`)
1. **scenarios:** 20 ชุดใน `lib/director/__fixtures__/scenarios/*.json`
   - misconception ครั้งแรก 6
   - slip 3
   - unknown 3
   - ถูก/ผ่าน skill 4
   - ติด 2
   - ทบทวน 2
2. **รัน:** ทุก scenario 3 รอบด้วย LLM จริง
3. **report:** schema-valid %, choice-valid %, digit/token violations, latency p50/p95
4. **output:** เขียน `eval-report.md` พร้อมข้อความทั้งหมดให้ Potter ให้คะแนนความถูกต้องและน้ำเสียง 1–5
5. **เกณฑ์ผ่าน:**
   - valid ≥ 95%
   - p95 latency < timeout (หรือ fallback ทำงานถูก)
   - ไม่มีข้อความที่เฉลยผิดเงื่อนไข

---

## 7. Provider adapter
```ts
interface LlmProvider {
  name: 'gemini' | 'anthropic' | 'openai';
  completeJson(args: { system: string; user: string; timeoutMs: number; signal: AbortSignal })
    : Promise<{ text: string; latencyMs: number }>;
}
```
- เลือกผ่าน env: `LLM_PROVIDER` (`none` | `gemini` | `anthropic` | `openai`), `LLM_MODEL`, `LLM_API_KEY`, `LLM_TIMEOUT_MS`
- ใช้ JSON mode / structured output ของ provider ถ้ามี แต่ต้อง validate ด้วย Zod ทุกครั้ง
- เลือกโมเดลรุ่นเร็วและถูก ประเมินค่าใช้จ่ายจาก pricing ปัจจุบันของ provider
- **rate limit:**
  - นักเรียน 40 คนตอบราวคนละ 1 ข้อต่อนาที ≈ 40 calls/นาที
  - เช็ค RPM/RPD ของ tier ที่ใช้ ถ้าไม่พอให้ fallback ทำงาน หรือปิด LLM ในวันนั้น
- **terms:** บาง free tier อาจนำข้อมูลไปปรับปรุงบริการ ให้อ่านก่อนใช้ (เราไม่ส่งข้อมูลระบุตัวตนอยู่แล้ว)

---

## 8. Stretch: แชท "ถามคิว" (หลังส่งงาน ก่อน 14 ม.ค.)
- **endpoint:** `POST /api/tutor/chat`
- **tools:**
  - `compute(op, operands)` เรียก engine (add, sub, scalar, mul, transpose, det, inv)
  - `show_scene(template, mode)` เลือกจาก template ที่มี
- **guard:**
  - ตัวเลขทุกตัวในคำตอบต้องมาจากผล tool หรือจากคำถามของนักเรียน ไม่งั้นแทนด้วย "ขอโทษนะ ลองถามใหม่อีกที" แล้ว log
  - ตอบไม่เกิน 3 ประโยค
  - คุยนอกเรื่องให้ปฏิเสธอย่างสุภาพ
  - rate limit 10 ครั้งต่อนาที
  - log แบบไม่ระบุตัวตน

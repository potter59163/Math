# Research: pre/post test, การทดลอง, การวิเคราะห์

> **ปรับเมื่อ 1 พ.ย. 2569:** ไม่มีหน้าครูแล้ว นักเรียนเข้าด้วย Google จากลิงก์ `?cohort=` และทำ pre-test กับ post-test เองในแอป (ฟอร์มตามรหัสบัญชีแทนเลขที่คี่คู่) ส่วนการส่งออกใช้ `npm run export -- <cohort>` การทดลองในห้องยังต้องได้รับอนุญาตจากครูและโรงเรียนเหมือนเดิม

ข้อมูลส่วนนี้ใช้ตอบข้อ 7 ของแบบเสนอ (การนำไปใช้จริงและผลลัพธ์) ให้รายงานตามจริงในฐานะ **pilot ขนาดเล็ก**

## 1. คำถามวิจัย
1. **RQ1:** คะแนนความเข้าใจเรื่องเมทริกซ์หลังใช้แอปสูงขึ้นจากก่อนใช้หรือไม่ และมากน้อยเท่าไร (normalized gain, effect size)
2. **RQ2:** สัดส่วนนักเรียนที่มีความเข้าใจผิดแต่ละแบบลดลงหรือไม่ (เทียบก่อน–หลัง)
3. **RQ3:** ในแอป ความเข้าใจผิดถูกแก้สำเร็จ (resolved) กี่ % และใช้กี่ข้อ
4. **RQ4:** นักเรียนและครูประเมินแอปอย่างไร (ใช้แบบสอบถามชุดเดิมของ QEDify ปรับเป็นคณิต)
5. **RQ5 (ทำเมื่อมีนักเรียนพอ):** เส้นทางแบบ adaptive ดีกว่าเส้นทางตายตัวที่ใช้เวลาเท่ากันหรือไม่

## 2. รูปแบบการทดลอง
- **ค่าเริ่มต้น:** one-group pre-test/post-test (ทุกคนใช้ adaptive) เหมาะกับห้องเดียว 30–40 คน
- **`ab_split`:** ใช้เมื่อมี ≥ 2 ห้องหรือ ≥ 60 คน
  - หลัง pre-test เรียงนักเรียนตามคะแนน แล้วจับคู่คนที่คะแนนติดกัน
  - สุ่มในแต่ละคู่ให้ไป adaptive หรือ fixed (matched-pair randomization)
  - ปุ่มนี้เคยอยู่ใน dashboard ครูซึ่งตัดออกแล้ว ถ้าจะทำต้องเพิ่มสคริปต์จับคู่ที่เขียน `profiles.condition` ก่อน ส่วนแอปและ `analysis/analyze.py` รองรับสองกลุ่มอยู่แล้ว
- **ข้อจำกัดที่ต้องเขียนในรายงาน:** ไม่มีกลุ่มควบคุม (ถ้าไม่ได้ทำ A/B), n น้อย, ใช้แค่ช่วงสั้น, มี testing effect, วัดเฉพาะ unit ที่เปิด
- **โหมด AI ที่ใช้จริง:** ตั้งใจเปิด LLM ตอนทดลอง ถ้าใช้โหมด rules ทั้งหมดหรือบางส่วนต้องระบุในรายงาน และห้ามเขียนว่าผลมาจาก AI ที่คิดสด

## 3. ขั้นตอนในห้องเรียน (2 คาบ ห่างกันได้ไม่เกิน 1 สัปดาห์)
| คาบ | นาที | กิจกรรม |
|---|---|---|
| 1 | 5 | แนะนำ, สแกน QR ลิงก์ของกลุ่ม (`?cohort=`), ล็อกอิน Google, ให้ความยินยอม |
| 1 | 20 | pre-test ในแอป (หน้ากรอกผลสอบกระดาษตัดไปพร้อมหน้าครู ถ้าเน็ตล่มต้องเลื่อนไปคาบถัดไป) |
| 1 | 25 | ใช้แอป |
| 2 | 30 | ใช้แอป |
| 2 | 20 | post-test |
| หลังคาบ | 5 | แบบสอบถามนักเรียน (Google Form) · ครูทำแบบสอบถามครู |

**แอปกันลำดับไว้เอง เพราะไม่มีหน้าครูแล้ว:** pre-test ทำได้ก่อนฝึกข้อแรกเท่านั้น · post-test เปิดเมื่อฝึกครบ 10 ข้อ (`CONFIG.postTestAfterItems`) · ทำได้อย่างละครั้ง จึงต้องบอกนักเรียนว่ายังไม่ต้องกด post-test จนกว่าจะถึงคาบ 2

ระหว่างทดลอง Potter จดสังเกต เช่น ปัญหาที่เจอ จุดที่นักเรียนติด และคำพูดของนักเรียน ห้ามช่วยนักเรียนตอบ

### 3.1 เลือก unit ให้พอดีเวลา
**ตอนนี้แอปเปิดทุก unit เสมอ** เพราะตัดหน้าครูออก จึงตรงกับแถวแรกของตาราง ส่วนที่เหลือของหัวข้อนี้เก็บไว้สำหรับตอนเลือก unit ได้อีกครั้ง

ตกลงกับครูก่อนเปิด pre-test เพราะเปลี่ยนภายหลังไม่ได้ (SPEC §3) ถ้าเปิดครบทุก unit นักเรียนหลายคนจะไปไม่ถึง Unit 5 ทั้งที่ข้อสอบมีเนื้อหานั้น ทำให้คะแนนเพิ่มน้อยกว่าที่ควร การปิด unit ช่วยได้สองทาง คือมี skill น้อยลง และข้อสอบสั้นลงจึงเหลือเวลาใช้แอปมากขึ้น

| unit ที่เปิด | skill | ข้อสอบ | เวลาในแอป | ตอบถูก 90% | ตอบถูก 80% | ตอบถูก 70% |
|---|---|---|---|---|---|---|
| 1–5 | 13 | 14 ข้อ | 55 นาที | 95% | 30% | 1% |
| 2–5 | 10 | 11 ข้อ | 64 นาที | 100% | 86% | 22% |
| 3–5 | 8 | 9 ข้อ | 69 นาที | 100% | 98% | 59% |
| 3–4 | 6 | 7 ข้อ | 75 นาที | 100% | 100% | 96% |

สามคอลัมน์ขวาคือ % นักเรียนที่ผ่านครบทุก skill ที่เปิด **เป็นการประมาณเพื่อวางแผนเท่านั้น ห้ามใช้เป็นหลักฐาน**
- **สมมติฐาน:** 1 ข้อต่อนาที, scene แก้ความเข้าใจผิด 25 วิ, คลิปนำ 40 วิสำหรับ intro และ 20 วิสำหรับ concept scene (ข้ามเมื่อ pre-test ถูก), ข้อสอบ 20 นาทีต่อ 14 ข้อ, ความเข้าใจผิดเป็นครึ่งหนึ่งของคำตอบที่ผิด
- **กลุ่มนักเรียน:** กลุ่มตอบถูก 90%, 80% และ 70% สมมติว่า pre-test ถูก 60%, 40% และ 20% ตามลำดับ

**คำแนะนำ:** ถ้าครูยืนยันว่านักเรียนเคยเรียนพื้นฐานแล้ว ให้เปิด Unit 3–5 ซึ่งมี misconception ★ 12 จาก 18 แบบ ถ้าไม่แน่ใจให้เปิด Unit 2–5 ส่วนการเปิดครบทุก unit เหมาะกับการใช้ทบทวนมากกว่าการทดลอง 2 คาบ

## 4. ข้อสอบ pre/post (blueprint 14 ข้อ ~20 นาที)
- **ลักษณะ:** ไม่มี feedback, ไม่มี hint, ไม่ใช้เครื่องคิดเลข ข้อละ 1 คะแนน (ถูกแบบ exact)
- **บันทึก:** classification ของทุกข้อ เพื่อดูว่ามีความเข้าใจผิดแบบไหน
- **ถ้าเวลาไม่พอ:** ตัดข้อ 7, 9, 14 ออก
- **ตาม unit ที่เปิด:** แสดงเฉพาะข้อของ unit ที่เปิด ทั้ง pre และ post รวมถึงฟอร์มพิมพ์ (ข้อ 1–3 = Unit 1, ข้อ 4–5 = Unit 2, ข้อ 6–9 = Unit 3, ข้อ 10–12 = Unit 4, ข้อ 13–14 = Unit 5)
- **ความเข้าใจผิดที่วัดได้:** ข้อสอบเต็มวัดได้ 15 จาก 18 แบบ ไม่มีข้อวัด M04, M15, M18 และถ้าตัดข้อ 14 จะวัด M19 ไม่ได้ด้วย

| # | skill | kind | วินิจฉัย | สเปค |
|---|---|---|---|---|
| 1 | dim | dims | M01 | A 2×3 หรือ 3×2 |
| 2 | index | cell | M02 | 3×3 เลขไม่ซ้ำ ถาม aᵢⱼ ที่ i ≠ j |
| 3 | transpose | matrix | M03 | 2×3 เลขไม่ซ้ำ (grid 3×2) |
| 4 | addsub | matrix | M05 | A − B โดย B มีลบ ≥ 2 ช่อง |
| 5 | scalar | matrix | M07 | kA, k ∈ {2,3} ไม่มีศูนย์ |
| 6 | mult_defined | dims_or_undefined | M08 | AB หาได้ และ m ≠ p |
| 7 | mult_defined | dims_or_undefined | M08 SAME_DIMS | A, B เป็น 2×3 ทั้งคู่ (หาค่าไม่ได้) |
| 8 | mult | matrix | M09, M10, M11 | 2×2·2×2 ที่ทุก candidate แยกกันได้ |
| 9 | mult_noncomm | choice | M11 | "AB = BA เสมอ" จริง/เท็จ |
| 10 | det2 | scalar | M12 | bc ≠ 0, det ≠ 0 |
| 11 | det3 | scalar | M13 | 3×3 มีศูนย์ 1 ตัว |
| 12 | det_props | scalar | M14 | n = 3, det A = d, หา det(kA) |
| 13 | inv2 | matrix | M20, M21 | \|det\| ∈ {2,3,4} ไม่มีศูนย์ |
| 14 | invertible | choice | M19 | มีศูนย์ 1 ตัว แต่ det ≠ 0 |

### 4.1 ฟอร์ม A/B
- **สร้าง:** generator ชุดเดียวกัน แต่ seed คงที่ต่างกัน (เก็บใน `lib/topics/matrix/assessment.ts`) ได้ข้อสอบโครงสร้างเดียวกันคนละตัวเลข
- **counterbalance:**
  - เลขที่คี่: pre = A, post = B
  - เลขที่คู่: pre = B, post = A
- **ครูต้องตรวจทั้งสองฟอร์มก่อนใช้:**
  - ถ้าทำได้ ให้ครูคณิต 3 คนประเมินความตรงเชิงเนื้อหา (IOC, Rovinelli & Hambleton, 1977) แล้วเก็บข้อที่ IOC ≥ 0.5
  - ถ้าแก้ข้อ ให้เปลี่ยน seed แล้วบันทึกใน DECISIONS.md
- **มีหน้าพิมพ์พร้อมเฉลย:** สำรองไว้สอบบนกระดาษ แล้วกรอกคำตอบเข้าระบบภายหลัง (หน้า admin สำหรับกรอก)

## 5. ข้อมูลที่ต้องได้ (CSV export)
- **รายตาราง:** attempts, decisions, scene_views, hint_events, assessments, assessment_responses, learner_profiles
- **`research_wide.csv` (1 แถวต่อนักเรียน):**
  - ตัวตน: alias, condition, form_pre, form_post
  - คะแนน: pre_score, post_score (และ %) คิดจากข้อที่สอบจริง
  - misconception: `pre_Mxx` / `post_Mxx` ของทุก ★ · 1 = พบ · 0 = มีข้อวัดแต่ไม่พบ · ว่าง = ฟอร์มนั้นไม่มีข้อวัด (ห้ามใส่ 0 เพราะจะอ่านเหมือนไม่มีความเข้าใจผิด)
  - การใช้งาน: units_enabled, minutes_in_app, items_done, skills_reached, skills_mastered, scenes_viewed, hints_used, reveals
  - ผลในแอป: misconceptions_resolved, median_items_to_resolve
  - LLM: llm_decisions, fallback_rate
- **ไม่มีชื่อเล่นใน export:** ใช้ alias เช่น S-17

## 6. การวิเคราะห์ (`analysis/analyze.py`, Python + pandas + scipy + matplotlib)
1. **Descriptive:** n, ค่าเฉลี่ยและ SD ของ pre และ post (%)
2. **Paired:** mean diff + 95% CI · paired t-test และ Wilcoxon signed-rank (รายงานทั้งคู่เพราะ n น้อย) · Cohen's d_z = mean(diff)/sd(diff)
3. **Normalized gain (Hake, 1998):**
   - ระดับห้อง: g = (post% − pre%) / (100 − pre%) จากค่าเฉลี่ยของห้อง
   - ระดับคน: เฉลี่ยรายคน โดยตัดคนที่ pre = 100%
   - ตัวอย่างตรวจแล้ว: pre 40%, post 70% → g = 0.5
4. **Misconception prevalence:** % นักเรียนที่มี Mxx ก่อนและหลัง เฉพาะ Mxx ที่มีข้อวัด (ค่าว่างไม่นับเป็น 0)
   - McNemar แบบ exact = binomial test บนคู่ที่เปลี่ยนสถานะ (b เทียบ c, p = 0.5)
5. **ในแอป:** % misconception ที่ resolved, median items/เวลาที่ใช้แก้, อัตรา relapse, สัดส่วน decision โหมด llm/rules, fallback rate
6. **ตามความครอบคลุม (เชิงสำรวจ):** gain เฉพาะข้อของ skill ที่นักเรียนเรียนถึง รายงานคู่กับผลหลักเท่านั้น เพราะคนที่เรียนถึงอาจเก่งกว่าอยู่แล้ว จึงสรุปเป็นผลของแอปไม่ได้
7. **ถ้า ab_split:** เทียบ gain ระหว่างกลุ่มด้วย Mann–Whitney U + rank-biserial r พร้อมเตือนเรื่อง power ต่ำ
8. **Output:**
   - `analysis/out/report.md`
   - กราฟ `pre_post.png`, `misconceptions.png`, `gain_hist.png` (ป้ายภาษาไทย ใช้ฟอนต์ไทย)

**ข้อห้าม:**
- **ห้ามใช้ผลจาก simulated learners (`npm run sim`) เป็นหลักฐาน:** ใช้ได้แค่ทดสอบระบบ
- **ห้ามเติมหรือแก้ข้อมูล:** ถ้า n น้อยก็รายงานตามจริง

## 7. แบบสอบถาม
- **ฐาน:** ใช้ชุดเดิมของ QEDify แต่เปลี่ยนเนื้อหาเป็นคณิต
  - นักเรียน: ความพึงพอใจ, ใช้งานง่าย, รับรู้ว่าได้เรียนรู้
  - ครู: สอดคล้องหลักสูตร, การประเมินผล, นำไปใช้ได้
- **เพิ่มข้อเฉพาะงานนี้:**
  - "animation ช่วยให้เข้าใจว่าผิดตรงไหน"
  - "คำแนะนำของคิวตรงกับสิ่งที่ฉันทำผิด"
  - "บทเรียนนี้ถูกปรับมาให้เหมาะกับฉัน"
  - "เหตุผลของ AI ใน dashboard ช่วยครูตัดสินใจ" (ครู)

## 8. จริยธรรม
- ครูที่ปรึกษาและโรงเรียนอนุญาต
- consent ในแอป (SPEC §15) และของผู้ปกครองถ้าโรงเรียนกำหนด
- นักเรียนหยุดได้ทุกเมื่อ ผลไม่มีผลต่อคะแนนวิชา (ยืนยันกับครู)
- ลบข้อมูลภายใน 31 มี.ค. 2570

## 9. เอกสารอ้างอิงหลัก (ใช้ในแบบเสนอได้)
- Brown, J. S., & Burton, R. R. (1978). Diagnostic models for procedural bugs in basic mathematical skills. *Cognitive Science, 2*(2), 155–192.
- Corbett, A. T., & Anderson, J. R. (1994). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction, 4*(4), 253–278.
- Hake, R. R. (1998). Interactive-engagement versus traditional methods: A six-thousand-student survey of mechanics test data for introductory physics courses. *American Journal of Physics, 66*(1), 64–74.
- Mayer, R. E. (2009). *Multimedia learning* (2nd ed.). Cambridge University Press.
- Mayer, R. E. (2014). *Computer games for learning: An evidence-based approach.* MIT Press.
- Rovinelli, R. J., & Hambleton, R. K. (1977). On the use of content specialists in the assessment of criterion-referenced test item validity. *Dutch Journal of Educational Research, 2*, 49–60.
- VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist, 46*(4), 197–221.
- **To-do:** หา paper ที่ศึกษาความเข้าใจผิดเรื่องเมทริกซ์ของนักเรียนมัธยมโดยตรงมาอ้างประกอบ catalog

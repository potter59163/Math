# Misconception catalog (bug library)

**แนวคิด:** ใช้หลัก "buggy rules" (Brown & Burton, 1978) ข้อผิดพลาดเชิงระบบทำนายคำตอบผิดได้ เราเขียนความเข้าใจผิดแต่ละแบบเป็นฟังก์ชัน `candidate(item)` ที่คืน "คำตอบที่คนเข้าใจผิดแบบนี้จะตอบ" แล้วเทียบกับคำตอบนักเรียนแบบ exact

- ★ = MVP (ต้องมีก่อนทดลอง) · ☆ = stretch
- **ตัวอย่างทุกตัวในไฟล์นี้คำนวณด้วยเศษส่วน exact แล้ว** ให้ใช้เป็น unit test ได้ตรงๆ ถ้าโค้ดได้ไม่ตรง แปลว่าโค้ดผิด
- เขียนเมทริกซ์แบบแถวต่อแถว: `[[a, b], [c, d]]`, ค่าที่ 1-based: aᵢⱼ = แถว i หลัก j

---

## 1. Classification

```ts
type Classification =
  | { type: 'correct' }
  | { type: 'misconception'; id: MisconceptionId; variant?: string }
  | { type: 'slip'; cell: [number, number] }      // ผิดช่องเดียว (1-based)
  | { type: 'shape_error' }
  | { type: 'unknown' };
```
ลำดับการตรวจ (หยุดที่อันแรกที่ตรง):
1. `equals(answer, item.correct)` → `correct`
2. วน `item.diagnostics` (target ก่อน แล้วตามลำดับ catalog) ถ้า `equals(answer, d.answer)` → `misconception(d.id, d.variant)`
   - `d.answer` ของ M04 เป็นค่าพิเศษ `ANY_MATRIX` ซึ่งตรงกับเมทริกซ์ใดๆ ที่นักเรียนกรอกมา
3. kind เป็น matrix หรือ matrix_or_undefined, shape เท่ากัน และผิด **1 ช่องพอดี** → `slip`
4. kind เป็น matrix หรือ matrix_or_undefined และ shape ไม่เท่า (หรือตอบ "หาค่าไม่ได้" ทั้งที่หาได้) → `shape_error`
5. นอกนั้น → `unknown` (log คำตอบดิบไว้ ครูดูได้ และใช้หา misconception ใหม่ภายหลัง)

---

## 2. `validateItem`: ทำให้การวินิจฉัยเชื่อถือได้

Generator ต้องสุ่มใหม่ (seed ถัดไป) จนผ่านทุกข้อ:
1. **ไม่ชนคำตอบถูก:** ทุก diagnostic ≠ คำตอบที่ถูก
2. **ไม่ชนกันเอง:** diagnostics ต่างกันทุกคู่
   - ถ้าสองตัวชนกัน ให้ตัด variant ที่ลำดับต่ำกว่าทิ้ง
   - ถ้าตัวที่ชนเป็น target ให้สุ่มใหม่
3. **ห่างจาก slip:**
   - สำหรับ matrix: diagnostic ที่ shape เท่ากับคำตอบต้องต่างจากคำตอบถูก **≥ 2 ช่อง** ไม่งั้นจะแยกไม่ออกจากการคิดเลขพลาดช่องเดียว
   - ตัวอย่างที่ต้อง reject: k=3, A=[[1,−2],[0,4]] → 3A=[[3,−6],[0,12]], candidate FIRST_ROW = [[3,−6],[0,4]] ต่างกันแค่ 1 ช่อง เพราะ 3·0 = 0
4. **target ต้องแยกได้:** ถ้า item มี `target` ต้อง applicable และผ่าน 1–3
5. **ขนาดตัวเลขตามระดับ:**
   - ค่าใน grid และผลลัพธ์อยู่ในช่วงของระดับ (SPEC §3)
   - L1–L2: |ผลคูณย่อย| ≤ 60, |ผลลัพธ์| ≤ 150
   - inverse: ตัวส่วน ≤ 12
6. **invertible:** โจทย์อินเวอร์สต้องมี det ≠ 0 และตรวจซ้ำว่า A·A⁻¹ = I แบบ exact

คำตอบแบบ scalar (เช่น det) ใช้ข้อ 3 ไม่ได้ จึงอาจชนกับเลขที่คิดพลาดโดยบังเอิญ เราลดความเสี่ยงด้วย state machine ที่ต้องเห็น ≥ 2 ครั้งก่อนจะเป็น `active` (SPEC §7.2)

---

## 3. Catalog

แต่ละรายการระบุ: id · ชื่อไทย · skill · kind · สูตร candidate · ใช้ได้เมื่อ · ตัวอย่าง · scene · hint (L2)

### Unit 1: พื้นฐาน

**M01_DIM_SWAP ★ สลับมิติ (ตอบหลัก×แถว)**
- **skill:** `dim` · **kind:** dims
- **candidate:** A เป็น m×n แต่ตอบ n×m
- **ใช้ได้เมื่อ:** m ≠ n
- **ตัวอย่าง:** A เป็น 2×3 → ถูก 2×3 · candidate 3×2
- **scene:** `dimension_match` (single)
- **hint:** "นับแถว (แนวนอน) ก่อน แล้วค่อยนับหลัก (แนวตั้ง)"

**M02_INDEX_SWAP ★ อ่าน aᵢⱼ เป็นแถว j หลัก i**
- **skill:** `index` · **kind:** cell
- **candidate:** ค่าของ aⱼᵢ
- **ใช้ได้เมื่อ:** aⱼᵢ มีอยู่ และ aⱼᵢ ≠ aᵢⱼ
- **ตัวอย่าง:** A=[[5,8,1],[2,7,4],[9,3,6]] ถาม a₂₃ → ถูก 4 · candidate 3 (= a₃₂)
- **scene:** `cell_locator` (Tier B, fallback `worked_solution`)

**M03_TRANSPOSE_WRONG ★ ทรานสโพสด้วยการหมุนหรือพลิก แทนการสะท้อนตามเส้นทแยงหลัก**
- **skill:** `transpose` · **kind:** matrix
- **variants:**
  - `ROT_CW`: new[i][j] = A[m−1−j][i]
  - `ROT_CCW`: new[i][j] = A[j][n−1−i]
  - `ANTI`: สะท้อนตามเส้นทแยงรอง, new[i][j] = A[m−1−j][n−1−i]
  - สำหรับเมทริกซ์จัตุรัสเท่านั้น (เพราะ MVP ให้ขนาด grid): `FLIP_H`, `FLIP_V`, `SAME`
- **ตัวอย่าง:** A=[[1,2,3],[4,5,6]] → ถูก Aᵀ=[[1,4],[2,5],[3,6]]
  - ROT_CW: [[4,1],[5,2],[6,3]]
  - ROT_CCW: [[3,6],[2,5],[1,4]]
  - ANTI: [[6,3],[5,2],[4,1]]
- **scene:** `transpose_flip` (Tier B, fallback `worked_solution`)
- **hint:** "แถวที่ 1 กลายเป็นหลักที่ 1, แถวที่ 2 กลายเป็นหลักที่ 2…"

### Unit 2: บวก ลบ คูณสเกลาร์

**M04_ADD_DIM_MISMATCH ★ คิดว่าบวก/ลบเมทริกซ์ต่างมิติได้**
- **skill:** `addsub` · **kind:** matrix_or_undefined
- **candidate:** โจทย์มิติไม่เท่ากัน (คำตอบถูก = "หาค่าไม่ได้") แต่นักเรียนกรอกเมทริกซ์ใดๆ มา จึงใช้ `d.answer = ANY_MATRIX` แทนคำตอบค่าเดียว (property test ใช้เมทริกซ์สุ่มตามขนาด grid)
- **ตัวอย่าง:** A เป็น 2×2, B เป็น 2×3 แล้วถาม A + B (grid เป็น 2×2 ตามมิติของ A)
- **scene:** `dimension_match` (add)
- **hint:** "บวกลบได้เฉพาะเมทริกซ์มิติเดียวกันเท่านั้น"

**M05_SUB_REVERSED ★ ลบสลับลำดับ (คิด B − A)**
- **skill:** `addsub` · **kind:** matrix หรือ matrix_or_undefined
- **candidate:** B − A
- **ใช้ได้เมื่อ:** A ≠ B
- **ตัวอย่าง:** A=[[5,2],[−1,3]], B=[[1,−4],[−2,6]] → ถูก A−B=[[4,6],[1,−3]] · candidate [[−4,−6],[−1,3]]
- **scene:** `worked_solution`

**M06_SUB_DOUBLE_NEG ☆ ลบด้วยจำนวนลบผิด (a − (−b) คิดเป็น a − b)**
- **skill:** `addsub` · **kind:** matrix
- **candidate:** ช่องที่ bᵢⱼ < 0 ใช้ aᵢⱼ + bᵢⱼ ช่องอื่นใช้ aᵢⱼ − bᵢⱼ
- **ใช้ได้เมื่อ:** B มีจำนวนลบ ≥ 2 ช่อง (กฎ ≥ 2 ช่อง)
- **ตัวอย่าง (A, B เดิม):** candidate [[4,−2],[−3,−3]]

**M07_SCALAR_PARTIAL ★ คูณสเกลาร์ไม่ครบทุกช่อง**
- **skill:** `scalar` · **kind:** matrix
- **variants:**
  - `FIRST_ROW`: คูณ k แค่แถวแรก (สับสนกับสมบัติ det ที่คูณทีละแถว)
  - `DIAGONAL`: คูณแค่แนวทแยง
  - `ADD`: บวก k แทนการคูณ
- **ตัวอย่าง:** k=3, A=[[1,−2],[5,4]] → ถูก [[3,−6],[15,12]]
  - FIRST_ROW: [[3,−6],[5,4]]
  - DIAGONAL: [[3,−2],[5,12]]
  - ADD: [[4,1],[8,7]]
- **scene:** `worked_solution` (ไฮไลต์ทุกช่อง)
- **hint:** "k ต้องคูณเข้าไปทุกช่อง"

### Unit 3: การคูณเมทริกซ์

**M08_MULT_DIM_RULE ★ กฎมิติของการคูณผิด**
- **skill:** `mult_defined` · **kind:** dims_or_undefined
- **variants** (A เป็น m×n, B เป็น r×p):
  - `SAME_DIMS`: ตัดสินว่าคูณได้ก็ต่อเมื่อมิติเท่ากันทั้งคู่
    - ตอบ "ได้" เมื่อ dims(A) = dims(B) แต่ n ≠ r
    - หรือตอบ "ไม่ได้" เมื่อ n = r แต่มิติไม่เท่ากัน
  - `RESULT_INNER`: ตอบมิติผลคูณเป็น n×n (มิติด้านใน)
  - `RESULT_FIRST`: ตอบเป็น m×n (มิติของ A)
  - `RESULT_SWAPPED`: ตอบเป็น p×m
- **ใช้ได้เมื่อ:**
  - RESULT_INNER: n×n ≠ m×p
  - RESULT_FIRST: n ≠ p
  - RESULT_SWAPPED: p ≠ m
- **ตัวอย่าง:**
  - A 2×3, B 3×4 → AB เป็น 2×4 · RESULT_INNER 3×3 · RESULT_FIRST 2×3 · RESULT_SWAPPED 4×2
  - BA หาค่าไม่ได้ (4 ≠ 2)
  - A 2×3, B 2×3 → AB หาค่าไม่ได้ · ถ้าตอบ "ได้ มิติ 2×3" คือ SAME_DIMS
- **scene:** `dimension_match` (mult)
- **hint:** "ตัวเลขด้านในต้องเท่ากัน ส่วนตัวเลขด้านนอกคือมิติของผลคูณ"

**M09_MULT_ELEMENTWISE ★ คูณทีละช่อง**
- **skill:** `mult` · **kind:** matrix
- **candidate:** A∘B (aᵢⱼ·bᵢⱼ)
- **ใช้ได้เมื่อ:** dims(A) = dims(B) (จัตุรัส)
- **ตัวอย่าง:** A=[[2,1],[3,4]], B=[[1,5],[2,0]] → ถูก AB=[[4,10],[11,15]] · candidate [[2,5],[6,0]]
- **scene:** `row_col_dot` (compare, variant elementwise)
- **hint:** "ช่องแถว i หลัก j ใช้แถว i ของ A ทั้งแถว คู่กับหลัก j ของ B ทั้งหลัก"

**M10_MULT_ROW_ROW ★ ใช้แถวคูณแถว (หรือหลักคูณหลัก)**
- **skill:** `mult` · **kind:** matrix
- **variants:**
  - `ROW_ROW`: A·Bᵀ (ใช้ได้เมื่อ cols(A) = cols(B))
  - `COL_COL`: Aᵀ·B (ใช้ได้เมื่อ rows(A) = rows(B))
- **ตัวอย่าง (A, B เดิม):** ROW_ROW [[7,4],[23,6]] · COL_COL [[8,10],[9,5]] (ต่างจาก AB 3 ช่อง ✓)
- **scene:** `row_col_dot` (compare, variant row_row หรือ col_col)

**M11_MULT_COMMUTATIVE ★ คิดว่า AB = BA**
- **skill:** `mult`, `mult_noncomm` · **kind:** matrix หรือ choice
- **candidate:**
  - (matrix) BA เมื่อถาม AB หรือ AB เมื่อถาม BA (`mult_noncomm` L2)
  - (choice) เลือก "AB = BA เสมอ เป็นจริง" หรือตอบว่าคู่นี้สลับที่ได้ทั้งที่ไม่ได้
- **ใช้ได้เมื่อ:** (matrix) AB ≠ BA
- **ตัวอย่าง (A, B เดิม):** BA = [[17,21],[4,2]]
- **scene:**
  - ข้อ matrix: `row_col_dot` (compare, variant reversed)
  - ข้อ choice: `grid_transform` (compose)

### Unit 4: ดีเทอร์มิแนนต์

**M12_DET2_FORMULA ★ สูตร det 2×2 ผิด**
- **skill:** `det2` · **kind:** scalar
- **variants** (A=[[a,b],[c,d]]):
  - `ADD`: ad + bc
  - `REVERSE`: bc − ad
  - `PAIRS_ROW`: ab − cd
  - `PAIRS_COL`: ac − bd
- **ใช้ได้เมื่อ:** bc ≠ 0 และ det ≠ 0 (ให้ทุก variant แยกกันได้)
- **ตัวอย่าง:** A=[[2,1],[3,4]] → ถูก 5 · ADD 11 · REVERSE −5 · PAIRS_ROW −10 · PAIRS_COL 2
- **scene:** `sarrus` (โหมด 2×2, Tier B, fallback `worked_solution`)
- **hint:** "ทแยงลง (ad) ลบ ทแยงขึ้น (bc)"

**M13_DET3_SIGN ★ det 3×3 เครื่องหมายผิด**
- **skill:** `det3` · **kind:** scalar
- **variants** (แถว [a,b,c],[d,e,f],[g,h,i]):
  - `ALL_PLUS`: บวกผลคูณทั้ง 6 เส้นของ Sarrus
  - `NO_ALT_SIGN`: a·M₁₁ + b·M₁₂ + c·M₁₃ (กระจาย cofactor โดยไม่สลับเครื่องหมาย)
  - `TWO_DIAG`: aei − ceg (ใช้แค่ 2 เส้น)
- **ตัวอย่าง:** A=[[2,1,3],[0,−1,4],[1,2,1]]
  - เส้นลง: aei=−2, bfg=4, cdh=0
  - เส้นขึ้น: ceg=−3, afh=16, bdi=0
  - ถูก (−2+4+0) − (−3+16+0) = **−11**
  - ALL_PLUS 15 · NO_ALT_SIGN −19 (minors −9, −4, 1) · TWO_DIAG 1
- **scene:** `sarrus` (Tier B, fallback `worked_solution`)
- **hint:** "3 เส้นลงเป็นบวก 3 เส้นขึ้นเป็นลบ"

**M14_DET_SCALAR_LINEAR ★ คิดว่า det(kA) = k·det(A)**
- **skill:** `det_props` · **kind:** scalar
- **candidate:** k·d (ที่ถูกคือ kⁿ·d)
- **ใช้ได้เมื่อ:** k ∉ {0, 1}, d ≠ 0, n ≥ 2 (และกรณี k = −1 กับ n คี่ให้ตัดทิ้ง เพราะได้ค่าเท่ากัน)
- **ตัวอย่าง:** A เป็น 3×3, det(A)=4, k=2 → ถูก 32 · candidate 8
- **scene:** `grid_transform` (scale_k: ขยาย 2 แกน พื้นที่ขยาย k² เท่า)
- **hint:** "k คูณเข้าไปทุกแถว แต่ละแถวดึง k ออกมาได้ 1 ตัว"

**M15_DET_ADDITIVE ★ คิดว่า det(A+B) = det A + det B**
- **skill:** `det_props` · **kind:** scalar
- **candidate:** det A + det B
- **ใช้ได้เมื่อ:** ค่านี้ ≠ det(A+B)
- **ตัวอย่าง:** P=[[1,2],[3,4]] (det −2), Q=[[2,0],[1,3]] (det 6) → P+Q=[[3,2],[4,7]], det = 13 · candidate 4
- **scene:** `worked_solution`

**M16_DET_INVERSE ☆ det(A⁻¹) ผิด**
- **skill:** `det_props`
- **variants:** `NEG` (−d) และ `SAME` (d) · ที่ถูกคือ 1/d
- **ใช้ได้เมื่อ:** d ∉ {±1}

**M17_DET_TRANSPOSE_NEG ☆ คิดว่า det(Aᵀ) = −det A**
- **skill:** `det_props`
- **candidate:** −d
- **ใช้ได้เมื่อ:** d ≠ 0

### Unit 5: อินเวอร์ส

**M18_INV_SINGULAR ★ คิดว่ามีอินเวอร์สทั้งที่ det = 0**
- **skill:** `invertible` · **kind:** choice
- **ตัวอย่าง:** [[2,4],[1,2]] (det 0) ถ้าตอบ "มี" → M18
- **scene:** `grid_transform` (det_zero: แบนเป็นเส้น ย้อนกลับไม่ได้)

**M19_INV_ZERO_ENTRY ★ คิดว่ามีสมาชิกเป็น 0 แล้วจะไม่มีอินเวอร์ส**
- **skill:** `invertible` · **kind:** choice
- **ตัวอย่าง:** [[0,3],[2,5]] (det −6) ถ้าตอบ "ไม่มี" → M19
- **scene:** `grid_transform` (undo)
- **hint:** "ดูที่ det ไม่ใช่ดูว่ามี 0 ไหม"

**M20_INV2_RECIPE ★ สูตรอินเวอร์ส 2×2 ขาดขั้น**
- **skill:** `inv2` · **kind:** matrix
- **ที่ถูก:** A⁻¹ = (1/det)·[[d, −b], [−c, a]]
- **variants:**
  - `NO_SWAP`: (1/det)[[a,−b],[−c,d]]
  - `NO_NEGATE`: (1/det)[[d,b],[c,a]]
  - `NO_DIVIDE`: [[d,−b],[−c,a]]
  - `TIMES_DET`: det·[[d,−b],[−c,a]]
  - `TRANSPOSED`: (1/det)[[d,−c],[−b,a]]
- **ใช้ได้เมื่อ:**
  - NO_DIVIDE และ TIMES_DET: |det| ≥ 2 (ระดับ L1 ใช้ det = ±1 ห้าม target สองตัวนี้)
  - NO_SWAP: a ≠ d
  - NO_NEGATE: b, c ≠ 0
  - TRANSPOSED: b ≠ c
- **ตัวอย่าง:** A=[[3,1],[4,2]], det = 2 → ถูก A⁻¹=[[1, −1/2], [−2, 3/2]]
  - NO_SWAP [[3/2, −1/2], [−2, 1]]
  - NO_NEGATE [[1, 1/2], [2, 3/2]]
  - NO_DIVIDE [[2, −1], [−4, 3]]
  - TIMES_DET [[4, −2], [−8, 6]]
  - TRANSPOSED [[1, −2], [−1/2, 3/2]]
  - (ทุกตัวต่างจากคำตอบถูก ≥ 2 ช่อง ✓)
- **scene:** `inverse_recipe` (compare: ไฮไลต์ขั้นที่ขาด)
- **hint:** "สลับ (a↔d) → กลับเครื่องหมาย (b, c) → หารด้วย det"

**M21_INV_RECIPROCAL ★ คิดว่าอินเวอร์สคือกลับเศษทีละช่อง**
- **skill:** `inv2` · **kind:** matrix
- **candidate:** [[1/a, 1/b], [1/c, 1/d]]
- **ใช้ได้เมื่อ:** ไม่มีสมาชิกเป็น 0
- **ตัวอย่าง (A เดิม):** [[1/3, 1], [1/4, 1/2]]
- **scene:** `inverse_recipe` (intro "อินเวอร์สไม่ใช่การกลับเศษทีละตัว")

**M22_INV_PRODUCT_ORDER ☆ คิดว่า (AB)⁻¹ = A⁻¹B⁻¹**
- **skill:** `props`
- **ใช้ได้เมื่อ:** AB ≠ BA
- **ตัวอย่าง:** X=[[1,1],[0,1]], Y=[[1,0],[1,1]] → XY=[[2,1],[1,1]] → ถูก (XY)⁻¹=[[1,−1],[−1,2]] (= Y⁻¹X⁻¹) · candidate X⁻¹Y⁻¹=[[2,−1],[−1,1]]
- **scene:** `grid_transform` (undo + "ใส่ถุงเท้าแล้วใส่รองเท้า ตอนถอดต้องถอดรองเท้าก่อน")

**M23_TRANSPOSE_PRODUCT_ORDER ☆ คิดว่า (AB)ᵀ = AᵀBᵀ**
- **skill:** `props`
- **ตัวอย่าง (X, Y เดิม):** ถูก (XY)ᵀ=[[2,1],[1,1]] (= YᵀXᵀ) · candidate XᵀYᵀ=[[1,1],[1,2]]

---

## 4. Diagnostic items สำหรับ "probe"
เมื่อ director ขอ `target: Mxx` generator ต้องสร้างข้อที่ candidate ของ Mxx ใช้ได้และแยกได้ชัด (§2) และถ้าเป็นไปได้ ให้ดีไซน์ข้อให้ "ล่อ" misconception นั้น เช่น
- **M09:** ใช้ 2×2 ที่ A∘B ดูเป็นคำตอบที่น่าเชื่อ
- **M20 NO_SWAP:** ใช้ a กับ d ที่ต่างกันมาก

### 4.1 ระดับที่สร้าง probe ได้
บางระดับไม่มีโจทย์แบบที่ misconception นั้นต้องใช้ เช่น `addsub` L1 มีแต่การบวก จึงทดสอบการลบสลับลำดับไม่ได้ ทุกแบบมีระดับ L1 หรือ L2 รองรับ จึงเลื่อนการทำ L3 ได้โดยไม่เสียการจับ misconception ★

| misconception | skill | ระดับ | หมายเหตุ |
|---|---|---|---|
| M01 | `dim` | L1, L2, L3 | |
| M02 | `index` | L1, L2, L3 | |
| M03 | `transpose` | L1, L2, L3 | |
| M04 | `addsub` | L2, L3 | L1 มีแต่มิติเท่ากัน |
| M05 | `addsub` | L2, L3 | L1 มีแต่การบวก |
| M07 | `scalar` | L1, L2 | L3 (`2A − 3B`) ยังไม่มีสูตร candidate |
| M08 | `mult_defined` | L1, L2 | L3 (ABC) ยังไม่มีสูตร candidate |
| M09 | `mult` | L1, L2 | ใช้ 2×2 · L3 ไม่มีคู่ที่มิติเท่ากัน |
| M10 | `mult` | L1, L2, L3 | L1–L2 ใช้ 2×2 · L3 ROW_ROW ใช้ 2×3·3×3 และ COL_COL ใช้ 3×3·3×1 |
| M11 | `mult` | L1, L2 | ใช้ 2×2 · L3 หา BA ไม่ได้ |
| M11 | `mult_noncomm` | L1, L2, L3 | L1 และ L3 เป็น choice · L2 ให้ AB มาแล้วถาม BA |
| M12 | `det2` | L1, L2 | L3 เป็น ☆ |
| M13 | `det3` | L1, L2, L3 | |
| M14 | `det_props` | L1, L2 | L3 ไม่มีโจทย์ det(kA) |
| M15 | `det_props` | L2 | |
| M18 | `invertible` | L1, L2, L3 | |
| M19 | `invertible` | L2, L3 | L1 ไม่มีสมาชิกเป็น 0 |
| M20 | `inv2` | L1, L2, L3 | NO_DIVIDE และ TIMES_DET ใช้ได้เฉพาะ L2–L3 |
| M21 | `inv2` | L1, L2, L3 | |

**`probeLevel(skill, m, L)`** คืนระดับในตารางที่ใกล้ L ที่สุด
- **ตัวอย่าง (ใช้เป็น test ได้):** probeLevel(addsub, M05, 1) = 2 · probeLevel(mult, M09, 3) = 2 · probeLevel(det_props, M15, 1) = 2 · probeLevel(invertible, M19, 1) = 2 · probeLevel(mult, M09, 1) = 1 · probeLevel(mult, M10, 3) = 3
- **ผู้เรียก:** candidate ทุกตัวที่มี target ต้องผ่านฟังก์ชันนี้ก่อนเรียก generator
- **ระดับที่ถูกเลื่อน:** มีผลเฉพาะข้อนั้น ไม่เปลี่ยนระดับของ skill แต่นับตามระดับจริงของข้อตอนตรวจ Mastered
- **ถ้ายังสร้างไม่ได้ตอนใช้งานจริง:** API ต้องไม่ล้ม ให้ log แล้วออกข้อ `item(s, L)` ที่ไม่มี target แทน

---

## 5. เพิ่ม misconception ใหม่ (checklist)
1. เขียนลงไฟล์นี้: id, ชื่อไทย, skill, สูตร, ใช้ได้เมื่อ, ตัวอย่างที่คำนวณแล้ว, แถวในตาราง §4.1
2. เพิ่ม `candidate` + `applies` ใน `misconceptions.ts`
3. unit test จากตัวอย่าง + property test (candidate → classify เป็นตัวเอง และไม่ชน correct)
4. ผูก scene และ hint ใน `lib/content/th.ts` (`// TODO(review)`)
5. ถ้าเพิ่มหลังเริ่มทดลอง ให้ bump `generatorVersion` และบันทึกใน DECISIONS.md

แหล่งไอเดีย misconception ใหม่: คำตอบ `unknown` ที่เจอบ่อยใน log ระหว่าง pilot

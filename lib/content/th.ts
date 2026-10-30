import { CONFIG } from '@/lib/config';

// All Thai UI copy lives here. Draft copy stays marked TODO(review) until Potter and a math teacher check it.
export const th = {
  home: {
    // TODO(review)
    tagline: 'ฝึกเมทริกซ์ทีละขั้น ดูคลิปสั้นๆ แล้วลองทำเอง',
    // TODO(review)
    description: `ถ้าตอบผิด ${CONFIG.tutorName}จะพาดูว่าคลาดเคลื่อนตรงไหน แล้วเลือกขั้นต่อไปให้เหมาะกับคุณ`,
    // TODO(review)
    numberSample: 'ตัวอย่างตัวเลขในเมทริกซ์',
    // TODO(review)
    status: 'กำลังสร้าง เปิดให้เรียนเร็วๆ นี้',
  },

  // Names from docs/SPEC.md §3.
  skills: {
    dim: 'มิติของเมทริกซ์',
    index: 'ตำแหน่งสมาชิก aᵢⱼ',
    transpose: 'ทรานสโพส',
    addsub: 'บวก/ลบเมทริกซ์',
    scalar: 'คูณด้วยสเกลาร์',
    mult_defined: 'คูณได้ไหม / มิติผลคูณ',
    mult: 'คูณเมทริกซ์',
    mult_noncomm: 'AB กับ BA',
    det2: 'det 2×2',
    det3: 'det 3×3',
    det_props: 'สมบัติของ det',
    invertible: 'มีอินเวอร์สไหม',
    inv2: 'อินเวอร์ส 2×2',
  },

  // Names from docs/MISCONCEPTIONS.md §3.
  misconceptionNames: {
    M01_DIM_SWAP: 'สลับมิติ (ตอบหลัก×แถว)',
    M02_INDEX_SWAP: 'อ่าน aᵢⱼ เป็นแถว j หลัก i',
    M03_TRANSPOSE_WRONG: 'ทรานสโพสด้วยการหมุนหรือพลิก แทนการสะท้อนตามเส้นทแยงหลัก',
    M04_ADD_DIM_MISMATCH: 'คิดว่าบวก/ลบเมทริกซ์ต่างมิติได้',
    M05_SUB_REVERSED: 'ลบสลับลำดับ (คิด B − A)',
    M07_SCALAR_PARTIAL: 'คูณสเกลาร์ไม่ครบทุกช่อง',
    M08_MULT_DIM_RULE: 'กฎมิติของการคูณผิด',
    M09_MULT_ELEMENTWISE: 'คูณทีละช่อง',
    M10_MULT_ROW_ROW: 'ใช้แถวคูณแถว (หรือหลักคูณหลัก)',
    M11_MULT_COMMUTATIVE: 'คิดว่า AB = BA',
    M12_DET2_FORMULA: 'สูตร det 2×2 ผิด',
    M13_DET3_SIGN: 'det 3×3 เครื่องหมายผิด',
    M14_DET_SCALAR_LINEAR: 'คิดว่า det(kA) = k·det(A)',
    M15_DET_ADDITIVE: 'คิดว่า det(A+B) = det A + det B',
    M18_INV_SINGULAR: 'คิดว่ามีอินเวอร์สทั้งที่ det = 0',
    M19_INV_ZERO_ENTRY: 'คิดว่ามีสมาชิกเป็น 0 แล้วจะไม่มีอินเวอร์ส',
    M20_INV2_RECIPE: 'สูตรอินเวอร์ส 2×2 ขาดขั้น',
    M21_INV_RECIPROCAL: 'คิดว่าอินเวอร์สคือกลับเศษทีละช่อง',
  },

  // L2 hints (SPEC §9). Unmarked ones come from docs/MISCONCEPTIONS.md §3.
  hints: {
    M01_DIM_SWAP: 'นับแถว (แนวนอน) ก่อน แล้วค่อยนับหลัก (แนวตั้ง)',
    // TODO(review)
    M02_INDEX_SWAP: 'ใน aᵢⱼ ตัวเลขแรกคือแถว ตัวเลขหลังคือหลัก ดูแถวก่อนแล้วค่อยดูหลัก',
    M03_TRANSPOSE_WRONG: 'แถวที่ 1 กลายเป็นหลักที่ 1, แถวที่ 2 กลายเป็นหลักที่ 2…',
    M04_ADD_DIM_MISMATCH: 'บวกลบได้เฉพาะเมทริกซ์มิติเดียวกันเท่านั้น',
    // TODO(review)
    M05_SUB_REVERSED: 'A − B คือเอาค่าใน A ตั้ง แล้วลบด้วยค่าใน B ทีละช่อง',
    M07_SCALAR_PARTIAL: 'k ต้องคูณเข้าไปทุกช่อง',
    M08_MULT_DIM_RULE: 'ตัวเลขด้านในต้องเท่ากัน ส่วนตัวเลขด้านนอกคือมิติของผลคูณ',
    M09_MULT_ELEMENTWISE: 'ช่องแถว i หลัก j ใช้แถว i ของ A ทั้งแถว คู่กับหลัก j ของ B ทั้งหลัก',
    // TODO(review)
    M10_MULT_ROW_ROW: 'ตัวหน้าใช้แถว ตัวหลังใช้หลัก: แถวของ A ต้องคู่กับหลักของ B เสมอ',
    // TODO(review)
    M11_MULT_COMMUTATIVE: 'สลับลำดับการคูณแล้วผลมักเปลี่ยน AB กับ BA ต้องคิดแยกกัน',
    M12_DET2_FORMULA: 'ทแยงลง (ad) ลบ ทแยงขึ้น (bc)',
    M13_DET3_SIGN: '3 เส้นลงเป็นบวก 3 เส้นขึ้นเป็นลบ',
    M14_DET_SCALAR_LINEAR: 'k คูณเข้าไปทุกแถว แต่ละแถวดึง k ออกมาได้ 1 ตัว',
    // TODO(review)
    M15_DET_ADDITIVE: 'det แยกผลบวกไม่ได้ ต้องบวกเมทริกซ์ให้เสร็จก่อน แล้วค่อยหา det',
    // TODO(review)
    M18_INV_SINGULAR: 'ลองหา det ก่อน ถ้า det เป็น 0 จะย้อนกลับไม่ได้ จึงไม่มีอินเวอร์ส',
    M19_INV_ZERO_ENTRY: 'ดูที่ det ไม่ใช่ดูว่ามี 0 ไหม',
    M20_INV2_RECIPE: 'สลับ (a↔d) → กลับเครื่องหมาย (b, c) → หารด้วย det',
    // TODO(review)
    M21_INV_RECIPROCAL: 'อินเวอร์สไม่ใช่การกลับเศษทีละตัว ใช้ขั้นตอน สลับ → กลับเครื่องหมาย → หาร',
  },

  // Item prompts. Unmarked ones come from docs/SPEC.md §5.
  prompts: {
    // TODO(review)
    dim_find: 'เมทริกซ์ A มีมิติเท่าใด',
    // TODO(review)
    index_find: 'จงหา a{{sub}}',
    // TODO(review)
    transpose_find: 'จงหา Aᵀ',
    // TODO(review)
    addsub_add: 'จงหา A + B',
    // TODO(review)
    addsub_sub: 'จงหา A − B',
    // TODO(review)
    scalar_find: 'จงหา {{k}}A',
    // TODO(review)
    combo_find: 'จงหา {{p}}A − {{q}}B',
    mult_defined_ab:
      'A มีมิติ {{dimsA}} และ B มีมิติ {{dimsB}} แล้ว AB หาค่าได้ไหม ถ้าได้มีมิติเท่าใด',
    // TODO(review)
    mult_defined_ba:
      'A มีมิติ {{dimsA}} และ B มีมิติ {{dimsB}} แล้ว BA หาค่าได้ไหม ถ้าได้มีมิติเท่าใด',
    // TODO(review)
    mult_defined_abc:
      'A มีมิติ {{dimsA}}, B มีมิติ {{dimsB}} และ C มีมิติ {{dimsC}} แล้ว ABC หาค่าได้ไหม ถ้าได้มีมิติเท่าใด',
    mult_find: 'จงหา AB',
    // TODO(review)
    noncomm_always_equal: 'ถ้า A และ B เป็นเมทริกซ์จัตุรัสมิติเดียวกัน แล้ว AB = BA เสมอ',
    // TODO(review)
    noncomm_may_differ: 'มีเมทริกซ์จัตุรัส A และ B มิติเดียวกันที่ทำให้ AB ≠ BA',
    // TODO(review)
    noncomm_swap_keeps_product: 'ถ้าสลับลำดับการคูณจาก AB เป็น BA ผลคูณจะไม่เปลี่ยนเสมอ',
    // TODO(review)
    noncomm_find_ba: 'กำหนด A, B และ AB ให้ จงหา BA',
    // TODO(review)
    noncomm_pair: 'เมทริกซ์คู่นี้สลับที่การคูณได้ไหม (AB = BA หรือไม่)',
    det_find: 'จงหา det(A)',
    det_scaled: 'ถ้า A เป็นเมทริกซ์ {{n}}×{{n}} และ det(A) = {{d}} จงหา det({{k}}A)',
    // TODO(review)
    det_product:
      'A และ B เป็นเมทริกซ์จัตุรัสมิติเดียวกัน โดย det(A) = {{p}} และ det(B) = {{q}} จงหา det(AB)',
    // TODO(review)
    det_sum: 'จงหา det(A + B)',
    // TODO(review)
    det_transpose: 'ถ้า det(A) = {{d}} จงหา det(Aᵀ)',
    // TODO(review)
    det_inverse: 'ถ้า det(A) = {{d}} จงหา det(A⁻¹)',
    // TODO(review)
    invertible_find: 'เมทริกซ์ A มีอินเวอร์สไหม',
    // TODO(review)
    inv2_find: 'จงหา A⁻¹',
  },

  choices: {
    // TODO(review)
    true: 'จริง',
    // TODO(review)
    false: 'เท็จ',
    // TODO(review)
    has_inverse: 'มี',
    // TODO(review)
    no_inverse: 'ไม่มี',
    // TODO(review)
    swap_yes: 'สลับได้',
    // TODO(review)
    swap_no: 'สลับไม่ได้',
  },

  // Captions of worked-solution steps. Formulas come from the engine as LaTeX.
  worked: {
    // TODO(review)
    dim_rows: 'นับแถว (แนวนอน) ได้ {{rows}} แถว',
    // TODO(review)
    dim_cols: 'นับหลัก (แนวตั้ง) ได้ {{cols}} หลัก',
    // TODO(review)
    dim_result: 'มิติเขียนเป็น แถว × หลัก',
    // TODO(review)
    index_locate: 'ไปที่แถว {{i}} แล้วดูหลัก {{j}}',
    // TODO(review)
    transpose_row: 'แถวที่ {{i}} ของ A กลายเป็นหลักที่ {{i}} ของ Aᵀ',
    // TODO(review)
    transpose_result: 'ได้ Aᵀ',
    // TODO(review)
    addsub_dims: 'ดูมิติ: A เป็น {{dimsA}} และ B เป็น {{dimsB}}',
    // TODO(review)
    addsub_undefined: 'มิติไม่เท่ากัน จึงหาค่าไม่ได้',
    // TODO(review)
    addsub_cell: 'ช่องแถว {{i}} หลัก {{j}}',
    // TODO(review)
    addsub_result: 'ครบทุกช่องแล้ว',
    // TODO(review)
    scalar_cell: 'คูณ {{k}} เข้าไปที่ช่องแถว {{i}} หลัก {{j}}',
    // TODO(review)
    scalar_result: 'ครบทุกช่องแล้ว',
    // TODO(review)
    combo_scale_a: 'คูณ A ด้วย {{p}}',
    // TODO(review)
    combo_scale_b: 'คูณ B ด้วย {{q}}',
    // TODO(review)
    combo_cell: 'ลบกันที่ช่องแถว {{i}} หลัก {{j}}',
    // TODO(review)
    combo_result: 'ครบทุกช่องแล้ว',
    // TODO(review)
    defined_inner: 'ดูตัวเลขด้านใน: {{n}} กับ {{r}}',
    // TODO(review)
    defined_result: 'ตัวในเท่ากัน มิติของผลคูณคือตัวเลขด้านนอก',
    // TODO(review)
    defined_undefined: 'ตัวในไม่เท่ากัน จึงหาค่าไม่ได้',
    // TODO(review)
    abc_first: 'เริ่มจาก AB',
    // TODO(review)
    abc_second: 'ต่อด้วย (AB)C',
    // TODO(review)
    mult_cell: 'ช่องแถว {{i}} หลัก {{j}}: แถว {{i}} ของตัวหน้า คู่กับหลัก {{j}} ของตัวหลัง',
    // TODO(review)
    mult_result: 'ครบทุกช่องแล้ว',
    // TODO(review)
    noncomm_example: 'ลองดูตัวอย่างคู่หนึ่ง: คูณ XY',
    // TODO(review)
    noncomm_example_swapped: 'สลับลำดับเป็น YX',
    // TODO(review)
    noncomm_example_differ: 'ได้ผลต่างกัน จึงสรุปว่า AB กับ BA อาจไม่เท่ากัน',
    // TODO(review)
    noncomm_ab: 'หา AB',
    // TODO(review)
    noncomm_ba: 'หา BA',
    // TODO(review)
    noncomm_same: 'ได้ผลเท่ากัน คู่นี้สลับที่ได้',
    // TODO(review)
    noncomm_differ: 'ได้ผลต่างกัน คู่นี้สลับที่ไม่ได้',
    // TODO(review)
    det2_formula: 'ทแยงลง (ad) ลบ ทแยงขึ้น (bc)',
    // TODO(review)
    det3_down: 'รวม 3 เส้นลง',
    // TODO(review)
    det3_up: 'รวม 3 เส้นขึ้น',
    // TODO(review)
    det3_result: 'เส้นลง ลบ เส้นขึ้น',
    // TODO(review)
    det_scaled_rule: 'k คูณเข้าไป {{n}} แถว จึงดึง k ออกมาได้ {{n}} ตัว',
    // TODO(review)
    det_scaled_value: 'แทนค่า',
    // TODO(review)
    det_product_rule: 'det ของผลคูณเท่ากับผลคูณของ det',
    // TODO(review)
    det_sum_add: 'บวกเมทริกซ์ให้เสร็จก่อน',
    // TODO(review)
    det_sum_det: 'แล้วค่อยหา det',
    // TODO(review)
    det_transpose_rule: 'ทรานสโพสไม่เปลี่ยนค่า det',
    // TODO(review)
    det_inverse_rule: 'det ของอินเวอร์สคือส่วนกลับของ det',
    // TODO(review)
    invertible_det: 'หา det ก่อน',
    // TODO(review)
    invertible_has: 'det ไม่เป็น 0 จึงมีอินเวอร์ส',
    // TODO(review)
    invertible_none: 'det เป็น 0 จึงไม่มีอินเวอร์ส',
    // TODO(review)
    inv2_swap: 'สลับ a กับ d',
    // TODO(review)
    inv2_negate: 'กลับเครื่องหมาย b กับ c',
    // TODO(review)
    inv2_det: 'หา det = ad − bc',
    // TODO(review)
    inv2_divide: 'หารทุกช่องด้วย det',
  },
} as const;

export type PromptKey = keyof typeof th.prompts;
export type ChoiceKey = keyof typeof th.choices;
export type HintKey = keyof typeof th.hints;
export type WorkedKey = keyof typeof th.worked;

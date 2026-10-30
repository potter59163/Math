import { describe, expect, it } from 'vitest';
import { classify, countDiffCells } from '@/lib/core/classify';
import { Rational } from '@/lib/core/rational';
import { ANY_MATRIX, type Answer, type DiagnosticAnswer } from '@/lib/core/types';
import { assemble } from './generators';
import { add, det2, inv2, matrix, minor, mul, sarrusLines, scalar, sub, transpose } from './ops';
import { validateMatrixItem } from './rules';
import type { MatrixItem, MisconceptionId } from './types';

// Every number in this file is copied from docs/MISCONCEPTIONS.md. If code disagrees, the code is wrong.

type Cell = number | string;

const mat = (rows: Cell[][]): Answer => ({ kind: 'matrix', value: matrix(rows) });
const num = (value: Cell): Answer => ({ kind: 'scalar', value: Rational.parse(String(value)) });
const dims = (rows: number, cols: number): Answer => ({ kind: 'dims', rows, cols });
const choice = (id: string): Answer => ({ kind: 'choice', id });
const UNDEFINED: Answer = { kind: 'undefined' };

function diagnosticAnswer(
  item: MatrixItem,
  id: MisconceptionId,
  variant?: string,
): DiagnosticAnswer | undefined {
  return item.diagnostics.find((d) => d.id === id && d.variant === variant)?.answer;
}

function expectDetects(
  item: MatrixItem,
  id: MisconceptionId,
  variant: string | undefined,
  answer: Answer,
) {
  expect(diagnosticAnswer(item, id, variant)).toEqual(answer);
  expect(classify(item, answer)).toEqual(
    variant === undefined ? { type: 'misconception', id } : { type: 'misconception', id, variant },
  );
}

function expectCorrect(item: MatrixItem, answer: Answer) {
  expect(item.correct).toEqual(answer);
  expect(classify(item, answer)).toEqual({ type: 'correct' });
}

function expectValid(item: MatrixItem) {
  expect(validateMatrixItem(item)).toEqual({ ok: true });
}

const variantsOf = (item: MatrixItem, id: MisconceptionId) =>
  item.diagnostics.filter((d) => d.id === id).map((d) => d.variant);

describe('M01_DIM_SWAP', () => {
  it('A 2×3 → correct 2×3, candidate 3×2', () => {
    const item = assemble('dim', 1, {
      form: 'dim',
      A: matrix([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    });
    expectCorrect(item, dims(2, 3));
    expectDetects(item, 'M01_DIM_SWAP', undefined, dims(3, 2));
    expectValid(item);
  });

  it('does not apply when m = n', () => {
    const item = assemble('dim', 2, {
      form: 'dim',
      A: matrix([
        [1, 2],
        [3, 4],
      ]),
    });
    expect(item.diagnostics).toEqual([]);
  });
});

describe('M02_INDEX_SWAP', () => {
  const A = matrix([
    [5, 8, 1],
    [2, 7, 4],
    [9, 3, 6],
  ]);

  it('asking a₂₃ → correct 4, candidate 3 (= a₃₂)', () => {
    const item = assemble('index', 1, { form: 'index', A, i: 2, j: 3 });
    expectCorrect(item, num(4));
    expectDetects(item, 'M02_INDEX_SWAP', undefined, num(3));
    expectValid(item);
  });

  it('does not apply when aⱼᵢ = aᵢⱼ', () => {
    const item = assemble('index', 1, { form: 'index', A, i: 2, j: 2 });
    expect(item.diagnostics).toEqual([]);
  });

  it('does not apply when aⱼᵢ does not exist', () => {
    const wide = matrix([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
    ]);
    const item = assemble('index', 2, { form: 'index', A: wide, i: 1, j: 4 });
    expect(item.diagnostics).toEqual([]);
  });
});

describe('M03_TRANSPOSE_WRONG', () => {
  const item = assemble('transpose', 2, {
    form: 'transpose',
    A: matrix([
      [1, 2, 3],
      [4, 5, 6],
    ]),
  });

  it('A=[[1,2,3],[4,5,6]] → Aᵀ=[[1,4],[2,5],[3,6]]', () => {
    expectCorrect(
      item,
      mat([
        [1, 4],
        [2, 5],
        [3, 6],
      ]),
    );
    expect(item.grid).toEqual({ rows: 3, cols: 2 });
    expectValid(item);
  });

  it('ROT_CW [[4,1],[5,2],[6,3]]', () => {
    expectDetects(
      item,
      'M03_TRANSPOSE_WRONG',
      'ROT_CW',
      mat([
        [4, 1],
        [5, 2],
        [6, 3],
      ]),
    );
  });

  it('ROT_CCW [[3,6],[2,5],[1,4]]', () => {
    expectDetects(
      item,
      'M03_TRANSPOSE_WRONG',
      'ROT_CCW',
      mat([
        [3, 6],
        [2, 5],
        [1, 4],
      ]),
    );
  });

  it('ANTI [[6,3],[5,2],[4,1]]', () => {
    expectDetects(
      item,
      'M03_TRANSPOSE_WRONG',
      'ANTI',
      mat([
        [6, 3],
        [5, 2],
        [4, 1],
      ]),
    );
  });

  it('non-square matrices have only the three shape-preserving variants', () => {
    expect(variantsOf(item, 'M03_TRANSPOSE_WRONG')).toEqual(['ROT_CW', 'ROT_CCW', 'ANTI']);
  });

  it('square matrices add FLIP_H, FLIP_V and SAME', () => {
    const square = assemble('transpose', 1, {
      form: 'transpose',
      A: matrix([
        [1, 2],
        [3, 4],
      ]),
    });
    expect(variantsOf(square, 'M03_TRANSPOSE_WRONG')).toEqual([
      'ROT_CW',
      'ROT_CCW',
      'ANTI',
      'FLIP_H',
      'FLIP_V',
      'SAME',
    ]);
    expectDetects(
      square,
      'M03_TRANSPOSE_WRONG',
      'FLIP_H',
      mat([
        [2, 1],
        [4, 3],
      ]),
    );
    expectDetects(
      square,
      'M03_TRANSPOSE_WRONG',
      'FLIP_V',
      mat([
        [3, 4],
        [1, 2],
      ]),
    );
    expectDetects(
      square,
      'M03_TRANSPOSE_WRONG',
      'SAME',
      mat([
        [1, 2],
        [3, 4],
      ]),
    );
    expectValid(square);
  });
});

describe('M04_ADD_DIM_MISMATCH', () => {
  const item = assemble('addsub', 2, {
    form: 'addsub',
    op: 'add',
    A: matrix([
      [1, 2],
      [3, 4],
    ]),
    B: matrix([
      [1, 2, 3],
      [4, 5, 6],
    ]),
  });

  it('A 2×2 + B 2×3 is undefined and the grid follows A', () => {
    expectCorrect(item, UNDEFINED);
    expect(item.kind).toBe('matrix_or_undefined');
    expect(item.grid).toEqual({ rows: 2, cols: 2 });
    expectValid(item);
  });

  it('uses ANY_MATRIX, which matches whatever matrix the student entered', () => {
    expect(diagnosticAnswer(item, 'M04_ADD_DIM_MISMATCH')).toEqual(ANY_MATRIX);
    for (const answer of [
      mat([
        [0, 0],
        [0, 0],
      ]),
      mat([
        [2, 4],
        [6, 8],
      ]),
      mat([
        ['1/2', -3],
        [7, 9],
      ]),
    ]) {
      expect(classify(item, answer)).toEqual({ type: 'misconception', id: 'M04_ADD_DIM_MISMATCH' });
    }
  });
});

describe('M05_SUB_REVERSED', () => {
  const A = matrix([
    [5, 2],
    [-1, 3],
  ]);
  const B = matrix([
    [1, -4],
    [-2, 6],
  ]);
  const item = assemble('addsub', 2, { form: 'addsub', op: 'sub', A, B });

  it('A−B=[[4,6],[1,−3]], candidate [[−4,−6],[−1,3]]', () => {
    expectCorrect(
      item,
      mat([
        [4, 6],
        [1, -3],
      ]),
    );
    expectDetects(
      item,
      'M05_SUB_REVERSED',
      undefined,
      mat([
        [-4, -6],
        [-1, 3],
      ]),
    );
    expectValid(item);
  });

  it('does not apply when A = B', () => {
    const same = assemble('addsub', 2, { form: 'addsub', op: 'sub', A, B: A });
    expect(variantsOf(same, 'M05_SUB_REVERSED')).toEqual([]);
  });

  it('does not apply to addition', () => {
    const sum = assemble('addsub', 1, {
      form: 'addsub',
      op: 'add',
      A: matrix([
        [1, 2],
        [3, 4],
      ]),
      B: matrix([
        [5, 6],
        [7, 8],
      ]),
    });
    expect(sum.kind).toBe('matrix');
    expect(sum.diagnostics).toEqual([]);
  });
});

describe('M07_SCALAR_PARTIAL', () => {
  const item = assemble('scalar', 2, {
    form: 'scalar',
    k: 3,
    A: matrix([
      [1, -2],
      [5, 4],
    ]),
  });

  it('k=3, A=[[1,−2],[5,4]] → [[3,−6],[15,12]]', () => {
    expectCorrect(
      item,
      mat([
        [3, -6],
        [15, 12],
      ]),
    );
    expectValid(item);
  });

  it('FIRST_ROW [[3,−6],[5,4]]', () => {
    expectDetects(
      item,
      'M07_SCALAR_PARTIAL',
      'FIRST_ROW',
      mat([
        [3, -6],
        [5, 4],
      ]),
    );
  });

  it('DIAGONAL [[3,−2],[5,12]]', () => {
    expectDetects(
      item,
      'M07_SCALAR_PARTIAL',
      'DIAGONAL',
      mat([
        [3, -2],
        [5, 12],
      ]),
    );
  });

  it('ADD [[4,1],[8,7]]', () => {
    expectDetects(
      item,
      'M07_SCALAR_PARTIAL',
      'ADD',
      mat([
        [4, 1],
        [8, 7],
      ]),
    );
  });

  it('§2 rule 3: rejects k=3, A=[[1,−2],[0,4]] because FIRST_ROW differs from 3A in one cell', () => {
    const rejected = assemble('scalar', 2, {
      form: 'scalar',
      k: 3,
      A: matrix([
        [1, -2],
        [0, 4],
      ]),
    });
    expect(rejected.correct).toEqual(
      mat([
        [3, -6],
        [0, 12],
      ]),
    );
    expect(diagnosticAnswer(rejected, 'M07_SCALAR_PARTIAL', 'FIRST_ROW')).toEqual(
      mat([
        [3, -6],
        [0, 4],
      ]),
    );
    expect(validateMatrixItem(rejected)).toMatchObject({ ok: false, failure: { rule: 3 } });
  });
});

describe('M08_MULT_DIM_RULE', () => {
  const dimsOf = (rows: number, cols: number) => ({ rows, cols });
  const ab = assemble('mult_defined', 1, {
    form: 'mult_defined',
    order: 'AB',
    dimsA: dimsOf(2, 3),
    dimsB: dimsOf(3, 4),
  });

  it('A 2×3, B 3×4 → AB is 2×4', () => {
    expectCorrect(ab, dims(2, 4));
    expectValid(ab);
  });

  it('RESULT_INNER 3×3', () => {
    expectDetects(ab, 'M08_MULT_DIM_RULE', 'RESULT_INNER', dims(3, 3));
  });

  it('RESULT_FIRST 2×3', () => {
    expectDetects(ab, 'M08_MULT_DIM_RULE', 'RESULT_FIRST', dims(2, 3));
  });

  it('RESULT_SWAPPED 4×2', () => {
    expectDetects(ab, 'M08_MULT_DIM_RULE', 'RESULT_SWAPPED', dims(4, 2));
  });

  it('SAME_DIMS: answers "undefined" when n = r but the dims differ', () => {
    expectDetects(ab, 'M08_MULT_DIM_RULE', 'SAME_DIMS', UNDEFINED);
  });

  it('BA is undefined (4 ≠ 2)', () => {
    const ba = assemble('mult_defined', 2, {
      form: 'mult_defined',
      order: 'BA',
      dimsA: dimsOf(2, 3),
      dimsB: dimsOf(3, 4),
    });
    expectCorrect(ba, UNDEFINED);
    expectValid(ba);
  });

  it('A 2×3, B 2×3 → AB is undefined and "yes, 2×3" is SAME_DIMS', () => {
    const same = assemble('mult_defined', 1, {
      form: 'mult_defined',
      order: 'AB',
      dimsA: dimsOf(2, 3),
      dimsB: dimsOf(2, 3),
    });
    expectCorrect(same, UNDEFINED);
    expectDetects(same, 'M08_MULT_DIM_RULE', 'SAME_DIMS', dims(2, 3));
    expectValid(same);
  });

  it('RESULT_INNER does not apply when n×n = m×p', () => {
    const item = assemble('mult_defined', 1, {
      form: 'mult_defined',
      order: 'AB',
      dimsA: dimsOf(2, 2),
      dimsB: dimsOf(2, 2),
    });
    expect(variantsOf(item, 'M08_MULT_DIM_RULE')).not.toContain('RESULT_INNER');
  });

  it('RESULT_FIRST does not apply when n = p', () => {
    const item = assemble('mult_defined', 1, {
      form: 'mult_defined',
      order: 'AB',
      dimsA: dimsOf(2, 3),
      dimsB: dimsOf(3, 3),
    });
    expect(variantsOf(item, 'M08_MULT_DIM_RULE')).not.toContain('RESULT_FIRST');
  });

  it('RESULT_SWAPPED does not apply when p = m', () => {
    const item = assemble('mult_defined', 1, {
      form: 'mult_defined',
      order: 'AB',
      dimsA: dimsOf(2, 3),
      dimsB: dimsOf(3, 2),
    });
    expect(variantsOf(item, 'M08_MULT_DIM_RULE')).not.toContain('RESULT_SWAPPED');
  });
});

describe('M09, M10, M11 on A=[[2,1],[3,4]], B=[[1,5],[2,0]]', () => {
  const A = matrix([
    [2, 1],
    [3, 4],
  ]);
  const B = matrix([
    [1, 5],
    [2, 0],
  ]);
  const item = assemble('mult', 1, { form: 'mult', A, B });

  it('AB=[[4,10],[11,15]]', () => {
    expectCorrect(
      item,
      mat([
        [4, 10],
        [11, 15],
      ]),
    );
    expectValid(item);
  });

  it('M09 elementwise [[2,5],[6,0]]', () => {
    expectDetects(
      item,
      'M09_MULT_ELEMENTWISE',
      undefined,
      mat([
        [2, 5],
        [6, 0],
      ]),
    );
  });

  it('M10 ROW_ROW [[7,4],[23,6]]', () => {
    expectDetects(
      item,
      'M10_MULT_ROW_ROW',
      'ROW_ROW',
      mat([
        [7, 4],
        [23, 6],
      ]),
    );
  });

  it('M10 COL_COL [[8,10],[9,5]], three cells away from AB', () => {
    expectDetects(
      item,
      'M10_MULT_ROW_ROW',
      'COL_COL',
      mat([
        [8, 10],
        [9, 5],
      ]),
    );
    expect(
      countDiffCells(
        matrix([
          [8, 10],
          [9, 5],
        ]),
        mul(A, B),
      ),
    ).toBe(3);
  });

  it('M11 BA=[[17,21],[4,2]]', () => {
    expectDetects(
      item,
      'M11_MULT_COMMUTATIVE',
      undefined,
      mat([
        [17, 21],
        [4, 2],
      ]),
    );
  });

  it('M09 does not apply when dims(A) ≠ dims(B)', () => {
    const rect = assemble('mult', 2, {
      form: 'mult',
      A: matrix([
        [1, 2, 3],
        [4, 5, 6],
      ]),
      B: matrix([
        [1, 2],
        [3, 4],
        [5, 6],
      ]),
    });
    expect(rect.grid).toEqual({ rows: 2, cols: 2 });
    expect(rect.diagnostics).toEqual([]);
  });

  it('M10 ROW_ROW needs cols(A) = cols(B), so 2×3·3×3 has ROW_ROW only', () => {
    const rect = assemble('mult', 3, {
      form: 'mult',
      A: matrix([
        [1, 2, 3],
        [4, 5, 6],
      ]),
      B: matrix([
        [1, 0, 2],
        [3, 1, 1],
        [2, 2, 5],
      ]),
    });
    expect(variantsOf(rect, 'M10_MULT_ROW_ROW')).toEqual(['ROW_ROW']);
  });

  it('M10 COL_COL needs rows(A) = rows(B), so 3×3·3×1 has COL_COL only', () => {
    const rect = assemble('mult', 3, {
      form: 'mult',
      A: matrix([
        [1, 2, 3],
        [0, 4, 5],
        [6, 1, 2],
      ]),
      B: matrix([[1], [2], [3]]),
    });
    expect(variantsOf(rect, 'M10_MULT_ROW_ROW')).toEqual(['COL_COL']);
  });

  it('M11 does not apply when AB = BA', () => {
    const commuting = assemble('mult', 1, {
      form: 'mult',
      A: matrix([
        [1, 2],
        [3, 4],
      ]),
      B: matrix([
        [1, 0],
        [0, 1],
      ]),
    });
    expect(variantsOf(commuting, 'M11_MULT_COMMUTATIVE')).toEqual([]);
  });

  it('mult_noncomm L2 gives AB and asks for BA, so the candidate is AB', () => {
    const swapped = assemble('mult_noncomm', 2, {
      form: 'noncomm_find_ba',
      A,
      B,
      AB: mul(A, B),
    });
    expectCorrect(
      swapped,
      mat([
        [17, 21],
        [4, 2],
      ]),
    );
    expectDetects(
      swapped,
      'M11_MULT_COMMUTATIVE',
      undefined,
      mat([
        [4, 10],
        [11, 15],
      ]),
    );
    expectValid(swapped);
  });

  it('mult_noncomm L1 true/false: choosing "AB = BA always" is M11', () => {
    const statement = assemble('mult_noncomm', 1, {
      form: 'noncomm_statement',
      statement: 'always_equal',
    });
    expect(statement.kind).toBe('choice');
    expectCorrect(statement, choice('false'));
    expectDetects(statement, 'M11_MULT_COMMUTATIVE', undefined, choice('true'));
    expectValid(statement);
  });

  it('mult_noncomm L3: saying this pair commutes when it does not is M11', () => {
    const pair = assemble('mult_noncomm', 3, { form: 'noncomm_pair', A, B });
    expectCorrect(pair, choice('swap_no'));
    expectDetects(pair, 'M11_MULT_COMMUTATIVE', undefined, choice('swap_yes'));
    expectValid(pair);
  });
});

describe('M12_DET2_FORMULA', () => {
  const item = assemble('det2', 1, {
    form: 'det2',
    A: matrix([
      [2, 1],
      [3, 4],
    ]),
  });

  it('A=[[2,1],[3,4]] → det 5', () => {
    expectCorrect(item, num(5));
    expectValid(item);
  });

  it.each([
    ['ADD', 11],
    ['REVERSE', -5],
    ['PAIRS_ROW', -10],
    ['PAIRS_COL', 2],
  ])('%s %i', (variant, value) => {
    expectDetects(item, 'M12_DET2_FORMULA', variant, num(value));
  });

  it('does not apply when bc = 0', () => {
    const item0 = assemble('det2', 1, {
      form: 'det2',
      A: matrix([
        [2, 0],
        [3, 4],
      ]),
    });
    expect(item0.diagnostics).toEqual([]);
  });

  it('does not apply when det = 0', () => {
    const item0 = assemble('det2', 2, {
      form: 'det2',
      A: matrix([
        [2, 4],
        [1, 2],
      ]),
    });
    expect(item0.diagnostics).toEqual([]);
  });
});

describe('M13_DET3_SIGN', () => {
  const A = matrix([
    [2, 1, 3],
    [0, -1, 4],
    [1, 2, 1],
  ]);
  const item = assemble('det3', 2, { form: 'det3', A });

  it('Sarrus lines: down −2, 4, 0 and up −3, 16, 0', () => {
    expect(sarrusLines(A).down.map(String)).toEqual(['-2', '4', '0']);
    expect(sarrusLines(A).up.map(String)).toEqual(['-3', '16', '0']);
  });

  it('minors −9, −4, 1', () => {
    expect([minor(A, 1, 1), minor(A, 1, 2), minor(A, 1, 3)].map(String)).toEqual(['-9', '-4', '1']);
  });

  it('det = (−2+4+0) − (−3+16+0) = −11', () => {
    expectCorrect(item, num(-11));
    expectValid(item);
  });

  it.each([
    ['ALL_PLUS', 15],
    ['NO_ALT_SIGN', -19],
    ['TWO_DIAG', 1],
  ])('%s %i', (variant, value) => {
    expectDetects(item, 'M13_DET3_SIGN', variant, num(value));
  });
});

describe('M14_DET_SCALAR_LINEAR', () => {
  it('A 3×3, det(A)=4, k=2 → correct 32, candidate 8', () => {
    const item = assemble('det_props', 2, { form: 'det_scaled', n: 3, d: 4, k: 2 });
    expectCorrect(item, num(32));
    expectDetects(item, 'M14_DET_SCALAR_LINEAR', undefined, num(8));
    expectValid(item);
  });

  it('does not apply to k = 1 or k = 0', () => {
    for (const k of [0, 1]) {
      const item = assemble('det_props', 2, { form: 'det_scaled', n: 3, d: 4, k });
      expect(item.diagnostics).toEqual([]);
    }
  });

  it('does not apply when d = 0', () => {
    const item = assemble('det_props', 2, { form: 'det_scaled', n: 3, d: 0, k: 2 });
    expect(item.diagnostics).toEqual([]);
  });

  it('does not apply to k = −1 with odd n (same value)', () => {
    const item = assemble('det_props', 2, { form: 'det_scaled', n: 3, d: 4, k: -1 });
    expect(item.correct).toEqual(num(-4));
    expect(item.diagnostics).toEqual([]);
  });

  it('applies to k = −1 with even n', () => {
    const item = assemble('det_props', 1, { form: 'det_scaled', n: 2, d: 4, k: -1 });
    expectCorrect(item, num(4));
    expectDetects(item, 'M14_DET_SCALAR_LINEAR', undefined, num(-4));
    expect(item.prompt.params?.k).toBe('−');
  });
});

describe('M15_DET_ADDITIVE', () => {
  const P = matrix([
    [1, 2],
    [3, 4],
  ]);
  const Q = matrix([
    [2, 0],
    [1, 3],
  ]);

  it('det P = −2, det Q = 6, P+Q=[[3,2],[4,7]]', () => {
    expect(det2(P).toString()).toBe('-2');
    expect(det2(Q).toString()).toBe('6');
    expect(add(P, Q)).toEqual(
      matrix([
        [3, 2],
        [4, 7],
      ]),
    );
  });

  it('correct 13, candidate 4', () => {
    const item = assemble('det_props', 2, { form: 'det_sum', A: P, B: Q });
    expectCorrect(item, num(13));
    expectDetects(item, 'M15_DET_ADDITIVE', undefined, num(4));
    expectValid(item);
  });

  it('does not apply when det A + det B = det(A+B)', () => {
    const E = matrix([
      [1, 0],
      [0, 0],
    ]);
    const item = assemble('det_props', 2, { form: 'det_sum', A: E, B: E });
    expect(item.diagnostics).toEqual([]);
  });
});

describe('M18_INV_SINGULAR', () => {
  it('[[2,4],[1,2]] has det 0, so answering "has inverse" is M18', () => {
    const item = assemble('invertible', 1, {
      form: 'invertible',
      A: matrix([
        [2, 4],
        [1, 2],
      ]),
    });
    expectCorrect(item, choice('no_inverse'));
    expectDetects(item, 'M18_INV_SINGULAR', undefined, choice('has_inverse'));
    expectValid(item);
  });
});

describe('M19_INV_ZERO_ENTRY', () => {
  it('[[0,3],[2,5]] has det −6, so answering "no inverse" is M19', () => {
    const item = assemble('invertible', 2, {
      form: 'invertible',
      A: matrix([
        [0, 3],
        [2, 5],
      ]),
    });
    expectCorrect(item, choice('has_inverse'));
    expectDetects(item, 'M19_INV_ZERO_ENTRY', undefined, choice('no_inverse'));
    expectValid(item);
  });

  it('does not apply without a zero entry', () => {
    const item = assemble('invertible', 1, {
      form: 'invertible',
      A: matrix([
        [2, 1],
        [3, 4],
      ]),
    });
    expect(item.diagnostics).toEqual([]);
    expect(classify(item, choice('no_inverse'))).toEqual({ type: 'unknown' });
  });
});

describe('M20_INV2_RECIPE and M21_INV_RECIPROCAL on A=[[3,1],[4,2]]', () => {
  const A = matrix([
    [3, 1],
    [4, 2],
  ]);
  const item = assemble('inv2', 2, { form: 'inv2', A });

  it('det = 2, A⁻¹=[[1,−1/2],[−2,3/2]]', () => {
    expect(det2(A).toString()).toBe('2');
    expectCorrect(
      item,
      mat([
        [1, '-1/2'],
        [-2, '3/2'],
      ]),
    );
    expect(inv2(A)).toEqual(
      matrix([
        [1, '-1/2'],
        [-2, '3/2'],
      ]),
    );
    expectValid(item);
  });

  it.each<[string, Cell[][]]>([
    [
      'NO_SWAP',
      [
        ['3/2', '-1/2'],
        [-2, 1],
      ],
    ],
    [
      'NO_NEGATE',
      [
        [1, '1/2'],
        [2, '3/2'],
      ],
    ],
    [
      'NO_DIVIDE',
      [
        [2, -1],
        [-4, 3],
      ],
    ],
    [
      'TIMES_DET',
      [
        [4, -2],
        [-8, 6],
      ],
    ],
    [
      'TRANSPOSED',
      [
        [1, -2],
        ['-1/2', '3/2'],
      ],
    ],
  ])('%s', (variant, rows) => {
    expectDetects(item, 'M20_INV2_RECIPE', variant, mat(rows));
    expect(countDiffCells(matrix(rows), inv2(A))).toBeGreaterThanOrEqual(2);
  });

  it('M21 [[1/3,1],[1/4,1/2]]', () => {
    expectDetects(
      item,
      'M21_INV_RECIPROCAL',
      undefined,
      mat([
        ['1/3', 1],
        ['1/4', '1/2'],
      ]),
    );
  });

  it('NO_DIVIDE and TIMES_DET need |det| ≥ 2', () => {
    const unit = assemble('inv2', 1, {
      form: 'inv2',
      A: matrix([
        [3, 2],
        [1, 1],
      ]),
    });
    expect(variantsOf(unit, 'M20_INV2_RECIPE')).toEqual(['NO_SWAP', 'NO_NEGATE', 'TRANSPOSED']);
  });

  it('NO_SWAP needs a ≠ d', () => {
    const equalDiagonal = assemble('inv2', 2, {
      form: 'inv2',
      A: matrix([
        [3, 1],
        [1, 3],
      ]),
    });
    expect(variantsOf(equalDiagonal, 'M20_INV2_RECIPE')).not.toContain('NO_SWAP');
  });

  it('NO_NEGATE needs b, c ≠ 0', () => {
    const zero = assemble('inv2', 2, {
      form: 'inv2',
      A: matrix([
        [3, 0],
        [1, 2],
      ]),
    });
    expect(variantsOf(zero, 'M20_INV2_RECIPE')).not.toContain('NO_NEGATE');
  });

  it('TRANSPOSED needs b ≠ c', () => {
    const symmetric = assemble('inv2', 2, {
      form: 'inv2',
      A: matrix([
        [3, 1],
        [1, 1],
      ]),
    });
    expect(variantsOf(symmetric, 'M20_INV2_RECIPE')).not.toContain('TRANSPOSED');
  });

  it('M21 needs no zero entry', () => {
    const zero = assemble('inv2', 2, {
      form: 'inv2',
      A: matrix([
        [3, 0],
        [1, 2],
      ]),
    });
    expect(variantsOf(zero, 'M21_INV_RECIPROCAL')).toEqual([]);
  });
});

// Stretch misconceptions are not in the catalog yet, but their documented arithmetic must hold too.
describe('☆ examples (arithmetic only)', () => {
  it('M06: A−B with b<0 treated as a+b gives [[4,−2],[−3,−3]]', () => {
    const A = matrix([
      [5, 2],
      [-1, 3],
    ]);
    const B = matrix([
      [1, -4],
      [-2, 6],
    ]);
    const candidate = A.map((row, i) =>
      row.map((a, j) => (B[i][j].sign() < 0 ? a.add(B[i][j]) : a.sub(B[i][j]))),
    );
    expect(candidate).toEqual(
      matrix([
        [4, -2],
        [-3, -3],
      ]),
    );
  });

  const X = matrix([
    [1, 1],
    [0, 1],
  ]);
  const Y = matrix([
    [1, 0],
    [1, 1],
  ]);

  it('M22: XY=[[2,1],[1,1]], (XY)⁻¹=[[1,−1],[−1,2]]=Y⁻¹X⁻¹, X⁻¹Y⁻¹=[[2,−1],[−1,1]]', () => {
    const XY = mul(X, Y);
    expect(XY).toEqual(
      matrix([
        [2, 1],
        [1, 1],
      ]),
    );
    expect(inv2(XY)).toEqual(
      matrix([
        [1, -1],
        [-1, 2],
      ]),
    );
    expect(mul(inv2(Y), inv2(X))).toEqual(
      matrix([
        [1, -1],
        [-1, 2],
      ]),
    );
    expect(mul(inv2(X), inv2(Y))).toEqual(
      matrix([
        [2, -1],
        [-1, 1],
      ]),
    );
  });

  it('M23: (XY)ᵀ=[[2,1],[1,1]]=YᵀXᵀ, XᵀYᵀ=[[1,1],[1,2]]', () => {
    expect(transpose(mul(X, Y))).toEqual(
      matrix([
        [2, 1],
        [1, 1],
      ]),
    );
    expect(mul(transpose(Y), transpose(X))).toEqual(
      matrix([
        [2, 1],
        [1, 1],
      ]),
    );
    expect(mul(transpose(X), transpose(Y))).toEqual(
      matrix([
        [1, 1],
        [1, 2],
      ]),
    );
  });
});

describe('ops used by the examples', () => {
  it('sub and scalar', () => {
    const A = matrix([
      [5, 2],
      [-1, 3],
    ]);
    const B = matrix([
      [1, -4],
      [-2, 6],
    ]);
    expect(sub(A, B)).toEqual(
      matrix([
        [4, 6],
        [1, -3],
      ]),
    );
    expect(
      scalar(
        Rational.of(3),
        matrix([
          [1, -2],
          [5, 4],
        ]),
      ),
    ).toEqual(
      matrix([
        [3, -6],
        [15, 12],
      ]),
    );
  });
});

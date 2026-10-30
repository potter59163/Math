import type { ReactNode } from 'react';
import type { Rational } from '@/lib/core/rational';
import type { Matrix } from '@/lib/core/types';
import { signed } from '@/lib/topics/matrix/format';

/** Square brackets around a block, for the given matrices and the answer grid alike. */
export function Bracket({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block px-2.5 py-1">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-2 rounded-l-sm border-y-2 border-l-2 border-current"
      />
      <span
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-2 rounded-r-sm border-y-2 border-r-2 border-current"
      />
      {children}
    </span>
  );
}

/** An exact number: integers inline, fractions stacked, with a typographic minus. */
export function NumberText({ value }: { value: Rational }) {
  if (value.isInteger()) return signed(value.n);
  return (
    <span
      role="img"
      aria-label={signed(value.n).concat('/', String(value.d))}
      className="inline-flex items-center gap-0.5 align-middle"
    >
      {value.sign() < 0 && <span aria-hidden="true">−</span>}
      <span
        aria-hidden="true"
        className="inline-flex flex-col items-center text-[0.8em] leading-none"
      >
        <span className="px-0.5 pb-0.5">{Math.abs(value.n)}</span>
        <span className="w-full border-t border-current px-0.5 pt-0.5 text-center">{value.d}</span>
      </span>
    </span>
  );
}

interface MatrixViewProps {
  value: Matrix;
  label?: string;
}

export function MatrixView({ value, label }: MatrixViewProps) {
  return (
    <figure className="inline-flex items-center gap-1.5 font-matrix leading-snug tabular-nums">
      {label && <figcaption className="font-semibold">{label} =</figcaption>}
      <Bracket>
        <table aria-label={label} className="border-separate border-spacing-x-1.5">
          <tbody>
            {value.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="py-0.5 text-center">
                    <NumberText value={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Bracket>
    </figure>
  );
}

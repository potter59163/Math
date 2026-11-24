import { MatrixView } from '@/components/ui/MatrixView';
import type { Item } from '@/lib/core/types';
import { givenMatrices } from '@/lib/topics/matrix/format';
import type { MatrixItem } from '@/lib/topics/matrix/types';

/** The matrices a matrix item gives. Numbers all come from the engine. */
export function MatrixGivens({ item }: { item: Item }) {
  const matrices = givenMatrices((item as MatrixItem).data);
  if (matrices.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-lg">
      {matrices.map(({ label, value }) => (
        <MatrixView key={label} label={label} value={value} />
      ))}
    </div>
  );
}

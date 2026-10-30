import { MatrixView } from '@/components/ui/MatrixView';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { givenMatrices } from '@/lib/topics/matrix/format';
import type { MatrixItem } from '@/lib/topics/matrix/types';

/** What the item asks and the matrices it gives (SPEC §4). Numbers all come from the engine. */
export function ItemPrompt({ item }: { item: MatrixItem }) {
  const matrices = givenMatrices(item.data);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg font-semibold">
        {fillTokens(th.prompts[item.prompt.key], item.prompt.params)}
      </p>
      {matrices.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-lg">
          {matrices.map(({ label, value }) => (
            <MatrixView key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}

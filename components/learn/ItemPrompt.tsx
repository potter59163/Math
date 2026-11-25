import { componentsOf } from '@/components/topics';
import type { Item } from '@/lib/core/types';
import { packOf } from '@/lib/topics';

/** What the item asks and what it gives (SPEC §4). Numbers all come from the engine. */
export function ItemPrompt({ item }: { item: Item }) {
  const { Givens, Prompt } = componentsOf(item.ref.topic);
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-sans text-lg font-semibold">
        {Prompt ? <Prompt item={item} /> : packOf(item.ref.topic).copy.prompt(item)}
      </h1>
      <Givens item={item} />
    </div>
  );
}

import { componentsOf } from '@/components/topics';
import { th, type PromptKey } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Item } from '@/lib/core/types';

/** What the item asks and what it gives (SPEC §4). Numbers all come from the engine. */
export function ItemPrompt({ item }: { item: Item }) {
  const { Givens } = componentsOf(item.ref.topic);
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-sans text-lg font-semibold">
        {fillTokens(th.prompts[item.prompt.key as PromptKey], item.prompt.params)}
      </h1>
      <Givens item={item} />
    </div>
  );
}

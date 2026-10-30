const TOKEN = /\{\{(\w+)\}\}/g;

/** Replaces each {{token}}. A missing value throws, so a blank can never reach a student. */
export function fillTokens(template: string, params: Record<string, string> = {}): string {
  return template.replace(TOKEN, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`fillTokens: no value for {{${name}}}`);
    return value;
  });
}

export function tokensIn(template: string): string[] {
  return [...new Set([...template.matchAll(TOKEN)].map((match) => match[1]))];
}

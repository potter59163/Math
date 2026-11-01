import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProvider, RateLimitedError } from './providers';

// The real SDK with only the network replaced, because no API key is used in tests. What is checked is
// the request as it would leave this machine, against the limits in the API's documentation.

const CONFIG = { model: 'claude-haiku-5-5', apiKey: 'test-key', timeoutMs: 100 };
const ARGS = { system: 'be brief', user: '{"item":1}', signal: new AbortController().signal };

function message(content: unknown[], stopReason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: CONFIG.model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function answering(body: unknown, status = 200) {
  const network = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', network);
  return network;
}

const sentBody = (network: ReturnType<typeof answering>) =>
  JSON.parse(network.mock.calls[0][1].body as string) as Record<string, unknown>;

function everyNode(node: unknown, visit: (value: Record<string, unknown>) => void) {
  if (Array.isArray(node)) node.forEach((entry) => everyNode(entry, visit));
  else if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>);
    Object.values(node).forEach((entry) => everyNode(entry, visit));
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('the request to Claude', () => {
  const answer = message([{ type: 'text', text: '{}' }]);

  it('asks for the fast model at low effort, and carries the key', async () => {
    const network = answering(answer);
    await createProvider(CONFIG).completeJson(ARGS);

    expect(network).toHaveBeenCalledOnce();
    expect(network.mock.calls[0][0].toString()).toMatch(/\/v1\/messages$/);
    expect(new Headers(network.mock.calls[0][1].headers).get('authorization')).toBe(
      'Bearer test-key',
    );

    expect(sentBody(network)).toMatchObject({
      model: 'claude-haiku-5-5',
      system: 'be brief',
      messages: [{ role: 'user', content: '{"item":1}' }],
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
  });

  it('sends nothing this model refuses with a 400', async () => {
    const network = answering(answer);
    await createProvider(CONFIG).completeJson(ARGS);
    const body = sentBody(network);
    for (const refused of ['temperature', 'top_p', 'top_k', 'thinking']) {
      expect(body).not.toHaveProperty(refused);
    }
    expect((body.messages as { role: string }[]).at(-1)?.role).toBe('user');
  });

  // With these in the schema every real call failed with a 400, and every student quietly got the rules.
  it('sends a schema that structured outputs accept', async () => {
    const network = answering(answer);
    await createProvider(CONFIG).completeJson(ARGS);
    const { output_config: output } = sentBody(network) as {
      output_config: { format: { schema: unknown } };
    };
    const { schema } = output.format;

    const refused = ['minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum'];
    let objects = 0;
    everyNode(schema, (node) => {
      for (const keyword of refused) expect(node).not.toHaveProperty(keyword);
      if (node.type === 'object') {
        objects += 1;
        expect(node.additionalProperties).toBe(false);
      }
    });
    expect(objects).toBeGreaterThanOrEqual(2);
    expect(schema).toMatchObject({
      properties: { choice: { type: 'string' }, message: { type: 'string' } },
      required: ['choice', 'message', 'reason'],
    });
  });
});

describe('the answer from Claude', () => {
  it('is found after any thinking blocks', async () => {
    answering(
      message([
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: '{"choice":"c1"}' },
      ]),
    );
    expect(await createProvider(CONFIG).completeJson(ARGS)).toBe('{"choice":"c1"}');
  });

  it('counts as a failure when refused or empty, whatever it holds', async () => {
    answering(message([{ type: 'text', text: '{}' }], 'refusal'));
    await expect(createProvider(CONFIG).completeJson(ARGS)).rejects.toThrow('refused');

    answering(message([{ type: 'thinking', thinking: '', signature: 'sig' }], 'max_tokens'));
    await expect(createProvider(CONFIG).completeJson(ARGS)).rejects.toThrow('no text');
  });

  it('tells a 429 apart from other errors, and asks only once', async () => {
    const error = { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } };
    const limited = answering(error, 429);
    await expect(createProvider(CONFIG).completeJson(ARGS)).rejects.toBeInstanceOf(
      RateLimitedError,
    );
    expect(limited).toHaveBeenCalledOnce();

    const broken = answering(
      { type: 'error', error: { type: 'api_error', message: 'broken' } },
      500,
    );
    const failure = await createProvider(CONFIG)
      .completeJson(ARGS)
      .catch((reason: unknown) => reason);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(RateLimitedError);
    expect(broken).toHaveBeenCalledOnce();
  });
});

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
      messages: [{ role: 'user', content: '{"item":1}' }],
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
  });

  it('keeps the long prompt in the cache, and does not stop to think under a 4 s limit', async () => {
    const network = answering(answer);
    await createProvider(CONFIG).completeJson(ARGS);
    expect(sentBody(network)).toMatchObject({
      system: [{ type: 'text', text: 'be brief', cache_control: { type: 'ephemeral' } }],
      thinking: { type: 'disabled' },
    });
  });

  it('sends nothing this model refuses with a 400', async () => {
    const network = answering(answer);
    await createProvider(CONFIG).completeJson(ARGS);
    const body = sentBody(network);
    for (const refused of ['temperature', 'top_p', 'top_k']) {
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

// Claude Sonnet 5.5 refuses `thinking: disabled`, and only it accepts `between_tools`: the wrong one is a
// 400 on every call, which the students would only ever see as the rules (DECISIONS, 25 Nov 2026).
describe('the request to Claude Sonnet 5.5', () => {
  const SONNET = { ...CONFIG, model: 'claude-sonnet-5-5' };
  const answer = message([{ type: 'text', text: '{}' }]);

  it('turns thinking off with between_tools, at low effort, through the fallback beta', async () => {
    const network = answering(answer);
    await createProvider(SONNET).completeJson(ARGS);
    expect(network.mock.calls[0][0].toString()).toMatch(/\/v1\/messages(\?beta=true)?$/);
    expect(new Headers(network.mock.calls[0][1].headers).get('anthropic-beta')).toContain(
      'server-side-fallback-2026-07-01',
    );
    const body = sentBody(network);
    expect(body).toMatchObject({
      model: 'claude-sonnet-5-5',
      thinking: { type: 'between_tools' },
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema' } },
      system: [{ type: 'text', text: 'be brief', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: '{"item":1}' }],
    });
    expect(body.thinking).toEqual({ type: 'between_tools' });
    for (const refused of ['temperature', 'top_p', 'top_k', 'tool_choice']) {
      expect(body).not.toHaveProperty(refused);
    }
  });

  it('leaves thinking out, so adaptive, when asked to', async () => {
    const network = answering(answer);
    await createProvider({ ...SONNET, thinking: 'adaptive' }).completeJson(ARGS);
    expect(sentBody(network)).not.toHaveProperty('thinking');
  });

  it('never sends between_tools to another model, nor disabled to Sonnet 5.5', async () => {
    const haiku = answering(answer);
    await createProvider(CONFIG).completeJson(ARGS);
    expect(sentBody(haiku).thinking).toEqual({ type: 'disabled' });

    const sonnet = answering(answer);
    await createProvider(SONNET).completeJson(ARGS);
    expect(sentBody(sonnet).thinking).not.toEqual({ type: 'disabled' });
  });

  it('sends the same schema the structured outputs accept', async () => {
    const network = answering(answer);
    await createProvider(SONNET).completeJson(ARGS);
    const { output_config: output } = sentBody(network) as {
      output_config: { format: { schema: unknown } };
    };
    const refused = ['minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum'];
    everyNode(output.format.schema, (node) => {
      for (const keyword of refused) expect(node).not.toHaveProperty(keyword);
    });
  });

  it('finds the answer after a fallback block, and still fails on a refusal', async () => {
    answering(
      message([
        {
          type: 'fallback',
          from: { model: 'claude-sonnet-5-5' },
          to: { model: 'claude-sonnet-5' },
        },
        { type: 'text', text: '{"choice":"c2"}' },
      ]),
    );
    expect(await createProvider(SONNET).completeJson(ARGS)).toBe('{"choice":"c2"}');

    answering(message([{ type: 'text', text: '{}' }], 'refusal'));
    await expect(createProvider(SONNET).completeJson(ARGS)).rejects.toThrow('refused');
  });
});

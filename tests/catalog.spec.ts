import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CredentialProvider, credentialRef } from '@deepseek-ai/dsh-credentials'
import type {
  CredentialInfo,
  CredentialKey,
  CredentialRecord,
  CredentialRecordEntry,
  CredentialRecordInfo,
  CredentialRef,
  ResolvedCredential,
} from '@deepseek-ai/dsh-credentials'
import LlmRuntime, { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import * as BigModel from '../src/index.ts'
import { discoverModels, maintainedModels, parseModelIds } from '../src/index.ts'

let context: Context | undefined

class TestCredentials extends CredentialProvider {
  constructor(ctx: Context, private readonly value: string) {
    super(ctx)
  }

  override resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    return Promise.resolve(ref === credentialRef('BIGMODEL_API_KEY')
      ? { value: this.value, source: 'test' }
      : undefined)
  }

  override describe(_ref: CredentialRef): Promise<CredentialInfo> {
    return Promise.resolve({ configured: true, source: 'test', writable: false })
  }

  override set(_ref: CredentialRef, _value: string): Promise<void> {
    return Promise.reject(new Error('test credentials are read-only'))
  }

  override unset(_ref: CredentialRef): Promise<void> {
    return Promise.reject(new Error('test credentials are read-only'))
  }

  override readRecord(_key: CredentialKey): Promise<CredentialRecord | undefined> {
    return Promise.resolve(undefined)
  }

  override describeRecord(_key: CredentialKey): Promise<CredentialRecordInfo> {
    return Promise.resolve({ configured: false, writable: false })
  }

  override listRecords(): Promise<readonly CredentialRecordEntry[]> {
    return Promise.resolve([])
  }

  override modifyRecord(
    _key: CredentialKey,
    _mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<CredentialRecord | undefined> {
    return Promise.reject(new Error('test credentials are read-only'))
  }

  override deleteRecord(_key: CredentialKey): Promise<void> {
    return Promise.reject(new Error('test credentials are read-only'))
  }
}

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  vi.unstubAllGlobals()
})

describe('BigModel model catalog', () => {
  it('owns the verified GLM-5.3 capacities and validates the Models response shape', () => {
    const glm53 = maintainedModels.find(model => model.id === 'glm-5.3')
    expect(glm53).toMatchObject({ contextWindow: 1_000_000, maxTokens: 131_072 })
    expect(parseModelIds({ data: [{ id: 'glm-5.3' }] })).toEqual(['glm-5.3'])
    expect(() => parseModelIds([])).toThrow(/data array/)
  })

  it('reconciles the live list while retaining the direct-call verified GLM-5.3', async () => {
    const models = discoverModels({ data: [{ id: 'glm-5.2' }] })
    expect(models.map(model => model.id)).toEqual(['glm-5.2', 'glm-5.3'])
  })

  it('owns the zai route and filters it with the authenticated Models endpoint', async () => {
    const requests: Array<{ authorization: string | null, url: string }> = []
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      requests.push({ authorization: new Headers(init?.headers).get('authorization'), url })
      if (url.endsWith('/models')) {
        return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'glm-5.2' }] })))
      }
      const events = [
        '{"choices":[{"delta":{"role":"assistant","content":""},"index":0,"finish_reason":null}]}',
        '{"choices":[{"delta":{"content":"hello"},"index":0,"finish_reason":null}]}',
        '{"choices":[{"delta":{},"index":0,"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}',
        '[DONE]',
      ]
      return Promise.resolve(new Response(events.map(event => `data: ${event}\n\n`).join(''), {
        headers: { 'content-type': 'text/event-stream' },
      }))
    })
    context = new Context()
    await context.plugin(LlmRuntime)
    await context.plugin(TestCredentials, 'test-key')
    await context.plugin(BigModel, {})
    const loaded = context

    expect(loaded.llm.listProviders()).toEqual([{ id: 'zai', name: 'BigModel' }])
    await vi.waitFor(async () => {
      expect((await loaded.llm.listModels('zai')).map(model => model.id)).toEqual(['glm-5.2', 'glm-5.3'])
    })
    const assembler = new BlockAssembler()
    for await (const chunk of loaded.llm.stream({
      provider: 'zai',
      model: 'glm-5.3',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
    })) assembler.push(chunk)
    expect(assembler.message({ kind: 'model', provider: 'zai', model: 'glm-5.3' }).content)
      .toEqual([{ type: 'text', text: 'hello' }])
    expect(requests).toEqual([{
      authorization: 'Bearer test-key',
      url: 'https://open.bigmodel.cn/api/coding/paas/v4/models',
    }, {
      authorization: 'Bearer test-key',
      url: 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions',
    }])
  })
})

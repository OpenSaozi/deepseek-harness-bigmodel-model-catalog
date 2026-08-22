import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
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
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as BigModel from '../src/index.ts'

let context: Context | undefined
let root: string | undefined

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
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  vi.unstubAllGlobals()
})

describe('real Loader composition', () => {
  it('loads the standalone route from its shipping plugin export', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(
      new Response(JSON.stringify({ data: [{ id: 'glm-5.2' }] })),
    ))
    root = await mkdtemp(join(tmpdir(), 'dsh-bigmodel-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-llm'",
      "- name: 'test-credentials'",
      '  config: test-key',
      "- name: '@deepseek-ai/dsh-model-catalog-bigmodel'",
      '  config:',
      '    apiKeyEnv: BIGMODEL_API_KEY',
      '    baseURL: https://open.bigmodel.cn/api/coding/paas/v4',
      '    displayName: BigModel',
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-llm', LlmRuntime],
      ['test-credentials', TestCredentials],
      ['@deepseek-ai/dsh-model-catalog-bigmodel', BigModel],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()
    const loaded = context

    const unloaded = [...loaded.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(unloaded).toEqual([])
    expect(loaded.llm.listProviders()).toEqual([{ id: 'zai', name: 'BigModel' }])
    await vi.waitFor(async () => {
      expect((await loaded.llm.listModels('zai')).map(model => model.id)).toEqual(['glm-5.2', 'glm-5.3'])
    })
  })
})

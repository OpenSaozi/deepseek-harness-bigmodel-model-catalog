/** BigModel Coding Plan provider route backed by pi-ai message conversion. */

import {
  defaultProviderAuthContext,
  InMemoryCredentialStore,
  type Api,
  type Model,
  type OpenAICompletionsCompat,
  type Provider,
} from '@earendil-works/pi-ai'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import { zaiProvider } from '@earendil-works/pi-ai/providers/zai'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { assertUsableApiKey, LlmError, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'

export const name = 'model-catalog-bigmodel'
export const inject = ['llm', 'credentials']

const PROVIDER = 'zai'
const DEFAULT_API_KEY_ENV = 'BIGMODEL_API_KEY'
const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4'
const DEFAULT_DISPLAY_NAME = 'BigModel'
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000
const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024
const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048
const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const
const COMPAT: OpenAICompletionsCompat = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  thinkingFormat: 'zai',
  zaiToolStream: true,
}

/** Deployment settings for the independent `zai` route. */
export interface Config {
  /** Credential reference resolved for every request. */
  apiKeyEnv?: string
  /** BigModel Coding Plan API base URL. */
  baseURL?: string
  /** Provider label shown in model selectors. */
  displayName?: string
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs?: number
  /**
   * Base64 image payload bound for one request. Older images become text
   * placeholders once a session's accumulated images exceed it, so a long
   * session keeps completing requests instead of being refused for size.
   */
  maxRequestImageBytes?: number
  /** Total-pixel budget for each deterministic inline request version. */
  requestImagePixelBudget?: number
  /** Raw encoded-byte cap for each deterministic inline request version. */
  requestImageMaxBytes?: number
}

/** Schemastery validator for the independent BigModel route configuration. */
export const Config: z<Config> = z.object({
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  displayName: z.string().default(DEFAULT_DISPLAY_NAME),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
})

interface ResolvedConfig {
  readonly apiKeyEnv: ReturnType<typeof credentialRef>
  readonly baseURL: string
  readonly displayName: string
  readonly streamIdleTimeoutMs: number
  readonly maxRequestImageBytes: number
  readonly requestImagePixelBudget: number
  readonly requestImageMaxBytes: number
}

function resolveConfig(config: Config): ResolvedConfig {
  const baseURL = config.baseURL ?? DEFAULT_BASE_URL
  const displayName = config.displayName ?? DEFAULT_DISPLAY_NAME
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  const maxRequestImageBytes = config.maxRequestImageBytes ?? DEFAULT_MAX_REQUEST_IMAGE_BYTES
  const requestImagePixelBudget = config.requestImagePixelBudget ?? DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET
  const requestImageMaxBytes = config.requestImageMaxBytes ?? DEFAULT_REQUEST_IMAGE_MAX_BYTES
  if (baseURL.length === 0) throw new Error('model-catalog-bigmodel: baseURL must not be empty')
  if (displayName.length === 0) throw new Error('model-catalog-bigmodel: displayName must not be empty')
  if (!Number.isFinite(streamIdleTimeoutMs)
    || streamIdleTimeoutMs <= 0
    || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `model-catalog-bigmodel: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    )
  }
  if (!Number.isInteger(maxRequestImageBytes) || maxRequestImageBytes <= 0) {
    throw new Error('model-catalog-bigmodel: maxRequestImageBytes must be a positive integer')
  }
  if (!Number.isSafeInteger(requestImagePixelBudget) || requestImagePixelBudget <= 0) {
    throw new Error('model-catalog-bigmodel: requestImagePixelBudget must be a positive safe integer')
  }
  if (!Number.isSafeInteger(requestImageMaxBytes) || requestImageMaxBytes <= 0) {
    throw new Error('model-catalog-bigmodel: requestImageMaxBytes must be a positive safe integer')
  }
  return {
    apiKeyEnv: credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV),
    baseURL,
    displayName,
    streamIdleTimeoutMs,
    maxRequestImageBytes,
    requestImagePixelBudget,
    requestImageMaxBytes,
  }
}

function textModel(id: string, name: string, contextWindow: number, maxTokens: number): Model<'openai-completions'> {
  return {
    id,
    name,
    api: 'openai-completions',
    provider: PROVIDER,
    baseUrl: DEFAULT_BASE_URL,
    reasoning: true,
    input: ['text'],
    cost: ZERO_COST,
    compat: COMPAT,
    contextWindow,
    maxTokens,
  }
}

interface MaintainedTextModel {
  readonly id: string
  readonly name: string
  readonly contextWindow: number
  readonly maxTokens: number
}

const MAINTAINED_TEXT_MODELS = [
  { id: 'glm-4.5', name: 'GLM-4.5', contextWindow: 131_072, maxTokens: 98_304 },
  { id: 'glm-4.6', name: 'GLM-4.6', contextWindow: 204_800, maxTokens: 131_072 },
  { id: 'glm-5', name: 'GLM-5', contextWindow: 200_000, maxTokens: 131_072 },
  { id: 'glm-5.3', name: 'GLM-5.3', contextWindow: 1_000_000, maxTokens: 131_072 },
] as const satisfies readonly MaintainedTextModel[]

/** Maintained descriptors plus models live-verified ahead of pi-ai's catalog. */
export const maintainedModels: readonly Model<Api>[] = appendMissing(
  getBuiltinModels(PROVIDER),
  MAINTAINED_TEXT_MODELS.map(model => textModel(
    model.id,
    model.name,
    model.contextWindow,
    model.maxTokens,
  )),
)

/** Models proven by a direct completion may remain even when `/models` lags. */
const DIRECTLY_VERIFIED = new Set(['glm-5.3'])

function appendMissing(base: readonly Model<Api>[], additions: readonly Model<Api>[]): readonly Model<Api>[] {
  const merged = new Map(base.map(model => [model.id, model]))
  for (const model of additions) if (!merged.has(model.id)) merged.set(model.id, model)
  return [...merged.values()]
}

/**
 * Parse the provider-neutral ids returned by BigModel's Models endpoint.
 * @param payload - decoded JSON response body.
 * @returns model ids in provider order.
 */
export function parseModelIds(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null || !Array.isArray((payload as { data?: unknown }).data)) {
    throw new Error('BigModel /models response must contain a data array')
  }
  return (payload as { data: unknown[] }).data.map((entry) => {
    if (typeof entry !== 'object' || entry === null || typeof (entry as { id?: unknown }).id !== 'string') {
      throw new Error('BigModel /models response contains an entry without a string id')
    }
    return (entry as { id: string }).id
  })
}

/**
 * Reconcile the live Coding Plan list with direct-call verified additions.
 * @param payload - provider response body.
 * @returns maintained descriptors currently reported or directly verified.
 */
export function discoverModels(payload: unknown): readonly Model<Api>[] {
  const live = new Set(parseModelIds(payload))
  return maintainedModels.filter(model => live.has(model.id) || DIRECTLY_VERIFIED.has(model.id))
}

function providerFor(config: ResolvedConfig, models: readonly Model<Api>[]): Provider {
  const builtin = zaiProvider()
  const resolvedModels = models.map(model => ({ ...model, provider: PROVIDER, baseUrl: config.baseURL }))
  return {
    ...builtin,
    id: PROVIDER,
    name: config.displayName,
    baseUrl: config.baseURL,
    getModels: () => resolvedModels,
  }
}

function profileFor(
  config: ResolvedConfig,
  models: readonly Model<Api>[],
): ReadonlyMap<string, ResolvedPiAiProviderProfile> {
  return new Map([[PROVIDER, {
    provider: PROVIDER,
    displayName: config.displayName,
    apiKeyEnv: config.apiKeyEnv,
    streamIdleTimeoutMs: config.streamIdleTimeoutMs,
    maxRequestImageBytes: config.maxRequestImageBytes,
    requestImagePixelBudget: config.requestImagePixelBudget,
    requestImageMaxBytes: config.requestImageMaxBytes,
    retryPolicy: resolveRetryPolicy(undefined, 'model-catalog-bigmodel: retryPolicy'),
    configuredMaxTokens: new Map(),
    piProvider: providerFor(config, models),
  }]])
}

/**
 * Register and live-filter the independent BigModel provider route.
 * @param ctx - Cordis context providing LLM and credential services.
 * @param rawConfig - validated plugin configuration.
 */
export function apply(ctx: Context, rawConfig: Config): void {
  const config = resolveConfig(rawConfig)
  let profiles = profileFor(config, maintainedModels)
  const resolveApiKey = async (): Promise<string> => {
    const hit = await ctx.credentials.resolve(config.apiKeyEnv)
    if (hit !== undefined) {
      return assertUsableApiKey(hit.value, 'model-catalog-bigmodel', config.apiKeyEnv)
    }
    throw new LlmError(
      `model-catalog-bigmodel: no API key for provider route "${PROVIDER}"; store ${config.apiKeyEnv}`
      + ' through the credentials service',
      'MISSING_CREDENTIAL',
    )
  }
  const adapter = new PiAiAdapter({
    profiles: () => profiles,
    resolveApiKey,
    auth: {
      credentials: new InMemoryCredentialStore(),
      authContext: defaultProviderAuthContext(),
    },
  })
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)
  const controller = new AbortController()
  let refreshing: Promise<void> | undefined
  const refresh = (): void => {
    refreshing ??= (async () => {
      try {
        const apiKey = await resolveApiKey()
        const response = await fetch(`${config.baseURL.replace(/\/$/, '')}/models`, {
          headers: { authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`BigModel /models failed with HTTP ${response.status}`)
        const live = discoverModels(await response.json())
        if (live.length === 0) throw new Error('BigModel /models returned no maintained chat models')
        profiles = profileFor(config, live)
        registration.replace([PROVIDER])
      } catch (error) {
        if (!controller.signal.aborted) {
          ctx.logger.warn('model-catalog-bigmodel: live refresh failed; keeping the maintained catalog')
          ctx.logger.warn(error)
        }
      } finally {
        refreshing = undefined
      }
    })()
  }
  ctx.effect(() => {
    refresh()
    return () => { controller.abort() }
  }, 'model-catalog-bigmodel: live refresh')
  ctx.on('credentials/reference-updated', (ref) => {
    if (ref === config.apiKeyEnv) refresh()
  })
}

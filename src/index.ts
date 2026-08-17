/** BigModel Coding Plan model-catalog plugin for the pi-ai adapter. */

import type { Api, Model, OpenAICompletionsCompat } from '@earendil-works/pi-ai'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import type { Context } from '@deepseek-ai/cordis'
import type { PiAiModelCatalog } from '@deepseek-ai/dsh-llm-pi-ai'

export const name = 'model-catalog-bigmodel'
export const inject = ['piAiModelCatalog']

const PROVIDER = 'zai'
const BASE_URL = 'https://api.z.ai/api/coding/paas/v4'
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const
const COMPAT: OpenAICompletionsCompat = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  thinkingFormat: 'zai',
  zaiToolStream: true,
}

function textModel(id: string, name: string, contextWindow: number, maxTokens: number): Model<'openai-completions'> {
  return {
    id,
    name,
    api: 'openai-completions',
    provider: PROVIDER,
    baseUrl: BASE_URL,
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
 * @param payload - credential-free provider response body.
 * @returns maintained descriptors currently reported or directly verified.
 */
export function discoverModels(payload: unknown): readonly Model<Api>[] {
  const live = new Set(parseModelIds(payload))
  return maintainedModels.filter(model => live.has(model.id) || DIRECTLY_VERIFIED.has(model.id))
}

/** Register the maintained list immediately, then reconcile it with live availability. */
export function apply(ctx: Context & { piAiModelCatalog: PiAiModelCatalog }): void {
  const registration = ctx.piAiModelCatalog.register(PROVIDER, maintainedModels)
  ctx.effect(() => () => { registration.dispose() }, 'model-catalog-bigmodel: registration')
  const controller = new AbortController()
  let refreshing: Promise<void> | undefined
  const refresh = (): void => {
    refreshing ??= (async () => {
      try {
        const payload = await ctx.piAiModelCatalog.fetchModels(PROVIDER, controller.signal)
        const live = discoverModels(payload)
        if (live.length === 0) throw new Error('BigModel /models returned no maintained chat models')
        registration.replace(live)
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
  ctx.effect(
    () => ctx.piAiModelCatalog.subscribeConfiguration(refresh),
    'model-catalog-bigmodel: configuration refresh',
  )
}

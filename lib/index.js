import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { zaiProvider } from "@earendil-works/pi-ai/providers/zai";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { LlmError, assertUsableApiKey, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
//#region lib/types/index.js
/** BigModel Coding Plan provider route backed by pi-ai message conversion. */
const name = "model-catalog-bigmodel";
const inject = ["llm", "credentials"];
const PROVIDER = "zai";
const DEFAULT_API_KEY_ENV = "BIGMODEL_API_KEY";
const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4";
const DEFAULT_DISPLAY_NAME = "BigModel";
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
const ZERO_COST = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0
};
const COMPAT = {
	supportsStore: false,
	supportsDeveloperRole: false,
	supportsReasoningEffort: false,
	thinkingFormat: "zai",
	zaiToolStream: true
};
/** Schemastery validator for the independent BigModel route configuration. */
const Config = z.object({
	apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
	baseURL: z.string().default(DEFAULT_BASE_URL),
	displayName: z.string().default(DEFAULT_DISPLAY_NAME),
	streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS)
});
function resolveConfig(config) {
	const baseURL = config.baseURL ?? DEFAULT_BASE_URL;
	const displayName = config.displayName ?? DEFAULT_DISPLAY_NAME;
	const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
	if (baseURL.length === 0) throw new Error("model-catalog-bigmodel: baseURL must not be empty");
	if (displayName.length === 0) throw new Error("model-catalog-bigmodel: displayName must not be empty");
	if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) throw new Error(`model-catalog-bigmodel: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	return {
		apiKeyEnv: credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV),
		baseURL,
		displayName,
		streamIdleTimeoutMs
	};
}
function textModel(id, name, contextWindow, maxTokens) {
	return {
		id,
		name,
		api: "openai-completions",
		provider: PROVIDER,
		baseUrl: DEFAULT_BASE_URL,
		reasoning: true,
		input: ["text"],
		cost: ZERO_COST,
		compat: COMPAT,
		contextWindow,
		maxTokens
	};
}
/** Maintained descriptors plus models live-verified ahead of pi-ai's catalog. */
const maintainedModels = appendMissing(getBuiltinModels(PROVIDER), [
	{
		id: "glm-4.5",
		name: "GLM-4.5",
		contextWindow: 131072,
		maxTokens: 98304
	},
	{
		id: "glm-4.6",
		name: "GLM-4.6",
		contextWindow: 204800,
		maxTokens: 131072
	},
	{
		id: "glm-5",
		name: "GLM-5",
		contextWindow: 2e5,
		maxTokens: 131072
	},
	{
		id: "glm-5.3",
		name: "GLM-5.3",
		contextWindow: 1e6,
		maxTokens: 131072
	}
].map((model) => textModel(model.id, model.name, model.contextWindow, model.maxTokens)));
/** Models proven by a direct completion may remain even when `/models` lags. */
const DIRECTLY_VERIFIED = new Set(["glm-5.3"]);
function appendMissing(base, additions) {
	const merged = new Map(base.map((model) => [model.id, model]));
	for (const model of additions) if (!merged.has(model.id)) merged.set(model.id, model);
	return [...merged.values()];
}
/**
* Parse the provider-neutral ids returned by BigModel's Models endpoint.
* @param payload - decoded JSON response body.
* @returns model ids in provider order.
*/
function parseModelIds(payload) {
	if (typeof payload !== "object" || payload === null || !Array.isArray(payload.data)) throw new Error("BigModel /models response must contain a data array");
	return payload.data.map((entry) => {
		if (typeof entry !== "object" || entry === null || typeof entry.id !== "string") throw new Error("BigModel /models response contains an entry without a string id");
		return entry.id;
	});
}
/**
* Reconcile the live Coding Plan list with direct-call verified additions.
* @param payload - provider response body.
* @returns maintained descriptors currently reported or directly verified.
*/
function discoverModels(payload) {
	const live = new Set(parseModelIds(payload));
	return maintainedModels.filter((model) => live.has(model.id) || DIRECTLY_VERIFIED.has(model.id));
}
function providerFor(config, models) {
	const builtin = zaiProvider();
	const resolvedModels = models.map((model) => ({
		...model,
		provider: PROVIDER,
		baseUrl: config.baseURL
	}));
	return {
		...builtin,
		id: PROVIDER,
		name: config.displayName,
		baseUrl: config.baseURL,
		getModels: () => resolvedModels
	};
}
function profileFor(config, models) {
	return new Map([[PROVIDER, {
		provider: PROVIDER,
		displayName: config.displayName,
		apiKeyEnv: config.apiKeyEnv,
		streamIdleTimeoutMs: config.streamIdleTimeoutMs,
		retryPolicy: resolveRetryPolicy(void 0, "model-catalog-bigmodel: retryPolicy"),
		configuredMaxTokens: /* @__PURE__ */ new Map(),
		piProvider: providerFor(config, models)
	}]]);
}
/**
* Register and live-filter the independent BigModel provider route.
* @param ctx - Cordis context providing LLM and credential services.
* @param rawConfig - validated plugin configuration.
*/
function apply(ctx, rawConfig) {
	const config = resolveConfig(rawConfig);
	let profiles = profileFor(config, maintainedModels);
	const resolveApiKey = async () => {
		const hit = await ctx.credentials.resolve(config.apiKeyEnv);
		if (hit !== void 0) return assertUsableApiKey(hit.value, "model-catalog-bigmodel", config.apiKeyEnv);
		throw new LlmError(`model-catalog-bigmodel: no API key for provider route "${PROVIDER}"; store ${config.apiKeyEnv} through the credentials service`, "MISSING_CREDENTIAL");
	};
	const adapter = new PiAiAdapter({
		profiles: () => profiles,
		resolveApiKey
	});
	const registration = ctx.llm.registerAdapter([PROVIDER], adapter);
	const controller = new AbortController();
	let refreshing;
	const refresh = () => {
		refreshing ??= (async () => {
			try {
				const apiKey = await resolveApiKey();
				const response = await fetch(`${config.baseURL.replace(/\/$/, "")}/models`, {
					headers: { authorization: `Bearer ${apiKey}` },
					signal: controller.signal
				});
				if (!response.ok) throw new Error(`BigModel /models failed with HTTP ${response.status}`);
				const live = discoverModels(await response.json());
				if (live.length === 0) throw new Error("BigModel /models returned no maintained chat models");
				profiles = profileFor(config, live);
				registration.replace([PROVIDER]);
			} catch (error) {
				if (!controller.signal.aborted) {
					ctx.logger.warn("model-catalog-bigmodel: live refresh failed; keeping the maintained catalog");
					ctx.logger.warn(error);
				}
			} finally {
				refreshing = void 0;
			}
		})();
	};
	ctx.effect(() => {
		refresh();
		return () => {
			controller.abort();
		};
	}, "model-catalog-bigmodel: live refresh");
	ctx.on("credentials/updated", (ref) => {
		if (ref === config.apiKeyEnv) refresh();
	});
}
//#endregion
export { Config, apply, discoverModels, inject, maintainedModels, name, parseModelIds };

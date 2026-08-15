import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
//#region lib/types/index.js
/** BigModel Coding Plan model-catalog plugin for the pi-ai adapter. */
const name = "model-catalog-bigmodel";
const inject = ["piAiModelCatalog"];
const PROVIDER = "zai";
const BASE_URL = "https://api.z.ai/api/coding/paas/v4";
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
function textModel(id, name, contextWindow, maxTokens) {
	return {
		id,
		name,
		api: "openai-completions",
		provider: PROVIDER,
		baseUrl: BASE_URL,
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
	textModel("glm-4.5", "GLM-4.5", 131072, 98304),
	textModel("glm-4.6", "GLM-4.6", 204800, 131072),
	textModel("glm-5", "GLM-5", 2e5, 131072),
	textModel("glm-5.3", "GLM-5.3", 2e5, 131072)
]);
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
* @param payload - credential-free provider response body.
* @returns maintained descriptors currently reported or directly verified.
*/
function discoverModels(payload) {
	const live = new Set(parseModelIds(payload));
	return maintainedModels.filter((model) => live.has(model.id) || DIRECTLY_VERIFIED.has(model.id));
}
/** Register the maintained list immediately, then reconcile it with live availability. */
function apply(ctx) {
	const registration = ctx.piAiModelCatalog.register(PROVIDER, maintainedModels);
	ctx.effect(() => () => {
		registration.dispose();
	}, "model-catalog-bigmodel: registration");
	const controller = new AbortController();
	let refreshing;
	const refresh = () => {
		refreshing ??= (async () => {
			try {
				const live = discoverModels(await ctx.piAiModelCatalog.fetchModels(PROVIDER, controller.signal));
				if (live.length === 0) throw new Error("BigModel /models returned no maintained chat models");
				registration.replace(live);
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
	ctx.effect(() => ctx.piAiModelCatalog.subscribeConfiguration(refresh), "model-catalog-bigmodel: configuration refresh");
}
//#endregion
export { apply, discoverModels, inject, maintainedModels, name, parseModelIds };

/** BigModel Coding Plan model-catalog plugin for the pi-ai adapter. */
import type { Api, Model } from '@earendil-works/pi-ai';
import type { Context } from '@deepseek-ai/cordis';
import type { PiAiModelCatalog } from '@deepseek-ai/dsh-llm-pi-ai';
export declare const name = "model-catalog-bigmodel";
export declare const inject: string[];
/** Maintained descriptors plus models live-verified ahead of pi-ai's catalog. */
export declare const maintainedModels: readonly Model<Api>[];
/**
 * Parse the provider-neutral ids returned by BigModel's Models endpoint.
 * @param payload - decoded JSON response body.
 * @returns model ids in provider order.
 */
export declare function parseModelIds(payload: unknown): string[];
/**
 * Reconcile the live Coding Plan list with direct-call verified additions.
 * @param payload - credential-free provider response body.
 * @returns maintained descriptors currently reported or directly verified.
 */
export declare function discoverModels(payload: unknown): readonly Model<Api>[];
/** Register the maintained list immediately, then reconcile it with live availability. */
export declare function apply(ctx: Context & {
    piAiModelCatalog: PiAiModelCatalog;
}): void;
//# sourceMappingURL=index.d.ts.map
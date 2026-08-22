/** BigModel Coding Plan provider route backed by pi-ai message conversion. */
import { type Api, type Model } from '@earendil-works/pi-ai';
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "model-catalog-bigmodel";
export declare const inject: string[];
/** Deployment settings for the independent `zai` route. */
export interface Config {
    /** Credential reference resolved for every request. */
    apiKeyEnv?: string;
    /** BigModel Coding Plan API base URL. */
    baseURL?: string;
    /** Provider label shown in model selectors. */
    displayName?: string;
    /** Maximum provider idle time while one stream read is outstanding. */
    streamIdleTimeoutMs?: number;
    /**
     * Base64 image payload bound for one request. Older images become text
     * placeholders once a session's accumulated images exceed it, so a long
     * session keeps completing requests instead of being refused for size.
     */
    maxRequestImageBytes?: number;
    /** Total-pixel budget for each deterministic inline request version. */
    requestImagePixelBudget?: number;
    /** Raw encoded-byte cap for each deterministic inline request version. */
    requestImageMaxBytes?: number;
}
/** Schemastery validator for the independent BigModel route configuration. */
export declare const Config: z<Config>;
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
 * @param payload - provider response body.
 * @returns maintained descriptors currently reported or directly verified.
 */
export declare function discoverModels(payload: unknown): readonly Model<Api>[];
/**
 * Register and live-filter the independent BigModel provider route.
 * @param ctx - Cordis context providing LLM and credential services.
 * @param rawConfig - validated plugin configuration.
 */
export declare function apply(ctx: Context, rawConfig: Config): void;
//# sourceMappingURL=index.d.ts.map
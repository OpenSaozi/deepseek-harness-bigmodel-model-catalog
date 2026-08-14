/** Package-owned invariant companion for the BigModel catalog. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
export const name = 'model-catalog-bigmodel-invariant'
export const inject = ['invariants']
// No runtime invariant: the owning llm-pi-ai registry validates catalog identity and lifecycle.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-model-catalog-bigmodel', install))

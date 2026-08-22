/** Package-owned invariant companion for the BigModel provider route. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
export const name = 'model-catalog-bigmodel-invariant'
export const inject = ['invariants']
// No runtime invariant: the LLM registry owns route identity and registration lifecycle.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-model-catalog-bigmodel', install))

//#region lib/types/invariant.js
const name = "model-catalog-bigmodel-invariant";
const inject = ["invariants"];
const install = () => {};
const apply = (ctx) => Promise.resolve(ctx.invariants.register("@deepseek-ai/dsh-model-catalog-bigmodel", install));
//#endregion
export { apply, inject, name };

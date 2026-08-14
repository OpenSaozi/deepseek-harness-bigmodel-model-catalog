# DeepSeek Harness BigModel / GLM Model Catalog

English | [中文](README.zh.md)

`@deepseek-ai/dsh-model-catalog-bigmodel` is a live Zhipu AI BigModel / GLM Coding Plan model catalog plugin for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) and its pi-ai adapter. It queries the exact `https://api.z.ai/api/coding/paas/v4/models` endpoint through the host, without exposing the Coding Plan key to the plugin.

## Highlights

- Maintains reviewed descriptors for `glm-4.5`, `glm-4.6`, `glm-5`, and `glm-5.3`.
- Reconciles the live provider response with an explicit, directly verified `glm-5.3` exception.
- Keeps the managed credential in DeepSeek Harness; the plugin receives only a credential-free model-list response.
- Changes model discovery only: no prompt text, compatibility header, token accounting, or inference transport is modified.

## Source Integration

This repository is currently a source distribution for a matching DeepSeek Harness checkout, not an independently installable npm release. Place it at `packages/llm/model-catalog-bigmodel`, add it to the host TypeScript references and base bundle dependencies, then register it in the bundle's Cordis configuration:

```yaml
- id: llm-pi-ai
  name: '@deepseek-ai/dsh-llm-pi-ai'
- id: model-catalog-bigmodel
  name: '@deepseek-ai/dsh-model-catalog-bigmodel'
```

Inference still uses the ordinary pi-ai `zai` route. This plugin owns only the model catalog and availability reconciliation.

## Contributing

Please attach provider evidence for every catalog change: the exact model id, protocol, context/output capacity, reasoning behavior, and a successful direct request where applicable. Do not infer capability metadata from the `/models` response alone.

## License and Disclaimer

MIT. This community integration is not affiliated with or endorsed by Zhipu AI, BigModel, DeepSeek, or pi-ai.

## Model Experience

### Catalog selection

#### What the model sees

No package-owned text. The plugin only controls which BigModel descriptor, such as `glm-5.3`, the existing pi-ai adapter may select; the adapter owns request conversion.

#### Token effect

No direct token effect. Tokenization and context use remain properties of the selected model and pi-ai's z.ai-compatible request implementation.

#### KV Cache effect

No direct effect. Selecting a different model may change provider-side cache eligibility, but this plugin adds no request content.

## Known Limitations and Deferred Work

- Refresh runs on mount and after route-setting or managed-credential changes. Failure keeps the maintained catalog and logs the error.
- The Coding Plan Models endpoint currently omits a directly callable `glm-5.3`; that exact id is an explicit verified exception.
- The endpoint supplies ids, not complete capability metadata. Descriptor changes still require verification and a package update.

# DSH Plugin: LLM Provider - BigModel GLM

[中文](README.md) | English

Allows connecting to the **Zhipu AI BigModel / GLM** Coding Plan as an LLM Provider, enabling [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) to utilize the dedicated Coding Plan route and unlocking the verified **1M-token context model `glm-5.3`** (along with `glm-4.5`, `glm-4.6`, and `glm-5`).

## Target Audience and Use Cases

Designed for developers with a Zhipu GLM Coding Plan membership or BigModel account who need to analyze large codebases, process long documents, or perform intensive code generation.

## Key Features

- **Unlocks 1M Context Window**: Directly select `glm-5.3` in the model selector, featuring a 1,000,000-token context limit and 128K max output capacity.
- **Tailored for Coding Plan**: Integrates seamlessly with Zhipu AI's developer-focused Coding PaaS endpoint (`https://api.z.ai/api/coding/paas/v4/models`).
- **Live Reconciled with Verified Exceptions**: Combines live endpoint discovery while maintaining verified support for `glm-5.3`.
- **Secure Credential Isolation**: Coding Plan keys remain inside the Harness host credential store; the plugin receives only sanitized model metadata.

## Installation and Quick Start

Install a reviewed revision into a DeepSeek Harness profile. The repository includes a `dsh.bundle` patch and prebuilt runtime artifacts so no local build steps are required:

```sh
dsh plugin --profile <profile> add github:OpenSaozi/dsh-bigmodel-catalog#<commit-sha>
```

The installed bundle contributes the following Cordis configuration (the base bundle already provides `llm-pi-ai`):

```yaml
- id: model-catalog-bigmodel
  name: '@deepseek-ai/dsh-model-catalog-bigmodel'
```

Configuration note: Inference continues through the standard `zai` route in `@deepseek-ai/dsh-llm-pi-ai`; this plugin manages catalog availability and metadata.

## Contributing

Please attach provider evidence for every catalog change: exact model ID, protocol, context/output capacity, reasoning behavior, and direct request verification where applicable. Update both README languages and run package tests in a matching DeepSeek Harness checkout.

## License and Disclaimer

MIT License. This community integration is not affiliated with or endorsed by Zhipu AI, BigModel, DeepSeek, or pi-ai.

## Model Experience

### Catalog Selection

#### What the model sees

No package-owned text. The plugin only controls which BigModel descriptor, such as `glm-5.3`, the existing pi-ai adapter may select; the adapter owns request conversion.

#### Token effect

No direct token effect. Tokenization and context use remain properties of the selected model and pi-ai's z.ai-compatible request implementation.

#### KV Cache effect

No direct effect. Selecting a different model may change provider-side cache eligibility, but this plugin adds no request content.

## Known Limitations and Deferred Work

- Refresh runs on mount and after route-setting or managed-credential changes. Failure keeps the maintained catalog and logs the error.
- The Coding Plan Models endpoint currently omits a directly callable `glm-5.3`; that exact id is an explicit verified exception.
- The endpoint supplies ids, not complete capability metadata. Context and output capacities therefore come from the reviewed descriptor table and remain pinned by package tests.

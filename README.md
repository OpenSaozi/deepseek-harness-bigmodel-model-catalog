# DSH Plugin: LLM Provider - BigModel GLM

中文 | [English](README.en.md)

允许接入 **智谱 AI BigModel / GLM** 的 Coding Plan 作为 LLM Provider，让 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 可以直接使用 Coding Plan 编程通道，并特别解锁官方列表未开放、但经真实验证可用的 **100 万超长上下文强力模型 `glm-5.3`**（同时支持 `glm-4.5`/`4.6`/`5`）。

## 适用人群与场景

适合拥有智谱 GLM Coding Plan 会员或 BigModel 开发者账号，需要处理超大代码库、长篇文档或进行高强度代码生成与重构的开发者。

## 核心特性

- **解锁 1M 上下文超长窗口**：直接在下拉列表选用 `glm-5.3`，拥有 100 万 token 上下文与 12.8 万 token 单次输出容量。
- **专为 Coding Plan 优化**：完美对接智谱为程序员定制的 Coding PaaS 接口（`https://api.z.ai/api/coding/paas/v4/models`）。
- **实时核对与验证异常保留**：结合官方端点实时可用性响应，同时保留经过真实验证的 `glm-5.3` 特别支持。
- **安全凭据隔离**：Coding Plan Key 留存在 Harness 内部，插件仅接收脱敏后的模型元数据。

## 极简安装与使用

请把经过评审的提交安装进指定的 DeepSeek Harness profile。仓库携带 `dsh.bundle` 配置和预构建运行文件，通过 Git 安装无需在本地执行构建：

```sh
dsh plugin --profile <profile> add github:OpenSaozi/dsh-bigmodel-catalog#<commit-sha>
```

安装后，插件会自动在 Cordis 配置中注入以下内容（profile 基础 bundle 已提供 `llm-pi-ai` 路由）：

```yaml
- id: model-catalog-bigmodel
  name: '@deepseek-ai/dsh-model-catalog-bigmodel'
```

配置说明：实际推理走 pi-ai 的标准 `zai` 路由。本插件只负责模型清单与可用性核对。

## 参与贡献

每次修改清单时，请附上供应商证据：准确模型 id、协议、上下文和输出容量、推理行为，并在适用时提供直接请求成功的结果。请同时更新中英文 README，并在版本匹配的 DeepSeek Harness 工作区中运行包测试。

## 许可证与免责声明

采用 MIT 许可证。本社区集成与智谱 AI、BigModel、DeepSeek 或 pi-ai 不存在隶属关系，也未获得这些项目的背书。

## 模型体验

### 清单选择

#### 模型看到的内容

没有本包自带的文本。插件只决定现有 pi-ai 适配器可以选择哪个 BigModel 模型描述，例如 `glm-5.3`；请求转换由适配器负责。

#### Token 影响

没有直接 Token 影响。分词和上下文占用仍由所选模型及 pi-ai 的 z.ai 兼容请求实现决定。

#### KV Cache 影响

没有直接影响。切换模型可能改变供应商端缓存的适用性，但本插件不会增加请求内容。

## 已知限制与暂缓事项

- 插件挂载、路由设置变化或受管凭据变化时会刷新。刷新失败时会保留代码维护的清单并记录错误。
- Coding Plan 的 Models 接口目前没有列出可直接调用的 `glm-5.3`；这个准确 id 是明确记录的真实验证例外。
- 接口只给出 id，没有完整能力元数据。上下文和输出容量因此来自已审核的描述表，并由包测试锁定。

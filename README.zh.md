# DSH Plugin: LLM Provider - BigModel GLM

中文 | [English](README.md)

允许接入 **智谱 AI BigModel / GLM** 的 Coding Plan 作为 LLM Provider，让 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 可以直接使用 Coding Plan 编程通道，并特别解锁官方列表未开放、但经真实验证可用的 **100 万超长上下文强力模型 `glm-5.3`**（同时支持 `glm-4.5`/`4.6`/`5`）。

## 适用人群与场景

适合拥有智谱 GLM Coding Plan 会员或 BigModel 开发者账号，需要处理超大代码库、长篇文档或进行高强度代码生成与重构的开发者。

## 核心特性

- **解锁 1M 上下文超长窗口**：直接在下拉列表选用 `glm-5.3`，拥有 100 万 token 上下文与 12.8 万 token 单次输出容量。
- **专为 Coding Plan 优化**：对接智谱为程序员提供的 Coding PaaS 接口（`https://open.bigmodel.cn/api/coding/paas/v4/models`）。
- **实时核对与验证异常保留**：结合官方端点实时可用性响应，同时保留经过真实验证的 `glm-5.3` 特别支持。
- **独立供应商路由**：插件自己注册 `zai` adapter；仅复用官方导出的 `PiAiAdapter` 做消息与流转换，不依赖 `llm-pi-ai` 的 provider 配置或目录接缝。
- **安全凭据隔离**：插件在每次请求时通过 Harness 凭据服务解析 `BIGMODEL_API_KEY`，不会把密钥写进 Cordis 配置或日志。

## 极简安装与使用

请把经过评审的提交安装进指定的 DeepSeek Harness profile。仓库携带 `dsh.bundle` 配置和预构建运行文件，通过 Git 安装无需在本地执行构建：

```sh
dsh plugin --profile <profile> add github:OpenSaozi/dsh-bigmodel-catalog#<commit-sha>
```

安装后，插件会自动在 Cordis 配置中注入以下内容：

```yaml
- id: model-catalog-bigmodel
  name: '@deepseek-ai/dsh-model-catalog-bigmodel'
  config:
    apiKeyEnv: BIGMODEL_API_KEY
    baseURL: https://open.bigmodel.cn/api/coding/paas/v4
    displayName: BigModel
```

插件拥有完整的 `zai` 路由：目录、在线筛选、凭据解析和 adapter 注册都在本包内完成。若部署使用其他 Coding Plan 端点，可覆盖 `baseURL`；凭据引用也可通过 `apiKeyEnv` 更换。

## 参与贡献

每次修改清单时，请附上供应商证据：准确模型 id、协议、上下文和输出容量、推理行为，并在适用时提供直接请求成功的结果。请同时更新中英文 README，并在版本匹配的 DeepSeek Harness 工作区中运行包测试。

## 许可证与免责声明

采用 MIT 许可证。本社区集成与智谱 AI、BigModel、DeepSeek 或 pi-ai 不存在隶属关系，也未获得这些项目的背书。

## 模型体验

### 清单选择

#### 模型看到的内容

没有本包自带的文本。插件决定可选择的 BigModel 模型描述，例如 `glm-5.3`；请求转换由官方导出的 `PiAiAdapter` 负责。

#### Token 影响

没有直接 Token 影响。分词和上下文占用仍由所选模型及 pi-ai 的 z.ai 兼容请求实现决定。

#### KV Cache 影响

没有直接影响。切换模型可能改变供应商端缓存的适用性，但本插件不会增加请求内容。

## 已知限制与暂缓事项

- 插件挂载或 `BIGMODEL_API_KEY` 对应的受管凭据变化时会刷新。刷新失败时会保留代码维护的清单并记录错误。
- Coding Plan 的 Models 接口目前没有列出可直接调用的 `glm-5.3`；这个准确 id 是明确记录的真实验证例外。
- 接口只给出 id，没有完整能力元数据。上下文和输出容量因此来自已审核的描述表，并由包测试锁定。

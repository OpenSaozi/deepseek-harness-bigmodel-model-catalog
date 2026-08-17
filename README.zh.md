# DeepSeek Harness BigModel / GLM 模型清单插件

[English](README.md) | 中文

`@deepseek-ai/dsh-model-catalog-bigmodel` 是面向 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 及其 pi-ai 适配器的智谱 AI BigModel / GLM Coding Plan 实时模型清单插件。它通过宿主访问准确的 `https://api.z.ai/api/coding/paas/v4/models` 接口，不会把 Coding Plan Key 暴露给插件。

## 特点

- 维护经过核对的 `glm-4.5`、`glm-4.6`、`glm-5` 以及拥有 1M 上下文、128K 最大输出的 `glm-5.3` 描述。
- 将供应商实时响应与明确、经过直接请求验证的 `glm-5.3` 例外合并。
- 受管凭据留在 DeepSeek Harness；插件只收到不含凭据的模型列表响应。
- 只改变模型发现：不修改提示词、兼容请求头、Token 计算或推理传输。

## 安装

请把经过评审的提交安装进一个 DeepSeek Harness profile。仓库携带 `dsh.bundle` patch 和预构建运行文件，因此通过 Git 安装时无需授权包构建：

```sh
dsh plugin --profile <profile> add github:OpenSaozi/deepseek-harness-bigmodel-model-catalog#<commit-sha>
```

安装后的组合包会贡献下面的清单配置；profile 的基础 bundle 已经提供 `llm-pi-ai`：

```yaml
- id: model-catalog-bigmodel
  name: '@deepseek-ai/dsh-model-catalog-bigmodel'
```

推理仍走 pi-ai 的普通 `zai` 路由。本插件只负责模型清单和可用性核对。

## 参与贡献

每次修改清单时，请附上供应商证据：准确模型 id、协议、上下文和输出容量、推理行为，并在适用时提供直接请求成功的结果。不要只根据 `/models` 响应推断能力元数据。

## 许可证与免责声明

MIT。本社区集成与智谱 AI、BigModel、DeepSeek 或 pi-ai 不存在隶属关系，也未获得这些项目的背书。

## 模型体验

### 清单选择

#### 模型看到的内容

没有本包自带的文本。插件只决定现有 pi-ai 适配器可以选择哪个 BigModel 模型描述，例如 `glm-5.3`；请求转换由适配器负责。

#### Token 影响

没有直接 Token 影响。分词和上下文占用仍由所选模型及 pi-ai 的 z.ai 兼容请求实现决定。

#### KV Cache 影响

没有直接影响。切换模型可能改变供应商端缓存的适用性，但本插件不会增加请求内容。

## 已知限制与延期工作

- 插件挂载、路由设置变化或受管凭据变化时会刷新。刷新失败时会保留代码维护的清单并记录错误。
- Coding Plan 的 Models 接口目前没有列出可直接调用的 `glm-5.3`；这个准确 id 是明确记录的真实验证例外。
- 接口只给出 id，没有完整能力元数据。上下文和输出容量因此来自已审核的描述表，并由包测试锁定。

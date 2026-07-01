# Vision Relay MCP 小白使用教程

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

vision-relay-mcp 的零基础部署教程，对应 1.1.0。完整文档见 [README.md](./README.md)。

## 这个项目是干什么的？

Claude Code 不能直接看图片。这个项目充当"翻译官"：

```
你的本地图片 → Vision Relay MCP → 视觉模型 API → 文字结果 → Claude Code
```

1.1.0 只有一个工具入口 process_images，单图多图都走这里，做什么由提示词决定。

### v0.1.0 vs v1.1.0

v0.1.0 有两个工具（analyze_image、compare_images），v1.1.0 合并为一个。

| | v0.1.0 | v1.1.0 |
|---|--------|--------|
| 工具数 | 2 个 | 1 个 |
| 一次几张 | 1 或刚好 2 | 不限 |
| 发送方式 | 分开发 | 合并一次 |

## 你需要准备什么

1. Node.js ≥ 18.0.0（[下载](https://nodejs.org/)）
2. Claude Code
3. 支持图片输入的视觉模型接口 + API key
4. 本项目代码

> VISION_MODEL 必须支持图片输入。

## 第 1 步：安装

```bash
cd /path/to/vision-relay-mcp    # Windows: cd C:\Users\你\vision-relay-mcp
npm install
npm run check                    # 没有报错就 OK
```

## 第 2 步：配置

所有配置通过环境变量传入。必填三项：

| 名称 | 作用 | 怎么填 |
| --- | --- | --- |
| VISION_API_KEY | API 密钥 | 接口提供方给的 key |
| VISION_BASE_URL | 接口地址 | 如 `https://api.example.com`（自动补全路径） |
| VISION_MODEL | 模型名 | 必须支持图片输入 |

选填（不改也能用）：

| 名称 | 默认 | 作用 |
| --- | --- | --- |
| VISION_PROVIDER | anthropic | 接口格式：anthropic 或 openai |
| VISION_MAX_TOKENS | 2000 | 返回文本最大长度 |
| VISION_MAX_IMAGE_SIZE | 0 | 单图大小上限（字节），0=不限制 |

URL 会自动补全：填 https://api.example.com，实际请求 Anthropic 的
/v1/messages 或 OpenAI 的 /v1/chat/completions。

> 不要把 API key 写进代码或 README。

## 第 3 步：配置 Claude Code

配置文件位置：
- 用户级：~/.claude/claude_desktop_config.json
- 项目级：.claude/settings.json

```json
{
  "mcpServers": {
    "vision-relay": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/vision-relay-mcp/index.js"],
      "env": {
        "VISION_PROVIDER": "anthropic",
        "VISION_BASE_URL": "https://your-relay.example.com",
        "VISION_MODEL": "your-model",
        "VISION_API_KEY": "your_key"
      }
    }
  }
}
```

路径必须绝对路径。Windows：C:\Users\你\vision-relay-mcp\index.js
macOS/Linux：/Users/你/vision-relay-mcp/index.js

配置完**重启 Claude Code**。

## 第 4 步：验证

```bash
claude mcp list
```

看到 vision-relay ... Connected 即成功。

> Connected 只代表服务启动了，不代表接口配置正确。实际识图时才会调接口。

## 第 5 步：使用

在 Claude Code 里直接描述需求：

```
帮我看看这张截图里的文字：C:\Users\你\screenshot.png
```

```
对比这两张设计稿的差异：C:\Users\你\v1.png 和 C:\Users\你\v2.png
```

```
把这张表单的字段提取成 JSON：C:\Users\你\form.jpg
```

底层格式（Claude Code 自动处理，不需要手动写）：

```json
{ "image_paths": ["/abs/path/img.png"], "prompt": "提取文字。" }
```

支持的格式：png、jpg/jpeg、webp、gif、bmp

## 从 v0.1.0 升级

1. 下载 v1.1.0，执行 npm install
2. 更新 MCP 路径指向 v1.1.0 的 index.js
3. 替换调用：

| v0.1.0 | v1.1.0 |
| --- | --- |
| analyze_image + 单张路径 | process_images + image_paths: ["路径"] |
| compare_images + 两张路径 | process_images + 两张路径 + 对比提示词 |

4. 重启 Claude Code，验证。

## 常见问题

### 1. Connected 但识图失败？

- VISION_BASE_URL 地址不对
- VISION_API_KEY 不正确
- VISION_MODEL 不是视觉模型
- VISION_PROVIDER 和接口格式不匹配
- 图片路径不存在或格式不支持

手动执行 node index.js 看报错信息。

### 2. provider 怎么选？

- Anthropic Messages 格式 → anthropic
- OpenAI Chat Completions 格式 → openai

不确定的话两个都试试。

### 3. 为什么用绝对路径？

MCP 服务的工作目录不确定，绝对路径最稳。

### 4. key 放哪最安全？

MCP 配置的 env 块里。不要写进代码或 README。

### 5. 怎么卸载？

删掉 MCP 配置中的 vision-relay 段，重启 Claude Code，删项目文件夹。

## 项目文件

```
vision-relay-mcp/
├── index.js          # 核心代码（单文件，约 240 行）
├── package.json
├── README.md         # 完整文档
├── README.zh-CN.md   # 本文件
├── LICENSE           # MIT
├── .env.example
└── .gitignore
```

## 一句话总结

```
Claude Code   →   对话和写代码
Vision Relay  →   把图片交给视觉模型
视觉模型      →   看懂图片返回文字
Claude Code   →   继续处理任务
```

v1.1.0 的核心变化：**统一走 process_images，由提示词决定做什么。**

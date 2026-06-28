# Vision Relay MCP 小白使用教程

这个项目可以让 Claude Code 在需要看图片时，调用一个“有视觉能力的模型”来帮它识图。

举个例子：

```text
你平时用 DeepSeek / 普通模型写代码。
它本身看不了图片。
这个 MCP 可以把 screenshot.png 发给 Claude / GPT / GLM 视觉模型分析。
分析结果再返回给 Claude Code。
```

## 你需要准备什么

你需要准备 4 样东西：

```text
1. Node.js
2. Claude Code
3. 一个支持图片输入的中转站 API
4. 一个支持视觉的模型名
```

注意：普通文本模型不行。模型必须真的支持图片输入。

常见视觉模型例子：

```text
claude-sonnet-4-6
claude-opus-4-6
gpt-4o
gemini-2.5-pro
glm-4v
glm-4.5v
```

具体能不能用，以你的中转站后台为准。

## 第 1 步：安装依赖

打开 PowerShell，进入这个项目目录。

如果项目在桌面，可以这样进入：

```powershell
cd "path\to\vision-relay-mcp"
```

然后安装依赖：

```powershell
npm install
```

如果提示找不到 `npm`，说明你还没装 Node.js。

## 第 2 步：设置 API 信息

你需要设置下面 4 个环境变量：

```text
VISION_PROVIDER
VISION_BASE_URL
VISION_MODEL
VISION_API_KEY
```

### Claude / Anthropic 格式中转站

如果你的中转站是 Claude Code 用的接口，通常用这个：

```powershell
[Environment]::SetEnvironmentVariable("VISION_PROVIDER", "anthropic", "User")
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", "https://你的中转站地址", "User")
[Environment]::SetEnvironmentVariable("VISION_MODEL", "你的视觉模型名", "User")
[Environment]::SetEnvironmentVariable("VISION_API_KEY", "你的API密钥", "User")
```

例子：

```powershell
[Environment]::SetEnvironmentVariable("VISION_PROVIDER", "anthropic", "User")
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", "https://example.com", "User")
[Environment]::SetEnvironmentVariable("VISION_MODEL", "claude-sonnet-4-6", "User")
[Environment]::SetEnvironmentVariable("VISION_API_KEY", "sk-xxxx", "User")
```

### OpenAI 格式中转站

如果你的中转站是 OpenAI 兼容接口，比如 `/v1/chat/completions`，用这个：

```powershell
[Environment]::SetEnvironmentVariable("VISION_PROVIDER", "openai", "User")
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", "https://你的中转站地址/v1", "User")
[Environment]::SetEnvironmentVariable("VISION_MODEL", "你的视觉模型名", "User")
[Environment]::SetEnvironmentVariable("VISION_API_KEY", "你的API密钥", "User")
```

设置完以后，重启 Claude Code。

## 第 3 步：把 MCP 加到 Claude Code

仍然在项目目录里执行：

```powershell
claude mcp add -s user vision-relay -- node "%CD%\index.js"
```

然后检查是否成功：

```powershell
claude mcp list
```

如果看到：

```text
vision-relay ... Connected
```

说明配置成功。

## 第 4 步：怎么使用

把图片放到你的代码项目目录里，比如：

```text
screenshot.png
```

然后在 Claude Code 里说：

```text
请调用 vision-relay 分析 screenshot.png
```

或者：

```text
请用 vision-relay 看一下 error.png，告诉我报错原因
```

对比两张图片：

```text
请调用 vision-relay 对比 before.png 和 after.png
```

## 怎么换模型

比如你想从 Sonnet 换成 Opus：

```powershell
[Environment]::SetEnvironmentVariable("VISION_MODEL", "claude-opus-4-6", "User")
```

然后重启 Claude Code。

## 怎么换中转站

改中转站地址：

```powershell
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", "https://新的中转站地址", "User")
```

改 API key：

```powershell
[Environment]::SetEnvironmentVariable("VISION_API_KEY", "新的API密钥", "User")
```

然后重启 Claude Code。

## 常见问题

### 1. 为什么 MCP 显示 Connected，但识图失败？

`Connected` 只代表 Claude Code 能启动这个 MCP。

真正识图还需要：

```text
API key 正确
中转站地址正确
模型支持图片
账号有额度
```

### 2. 为什么提示 Missing environment variable？

说明你漏设了环境变量。

检查：

```powershell
[Environment]::GetEnvironmentVariable("VISION_PROVIDER", "User")
[Environment]::GetEnvironmentVariable("VISION_BASE_URL", "User")
[Environment]::GetEnvironmentVariable("VISION_MODEL", "User")
```

不要随便截图显示 `VISION_API_KEY`，那是密钥。

### 3. 为什么普通模型不能识图？

因为这个 MCP 只是把图片发给你指定的模型。

如果你指定的是文本模型，它还是看不了图片。

### 4. API key 可以写进代码吗？

不建议。

不要把 API key 写进：

```text
index.js
README.md
.env.example
GitHub 仓库
截图
聊天记录
```

推荐放在 Windows 环境变量里。

### 5. 我怎么删除这个 MCP？

执行：

```powershell
claude mcp remove vision-relay -s user
```

如果还想删除环境变量：

```powershell
[Environment]::SetEnvironmentVariable("VISION_PROVIDER", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_MODEL", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_API_KEY", $null, "User")
```

## 最简单的理解

```text
Claude Code 负责写代码
vision-relay 负责接收图片
视觉模型负责看图
中转站负责转发 API 请求
```

你在 Claude Code 里明确说“调用 vision-relay 分析图片”，成功率最高。

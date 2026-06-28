# Vision Relay MCP

Vision Relay MCP is a small local MCP server for Claude Code and other MCP clients. It lets a text-first coding model call a separate vision-capable model through a relay API to analyze local images.

中文小白版教程见 [README.zh-CN.md](README.zh-CN.md).

This is useful when your main Claude Code model does not support images, or when you want to use a cheaper/default coding model and route only image tasks to a vision model.

## Features

- Analyze a local image with a vision model.
- Compare two local images.
- Supports Anthropic-compatible `/v1/messages` APIs.
- Supports OpenAI-compatible `/v1/chat/completions` APIs.
- Keeps API keys out of project files by reading environment variables.

## Project Files

```text
index.js            MCP server implementation
package.json        Node package metadata and dependencies
package-lock.json   Locked dependency versions
.env.example        Example environment variables
.gitignore          Files to exclude from Git
README.md           Usage documentation
LICENSE             MIT license
```

## Requirements

- Node.js 20 or newer. Node.js 22+ is recommended.
- Claude Code or another MCP-compatible client.
- A relay API key for a vision-capable model.

## Install

Clone or copy this project, then install dependencies:

```powershell
npm install
```

## Configure Environment Variables

Set the environment variables for your relay provider.

### Anthropic-Compatible Relay

Use this for Claude-style relays that expose `/v1/messages`.

```powershell
[Environment]::SetEnvironmentVariable("VISION_PROVIDER", "anthropic", "User")
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", "https://your-relay.example.com", "User")
[Environment]::SetEnvironmentVariable("VISION_MODEL", "claude-sonnet-4-6", "User")
[Environment]::SetEnvironmentVariable("VISION_API_KEY", "your_api_key_here", "User")
```

### OpenAI-Compatible Relay

Use this for relays that expose `/v1/chat/completions` and accept image input in OpenAI's `image_url` format.

```powershell
[Environment]::SetEnvironmentVariable("VISION_PROVIDER", "openai", "User")
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", "https://your-relay.example.com/v1", "User")
[Environment]::SetEnvironmentVariable("VISION_MODEL", "your-vision-model", "User")
[Environment]::SetEnvironmentVariable("VISION_API_KEY", "your_api_key_here", "User")
```

Restart Claude Code after changing user environment variables.

## Add To Claude Code

From this project directory, register the MCP server:

```powershell
claude mcp add -s user vision-relay -- node "%CD%\\index.js"
```

If you prefer to store non-secret settings directly in Claude Code's MCP config:

```powershell
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://your-relay.example.com `
  -e VISION_MODEL=claude-sonnet-4-6 `
  -- node "%CD%\\index.js"
```

Do not put `VISION_API_KEY` in source control.

## Verify

Check that Claude Code can start the MCP server:

```powershell
claude mcp list
claude mcp get vision-relay
```

You should see `vision-relay` with `Connected` status.

## Usage

Put an image in your project directory, then ask Claude Code:

```text
Please call vision-relay to analyze screenshot.png.
```

Or:

```text
Please use vision-relay to compare before.png and after.png.
```

Available tools:

- `analyze_image`
- `compare_images`

## Switching Models

Change the model through the environment variable:

```powershell
[Environment]::SetEnvironmentVariable("VISION_MODEL", "claude-opus-4-6", "User")
```

Then restart Claude Code.

If you put `VISION_MODEL` in Claude Code's MCP config with `claude mcp add -e`, that value overrides the user environment variable. In that case, remove and re-add the MCP server:

```powershell
claude mcp remove vision-relay -s user
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://your-relay.example.com `
  -e VISION_MODEL=claude-opus-4-6 `
  -- node "%CD%\\index.js"
```

## Security Notes

- Never commit real API keys.
- Treat screenshots as sensitive data. Images are sent to the configured relay API.
- Prefer environment variables or a secret manager for credentials.
- Rotate any API key that has been shared in chat, logs, screenshots, or public repos.

## Troubleshooting

### `Missing environment variable(s): VISION_API_KEY`

Set `VISION_API_KEY` and restart Claude Code.

### `Vision relay failed (403)`

The relay may restrict the endpoint or client type. Try `VISION_PROVIDER=anthropic` for Claude-style `/v1/messages` relays, or check your relay documentation.

### `Could not process image`

The relay may reject very small, corrupt, unsupported, or too-large images. Try a normal PNG/JPEG screenshot under 20 MB.

### Text works but images fail

The model or relay may not support vision input, even if the model name looks correct. Confirm with your relay provider that the selected model accepts images.

#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "vision-relay-mcp",
    version: "1.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const mimeByExt = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"]
]);

const DEFAULT_IMAGE_SET_PROMPT = "Analyze these images comprehensively. For each image, describe the main content, extract any visible text, and identify important objects, colors, layout, and notable details. Also mention relationships, sequence, similarities, or differences across the images when relevant.";

function config() {
  return {
    provider: (process.env.VISION_PROVIDER || "anthropic").toLowerCase(),
    apiKey: process.env.VISION_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl: process.env.VISION_BASE_URL,
    model: process.env.VISION_MODEL,
    maxTokens: Number(process.env.VISION_MAX_TOKENS || 2000)
  };
}

function endpoint(baseUrl, provider) {
  const base = baseUrl.replace(/\/+$/, "");
  if (provider === "anthropic") {
    if (base.endsWith("/v1/messages")) return base;
    if (base.endsWith("/v1")) return `${base}/messages`;
    return `${base}/v1/messages`;
  }
  if (provider === "openai") {
    if (base.endsWith("/chat/completions")) return base;
    if (base.endsWith("/v1")) return `${base}/chat/completions`;
    return `${base}/v1/chat/completions`;
  }
  throw new Error(`Unsupported VISION_PROVIDER: ${provider}`);
}

async function readImage(imagePath) {
  const fullPath = path.resolve(imagePath);
  const info = await stat(fullPath);
  if (!info.isFile()) {
    throw new Error(`Not a file: ${fullPath}`);
  }
  const maxSize = Number(process.env.VISION_MAX_IMAGE_SIZE || 0);
  if (maxSize > 0 && info.size > maxSize) {
    const limitMB = (maxSize / (1024 * 1024)).toFixed(1);
    throw new Error(`Image is larger than ${limitMB} MB: ${fullPath}`);
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mediaType = mimeByExt.get(ext);
  if (!mediaType) {
    throw new Error(`Unsupported image extension "${ext}". Use png, jpg, jpeg, webp, gif, or bmp.`);
  }

  const bytes = await readFile(fullPath);
  return {
    data: bytes.toString("base64"),
    mediaType
  };
}

async function callAnthropic({ apiKey, baseUrl, model, maxTokens, prompt, images }) {
  const content = [];
  for (const image of images) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: image.data
      }
    });
  }
  content.push({ type: "text", text: prompt });

  const response = await fetch(endpoint(baseUrl, "anthropic"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [
        {
          role: "user",
          content
        }
      ]
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Vision relay failed (${response.status}): ${text.slice(0, 2000)}`);
  }
  const data = JSON.parse(text);
  if (Array.isArray(data.content)) {
    return data.content.map((part) => part.text || JSON.stringify(part)).join("\n");
  }
  return JSON.stringify(data, null, 2);
}

async function callOpenAI({ apiKey, baseUrl, model, maxTokens, prompt, images }) {
  const content = [{ type: "text", text: prompt }];
  for (const image of images) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mediaType};base64,${image.data}`
      }
    });
  }

  const response = await fetch(endpoint(baseUrl, "openai"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: 0,
      max_tokens: maxTokens
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Vision relay failed (${response.status}): ${text.slice(0, 2000)}`);
  }
  const data = JSON.parse(text);
  const message = data?.choices?.[0]?.message?.content;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message.map((part) => part.text || JSON.stringify(part)).join("\n");
  }
  return JSON.stringify(data, null, 2);
}

async function callVision({ prompt, imagePaths }) {
  const cfg = config();
  const missing = [];
  if (!cfg.apiKey) missing.push("VISION_API_KEY");
  if (!cfg.baseUrl) missing.push("VISION_BASE_URL");
  if (!cfg.model) missing.push("VISION_MODEL");
  if (missing.length) {
    throw new Error(`Missing environment variable(s): ${missing.join(", ")}`);
  }

  const images = await Promise.all(imagePaths.map((imagePath) => readImage(imagePath)));

  if (cfg.provider === "anthropic") {
    return callAnthropic({ ...cfg, prompt, images });
  }
  if (cfg.provider === "openai") {
    return callOpenAI({ ...cfg, prompt, images });
  }
  throw new Error(`Unsupported VISION_PROVIDER: ${cfg.provider}`);
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "process_images",
      description: "General-purpose vision tool for one or more local images. Use it for OCR, extracting structured information, describing content, answering questions, locating elements, summarizing screenshots, or reasoning across multiple images in a single API call.",
      inputSchema: {
        type: "object",
        properties: {
          image_paths: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "Local paths to the image files to process. All images are sent together in one request."
          },
          prompt: {
            type: "string",
            description: "Optional task or question for the image set. The vision model decides how to handle comparison, OCR, extraction, description, summarization, or other requests from this instruction.",
            default: DEFAULT_IMAGE_SET_PROMPT
          }
        },
        required: ["image_paths"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    if (name === "process_images") {
      if (!Array.isArray(args.image_paths) || args.image_paths.length === 0) {
        throw new Error("image_paths must be a non-empty array of image file paths.");
      }
      const text = await callVision({
        prompt: args.prompt || DEFAULT_IMAGE_SET_PROMPT,
        imagePaths: args.image_paths
      });
      return { content: [{ type: "text", text }] };
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }
});

await server.connect(new StdioServerTransport());

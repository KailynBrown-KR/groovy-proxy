# LiteLLM Chat

A minimal localhost website that gives you a **ChatGPT-esque UI** routed through your
[LiteLLM](https://github.com/BerriAI/litellm) proxy.

- Zero npm dependencies — just Node.js built-ins
- Streaming responses (SSE)
- Multiple conversations stored in `localStorage`
- Model picker auto-populated from your LiteLLM proxy
- Light wrapper: every `/api/*` request is forwarded to `LITELLM_BASE_URL/*`

## Prerequisites

- Node.js 18+ (uses built-in `fetch` features and AbortController are only needed in
  the browser, but Node 18+ is recommended for the server).
- A running LiteLLM proxy that exposes the OpenAI-compatible endpoints
  (`/v1/models`, `/v1/chat/completions`). Default assumption: `https://api-internal.8451.com/ai/proxy`.

## Run

```bash
# Defaults: PORT=3000, LITELLM_BASE_URL=https://api-internal.8451.com/ai/proxy
node server.js
```

Then open <http://localhost:3000>.

### Configuration

| Env var             | Default                  | Purpose                                              |
|---------------------|--------------------------|------------------------------------------------------|
| `PORT`              | `3000`                   | Port for this UI server                              |
| `LITELLM_BASE_URL`  | `http://localhost:4000`  | Base URL of your LiteLLM proxy                       |
| `LITELLM_API_KEY`   | _(empty)_                | If set, forwarded as `Authorization: Bearer <key>`   |

Examples:

```bash
PORT=3000 LITELLM_BASE_URL=https://api-internal.8451.com/ai/proxy node server.js

LITELLM_API_KEY=sk-... node server.js
```

## How it works

```
Browser  →  http://localhost:3000/api/v1/chat/completions
             ↓ (Node proxy)
            https://api-internal.8451.com/ai/proxy/v1/chat/completions  (your LiteLLM proxy)
```

The frontend (`public/`) is a single static page that uses the OpenAI-compatible
chat-completions API with `stream: true`. Conversation history is kept in
`localStorage`, so refreshing the page preserves your chats.

## Files

```
server.js          # Node static server + /api/* reverse proxy
public/index.html  # Shell layout (sidebar + chat area)
public/styles.css  # Dark, ChatGPT-style theme
public/app.js      # Chat logic, streaming, conversation state```

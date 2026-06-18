# LiteLLM Chat

A minimal, self-hosted chat interface for [LiteLLM](https://github.com/BerriAI/litellm) and OpenAI-compatible APIs. Works like ChatGPT, runs on your Mac.

## 🚀 Quick Start (macOS)

Run this one command in Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/KailynBrown-KR/litellm-chat/master/install.sh | bash
```

That's it! The installer handles everything automatically, then you can double-click **LiteLLM Chat** from your Applications folder.

---

## ✨ Features

- **One-Click Launch** — Double-click the macOS app to start (no Terminal needed after install)
- **Auto-Updates** — Automatically checks GitHub for updates on each launch
- **Secure Credential Storage** — API keys stored securely in your home directory with restricted permissions
- **Zero npm Dependencies** — Just Node.js built-ins
- **Streaming Responses** — Real-time SSE streaming like ChatGPT
- **Multiple Conversations** — Stored in `localStorage`, persists across sessions
- **Model Picker** — Auto-populated from your API endpoint
- **Dark Theme** — Clean, ChatGPT-style interface

---

## 📦 Installation

### Option 1: Automatic (Recommended)

The installer automatically handles:
- ✅ Xcode Command Line Tools
- ✅ Homebrew
- ✅ Node.js
- ✅ Git
- ✅ App creation

```bash
curl -fsSL https://raw.githubusercontent.com/KailynBrown-KR/litellm-chat/master/install.sh | bash
```

### Option 2: Manual

```bash
# Clone the repo
git clone https://github.com/KailynBrown-KR/litellm-chat.git
cd litellm-chat

# Install dependencies
npm install

# Run the server
./start-server.sh
```

---

## ⚙️ Configuration

### First Run Setup

On first launch, you'll be prompted to enter:

1. **API Base URL** — Your LiteLLM proxy or OpenAI endpoint
   - OpenAI: `https://api.openai.com/v1`
   - Local LiteLLM: `http://localhost:4000`
   - Azure: `https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT`

2. **API Key** — Your API key (input is hidden for security)

Credentials are saved to `~/.litellm-chat-config` with `600` permissions (only you can read it).

### Environment Variables

You can also set these manually if needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port for the UI server |
| `LITELLM_BASE_URL` | _(prompted)_ | Base URL of your API |
| `LITELLM_API_KEY` | _(prompted)_ | API key for authentication |

---

## 🔧 How It Works

```
Browser  →  http://localhost:3000/api/v1/chat/completions
              ↓ (Node proxy)
            YOUR_API_URL/v1/chat/completions
```

The frontend (`public/`) is a single static page that uses the OpenAI-compatible chat-completions API with `stream: true`. Conversation history is kept in `localStorage`.

---

## 🛠️ Troubleshooting

### Reset API Credentials

```bash
rm ~/.litellm-chat-config
```
Next launch will prompt for new credentials.

### Reset Project Path

```bash
rm ~/.node-server-config
```
Next launch will prompt for the project directory.

### Server Won't Start

Check if another process is using port 3000:
```bash
lsof -i :3000
```

### Update to Latest Version

The app auto-updates on launch, but you can force an update:
```bash
cd ~/LiteLLM-Chat
git pull origin master
```

---

## 📁 Files

```
server.js          # Node static server + /api/* reverse proxy
start-server.sh    # Launch script with auto-update & credential management
install.sh         # One-click installer for macOS
public/index.html  # Shell layout (sidebar + chat area)
public/styles.css  # Dark, ChatGPT-style theme
public/app.js      # Chat logic, streaming, conversation state
```

---

## 📋 Requirements

- **macOS** (installer is macOS-only; manual install works on Linux)
- **Node.js 18+** (installed automatically by the installer)
- An OpenAI-compatible API endpoint

---

## 📄 License

MIT
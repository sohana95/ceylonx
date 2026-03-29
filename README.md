# CEYLON X 🚀
### 2026 Autonomous Super-Intelligence AI Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/ceylonx.svg)](https://www.npmjs.com/package/ceylonx)

**Ceylon X** is a next-generation autonomous AI agent designed for the 2026 era. It transforms your terminal into a powerful, multi-provider reasoning hub with full system access, background execution, and computer-use capabilities.

---

## 🌟 Super-Intelligence Features (v1.4.0)

### 1. 🤖 Universal Multi-Provider Engine (19+ Providers)
Seamlessly switch between the world's most powerful AI models:
- **Anthropic (Claude 3.5 Sonnet)**, **Google Gemini**, **OpenAI (GPT-4o)**
- **Groq**, **OpenRouter**, **Ollama (Local/Remote)**
- **GitHub Models**, **SambaNova**, **Hyperbolic**, **Cerebras**
- **GLHF**, **DeepSeek**, **Mistral**, **Cohere**
- **Perplexity**, **Together AI**, **xAI (Grok)**, **Fireworks AI**, and **HuggingFace**

### 2. 🛡️ Permission Control (Interactive vs. Auto Mode)
- **Interactive Mode (Default):** Absolute safety. Ceylon X asks for your permission before executing any terminal command or modifying files.
- **Auto Mode (`/auto`):** Full autonomy. The agent executes tasks end-to-end without interruptions. *Perfect for verified environments.*

### 3. 🛠️ Full Autonomous Tool Suite
Standardized function calling across all providers:
- 📖 **readFile**: Intelligent file context ingestion.
- ✍️ **writeFile**: Autonomous code generation and file updates.
- 💻 **runCommand**: Direct terminal/bash execution.
- 🔍 **searchCodebase**: Deep recursive search for patterns (grep/find).
- 🌐 **fetchWebsite**: Real-time web scraping and content extraction.

### 4. 🚀 2026 Agentic Features
- 🏗️ **Background Tasks (`&` prefix)**: Spawn agents for long-running tasks (e.g., `& run system audit`) while you keep chatting.
- 📡 **Remote Dispatch (`/dispatch`)**: Turns Ceylon X into a local API hub (Port 3000) allowed you to send tasks from external applications.
- 🖥️ **Computer Use**: Vision-grounded automation including `takeScreenshot`, `moveMouse`, and `typeText`.

---

## ⚡ Quick Start

1. **Install Ceylon X**:
   ```bash
   npm install -g ceylonx
   ```

2. **Launch Agent**:
   ```bash
   ceylonx
   ```

3. **Configure Your Engine**:
   Run the command below to choose your provider and model:
   ```bash
   /config
   ```

4. **Task Examples**:
   - `build a react contact form component`
   - `& audit my directory for security vulnerabilities`
   - `/auto` followed by `fix the bugs in index.js`

---

## 🛠️ Available Commands

| Command | Description |
| :--- | :--- |
| `/config` | Switch AI Provider, Base URL, API Key, and Model. |
| `/auto` | Toggle between **Interactive** (Safe) and **Auto** (Mission) modes. |
| `/dispatch` | Start the local Express hub on Port 3000 for remote tasks. |
| `& <task>` | Execute a task asynchronously in the background. |
| `/exit` | Gracefully shutdown the agent session. |

---

## 🔐 Security (Secure Vault)
All your API keys are encrypted at the machine level using **AES-256-CBC** with a hardware-based salt. They never leave your local environment.

---

## ❤️ Credits
Engineered for the future by **Dev Sohan d Perera**.

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

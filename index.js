#!/usr/bin/env node

/**
 * Ceylon X - 2026 Autonomous Super-Intelligence CLI Agent
 * Universal Multi-Provider Engine, Computer Use, and Advanced Agentic Features.
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { select, input, confirm, password } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import clear from 'clear';
import figlet from 'figlet';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { exec, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
import os from 'os';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cron from 'node-cron';
import express from 'express';
import bodyParser from 'body-parser';
import screenshot from 'screenshot-desktop';
import { mouse, keyboard, screen, Button, Key, Point } from '@nut-tree-fork/nut-js';

// Load environmental variables
dotenv.config();

// --- CONFIGURATION STORE ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');

// --- SECURE VAULT ---
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const SECRET_SALT = os.hostname() + 'CEYLONX_SECURE_VAULT_2026';
const SECRET_KEY = crypto.scryptSync(SECRET_SALT, 'salt', 32);
const IV = crypto.scryptSync(SECRET_SALT, 'iv', 16);

function encrypt(text) {
    if (!text) return null;
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, SECRET_KEY, IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(text) {
    if (!text) return null;
    try {
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, SECRET_KEY, IV);
        let decrypted = decipher.update(text, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return null;
    }
}

// --- PROVIDER METADATA (19 Providers) ---
const PROVIDER_METADATA = {
    'Anthropic': { type: 'anthropic' },
    'Google Gemini': { type: 'gemini' },
    'OpenAI': { type: 'openai', baseUrl: 'https://api.openai.com/v1' },
    'Groq': { type: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
    'OpenRouter': { type: 'openai', baseUrl: 'https://openrouter.ai/api/v1' },
    'Ollama (Local/Remote)': { type: 'openai' }, // Dynamic URL
    'GitHub Models': { type: 'openai', baseUrl: 'https://models.inference.ai.azure.com' },
    'SambaNova': { type: 'openai', baseUrl: 'https://api.sambanova.ai/v1' },
    'Hyperbolic': { type: 'openai', baseUrl: 'https://api.hyperbolic.xyz/v1' },
    'Cerebras': { type: 'openai', baseUrl: 'https://api.cerebras.ai/v1' },
    'GLHF': { type: 'openai', baseUrl: 'https://glhf.chat/api/openai/v1' },
    'DeepSeek': { type: 'openai', baseUrl: 'https://api.deepseek.com' },
    'Mistral': { type: 'openai', baseUrl: 'https://api.mistral.ai/v1' },
    'Cohere': { type: 'openai', baseUrl: 'https://api.cohere.com/v2' },
    'Perplexity': { type: 'openai', baseUrl: 'https://api.perplexity.ai' },
    'Together AI': { type: 'openai', baseUrl: 'https://api.together.xyz/v1' },
    'xAI (Grok)': { type: 'openai', baseUrl: 'https://api.x.ai/v1' },
    'Fireworks AI': { type: 'openai', baseUrl: 'https://api.fireworks.ai/inference/v1' },
    'HuggingFace': { type: 'openai', baseUrl: 'https://router.huggingface.co/hf-inference/v1' }
};

const PROVIDERS = Object.keys(PROVIDER_METADATA);

// --- STATE ---
let autoMode = false;

// --- TOOLS ---
const TOOLS = [
    { name: 'readFile', description: 'Read content of a local file.', parameters: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } },
    { name: 'writeFile', description: 'Create or update a local file.', parameters: { type: 'object', properties: { filePath: { type: 'string' }, content: { type: 'string' } }, required: ['filePath', 'content'] } },
    { name: 'runCommand', description: 'Execute a terminal/bash command.', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
    { name: 'searchCodebase', description: 'Run grep/find across the directory to search for patterns.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'fetchWebsite', description: 'Scrape URL content from the internet.', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'takeScreenshot', description: 'Take a screenshot of the computer screen (dummy functional).', parameters: { type: 'object', properties: {} } },
    { name: 'moveMouse', description: 'Move mouse to X, Y coordinates (dummy functional).', parameters: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] } },
    { name: 'typeText', description: 'Type text into the active window (dummy functional).', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }
];

const OPENAI_TOOLS = TOOLS.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
const ANTHROPIC_TOOLS = TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
const GEMINI_TOOLS = { functionDeclarations: TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) };

const TOOL_HANDLERS = {
    readFile: async ({ filePath }) => {
        try {
            const absolutePath = path.resolve(process.cwd(), filePath);
            return await readFile(absolutePath, 'utf8');
        } catch (e) { return `Error reading file: ${e.message}`; }
    },
    writeFile: async ({ filePath, content }) => {
        if (!autoMode) {
            console.log(chalk.yellow(`\n🛡️   Ceylon X wants to write to file: ${filePath}`));
            const ok = await confirm({ message: `Allow modification?`, default: true });
            if (!ok) return 'Permission denied by user.';
        }
        try {
            const absolutePath = path.resolve(process.cwd(), filePath);
            await writeFile(absolutePath, content, 'utf8');
            return `Successfully written to ${filePath}`;
        } catch (e) { return `Error writing file: ${e.message}`; }
    },
    runCommand: async ({ command }) => {
        if (!autoMode) {
            console.log(chalk.yellow(`\n🛡️   Ceylon X wants to run command: ${command}`));
            const ok = await confirm({ message: `Allow execution?`, default: true });
            if (!ok) return 'Permission denied by user.';
        }
        try {
            const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' }) || 'Command executed successfully (no output).';
            return output;
        } catch (e) { return `Error: ${e.stderr || e.message}`; }
    },
    searchCodebase: async ({ query }) => {
        try {
            // Using a simple recursive search if grep isn't available, but here we'll try exec grep
            const isWin = process.platform === 'win32';
            const cmd = isWin ? `findstr /s /i /c:"${query}" *` : `grep -rnE "${query}" . --exclude-dir=node_modules`;
            const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }) || 'No matches found.';
            return output;
        } catch (e) { return `No matches or error: ${e.message}`; }
    },
    fetchWebsite: async ({ url }) => {
        try {
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(data);
            $('script, style').remove();
            return $('body').text().replace(/\s+/g, ' ').slice(0, 5000);
        } catch (e) { return `Error fetching website: ${e.message}`; }
    },
    takeScreenshot: async () => {
        try {
            const filename = `screenshot_${Date.now()}.png`;
            await screenshot({ filename });
            return `Screenshot captured and saved to ${filename}`;
        } catch (e) { return `Screenshot failed: ${e.message}`; }
    },
    moveMouse: async ({ x, y }) => {
        try {
            await mouse.setPosition(new Point(x, y));
            return `Mouse moved to ${x}, ${y}`;
        } catch (e) { return `Mouse movement failed: ${e.message}`; }
    },
    typeText: async ({ text }) => {
        try {
            await keyboard.type(text);
            return `Typed: "${text}"`;
        } catch (e) { return `Typing failed: ${e.message}`; }
    }
};

// --- CLIENT FACTORY ---
function createAIClient(config) {
    const meta = PROVIDER_METADATA[config.provider];
    if (meta.type === 'openai') {
        const url = config.provider === 'Ollama (Local/Remote)' ? config.baseUrl : meta.baseUrl;
        return new OpenAI({ apiKey: config.apiKey || 'ollama', baseURL: url, dangerouslyAllowBrowser: true });
    } else if (meta.type === 'anthropic') {
        return new Anthropic({ apiKey: config.apiKey });
    } else if (meta.type === 'gemini') {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        return genAI.getGenerativeModel({ model: config.modelId, tools: [GEMINI_TOOLS] });
    }
}

// --- PERSISTENCE ---
async function loadConfig() { return existsSync(CONFIG_PATH) ? JSON.parse(await readFile(CONFIG_PATH, 'utf8')) : null; }
async function saveConfig(c) { await writeFile(CONFIG_PATH, JSON.stringify(c, null, 2)); }

// --- UI COMPONENTS ---
function renderHeader() {
    clear();
    const grad = gradient(['#FF00CC', '#3333FF', '#00CCFF']);
    console.log(grad(figlet.textSync('CEYLON X', { font: 'Slant' })));
    console.log(chalk.white.italic('        The 2026 Autonomous Super-Intelligence Agent\n'));
}

function showWelcome(config) {
    renderHeader();
    const modeStr = autoMode ? chalk.red.bold('AUTO MISSION MODE') : chalk.green.bold('INTERACTIVE MODE');
    const status = [
        chalk.cyan('Provider: ') + chalk.white(config.provider),
        chalk.cyan('Model:    ') + chalk.white(config.modelId),
        chalk.cyan('Mode:     ') + modeStr,
        '',
        chalk.gray('Commands:'),
        chalk.white(' /config ') + chalk.dim('Update settings'),
        chalk.white(' /auto   ') + chalk.dim('Toggle Auto Mode'),
        chalk.white(' /dispatch ') + chalk.dim('Start Remote Hub'),
        chalk.white(' & <task> ') + chalk.dim('Background execution'),
        chalk.white(' /exit   ') + chalk.dim('Shutdown Agent')
    ].join('\n');
    console.log(boxen(status, { padding: 1, borderStyle: 'round', borderColor: 'magenta' }));
}

// --- CORE AGENT ENGINE ---
async function runAgent(userInput, config, isBackground = false) {
    const ai = createAIClient(config);
    const meta = PROVIDER_METADATA[config.provider];
    const systemPrompt = `You are Ceylon X, an Autonomous AI Developer and System Engineer.
Current Directory: ${process.cwd()}
You have full access to the local machine and internet. 
Use tools proactively to solve tasks. If the user says 'hi', just respond politely but acknowledge you are ready to use your tools.
Set tool_choice to 'auto' for best performance.`;

    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }];
    let iterating = true;

    while (iterating) {
        const spinner = !isBackground ? ora(chalk.blue('Ceylon X is thinking...')).start() : null;
        try {
            if (meta.type === 'openai') {
                const response = await ai.chat.completions.create({
                    model: config.modelId,
                    messages: messages.filter(m => m.role !== 'system' || config.provider === 'OpenAI'), // Some providers don't like system role in messages array
                    ...(config.provider === 'OpenAI' ? { model: config.modelId } : {}),
                    tools: OPENAI_TOOLS,
                    tool_choice: 'auto'
                });

                const assistantMessage = response.choices[0].message;
                messages.push(assistantMessage);
                if (spinner) spinner.stop();

                if (assistantMessage.tool_calls) {
                    for (const toolCall of assistantMessage.tool_calls) {
                        const name = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);
                        if (!isBackground) console.log(chalk.cyan(`[Executing] ${name}...`));
                        const result = await TOOL_HANDLERS[name](args);
                        messages.push({ role: 'tool', tool_call_id: toolCall.id, name, content: String(result) });
                    }
                } else {
                    if (!isBackground) {
                        console.log(chalk.bold.magenta('\nCeylon X: ') + chalk.white(assistantMessage.content || '(Done)'));
                    }
                    iterating = false;
                }
            } else if (meta.type === 'anthropic') {
                const response = await ai.messages.create({
                    model: config.modelId,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: messages.filter(m => m.role !== 'system').map(m => {
                        if (m.role === 'tool') return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }] };
                        if (m.tool_calls) return { role: 'assistant', content: m.tool_calls.map(tc => ({ type: 'tool_use', id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) })) };
                        return m;
                    }),
                    tools: ANTHROPIC_TOOLS
                });

                if (spinner) spinner.stop();
                
                if (response.stop_reason === 'tool_use') {
                    const toolUses = response.content.filter(c => c.type === 'tool_use');
                    messages.push({ role: 'assistant', tool_calls: toolUses.map(tu => ({ id: tu.id, function: { name: tu.name, arguments: JSON.stringify(tu.input) } })) });
                    for (const tu of toolUses) {
                        if (!isBackground) console.log(chalk.cyan(`[Executing] ${tu.name}...`));
                        const result = await TOOL_HANDLERS[tu.name](tu.input);
                        messages.push({ role: 'tool', tool_call_id: tu.id, name: tu.name, content: String(result) });
                    }
                } else {
                    const text = response.content[0].text;
                    if (!isBackground) console.log(chalk.bold.magenta('\nCeylon X: ') + chalk.white(text));
                    iterating = false;
                }
            } else if (meta.type === 'gemini') {
                const chat = ai.startChat({ history: [] }); // Simple loop for brevity
                const result = await ai.generateContent({
                    contents: messages.filter(m => m.role !== 'system').map(m => {
                        if (m.role === 'tool') return { role: 'function', parts: [{ functionResponse: { name: m.name, response: { content: m.content } } }] };
                        if (m.tool_calls) return { role: 'model', parts: m.tool_calls.map(tc => ({ functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) } })) };
                        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content || ' ' }] };
                    }),
                    systemInstruction: systemPrompt
                });

                if (spinner) spinner.stop();
                const calls = result.response.functionCalls();
                if (calls) {
                    const mappedCalls = calls.map((c, i) => ({ id: `gemini_${Date.now()}_${i}`, function: { name: c.name, arguments: JSON.stringify(c.args) } }));
                    messages.push({ role: 'assistant', tool_calls: mappedCalls });
                    for (const tc of mappedCalls) {
                        if (!isBackground) console.log(chalk.cyan(`[Executing] ${tc.function.name}...`));
                        const res = await TOOL_HANDLERS[tc.function.name](JSON.parse(tc.function.arguments));
                        messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: String(res) });
                    }
                } else {
                    const text = result.response.text();
                    if (!isBackground) console.log(chalk.bold.magenta('\nCeylon X: ') + chalk.white(text));
                    iterating = false;
                }
            }
        } catch (e) {
            if (spinner) spinner.fail(chalk.red(`Error: ${e.message}`));
            iterating = false;
        }
    }
}

// --- SPECIAL COMMANDS ---
async function configure() {
    renderHeader();
    console.log(gradient(['#FF00CC', '#3333FF'])(figlet.textSync('SETUP')));
    const configData = await loadConfig();
    const vault = configData?.vault || {};

    const provider = await select({
        message: 'Select AI Provider (Universal Engine):',
        choices: PROVIDERS.map(p => ({ name: p, value: p })),
        pageSize: 15
    });

    const meta = PROVIDER_METADATA[provider];
    let customBase = meta.baseUrl;
    let apiKeyPrompt = `Enter ${provider} API Key:`;

    if (provider === 'Ollama (Local/Remote)') {
        customBase = await input({ message: 'Enter Ollama Base URL:', default: 'http://localhost:11434/v1' });
        apiKeyPrompt = 'Enter API Key (Optional for Ollama):';
    }

    const apiKey = await password({ message: apiKeyPrompt, mask: '*' });
    const modelId = await input({ message: 'Enter Model ID (e.g., claude-3-5-sonnet, gpt-4o):', default: provider === 'Anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o' });

    if (apiKey) vault[provider] = encrypt(apiKey);
    const finalKey = apiKey || (vault[provider] ? decrypt(vault[provider]) : '');

    const newConfig = { provider, modelId, apiKey: finalKey, baseUrl: customBase, vault };
    await saveConfig(newConfig);
    return newConfig;
}

function startDispatch(config) {
    const app = express();
    app.use(bodyParser.json());
    app.post('/dispatch-task', async (req, res) => {
        const { task } = req.body;
        console.log(chalk.blue(`\n[Dispatch] Remote Task Received: ${task}`));
        res.json({ status: 'Processing' });
        await runAgent(task, config, true);
        console.log(chalk.blue(`[Dispatch] Task Complete.`));
    });
    app.listen(3000, () => console.log(chalk.green('\n📡 Remote Dispatch Hub active on port 3000.')));
}

// --- MAIN LOOP ---
(async () => {
    let config = await loadConfig();
    if (!config) config = await configure();
    showWelcome(config);

    while (true) {
        const userInput = await input({
            message: gradient(['#FF00CC', '#3333FF'])('❯'),
            prefix: ''
        });

        if (!userInput) continue;
        if (userInput === '/exit') { console.log(chalk.yellow('Ceylon X shutting down...')); break; }
        
        if (userInput === '/config') {
            config = await configure();
            showWelcome(config);
            continue;
        }

        if (userInput === '/auto') {
            autoMode = !autoMode;
            console.log(boxen(autoMode ? chalk.red.bold('WARNING: AUTO MODE ENABLED. Ceylon X will execute all commands without asking.') : chalk.green.bold('Interactive Mode Enabled.'), { padding: 1, borderColor: autoMode ? 'red' : 'green' }));
            continue;
        }

        if (userInput === '/dispatch') {
            startDispatch(config);
            continue;
        }

        if (userInput.startsWith('&')) {
            const task = userInput.slice(1).trim();
            console.log(chalk.dim(`[Background] Spawning agent for: ${task}`));
            runAgent(task, config, true).then(() => {
                console.log(chalk.magenta(`\n[Background Agent] Task Finished: ${task}`));
            });
            continue;
        }

        await runAgent(userInput, config);
    }
})();

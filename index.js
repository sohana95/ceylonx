#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import clear from 'clear';
import figlet from 'figlet';
import boxen from 'boxen';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import google from 'googlethis';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import * as cheerio from 'cheerio';
import pptxgen from 'pptxgenjs';
import axios from 'axios';
import stripAnsi from 'strip-ansi';
import * as googleTTS from 'google-tts-api';
import ExcelJS from 'exceljs';

// SDKs
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environmental variables
dotenv.config();

// Config path
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Constants
const PROVIDERS = {
  GEMINI: 'Google Gemini (via @google/genai)',
  ANTHROPIC: 'Anthropic (via @anthropic-ai/sdk)',
  OPENAI: 'OpenAI (via openai)',
  GROQ: 'Groq',
  OPENROUTER: 'OpenRouter',
  NVIDIA: 'NVIDIA NIM',
  GITHUB: 'GitHub Models',
  CEREBRAS: 'Cerebras AI',
  MISTRAL: 'Mistral AI',
  TAALAS: 'Taalas',
  OLLAMA: 'Ollama (Local/Cloud)',
  CLOUDFLARE: 'Cloudflare Workers AI',
  HUGGINGFACE: 'Hugging Face'
};

const BASE_URLS = {
  [PROVIDERS.GROQ]: 'https://api.groq.com/openai/v1',
  [PROVIDERS.OPENROUTER]: 'https://openrouter.ai/api/v1',
  [PROVIDERS.NVIDIA]: 'https://integrate.api.nvidia.com/v1',
  [PROVIDERS.GITHUB]: 'https://models.inference.ai.azure.com',
  [PROVIDERS.CEREBRAS]: 'https://api.cerebras.ai/v1',
  [PROVIDERS.MISTRAL]: 'https://api.mistral.ai/v1',
  [PROVIDERS.TAALAS]: 'https://api.taalas.com/v1',
  [PROVIDERS.OLLAMA]: 'http://localhost:11434/v1',
  [PROVIDERS.HUGGINGFACE]: 'https://router.huggingface.co/hf-inference/v1',
};

const MODEL_SUGGESTIONS = {
  [PROVIDERS.GEMINI]: ['gemini-2.0-flash', 'gemini-1.5-flash'],
  [PROVIDERS.ANTHROPIC]: ['claude-3-5-sonnet-latest'],
  [PROVIDERS.OPENAI]: ['gpt-4o-mini', 'gpt-4o'],
  [PROVIDERS.GROQ]: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  [PROVIDERS.OPENROUTER]: ['openrouter/free'],
  [PROVIDERS.NVIDIA]: ['meta/llama-3.1-405b-instruct'],
  [PROVIDERS.GITHUB]: ['gpt-4o'],
  [PROVIDERS.CEREBRAS]: ['llama3.1-8b'],
  [PROVIDERS.MISTRAL]: ['mistral-large-latest'],
  [PROVIDERS.TAALAS]: ['llama3-70b'],
  [PROVIDERS.OLLAMA]: ['llama3'],
  [PROVIDERS.CLOUDFLARE]: ['@cf/meta/llama-3-8b-instruct'],
  [PROVIDERS.HUGGINGFACE]: ['meta-llama/Llama-3.3-70B-Instruct']
};

// Load existing config
async function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      const data = await readFile(CONFIG_PATH, 'utf8');
      const config = JSON.parse(data);
      // Ensure the config actually has valid data
      if (config && config.provider && config.modelId) {
        return config;
      }
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Save config
async function saveConfig(config) {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Enhanced error handler for API
 */
function handleApiError(error, spinner) {
  let errorMessage = error.message || 'An unexpected error occurred.';
  
  // Handle 401 Authentication Error Gracefully
  if (errorMessage.includes('401')) {
    const authFailedMsg = chalk.red.bold('\n[Authentication Failed] ') + chalk.white('Your API Key is invalid or expired. Please type ') + chalk.cyan('/config') + chalk.white(' to enter a new API key.\n');
    if (spinner) {
      spinner.fail(chalk.red('Authentication Failed'));
      console.log(authFailedMsg);
    } else {
      console.error(authFailedMsg);
    }
    return;
  }

  // Handle Network/Offline Error
  if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
    const offlineMsg = chalk.yellow.bold('\n[Network Error] ') + chalk.white('You are offline or the API server is unreachable. Please check your internet connection.\n');
    if (spinner) {
      spinner.fail(chalk.yellow('Network Unreachable'));
      console.log(offlineMsg);
    } else {
      console.error(offlineMsg);
    }
    return;
  }

  if (spinner) {
    spinner.fail(chalk.red('Error: ' + errorMessage));
  } else {
    console.error(chalk.red('\nError: ' + errorMessage + '\n'));
  }
}

/**
 * Security Check: Trust Workspace
 */
async function checkWorkspaceSecurity() {
  clear();
  const { trust } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'trust',
      message: chalk.cyan('👋 Welcome! Just a quick check—do you allow Ceylon X to create and edit files in this folder?'),
      default: true
    }
  ]);

  if (!trust) {
    console.log(chalk.white('\nUnderstood. Ceylon X will not operate without your permission. Have a great day!\n'));
    process.exit(0);
  }
}

/**
 * Tool Definitions
 */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'readFile',
      description: 'Reads the content of a file from the local file system.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The relative or absolute path to the file.' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'writeFile',
      description: 'Creates or updates a file on the local file system.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The path where the file should be saved.' },
          content: { type: 'string', description: 'The text content to be written inside the file.' }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'executeCommand',
      description: 'Executes a command in the terminal/shell.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The terminal command to run (e.g., npm install).' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchInternet',
      description: 'Search the web for real-time data, latest documentation, or news.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to look up.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listDirectory',
      description: 'Lists the contents (files/folders) of a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The directory path to list.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteFile',
      description: 'Deletes a file from the local file system.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The path to the file to delete.' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getProjectTree',
      description: 'Returns a light, recursive directory tree (ignores big folders like node_modules, dist, etc.).',
      parameters: {
        type: 'object',
        properties: {
          maxDepth: { type: 'number', description: 'Maximum depth to scan (default 3).' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchFiles',
      description: 'Searches for a string or regex across all text files in the project (ignores node_modules and .git).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The string or regular expression to search for.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readImage',
      description: 'Reads an image file and converts it to base64 for vision analysis.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The path to the image file.' }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fetchWebsite',
      description: 'Scrapes and extracts clean, readable text from a URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The web address to pull content from.' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'gitCommit',
      description: 'Stages all changes and commits them with a specific message.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The commit message.' }
        },
        required: ['message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generatePPT',
      description: 'Generates a professional PowerPoint presentation file.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Destination filename (e.g., deck.pptx).' },
          title: { type: 'string', description: 'Main title of the slide deck.' },
          slides: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                heading: { type: 'string' },
                content: { type: 'string' }
              }
            }
          }
        },
        required: ['filePath', 'title', 'slides']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generateImage',
      description: 'Generates a stunning AI image using Pollinations.ai.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Highly detailed, cinematic image prompt.' },
          filename: { type: 'string', description: 'Desired output filename (e.g., artwork.png).' }
        },
        required: ['prompt', 'filename']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generateExcel',
      description: 'Generates a professionally styled Excel report of data.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Destination filename (e.g., stats.xlsx).' },
          sheetName: { type: 'string', description: 'Name of the worksheet.' },
          data: {
            type: 'array',
            items: { type: 'object', description: 'Row data as objects.' }
          }
        },
        required: ['filename', 'sheetName', 'data']
      }
    }
  }
];

const TOOL_HANDLERS = {
  readFile: async (args) => {
    try { return readFileSync(args.filePath, 'utf8'); }
    catch (e) { return `Error: ${e.message}`; }
  },
  writeFile: async (args) => {
    try {
      writeFileSync(args.filePath, args.content, 'utf8');
      return `File ${args.filePath} written successfully.`;
    } catch (e) { return `Error: ${e.message}`; }
  },
  executeCommand: async (args) => {
    // Audit for dangerous commands
    const dangerousCommands = ['rm -rf', 'sudo', 'mv ', 'chmod', 'chown', 'wget', 'curl', 'shutdown', 'reboot'];
    const hasDanger = dangerousCommands.some(cmd => args.command.toLowerCase().includes(cmd));
    const multipleCommands = args.command.includes('&&') || args.command.includes(';') || args.command.includes('||');

    console.log('\n' + chalk.yellow.bold('⚠️ COMMAND AUTHORIZATION' + (hasDanger ? ' (HIGH RISK)' : '') + ' REQUIRED'));
    if (hasDanger) console.log(chalk.red.bold('! Warning: This command contains potentially destructive operations.'));
    if (multipleCommands) console.log(chalk.red.bold('! Warning: This command string contains multiple piped or sequential commands.'));

    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: `Ceylon X wants to run: ${chalk.cyan(args.command)}\nAllow execution?`,
      default: false
    }]);

    if (!confirmed) {
      return 'User denied permission to run this command. Explain what to do next.';
    }

    try {
      const output = execSync(args.command, { encoding: 'utf8', stdio: 'pipe' });
      return output || 'Command executed successfully (no output).';
    } catch (e) { return `Error: ${e.stderr || e.message}`; }
  },
  searchInternet: async (args) => {
    try {
      const response = await google.search(args.query);
      const results = response.results.slice(0, 5).map(r => 
        `Title: ${r.title}\nDesc: ${r.description}\nURL: ${r.url}`
      ).join('\n\n');
      return results || 'No results found.';
    } catch (e) { return `Error: ${e.message}`; }
  },
  listDirectory: async (args) => {
    try {
      const items = readdirSync(args.path || './');
      return items.join('\n') || 'Directory is empty.';
    } catch (e) { return `Error: ${e.message}`; }
  },
  deleteFile: async (args) => {
    console.log('\n' + chalk.red.bold('🧨 FILE DELETION WARNING'));
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: `Ceylon X wants to delete: ${chalk.red(args.filePath)}\nAre you sure?`,
      default: false
    }]);

    if (!confirmed) {
      return 'User denied permission to delete this file.';
    }

    try {
      unlinkSync(args.filePath);
      return `File ${args.filePath} deleted successfully.`;
    } catch (e) { return `Error: ${e.message}`; }
  },
  getProjectTree: async (args) => {
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'bin', 'out', 'node_modules.zip'];
    const maxDepth = args.maxDepth || 3;

    const getTree = (dir, prefix = '', depth = 0) => {
      if (depth >= maxDepth) return '';
      let tree = '';
      try {
        const files = readdirSync(dir);
        files.forEach((file, index) => {
          if (ignoreDirs.includes(file)) return;
          const filePath = path.join(dir, file);
          const isLast = index === files.length - 1;
          tree += `${prefix}${isLast ? '└── ' : '├── '}${file}\n`;
          if (existsSync(filePath)) { // Check if filePath exists before trying to read it
            try {
              const stats = readdirSync(filePath, { withFileTypes: true }); // Use withFileTypes to check if it's a directory
              if (stats.some(stat => stat.isDirectory())) { // If it contains directories, recurse
                tree += getTree(filePath, prefix + (isLast ? '    ' : '│   '), depth + 1);
              }
            } catch (inner) {
              // Ignore errors for files that are not directories or inaccessible
            }
          }
        });
      } catch (e) {
        // Ignore errors for inaccessible directories
      }
      return tree;
    };
    return getTree(process.cwd()) || 'Project tree is empty or depth reached.';
  },
  searchFiles: async (args) => {
    const results = [];
    const searchRecursively = (dir) => {
      const files = readdirSync(dir);
      for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const filePath = path.join(dir, file);
        try {
          if (readdirSync(filePath).length > 0) {
            searchRecursively(filePath);
          } else {
            const content = readFileSync(filePath, 'utf8');
            if (content.includes(args.query)) {
              results.push(filePath);
            }
          }
        } catch (e) {
          try {
            const content = readFileSync(filePath, 'utf8');
            if (content.includes(args.query)) {
              results.push(filePath);
            }
          } catch (inner) {}
        }
      }
    };
    try {
      searchRecursively(process.cwd());
      return results.length > 0 ? `Found "${args.query}" in:\n${results.join('\n')}` : `No matches found for "${args.query}".`;
    } catch (e) { return `Error: ${e.message}`; }
  },
  readImage: async (args) => {
    try {
      const buffer = await sharp(args.filePath).toBuffer();
      return buffer.toString('base64');
    } catch (e) { return `Error reading image: ${e.message}`; }
  },
  fetchWebsite: async (args) => {
    try {
      const { data } = await axios.get(args.url, { timeout: 5000 });
      const $ = cheerio.load(data);
      $('script, style, ads, iframe').remove();
      return $('p, h1, h2, h3, h4').text().slice(0, 5000);
    } catch (e) { return `Error scraping website: ${e.message}`; }
  },
  gitCommit: async (args) => {
    console.log('\n' + chalk.blue.bold('🛠️ GIT COMMIT AUTHORIZATION REQUIRED'));
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: `Ceylon X wants to commit with message: "${chalk.cyan(args.message)}"\nAllow commit?`,
      default: true
    }]);
    if (!confirmed) return 'User denied permission to commit changes.';
    try {
      execSync('git add .', { stdio: 'inherit' });
      execSync(`git commit -m "${args.message}"`, { stdio: 'inherit' });
      return 'Changes staged and committed successfully via Git.';
    } catch (e) { return `Error committing: ${e.message}`; }
  },
  generatePPT: async (args) => {
    try {
      const pres = new pptxgen();
      pres.title = args.title;
      args.slides.forEach(s => {
        const slide = pres.addSlide();
        slide.addText(s.heading, { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: '363636' });
        slide.addText(s.content, { x: 0.5, y: 1.5, fontSize: 18, color: '666666' });
      });
      await pres.writeFile({ fileName: args.filePath });
      return `Professional PowerPoint generated and saved to ${args.filePath}`;
    } catch (e) { return `Error generating PPT: ${e.message}`; }
  },
  generateImage: async (args) => {
    const seed = Math.floor(Math.random() * 1000000);
    const primaryUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(args.prompt)}?nologo=true&private=true&enhance=false&seed=${seed}&width=1024&height=1024`;
    const backupUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(args.prompt)}?nologo=true`;
    
    try {
      const response = await axios.get(primaryUrl, { responseType: 'arraybuffer', timeout: 15000 });
      writeFileSync(args.filename, response.data);
      return `AI Image successfully generated and saved to ${args.filename}`;
    } catch (e) { 
      try {
        const backupResp = await axios.get(backupUrl, { responseType: 'arraybuffer', timeout: 15000 });
        writeFileSync(args.filename, backupResp.data);
        return `AI Image generated using fallback model and saved to ${args.filename}`;
      } catch (inner) {
        return `⚠️ Failed to generate image. Please try again.`; 
      }
    }
  },
  generateExcel: async (args) => {
    try {
      const sanitizedFilename = args.filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + (args.filename.endsWith('.xlsx') ? '' : '.xlsx');
      const fullPath = path.join(process.cwd(), sanitizedFilename);
      
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(args.sheetName || 'Data Report');
      
      let reportData = args.data;
      
      // Fallback Data if empty or failed
      if (!reportData || reportData.length === 0) {
        reportData = [
          { ID: 1, Name: 'Rank 1', Value: 'Sample A', Note: 'Mock Data' },
          { ID: 2, Name: 'Rank 2', Value: 'Sample B', Note: 'Mock Data' }
        ];
      }
      
      const headers = Object.keys(reportData[0]);
      sheet.addRow(headers);
      
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' }
      };
      
      reportData.forEach(row => {
        sheet.addRow(Object.values(row));
      });
      
      sheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const val = cell.value ? cell.value.toString() : '';
          maxLen = Math.max(maxLen, val.length);
        });
        column.width = Math.min(Math.max(maxLen + 2, 12), 50);
      });
      
      await workbook.xlsx.writeFile(fullPath);
      return `Professional Excel report saved successfully to: ${sanitizedFilename}`;
    } catch (e) { 
      return `⚠️ Failed to generate Excel report. Please try again.`; 
    }
  }
};

const SYSTEM_PROMPT = `You are Ceylon X, the world's most advanced AI Agent and Multimedia Creator. You are a 10x Developer, a Crypto Trader, a Digital Marketing/SEO Expert, and a Business Strategist. Use your vast array of tools (generateExcel, generateImage, generatePPT, fetchWebsite, searchInternet, readImage, getProjectTree, searchFiles, etc.) to execute complex real-world workflows autonomously. You can generate professional Excel reports using the generateExcel tool, complete with styled headers and auto-formatted columns. If a user asks for an image, use generateImage to create stunning visuals directly to their disk. If a user drops an image, use readImage to analyze it. You produce professional, battle-tested outputs for both developer and business contexts.`;

/**
 * Configure the CLI
 */
async function configure() {
  console.log(chalk.cyan.bold('\n--- Ceylon X Setup ---\n'));

  const setup = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'provider',
      message: 'Select your AI Provider:',
      choices: Object.values(PROVIDERS),
      loop: true,
      pageSize: 12
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your API Key:',
      mask: '*',
      when: (a) => a.provider !== PROVIDERS.OLLAMA,
      validate: (input) => input.trim().length > 0 || 'API Key is required for this provider.',
    }
  ]);

  const modelChoice = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'selectedModel',
      message: 'Select a Model (or choose Custom):',
      choices: (a) => [...(MODEL_SUGGESTIONS[setup.provider] || []), '>> Type Custom Model <<'],
      loop: true
    },
    {
      type: 'input',
      name: 'customModel',
      message: 'Enter your custom Model ID:',
      when: (a) => a.selectedModel === '>> Type Custom Model <<',
      validate: (input) => input.trim().length > 0 || 'Model ID is required.',
    }
  ]);

  const answers = {
    provider: setup.provider,
    apiKey: setup.apiKey,
    modelId: modelChoice.customModel || modelChoice.selectedModel
  };

  await saveConfig(answers);
  console.log(chalk.green('\nConfiguration saved successfully!\n'));
  return answers;
}

/**
 * Clear the terminal and show the welcome screen
 */
function showWelcomeScreen(config) {
  clear();
  const width = process.stdout.columns || 80;
  
  const center = (text) => {
    const cleanText = stripAnsi(text);
    const pad = Math.max(0, Math.floor((width - cleanText.length) / 2));
    return ' '.repeat(pad) + text;
  };

  const titleLines = figlet.textSync('CEYLON X', { font: 'Slant', horizontalLayout: 'full' }).split('\n');
  titleLines.forEach(line => console.log(center(chalk.cyan(line))));
  
  console.log(center(chalk.white.italic('      2026 Latest Cli AI Agent | Dev Sohan d Perera\n')));

  const providerLabel = chalk.bold('Active Provider: ') + chalk.cyan(config.provider);
  const ethicalTip = chalk.gray('      [ Unlimited capabilities powered by AI. Please use in an ethical way. ]\n');
  const modelLabel = chalk.bold('Active Model: ')    + chalk.white(config.modelId);
  const tips = [
    '• Type ' + chalk.cyan('/exit') + ' to quit',
    '• Type ' + chalk.cyan('/config') + ' to change AI provider or model',
    '• Type ' + chalk.cyan('/update') + ' to install the latest version',
    '• Type ' + chalk.cyan('/excel <topic>') + ' to generate a data report',
    '• Type ' + chalk.cyan('/audio <text>') + ' to generate voice MP3',
    '• Type ' + chalk.cyan('/image <prompt>') + ' for AI-native visuals',
    '• Type ' + chalk.cyan('/freeimage <prompt>') + ' for unlimited free images',
    '• Type ' + chalk.cyan('/help') + ' for all commands',
    '• Just type anything to start building'
  ].join('\n');

  console.log(
    boxen(`${providerLabel}\n${ethicalTip}\n${modelLabel}\n\n${tips}`, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      title: 'Autonomous Engineering Core',
      titleAlignment: 'center',
    })
  );
}

/**
 * Main Chat Logic
 */
async function startChat(config) {
  if (!config || !config.provider || !config.modelId) {
    config = await configure();
  }

  showWelcomeScreen(config);
  console.log(chalk.gray('--- Start Safe & Secure chat ---\n'));
  
  let activeModelId = config.modelId;

  // Handle OpenRouter Auto-Free
  if (config.provider === PROVIDERS.OPENROUTER && config.modelId === 'auto-free') {
    activeModelId = 'openrouter/free';
  }

  let providerInstance;
  
  // Initialize Provider
  try {
    if (config.provider === PROVIDERS.GEMINI) {
      const genAI = new GoogleGenerativeAI(config.apiKey, { apiVersion: 'v1' });
      providerInstance = genAI.getGenerativeModel({ model: activeModelId });
    } else if (config.provider === PROVIDERS.ANTHROPIC) {
      providerInstance = new Anthropic({ apiKey: config.apiKey });
    } else {
      const options = { apiKey: config.apiKey || 'ollama' };
      if (BASE_URLS[config.provider]) options.baseURL = BASE_URLS[config.provider];
      providerInstance = new OpenAI(options);
    }
  } catch (err) {
    console.error(chalk.red('Failed to initialize provider: ' + err.message));
    return;
  }

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  while (true) {
    const { userInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'userInput',
        message: chalk.white.bold('You:'),
        validate: (input) => input.trim().length > 0 || 'Please enter a message.',
      },
    ]);

    if (userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === '/quit' || userInput.toLowerCase() === 'exit') {
      console.log(chalk.yellow('\nGoodbye from Ceylon X!\n'));
      break;
    }

    if (userInput.toLowerCase() === '/config') {
      config = await configure();
      return startChat(config);
    }

    let currentInput = userInput;

    // Handle /update interceptor
    if (userInput.toLowerCase() === '/update') {
      const updateSpinner = ora(chalk.gray('Updating Ceylon X...')).start();
      try {
        execSync('npm install -g ceylonx', { stdio: 'inherit' });
        updateSpinner.succeed(chalk.green('Ceylon X updated successfully!'));
      } catch (e) {
        updateSpinner.fail(chalk.red('Update failed: ' + e.message));
      }
      process.exit(0);
    }
    
    // Handle /help interceptor
    if (userInput.toLowerCase() === '/help') {
      const helpContent = [
        chalk.cyan.bold('Available Commands:'),
        '• ' + chalk.cyan('/config') + ' - Change AI provider or model',
        '• ' + chalk.cyan('/update') + ' - Fast-update to latest version',
        '• ' + chalk.cyan('/excel <topic>') + ' - Generate professional Excel reports',
        '• ' + chalk.cyan('/ppt <topic>') + ' - Auto-generate a PowerPoint deck',
        '• ' + chalk.cyan('/seo <url>') + ' - Get a deep SEO audit & strategy',
        '• ' + chalk.cyan('/dropship <niche>') + ' - Find trending products/marketing',
        '• ' + chalk.cyan('/tradesignal <pair>') + ' - Real-time trade signals',
        '• ' + chalk.cyan('/audio <text>') + ' - Generate high-quality voice MP3',
        '• ' + chalk.cyan('/image <prompt>') + ' - AI-native generation (uses active model)',
        '• ' + chalk.cyan('/freeimage <prompt>') + ' - Unlimited Free AI Image Model',
        '• ' + chalk.cyan('/exit') + ' - Close the agent session',
        '• ' + chalk.cyan('/help') + ' - Show this menu'
      ].join('\n');

      console.log(boxen(helpContent, { padding: 1, borderStyle: 'round', borderColor: 'yellow' }));
      continue;
    }
    
    if (userInput.toLowerCase().startsWith('/freeimage ')) {
      const prompt = userInput.slice(11).trim();
      const spinner = ora(chalk.gray('Generating AI image...')).start();
      try {
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 60000
        });
        const filename = `image_${Date.now()}.png`;
        writeFileSync(filename, Buffer.from(response.data));
        spinner.succeed(chalk.green(`Image saved as ${filename}`));
      } catch (error) {
        spinner.fail(chalk.red('Failed to generate image. Please try again.'));
      }
      continue;
    }
    // Handle /audio interceptor (Bypass AI)
    if (userInput.toLowerCase().startsWith('/audio ')) {
      const audioText = userInput.slice(7).trim();
      const audioSpinner = ora(chalk.gray('Generating Voice MP3...')).start();
      try {
        const filename = `audio_${Date.now()}.mp3`;
        const base64 = await googleTTS.getAudioBase64(audioText, {
          lang: 'en',
          slow: false,
          host: 'https://translate.google.com',
        });
        const buffer = Buffer.from(base64, 'base64');
        writeFileSync(filename, buffer);
        audioSpinner.succeed(chalk.green(`Voice MP3 successfully saved to ${filename}`));
      } catch (e) {
        audioSpinner.fail(chalk.red(`Error: ${e.message}`));
      }
      continue;
    }

    // Handle /tradesignal interceptor
    if (userInput.toLowerCase().startsWith('/tradesignal ')) {
      const pair = userInput.slice(13).trim();
      currentInput = `The user requested a trading signal for ${pair}. 
      Be extremely fast. Make ONE targeted searchInternet for live prices/sentiment. 
      Output strictly: [ BUY 🟢 / SELL 🔴 ], Entry, TP, SL, and brief analysis. 
      End with: ⚠️ Disclaimer: AI-generated from web data. NOT financial advice.`;
    }

    // Agency Commands interceptors
    if (userInput.toLowerCase().startsWith('/ppt ')) {
      const topic = userInput.slice(5).trim();
      currentInput = `The user wants a presentation about ${topic}. 
      Autonomously use searchInternet to gather facts, then use the generatePPT tool to create a highly professional 5-7 slide PowerPoint presentation.`;
    }
    
    if (userInput.toLowerCase().startsWith('/excel ')) {
      const topic = userInput.slice(7).trim();
      currentInput = `The user wants an Excel data report on: ${topic}. 
      First, use searchInternet to gather the latest factual data (e.g., statistics, rankings, lists). 
      Structure the data into a clean JSON array of objects. Then use the generateExcel tool to create a beautifully styled .xlsx file. Tell the user the report is ready.`;
    }
    if (userInput.toLowerCase().startsWith('/seo ')) {
      const url = userInput.slice(5).trim();
      currentInput = `Use fetchWebsite to scrape ${url}. Act as an Elite SEO Expert. 
      Output a detailed SEO audit, suggest 10 high-traffic keywords, and generate a strategy to get bulk high-quality backlinks. Format beautifully with chalk symbols.`;
    }
    if (userInput.toLowerCase().startsWith('/dropship ')) {
      const niche = userInput.slice(10).trim();
      currentInput = `Act as a Dropshipping & E-commerce Expert. Use searchInternet to find the top 3 trending winning products for ${niche} right now. 
      Output a complete report: Product Name, Target Audience, Facebook Ad strategy, and Supplier ideas.`;
    }
    
    if (userInput.toLowerCase().startsWith('/image ')) {
      const userPrompt = userInput.slice(7).trim();
      currentInput = `The user wants an image based on: ${userPrompt}. 
      Use your configured AI model's native image generation capabilities if you have them (like DALL-E or Imagen), 
      OR use the generateImage tool to create it via Pollinations.ai. Expanding the idea into a detailed, cinematic prompt first.`;
    }
    
    // Handle /read legacy
    if (userInput.startsWith('/read ')) {
      const filePath = userInput.slice(6).trim();
      const absolutePath = path.resolve(process.cwd(), filePath);
      if (existsSync(absolutePath)) {
        try {
          const content = readFileSync(absolutePath, 'utf8');
          currentInput = `[Local Read] Content of ${filePath}:\n\n${content}\n\nAnalyze this.`;
        } catch (e) {
          console.log(chalk.red(`\nError: ${e.message}`));
          continue;
        }
      }
    }

    messages.push({ role: 'user', content: currentInput });

    let isThinking = true;

    while (isThinking) {
      let seconds = 0;
      const mainSpinner = ora(chalk.gray('Ceylon X is thinking...')).start();
      const timer = setInterval(() => {
        seconds++;
        mainSpinner.text = chalk.gray(`Ceylon X is thinking... [${seconds}s]`);
      }, 1000);
      
      try {
        if (config.provider === PROVIDERS.GEMINI) {
          // Gemini Basic (Tool calling for Gemini 1.5/2.0 requires different structure, keeping basic for now)
          const result = await providerInstance.generateContentStream(currentInput);
          clearInterval(timer);
          mainSpinner.stop();
          process.stdout.write(chalk.green.bold('\nCeylon X: '));
          let fullText = "";
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullText += text;
            process.stdout.write(chalk.whiteBright(text));
          }
          process.stdout.write('\n\n');
          messages.push({ role: 'assistant', content: fullText });
          isThinking = false;
        } else if (config.provider === PROVIDERS.ANTHROPIC) {
          // Anthropic Basic
          clearInterval(timer);
          mainSpinner.stop();
          process.stdout.write(chalk.green.bold('\nCeylon X: '));
          const response = await providerInstance.messages.create({
            model: activeModelId,
            max_tokens: 2048,
            messages: messages.filter(m => m.role !== 'system'),
            system: SYSTEM_PROMPT
          });
          const text = response.content[0].text;
          console.log(chalk.whiteBright(text));
          messages.push({ role: 'assistant', content: text });
          isThinking = false;
        } else {
          // OpenAI / OpenRouter / Groq with TOOLS
          const response = await providerInstance.chat.completions.create({
            model: activeModelId,
            messages: messages,
            tools: TOOLS,
            tool_choice: 'auto'
          });

          clearInterval(timer);
          mainSpinner.stop();
          const message = response.choices[0].message;
          messages.push(message);

          if (message.tool_calls) {
            for (const toolCall of message.tool_calls) {
              const name = toolCall.function.name;
              const args = JSON.parse(toolCall.function.arguments);
              
              let spinnerMsg = `Ceylon X is using ${name}...`;
              if (name === 'searchInternet') spinnerMsg = `Searching the web for: ${chalk.bold(args.query)}...`;
              else if (name === 'readFile') spinnerMsg = `Reading file: ${chalk.bold(args.filePath)}...`;
              else if (name === 'writeFile') spinnerMsg = `Writing file: ${chalk.bold(args.filePath)}...`;
              else if (name === 'executeCommand') spinnerMsg = `Executing: ${chalk.bold(args.command)}...`;
              else if (name === 'getProjectTree') spinnerMsg = `Mapping project architecture...`;
              else if (name === 'searchFiles') spinnerMsg = `Searching codebase for: ${chalk.bold(args.query)}...`;
              else if (name === 'readImage') spinnerMsg = `Reading image: ${chalk.bold(args.filePath)}...`;
              else if (name === 'fetchWebsite') spinnerMsg = `Scraping website: ${chalk.bold(args.url)}...`;
              else if (name === 'gitCommit') spinnerMsg = `Committing to Git...`;
              else if (name === 'generatePPT') spinnerMsg = `Generating PowerPoint presentation...`;
              else if (name === 'generateImage') spinnerMsg = `Generating high-quality AI image...`;
              else if (name === 'generateExcel') spinnerMsg = `Generating professional Excel report...`;

              let toolSeconds = 0;
              const toolSpinner = ora(chalk.gray(`${spinnerMsg} [${toolSeconds}s]`)).start();
              const toolTimer = setInterval(() => {
                toolSeconds++;
                toolSpinner.text = chalk.gray(`${spinnerMsg} [${toolSeconds}s]`);
              }, 1000);

              const result = await TOOL_HANDLERS[name](args);
              clearInterval(toolTimer);
              if (result.startsWith('User denied')) {
                toolSpinner.fail(chalk.red(`Permission Denied`));
              } else {
                toolSpinner.succeed(chalk.green(`Executed ${name}`));
              }
              
              messages.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: name,
                content: result.toString()
              });
            }
            // Continue loop to send tool results back
          } else {
            process.stdout.write(chalk.green.bold('\nCeylon X: '));
            console.log(chalk.whiteBright(message.content + '\n'));
            isThinking = false;
          }
        }
      } catch (error) {
        handleApiError(error, mainSpinner);
        isThinking = false;
      }
    }
  }
}

const program = new Command();

program
  .name('ceylonx')
  .description('Ceylon X - 2026 Latest CLI AI Agent')
  .version('1.0.1');

program
  .command('chat')
  .description('Start a chat session')
  .action(async () => {
    const config = await loadConfig();
    await startChat(config);
  });

program
  .command('config')
  .description('Configure your AI provider')
  .action(async () => {
    await configure();
  });

// Handle default run
if (!process.argv.slice(2).length) {
  checkWorkspaceSecurity().then(() => {
    loadConfig().then(config => startChat(config));
  });
} else {
  program.parse(process.argv);
}

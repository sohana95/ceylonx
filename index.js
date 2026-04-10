#!/usr/bin/env node

/**
 * Ceylon X - 2026 Autonomous Super-Intelligence CLI Agent
 * Rebuilt with Claude Code Architecture
 */

import { input, select, password } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';
import * as dotenv from 'dotenv';
import { loadConfig, saveConfig, encrypt, decrypt } from './src/ceylonx/config.js';
import { renderHeader, showStatus, printResponse, printError } from './src/ceylonx/ui.js';
import { AgentLoop } from './src/ceylonx/agent.js';
import { checkAndUpdate } from './src/ceylonx/updater.js';
import { AIProvider, PROVIDER_REGISTRY } from './src/ceylonx/providers.js';
import gradient from 'gradient-string';
import figlet from 'figlet';
import ora from 'ora';

// Load environmental variables
dotenv.config();

// Handle CLI sub-commands before starting REPL
const args = process.argv.slice(2);
if (args[0] === 'update') {
    checkAndUpdate();
} else {
    runApp();
}

async function runApp() {
    let autoMode = false;
    let config = null;

    async function configure() {
        renderHeader();
        console.log(gradient(['#FF00CC', '#3333FF'])(figlet.textSync('SETUP')));
        
        const provider = await select({
            message: 'Select AI Provider (Universal Engine):',
            choices: Object.keys(PROVIDER_REGISTRY).map(p => ({ name: p, value: p })),
        });

        const apiKey = await password({ message: `Enter ${provider} API Key:`, mask: '*' });
        
        const modelId = await input({ 
            message: 'Enter the exact Model ID you want to use (Paste the model name here):',
        });

        const registryEntry = PROVIDER_REGISTRY[provider];
        const baseUrl = registryEntry.baseURL || '';

        const vault = config?.vault || {};
        if (apiKey) vault[provider] = encrypt(apiKey);
        
        const finalKey = apiKey || (vault[provider] ? decrypt(vault[provider]) : '');

        const newConfig = { provider, modelId, apiKey: finalKey, baseUrl, vault };

        // Verification Logic
        const spinner = ora(chalk.blue('Verifying connection...')).start();
        try {
            const testProvider = new AIProvider(newConfig);
            await testProvider.testConnection();
            spinner.succeed(chalk.green('Connection verified successfully!'));
            
            await saveConfig(newConfig);
            return newConfig;
        } catch (e) {
            spinner.fail(chalk.red(`Connection failed: ${e.message}`));
            const retry = await select({
                message: 'Connection failed. What would you like to do?',
                choices: [
                    { name: 'Retry Configuration', value: 'retry' },
                    { name: 'Save Anyway (Not Recommended)', value: 'save' },
                    { name: 'Cancel', value: 'cancel' }
                ]
            });
            if (retry === 'retry') return await configure();
            if (retry === 'save') {
                await saveConfig(newConfig);
                return newConfig;
            }
            process.exit(0);
        }
    }

    async function main() {
        config = await loadConfig();
        if (!config) {
            config = await configure();
        }

        renderHeader();
        showStatus(config, autoMode);

        let agent = new AgentLoop(config, autoMode);

        while (true) {
            try {
                const userInput = await input({
                    message: gradient(['#FF00CC', '#3333FF'])('❯'),
                    prefix: ''
                });

                if (!userInput) continue;
                
                if (userInput === '/exit') {
                    console.log(chalk.yellow('Ceylon X shutting down...'));
                    process.exit(0);
                }

                if (userInput === '/update') {
                    await checkAndUpdate();
                    continue;
                }

                if (userInput === '/config') {
                    config = await configure();
                    agent = new AgentLoop(config, autoMode);
                    showStatus(config, autoMode);
                    continue;
                }

                if (userInput === '/auto') {
                    autoMode = !autoMode;
                    agent.autoMode = autoMode;
                    agent.handlers.autoMode = autoMode;
                    console.log(boxen(autoMode ? chalk.red.bold('WARNING: AUTO MODE ENABLED. Ceylon X will execute all commands without asking.') : chalk.green.bold('Interactive Mode Enabled.'), { padding: 1, borderColor: autoMode ? 'red' : 'green' }));
                    continue;
                }

                if (userInput === '/clear') {
                    renderHeader();
                    showStatus(config, autoMode);
                    agent = new AgentLoop(config, autoMode);
                    continue;
                }

                const response = await agent.run(userInput);
                printResponse(response);
                
            } catch (e) {
                if (e.name === 'ExitPromptError') process.exit(0);
                printError(e.message);
            }
        }
    }

    main().catch(e => {
        console.error(e);
        process.exit(1);
    });
}

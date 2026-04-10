import { AIProvider } from './providers.js';
import { TOOL_DEFINITIONS, ToolHandlers } from './tools.js';
import { printThinking, printToolExecution, printError } from './ui.js';
import ora from 'ora';
import chalk from 'chalk';

export class AgentLoop {
    constructor(config, autoMode = false) {
        this.config = config;
        this.autoMode = autoMode;
        this.provider = new AIProvider(config);
        this.handlers = new ToolHandlers(autoMode);
        this.messages = [];
        this._initSystemPrompt();
    }

    _initSystemPrompt() {
        this.messages = [{
            role: 'system',
            content: `You are Ceylon X, an Autonomous AI Developer and System Engineer.
Current Directory: ${process.cwd()}
OS: ${process.platform}
You have full access to the local machine via tools. 
Use tools proactively to solve tasks. 
If native tool calling is not supported, you MUST output your tool calls in the following XML format:
<function(tool_name)>{ "arg1": "val1" }</function>
Always use this tag for tool calls if you are outputting them as text.
Be concise and efficient. If you have finished a task, clearly state it.`
        }];
    }

    async run(userInput) {
        this.messages.push({ role: 'user', content: userInput });
        let iterating = true;

        while (iterating) {
            const spinner = ora(chalk.blue('Ceylon X is thinking...')).start();
            try {
                const response = await this.provider.chat(this.messages, TOOL_DEFINITIONS);
                spinner.stop();

                let { content, tool_calls } = response;
                
                // Strip both XML and TOOLCALL tags for the user
                let displayContent = content;
                if (displayContent) {
                    displayContent = displayContent
                        .replace(/<function\(([^)]+)\)>([\s\S]*?)<\/function>/g, '')
                        .replace(/TOOLCALL>[\s\S]*?>/g, '')
                        .trim();
                }

                // Add assistant response to history
                this.messages.push({ 
                    role: 'assistant', 
                    content: content || null,
                    tool_calls: tool_calls 
                });

                if (tool_calls) {
                    for (const tc of tool_calls) {
                        const toolSpinner = ora(chalk.cyan(`Executing ${tc.name}...`)).start();
                        try {
                            const result = await this.handlers[tc.name](tc.arguments);
                            toolSpinner.succeed(chalk.green(`Executed ${tc.name}`));
                            
                            // Add tool result to history
                            this.messages.push({
                                role: 'tool',
                                tool_call_id: tc.id,
                                name: tc.name,
                                content: String(result)
                            });
                        } catch (err) {
                            toolSpinner.fail(chalk.red(`Failed ${tc.name}: ${err.message}`));
                            this.messages.push({
                                role: 'tool',
                                tool_call_id: tc.id,
                                name: tc.name,
                                content: `Error executing tool: ${err.message}`
                            });
                        }
                    }
                } else {
                    iterating = false;
                    return displayContent || 'Task complete.';
                }
            } catch (e) {
                spinner.stop();
                printError(e.message);
                iterating = false;
                return `Error occurred: ${e.message}`;
            }
        }
    }
}

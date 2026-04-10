import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import boxen from 'boxen';
import clear from 'clear';

const CEYLON_GRADIENT = gradient(['#FF00CC', '#3333FF', '#00CCFF']);
const INFO_GRADIENT = gradient(['#00CCFF', '#3333FF']);

export function renderHeader() {
    clear();
    console.log(CEYLON_GRADIENT(figlet.textSync('CEYLON X', { font: 'Slant' })));
    console.log(chalk.white.italic('        The 2026 Autonomous Super-Intelligence Agent\n'));
}

export function showStatus(config, autoMode) {
    const modeStr = autoMode ? chalk.red.bold('AUTO MISSION MODE') : chalk.green.bold('INTERACTIVE MODE');
    const status = [
        chalk.cyan('Provider: ') + chalk.white(config.provider),
        chalk.cyan('Model:    ') + chalk.white(config.modelId),
        chalk.cyan('Mode:     ') + modeStr,
        '',
        chalk.gray('Commands:'),
        chalk.white(' /config ') + chalk.dim('Update settings'),
        chalk.white(' /auto   ') + chalk.dim('Toggle Auto Mode'),
        chalk.white(' /update ') + chalk.dim('Check for CLI updates'),
        chalk.white(' /clear  ') + chalk.dim('Reset chat history'),
        chalk.white(' /exit   ') + chalk.dim('Shutdown Agent')
    ].join('\n');
    console.log(boxen(status, { padding: 1, borderStyle: 'round', borderColor: 'magenta' }));
}

export function printThinking() {
    return chalk.blue('Ceylon X is thinking...');
}

export function printToolExecution(name, args) {
    console.log(chalk.cyan(`\n🛠️  [Tool] ${name}`) + chalk.gray(` ${JSON.stringify(args)}`));
}

export function printResponse(content) {
    console.log(chalk.bold.magenta('\nCeylon X: ') + chalk.white(content));
}

export function printError(msg) {
    console.log(chalk.red(`\n❌ Error: ${msg}`));
}

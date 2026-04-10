import { execSync, spawn } from 'child_process';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function getLocalVersion() {
    try {
        const pkgPath = path.join(__dirname, '../../package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return pkg.version;
    } catch (e) {
        return '0.0.0';
    }
}

export async function getLatestVersion() {
    try {
        const version = execSync('npm view ceylonx version', { encoding: 'utf8' }).trim();
        return version;
    } catch (e) {
        return null;
    }
}

export async function checkAndUpdate() {
    const local = await getLocalVersion();
    const latest = await getLatestVersion();

    if (!latest) {
        console.log(chalk.red('⚠ Could not check for updates. Please check your internet connection.'));
        return;
    }

    if (local === latest) {
        console.log(chalk.green('✔ Ceylon X is already up to date (v' + local + ').'));
        return;
    }

    console.log(chalk.yellow(`New version available: ${local} -> ${latest}`));
    
    const spinner = ora(chalk.blue('Updating Ceylon X to the latest version...')).start();

    return new Promise((resolve) => {
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const child = spawn(npm, ['install', '-g', 'ceylonx@latest'], {
            stdio: 'ignore'
        });

        child.on('close', (code) => {
            spinner.stop();
            if (code === 0) {
                console.log(chalk.green.bold(`\n✔ Ceylon X has been updated to ${latest}.`));
                console.log(chalk.cyan('Please restart the CLI to apply changes.'));
                process.exit(0);
            } else {
                console.log(chalk.red(`\n✖ Update failed with exit code ${code}.`));
                console.log(chalk.yellow('Try running "npm install -g ceylonx@latest" manually.'));
                resolve();
            }
        });
    });
}

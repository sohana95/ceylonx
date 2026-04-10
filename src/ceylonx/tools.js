import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { glob } from 'glob';

export const TOOL_DEFINITIONS = [
    {
        name: 'read_file',
        description: 'Read the content of a file from the local filesystem.',
        parameters: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'The path to the file to read.' }
            },
            required: ['file_path']
        }
    },
    {
        name: 'write_file',
        description: 'Write or update a file on the local filesystem.',
        parameters: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'The path where the file should be saved.' },
                content: { type: 'string', description: 'The content to write into the file.' }
            },
            required: ['file_path', 'content']
        }
    },
    {
        name: 'run_command',
        description: 'Run a shell command on the local system.',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The shell command to execute.' }
            },
            required: ['command']
        }
    },
    {
        name: 'list_files',
        description: 'List files in a directory.',
        parameters: {
            type: 'object',
            properties: {
                directory_path: { type: 'string', description: 'The directory to list.' }
            },
            required: ['directory_path']
        }
    },
    {
        name: 'glob_search',
        description: 'Search for files using a glob pattern (e.g., "**/*.js").',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'The glob pattern to search for.' }
            },
            required: ['pattern']
        }
    },
    {
        name: 'grep_search',
        description: 'Search for a string pattern in files (like grep).',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The string or regex to search for.' },
                path: { type: 'string', description: 'The path to search within.', default: '.' }
            },
            required: ['query']
        }
    }
];

export class ToolHandlers {
    constructor(autoMode = false) {
        this.autoMode = autoMode;
    }

    async read_file({ file_path }) {
        try {
            const absPath = path.resolve(process.cwd(), file_path);
            return await readFile(absPath, 'utf8');
        } catch (e) {
            return `Error reading file: ${e.message}`;
        }
    }

    async write_file({ file_path, content }) {
        if (!this.autoMode) {
            console.log(chalk.yellow(`\n🛡️   Ceylon X wants to write to file: ${file_path}`));
            const ok = await confirm({ message: `Allow modification?`, default: true });
            if (!ok) return 'Permission denied by user.';
        }
        try {
            const absPath = path.resolve(process.cwd(), file_path);
            await writeFile(absPath, content, 'utf8');
            return `Successfully written to ${file_path}`;
        } catch (e) {
            return `Error writing file: ${e.message}`;
        }
    }

    async run_command({ command }) {
        if (!this.autoMode) {
            console.log(chalk.yellow(`\n🛡️   Ceylon X wants to run command: ${command}`));
            const ok = await confirm({ message: `Allow execution?`, default: true });
            if (!ok) return 'Permission denied by user.';
        }
        try {
            const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' }) || 'Command executed successfully (no output).';
            return output;
        } catch (e) {
            return `Error: ${e.stderr || e.message}`;
        }
    }

    async list_files({ directory_path }) {
        try {
            const absPath = path.resolve(process.cwd(), directory_path);
            const files = await readdir(absPath);
            const stats = await Promise.all(files.map(async f => {
                const s = await stat(path.join(absPath, f));
                return `${f} (${s.isDirectory() ? 'DIR' : 'FILE'})`;
            }));
            return stats.join('\n');
        } catch (e) {
            return `Error listing files: ${e.message}`;
        }
    }

    async glob_search({ pattern }) {
        try {
            const matches = await glob(pattern, { ignore: 'node_modules/**' });
            return matches.length > 0 ? matches.join('\n') : 'No matches found.';
        } catch (e) {
            return `Error in glob search: ${e.message}`;
        }
    }

    async grep_search({ query, path: searchPath = '.' }) {
        try {
            const isWin = process.platform === 'win32';
            const cmd = isWin ? `findstr /s /i /c:"${query}" *` : `grep -rnE "${query}" . --exclude-dir=node_modules`;
            const output = execSync(cmd, { encoding: 'utf8', cwd: path.resolve(process.cwd(), searchPath) }) || 'No matches found.';
            return output;
        } catch (e) {
            return `No matches or error: ${e.message}`;
        }
    }
}

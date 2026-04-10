import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

// Encryption for Vault
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const SECRET_SALT = os.hostname() + 'CEYLONX_SECURE_VAULT_2026';
const SECRET_KEY = crypto.scryptSync(SECRET_SALT, 'salt', 32);
const IV = crypto.scryptSync(SECRET_SALT, 'iv', 16);

export function encrypt(text) {
    if (!text) return null;
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, SECRET_KEY, IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

export function decrypt(text) {
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

export async function loadConfig() {
    if (existsSync(CONFIG_PATH)) {
        const data = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
        return data;
    }
    return null;
}

export async function saveConfig(config) {
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

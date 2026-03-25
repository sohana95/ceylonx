import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const SECRET_SALT = os.hostname() + 'CEYLONX_SECURE_VAULT_2026';
const SECRET_KEY = crypto.scryptSync(SECRET_SALT, 'salt', 32);
const IV = crypto.scryptSync(SECRET_SALT, 'iv', 16);

function encrypt(text) {
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, SECRET_KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

const key = 'infip-f47d0f7b';
const encryptedKey = encrypt(key);

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.vault = config.vault || {};
config.vault['Ghostbot AI'] = encryptedKey;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Vault updated successfully with Ghostbot key.');

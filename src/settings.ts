import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env');

// Load existing environment variables from .env file
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const ENV_KEYS = {
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  AZURE_PAT: 'AZURE_PAT',
  ORG_URL: 'ORG_URL',
  TARGET_BRANCH: 'TARGET_BRANCH'
};

// Read a variable from process.env
export function getEnv(key: keyof typeof ENV_KEYS): string | undefined {
  return process.env[ENV_KEYS[key]];
}

// Set a variable and persist to `.env` file
export function setEnv(key: keyof typeof ENV_KEYS, value: string): void {
  // Update current process.env
  process.env[ENV_KEYS[key]] = value;

  // Load and update .env file
  let envVars: Record<string, string> = {};
  if (fs.existsSync(envPath)) { // If file exists
    const content = fs.readFileSync(envPath, 'utf8'); // Read the content
    envVars = Object.fromEntries( // Convert key value pairs to an object
      content
        .split('\n')
        .filter(line => line.trim() !== '' && !line.startsWith('#'))
        .map(line => {
          const [k, ...rest] = line.split('=');
          return [k.trim(), rest.join('=').trim()];
        })
    );
  }

  envVars[ENV_KEYS[key]] = value;

  // Write back to .env
  const newContent = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  fs.writeFileSync(envPath, newContent, 'utf8');
  console.log(`✅ ${ENV_KEYS[key]} saved to .env`);
}

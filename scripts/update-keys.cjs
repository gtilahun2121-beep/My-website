const fs = require('fs');
const path = require('path');
const { generateKeyPairSync } = require('crypto');

const ENV_FILE = path.resolve(__dirname, '../.env');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

let env = fs.readFileSync(ENV_FILE, 'utf-8');

env = env.replace(
  /JWT_PRIVATE_KEY=.*?\n/,
  `JWT_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"\n`
);
env = env.replace(
  /JWT_PUBLIC_KEY=.*?\n/,
  `JWT_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"\n`
);

fs.writeFileSync(ENV_FILE, env);
console.log('Updated .env with real RSA keys');

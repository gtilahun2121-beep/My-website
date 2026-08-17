const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const envPath = path.join(__dirname, '..', 'apps', 'backend', '.env');
let envContent = fs.readFileSync(envPath, 'utf-8');

envContent = envContent.replace(
  /JWT_PRIVATE_KEY=.*?$/m,
  'JWT_PRIVATE_KEY="' + privateKey.replace(/\n/g, '\\n') + '"'
);

envContent = envContent.replace(
  /JWT_PUBLIC_KEY=.*?$/m,
  'JWT_PUBLIC_KEY="' + publicKey.replace(/\n/g, '\\n') + '"'
);

fs.writeFileSync(envPath, envContent);
console.log('Updated apps/backend/.env with matching RSA keys');
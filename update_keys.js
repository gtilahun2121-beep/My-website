const fs = require('fs');
const { generateKeyPairSync } = require('crypto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

let env = fs.readFileSync('.env', 'utf-8');

env = env.replace(
  /JWT_PRIVATE_KEY=.*?\n/,
  `JWT_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"\n`
);
env = env.replace(
  /JWT_PUBLIC_KEY=.*?\n/,
  `JWT_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"\n`
);

fs.writeFileSync('.env', env);
console.log('Updated .env with real RSA keys');

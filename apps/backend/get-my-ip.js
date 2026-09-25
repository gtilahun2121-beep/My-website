const https = require('https');

console.log('Finding your public IP address...\n');

// Try multiple IP lookup services
const services = [
  { name: 'ifconfig.me', url: 'https://ifconfig.me/', json: false },
  { name: 'api.ipify.org', url: 'https://api.ipify.org?format=json', json: true },
  { name: 'checkip.amazonaws.com', url: 'https://checkip.amazonaws.com/', json: false },
];

async function getIP(service) {
  return new Promise((resolve) => {
    https.get(service.url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (service.json) {
            const parsed = JSON.parse(data);
            resolve(parsed.ip);
          } else {
            resolve(data.trim());
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

(async () => {
  let publicIP = null;

  for (const service of services) {
    console.log(`Trying ${service.name}...`);
    publicIP = await getIP(service);
    if (publicIP) {
      console.log(`✓ Found: ${publicIP}\n`);
      break;
    }
  }

  if (!publicIP) {
    console.error('Could not determine public IP');
    process.exit(1);
  }

  console.log('=== NEON IP WHITELIST INSTRUCTIONS ===\n');
  console.log('1. Go to: https://console.neon.tech');
  console.log('2. Click on your project');
  console.log('3. Go to: Settings → Connection Settings');
  console.log('4. Find: "IP Whitelist"');
  console.log('5. Add this IP address:\n');
  console.log(`   ${publicIP}/32\n`);
  console.log('   OR for development (temporary):\n');
  console.log(`   0.0.0.0/0\n`);
  console.log('6. Save changes');
  console.log('7. Try connecting again with:');
  console.log(`\n   npm run dev\n`);

  process.exit(0);
})();

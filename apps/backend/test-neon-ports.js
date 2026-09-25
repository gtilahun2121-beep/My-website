const net = require('net');

console.log('=== TESTING NEON PORT CONNECTIVITY ===\n');

const host = 'ep-solitary-mouse-awewjpdb-pooler.c-12.us-east-1.aws.neon.tech';
const ports = [5432, 443, 3389, 80, 8432, 5433];

async function testPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);

    socket.on('connect', () => {
      console.log(`✓ Port ${port}: OPEN`);
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      console.log(`✗ Port ${port}: TIMEOUT (likely blocked by firewall)`);
      socket.destroy();
      resolve(false);
    });

    socket.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        console.log(`✗ Port ${port}: REFUSED (service not listening)`);
      } else if (err.code === 'ENOTFOUND') {
        console.log(`✗ Port ${port}: HOST NOT FOUND`);
      } else {
        console.log(`✗ Port ${port}: ${err.code}`);
      }
      resolve(false);
    });

    socket.connect(port, host);
  });
}

(async () => {
  console.log(`Testing connectivity to: ${host}\n`);
  
  for (const port of ports) {
    await testPort(port);
  }
  
  console.log('\n=== DIAGNOSIS ===');
  console.log('\nPossible issues:');
  console.log('1. Firewall blocking all ports - check Windows Defender/corporate firewall');
  console.log('2. Neon IP whitelist - check https://console.neon.tech for IP restrictions');
  console.log('3. Network proxy/VPN - may be blocking direct database connections');
  console.log('4. ISP blocking database ports - contact ISP if needed');
  
  process.exit(0);
})();

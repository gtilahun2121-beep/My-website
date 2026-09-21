const puppeteer = require('puppeteer');

async function testDashboard() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set authentication cookie/token if needed
  await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle2' });
  
  const breakpoints = [
    { name: 'Mobile (320px)', width: 320, height: 667 },
    { name: 'Tablet (768px)', width: 768, height: 1024 },
    { name: 'Desktop (1024px)', width: 1024, height: 768 }
  ];
  
  for (const bp of breakpoints) {
    console.log(\\nTesting: \\);
    await page.setViewport({ width: bp.width, height: bp.height });
    
    // Check if key elements are visible
    const hasLogoMark = await page.evaluate(() => document.querySelector('[class*="rounded-full"]') !== null);
    const hasBalance = await page.evaluate(() => document.body.innerText.includes('Balance'));
    const hasMenuItems = await page.evaluate(() => document.querySelectorAll('[class*="grid"]').length > 0);
    
    console.log(\  ✓ LogoMark visible: \\);
    console.log(\  ✓ Balance card visible: \\);
    console.log(\  ✓ Menu grid visible: \\);
  }
  
  await browser.close();
}

testDashboard().catch(console.error);

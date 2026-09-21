async function testDashboard() {
  try {
    // Fetch the dashboard page
    const response = await fetch('http://localhost:3001/dashboard');
    const html = await response.text();
    
    // Check for key elements
    const checks = {
      'LogoMark component': html.includes('rounded-full'),
      'Balance card (EQUB POT BALANCE)': html.includes('EQUB POT BALANCE'),
      'Join Equb menu': html.includes('Join Equb'),
      'Contribute menu': html.includes('Contribute'),
      'Winners Wheel menu': html.includes('Winners Wheel'),
      'Members menu': html.includes('Members'),
      'Schedule menu': html.includes('Schedule'),
      'Payments menu': html.includes('Payments'),
      'Invite Friends menu': html.includes('Invite Friends'),
      'History menu': html.includes('History'),
      'Bottom navigation': html.includes('My Equb') && html.includes('Profile'),
      'Green color (#16a34a)': html.includes('16a34a'),
      'Yellow color (#f0c84e)': html.includes('f0c84e'),
      'Teal color (#0a7f76)': html.includes('0a7f76'),
    };
    
    console.log('DASHBOARD STRUCTURE VERIFICATION');
    console.log('='.repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    for (const [check, result] of Object.entries(checks)) {
      const status = result ? '✓' : '✗';
      console.log(\\ \\);
      result ? passed++ : failed++;
    }
    
    console.log('='.repeat(50));
    console.log(\Total: \ passed, \ failed\);
    console.log(\Success Rate: \%\);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testDashboard();

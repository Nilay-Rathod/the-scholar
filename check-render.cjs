const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  
  const rootHTML = await page.$eval('#root', el => el.innerHTML);
  console.log('ROOT HTML:', rootHTML);
  
  await browser.close();
})();

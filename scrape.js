const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cheerio = require('cheerio');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Optional extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

  await page.goto('https://www.fragrantica.com/designers/Marc-Antoine-Barrois.html', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Wait for at least one perfume link to appear, up to 15 seconds
  try {
    await page.waitForSelector('a[href*="/perfume/"]', { timeout: 15000 });
  } catch (err) {
    console.log('No perfume link selector found within 15s');
  }

  // Optional: short delay
  await page.waitForTimeout(3000);

  // Screenshot to see if there's a captcha or challenge
  await page.screenshot({ path: 'debug.png', fullPage: true });

  const html = await page.content();
  const $ = cheerio.load(html);

  const links = [];
  $('a[href*="/perfume/"]').each((_, el) => {
    links.push($(el).attr('href'));
  });
  console.log(`Found ${links.length} links with '/perfume/' substring.`);

  await browser.close();
})();
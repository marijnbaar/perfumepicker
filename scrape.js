const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

const DESIGNER_URL = 'https://www.fragrantica.com/designers/Rabanne.html';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

async function scrapeDesignerPage() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  console.log(`Navigating to: ${DESIGNER_URL}`);
  await page.goto(DESIGNER_URL, { waitUntil: 'networkidle2' });

  const html = await page.content();
  const $ = cheerio.load(html);

  // Use the container classes from your screenshot:
  //  - cell text-left prefumeHbox px1-box-shadow
  // Inside each container, find the h3 > a[href*="/perfume/"] link
  const perfumeLinks = new Set();
  $('div.cell.text-left.prefumeHbox.px1-box-shadow').each((i, el) => {
    const link = $(el).find('h3 a[href*="/perfume/"]').attr('href');
    if (link) {
      // Build an absolute URL if the link is relative
      const absoluteUrl = link.startsWith('http')
        ? link
        : new URL(link, DESIGNER_URL).href;
      perfumeLinks.add(absoluteUrl);
    }
  });

  console.log(`Found ${perfumeLinks.size} perfume links.`);

  // Convert the Set to an array and (optionally) scrape each perfume page
  const perfumeUrls = Array.from(perfumeLinks);

  // Example: store the links in JSON (you can expand this to scrape details)
  fs.writeFileSync('perfumeLinks.json', JSON.stringify(perfumeUrls, null, 2));
  console.log('Perfume links saved to perfumeLinks.json');

  await browser.close();
}

scrapeDesignerPage().catch(error => {
  console.error('Error:', error);
});
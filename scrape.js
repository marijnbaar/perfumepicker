const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://www.fragrantica.com';
const DESIGNERS_URL = `${BASE_URL}/designers/`;  // Main page listing all designers
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

async function scrapeDesignersPage(page) {
  try {
    console.log(`Navigating to designers page: ${DESIGNERS_URL}`);
    await page.goto(DESIGNERS_URL, { waitUntil: 'networkidle2' });
    const html = await page.content();
    const $ = cheerio.load(html);
    const designerUrls = new Set();

    // Assuming designer links start with '/designers/' (excluding the main page itself)
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/designers/') && href !== '/designers/') {
        const absoluteUrl = new URL(href, BASE_URL).href;
        designerUrls.add(absoluteUrl);
      }
    });
    console.log(`Found ${designerUrls.size} designer URLs.`);
    return Array.from(designerUrls);
  } catch (error) {
    console.error('Error scraping designers page:', error);
    return [];
  }
}

async function scrapeDesignerForPerfumeLinks(page, designerUrl) {
  try {
    console.log(`Scraping designer page: ${designerUrl}`);
    await page.goto(designerUrl, { waitUntil: 'networkidle2' });
    const html = await page.content();
    const $ = cheerio.load(html);
    const perfumeLinks = new Set();

    // Adjusted filter: Look for links containing "/perfume/" (singular)
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/perfume/')) {
        const absoluteUrl = href.startsWith('http')
          ? href
          : new URL(href, designerUrl).href;
        perfumeLinks.add(absoluteUrl);
      }
    });
    console.log(`  Found ${perfumeLinks.size} perfume links on ${designerUrl}`);
    return Array.from(perfumeLinks);
  } catch (error) {
    console.error(`Error scraping designer ${designerUrl}:`, error);
    return [];
  }
}

async function scrapePerfumeDetail(page, perfumeUrl) {
  try {
    console.log(`    Scraping perfume detail: ${perfumeUrl}`);
    await page.goto(perfumeUrl, { waitUntil: 'networkidle2' });
    const html = await page.content();
    const $ = cheerio.load(html);

    // Example selectors; adjust these if necessary based on the page structure.
    const name = $('h1').first().text().trim();
    const brand = $('.breadcrumb a').eq(1).text().trim();
    const thumbnail = $('#mainpicbox > img').attr('src') || '';

    return { url: perfumeUrl, name, brand, thumbnail };
  } catch (error) {
    console.error(`    Error scraping perfume ${perfumeUrl}:`, error);
    return { url: perfumeUrl, error: error.toString() };
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  // Step 1: Scrape all designer URLs.
  const designerUrls = await scrapeDesignersPage(page);
  
  // Data structure to store scraped perfume details.
  const allPerfumeData = [];

  // Step 2: For each designer, scrape perfume links.
  for (const designerUrl of designerUrls) {
    const perfumeUrls = await scrapeDesignerForPerfumeLinks(page, designerUrl);
    
    // Step 3: For each perfume, scrape details.
    for (const perfumeUrl of perfumeUrls) {
      const perfumeData = await scrapePerfumeDetail(page, perfumeUrl);
      allPerfumeData.push(perfumeData);
    }
  }
  
  await browser.close();
  
  // Save the collected perfume data into a JSON file.
  fs.writeFileSync('perfumesData.json', JSON.stringify(allPerfumeData, null, 2));
  console.log('All perfume data saved in perfumesData.json');
}

main().catch(error => {
  console.error('Fatal error in main:', error);
});
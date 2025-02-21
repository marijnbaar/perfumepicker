const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cheerio = require('cheerio');
const fs = require('fs');

const DESIGNERS_INDEX_URL = 'https://www.fragrantica.com/designers/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

// Helper: scroll the page slowly to trigger lazy-loading
async function scrollPage(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

// Get all designer URLs from the designers index page.
async function getDesignerUrls(page) {
  console.log(`Visiting designers index: ${DESIGNERS_INDEX_URL}`);
  await page.goto(DESIGNERS_INDEX_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  const html = await page.content();
  const $ = cheerio.load(html);
  
  const designerUrls = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('/designers/') && href !== '/designers/') {
      const absoluteUrl = new URL(href, DESIGNERS_INDEX_URL).href;
      if (!designerUrls.includes(absoluteUrl)) {
        designerUrls.push(absoluteUrl);
      }
    }
  });
  console.log(`Found ${designerUrls.length} designer URLs.`);
  return designerUrls;
}

// Extract perfume links from a designer page using a flexible approach.
function getPerfumeLinks($, designerUrl) {
  let links = [];
  // Primary approach: use anchors within elements with class "prefumeHbox"
  $('.prefumeHbox h3 a').each((_, el) => {
    links.push($(el).attr('href'));
  });
  // Fallback: look for any anchor with '/perfume/' in its href.
  if (links.length === 0) {
    $('a[href*="/perfume/"]').each((_, el) => {
      links.push($(el).attr('href'));
    });
  }
  // Convert relative URLs to absolute URLs.
  links = links.map(link => link.startsWith('http') ? link : new URL(link, designerUrl).href);
  return Array.from(new Set(links));
}

// Get perfume links from a single designer page with error handling.
async function getPerfumeLinksFromDesigner(page, designerUrl) {
  console.log(`Scraping designer page: ${designerUrl}`);
  try {
    await page.goto(designerUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    // Wait for extra content to load (using waitFor as fallback for waitForTimeout)
    await page.waitFor(2000);
    await scrollPage(page);
  } catch (err) {
    console.error(`Error navigating to ${designerUrl}:`, err.toString());
    return [];
  }
  const html = await page.content();
  const $ = cheerio.load(html);
  const perfumeLinks = getPerfumeLinks($, designerUrl);
  console.log(`  Found ${perfumeLinks.length} perfume links on ${designerUrl}`);
  return perfumeLinks;
}

// Scrape details from a single perfume page.
async function scrapePerfumePage(page, perfumeUrl) {
  try {
    console.log(`Scraping perfume page: ${perfumeUrl}`);
    await page.goto(perfumeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitFor('h1', { timeout: 15000 });
    await scrollPage(page);
    const html = await page.content();
    const $ = cheerio.load(html);

    const name = $('h1').first().text().trim();
    const brand = $('.breadcrumb a').eq(1).text().trim();
    const thumbnail = $('#mainpicbox > img').attr('src') || '';
    const description = $('#info .content').first().text().trim();

    const topNotes = [];
    const middleNotes = [];
    const baseNotes = [];
    $('.noteItem').each((_, elem) => {
      const noteCategory = $(elem).find('.noteCategory').text().trim().toLowerCase();
      const noteName = $(elem).find('.noteName').text().trim();
      if (noteCategory.includes('top')) {
        topNotes.push(noteName);
      } else if (noteCategory.includes('heart') || noteCategory.includes('middle')) {
        middleNotes.push(noteName);
      } else if (noteCategory.includes('base')) {
        baseNotes.push(noteName);
      }
    });

    return {
      url: perfumeUrl,
      name,
      brand,
      thumbnail,
      description,
      notes: {
        top: topNotes,
        middle: middleNotes,
        base: baseNotes
      }
    };
  } catch (error) {
    console.error(`Error scraping perfume page ${perfumeUrl}:`, error);
    return { url: perfumeUrl, error: error.toString() };
  }
}

// Main function to orchestrate the scraping process.
async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  // 1. Get all designer URLs.
  const designerUrls = await getDesignerUrls(page);
  let allPerfumeLinks = [];

  // 2. For each designer, get perfume links.
  for (const designerUrl of designerUrls) {
    const links = await getPerfumeLinksFromDesigner(page, designerUrl);
    allPerfumeLinks = allPerfumeLinks.concat(links);
  }
  allPerfumeLinks = Array.from(new Set(allPerfumeLinks));
  console.log(`Total unique perfume links: ${allPerfumeLinks.length}`);

  const allPerfumesData = [];
  // 3. For each perfume link, scrape its details.
  for (const perfumeUrl of allPerfumeLinks) {
    const perfumeData = await scrapePerfumePage(page, perfumeUrl);
    allPerfumesData.push(perfumeData);
  }

  await browser.close();

  // 4. Save all scraped data to a JSON file.
  fs.writeFileSync('perfumesData.json', JSON.stringify(allPerfumesData, null, 2));
  console.log('Scraping complete. Data saved in perfumesData.json');
}

main().catch(error => {
  console.error('Fatal error in main:', error);
});
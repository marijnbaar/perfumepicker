const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pLimit = (await import('p-limit')).default;
puppeteer.use(StealthPlugin());
const cheerio = require('cheerio');
const fs = require('fs');

const DESIGNERS_INDEX_URL = 'https://www.fragrantica.com/designers/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

// Helper: delay for a given number of milliseconds
async function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// Helper: scroll the page slowly to trigger lazy-loading
async function scrollPage(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
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

// Helper: clean a URL by removing any trailing colon.
function cleanUrl(url) {
  return url.endsWith(':') ? url.slice(0, -1) : url;
}

// Get all designer URLs from the designers index page.
async function getDesignerUrls(page) {
  console.log(`Visiting designers index: ${DESIGNERS_INDEX_URL}`);
  await page.goto(DESIGNERS_INDEX_URL, { waitUntil: 'networkidle2', timeout: 120000 });
  const html = await page.content();
  const $ = cheerio.load(html);
  
  const designerUrls = [];
  $('a').each((_, el) => {
    let href = $(el).attr('href');
    if (href) {
      href = cleanUrl(href);
      if (href.startsWith('/designers/') && href !== '/designers/') {
        const absoluteUrl = new URL(href, DESIGNERS_INDEX_URL).href;
        if (!designerUrls.includes(absoluteUrl)) {
          designerUrls.push(absoluteUrl);
        }
      }
    }
  });
  console.log(`Found ${designerUrls.length} designer URLs.`);
  return designerUrls;
}

// Extract perfume links from a designer page using fallback selectors.
function getPerfumeLinks($, designerUrl) {
  let links = [];
  // Primary approach: use anchors within elements with class "prefumeHbox"
  $('.prefumeHbox h3 a').each((_, el) => {
    let link = $(el).attr('href');
    if (link) {
      links.push(cleanUrl(link));
    }
  });
  // Fallback: scan all <a> tags for '/perfume/' in href.
  if (links.length === 0) {
    $('a[href*="/perfume/"]').each((_, el) => {
      let link = $(el).attr('href');
      if (link) {
        links.push(cleanUrl(link));
      }
    });
  }
  // Convert relative URLs to absolute URLs.
  links = links.map(link =>
    link.startsWith('http') ? link : new URL(link, designerUrl).href
  );
  return Array.from(new Set(links)); // Remove duplicates.
}

// Get perfume links from a single designer page with error handling.
async function getPerfumeLinksFromDesigner(browser, designerUrl) {
  console.log(`Scraping designer page: ${designerUrl}`);
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    // Increase default timeouts.
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
    await page.goto(designerUrl, { waitUntil: 'networkidle2', timeout: 120000 });
    await delay(2000);
    await scrollPage(page);
  } catch (err) {
    console.error(`Error navigating to ${designerUrl}:`, err.toString());
    if (page) await page.close();
    return [];
  }
  const html = await page.content();
  const $ = cheerio.load(html);
  const perfumeLinks = getPerfumeLinks($, designerUrl);
  console.log(`  Found ${perfumeLinks.length} perfume links on ${designerUrl}`);
  await page.close();
  return perfumeLinks;
}

// Scrape details from a single perfume page.
async function scrapePerfumePage(browser, perfumeUrl) {
  let page;
  try {
    console.log(`Scraping perfume page: ${perfumeUrl}`);
    page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
    await page.goto(perfumeUrl, { waitUntil: 'networkidle2', timeout: 120000 });
    // Wait for key element
    await page.waitForSelector('h1', { timeout: 15000 });
    await delay(2000);
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

    await page.close();
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
    if (page) await page.close();
    return { url: perfumeUrl, error: error.toString() };
  }
}

// Main function orchestrating the full scraping process.
async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    // Increase protocolTimeout if needed by adding a higher timeout in launch options:
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Use one page to get the designer URLs.
  const mainPage = await browser.newPage();
  await mainPage.setUserAgent(USER_AGENT);
  mainPage.setDefaultNavigationTimeout(120000);
  mainPage.setDefaultTimeout(120000);
  const designerUrls = await getDesignerUrls(mainPage);
  await mainPage.close();

  // Set concurrency limits.
  const designerLimit = pLimit(5); // Up to 5 designer pages concurrently.
  const perfumeLimit = pLimit(10); // Up to 10 perfume pages concurrently.

  // For each designer, get perfume links concurrently.
  const perfumeLinksArrays = await Promise.all(
    designerUrls.map(designerUrl =>
      designerLimit(() => getPerfumeLinksFromDesigner(browser, designerUrl))
    )
  );
  let allPerfumeLinks = perfumeLinksArrays.flat();
  allPerfumeLinks = Array.from(new Set(allPerfumeLinks));
  console.log(`Total unique perfume links: ${allPerfumeLinks.length}`);

  // For each perfume link, scrape details concurrently.
  const allPerfumesData = await Promise.all(
    allPerfumeLinks.map(perfumeUrl =>
      perfumeLimit(() => scrapePerfumePage(browser, perfumeUrl))
    )
  );

  await browser.close();

  // Save data to a JSON file.
  fs.writeFileSync('perfumesData.json', JSON.stringify(allPerfumesData, null, 2));
  console.log('Scraping complete. Data saved in perfumesData.json');
}

main().catch(error => {
  console.error('Fatal error in main:', error);
});
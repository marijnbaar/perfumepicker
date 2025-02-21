const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

async function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

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

function cleanUrl(url) {
  return url.endsWith(':') ? url.slice(0, -1) : url;
}

const DESIGNERS_INDEX_URL = 'https://www.fragrantica.com/designers/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

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

async function getPerfumeLinksFromDesigner(browser, designerUrl) {
  console.log(`Scraping designer page: ${designerUrl}`);
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
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

async function scrapePerfumePage(browser, perfumeUrl) {
  let page;
  try {
    console.log(`Scraping perfume page: ${perfumeUrl}`);
    page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
    await page.goto(perfumeUrl, { waitUntil: 'networkidle2', timeout: 120000 });
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

async function main() {
  const { default: pLimit } = await import('p-limit');
  
  const browser = await puppeteer.launch({
    headless: true,
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

  console.log("Designer URLs:", designerUrls);

  // Set concurrency limits.
  const designerLimit = pLimit(5);
  const perfumeLimit = pLimit(10);

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

  console.log("All perfumes data count:", allPerfumesData.length);
  fs.writeFileSync('perfumesData.json', JSON.stringify(allPerfumesData, null, 2));
  console.log('Scraping complete. Data saved in perfumesData.json');
}

main().catch(error => {
  console.error('Fatal error in main:', error);
});
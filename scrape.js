const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

// Main designers page with all designer URLs
const DESIGNERS_INDEX_URL = 'https://www.fragrantica.com/designers/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

async function getDesignerUrls(page) {
  console.log(`Visiting designers index: ${DESIGNERS_INDEX_URL}`);
  await page.goto(DESIGNERS_INDEX_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  const html = await page.content();
  const $ = cheerio.load(html);

  // Collect all links that point to individual designer pages.
  const designerUrls = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    // Must start with "/designers/" and not be the main index
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

/**
 * Extracts all perfume links on a designer page by looking for anchor tags
 * whose href starts with "/perfume/". Falls back to *any* anchor containing "/perfume/" if none found.
 */
function getPerfumeLinks($, designerUrl) {
  let links = [];

  // 1. Primary approach: <a href^="/perfume/">
  $('a[href^="/perfume/"]').each((_, el) => {
    links.push($(el).attr('href'));
  });

  // 2. Fallback if none found: <a href*="/perfume/">
  if (links.length === 0) {
    $('a[href*="/perfume/"]').each((_, el) => {
      links.push($(el).attr('href'));
    });
  }

  // Convert relative URLs to absolute
  links = links.map(link => link.startsWith('http') ? link : new URL(link, designerUrl).href);

  return Array.from(new Set(links)); // remove duplicates
}

async function getPerfumeLinksFromDesigner(page, designerUrl) {
  console.log(`Scraping designer page: ${designerUrl}`);
  await page.goto(designerUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  const html = await page.content();
  const $ = cheerio.load(html);

  const perfumeLinks = getPerfumeLinks($, designerUrl);
  console.log(`  Found ${perfumeLinks.length} perfume links on ${designerUrl}`);
  return perfumeLinks;
}

async function scrapePerfumePage(page, perfumeUrl) {
  try {
    console.log(`Scraping perfume page: ${perfumeUrl}`);
    await page.goto(perfumeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    const html = await page.content();
    const $ = cheerio.load(html);

    const name = $('h1').first().text().trim();
    const brand = $('.breadcrumb a').eq(1).text().trim();
    const thumbnail = $('#mainpicbox > img').attr('src') || '';
    const description = $('#info .content').first().text().trim();

    // Extract notes
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

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  // 1. Get all designer URLs from the main index
  const designerUrls = await getDesignerUrls(page);
  let allPerfumeLinks = [];

  // 2. For each designer, gather perfume links
  for (const designerUrl of designerUrls) {
    const links = await getPerfumeLinksFromDesigner(page, designerUrl);
    allPerfumeLinks = allPerfumeLinks.concat(links);
  }
  // Remove duplicates
  allPerfumeLinks = Array.from(new Set(allPerfumeLinks));
  console.log(`Total unique perfume links: ${allPerfumeLinks.length}`);

  // 3. Scrape each perfume page
  const allPerfumesData = [];
  for (const perfumeUrl of allPerfumeLinks) {
    const perfumeData = await scrapePerfumePage(page, perfumeUrl);
    allPerfumesData.push(perfumeData);
  }

  await browser.close();

  // 4. Save to JSON
  fs.writeFileSync('scrapedData.json', JSON.stringify(allPerfumesData, null, 2));
  console.log('Scraping complete. Data saved in scrapedData.json');
}

main().catch(error => {
  console.error('Fatal error in main:', error);
});
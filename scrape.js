const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

const SEARCH_URL = 'https://www.fragrantica.com/search/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

// The "Accept" button for the cookie popup. Replace with the real selector from DevTools:
const COOKIE_ACCEPT_SELECTOR = 'button.cc-accept'; 
// Or something like: 'button[aria-label="Accept"]', or an XPath approach if there's no good CSS

const SHOW_MORE_SELECTOR = 'button.button';
const PERFUME_LINK_SELECTOR = '.cell.card.fr-news-box .card-section a[href]';

function cleanUrl(url) {
  return url.endsWith(':') ? url.slice(0, -1) : url;
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleCookiePopup(page) {
  try {
    // Wait up to 10s for the popup's "Accept" button
    await page.waitForSelector(COOKIE_ACCEPT_SELECTOR, { timeout: 10000 });
    console.log('Cookie popup found, clicking Accept...');
    await page.click(COOKIE_ACCEPT_SELECTOR);
    // Give it a moment to close
    await delay(2000);
  } catch (err) {
    console.log('No cookie popup found within 10s or could not click Accept:', err.message);
  }
}

async function getPerfumeLinksFromSearch(page) {
  console.log(`Navigating to: ${SEARCH_URL}`);
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 120000 });

  // 1) Handle the cookie popup
  await handleCookiePopup(page);

  // 2) Wait up to 15s for "Show more results" button (if it appears)
  try {
    await page.waitForSelector(SHOW_MORE_SELECTOR, { timeout: 15000 });
    console.log('"Show more results" button is present, proceeding...');
  } catch (err) {
    console.log('No "Show more results" button found within 15s:', err.message);
  }

  // 3) Repeatedly click "Show more results" if found
  while (true) {
    const loadMoreBtn = await page.$(SHOW_MORE_SELECTOR);
    if (!loadMoreBtn) {
      console.log('No more "Show more results" button. Stopping.');
      break;
    }
    console.log('Clicking "Show more results" button...');
    await loadMoreBtn.click();
    await delay(3000); // Wait for new items to load
  }

  // 4) Extract final HTML
  const html = await page.content();
  const $ = cheerio.load(html);

  // 5) Extract perfume links
  let perfumeLinks = [];
  $(PERFUME_LINK_SELECTOR).each((_, el) => {
    let href = $(el).attr('href');
    if (href) {
      href = cleanUrl(href);
      if (!href.startsWith('http')) {
        href = new URL(href, SEARCH_URL).href;
      }
      perfumeLinks.push(href);
    }
  });

  // Deduplicate
  perfumeLinks = [...new Set(perfumeLinks)];
  console.log(`Found ${perfumeLinks.length} perfume links in total.`);
  return perfumeLinks;
}

(async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);

  // Grab all perfume links
  const perfumeLinks = await getPerfumeLinksFromSearch(page);
  console.log('Perfume Links:', perfumeLinks);

  // Optionally scrape each link in perfumeLinks...
  // for (const link of perfumeLinks) {
  //   await scrapePerfumePage(browser, link);
  // }

  await page.close();
  await browser.close();
  console.log('Done!');
})();
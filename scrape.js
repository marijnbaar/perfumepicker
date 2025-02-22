const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

const SEARCH_URL = 'https://www.fragrantica.com/search';

// The button we *think* we see:
const SHOW_MORE_SELECTOR = 'button.button';

// The link selector:
const PERFUME_LINK_SELECTOR = '.cell.card.fr-news-box .card-section a.link-span';

(async function main() {
  const browser = await puppeteer.launch({
    headless: false, // run headful so we can watch
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  );
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);

  // 1) Go to the search page
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(5000); // give site some extra time

  // 2) Possibly close/accept cookie or region popup
  // const consentBtn = await page.$('.cookie-consent-accept');
  // if (consentBtn) {
  //   await consentBtn.click();
  //   await page.waitForTimeout(2000);
  // }

  // 3) Check if the button is present
  try {
    await page.waitForSelector(SHOW_MORE_SELECTOR, { timeout: 10000 });
    console.log('Found the "Show more results" button, proceeding...');
  } catch (err) {
    console.log('Did NOT find the button within 10s:', err.message);
    await page.screenshot({ path: 'debug_no_button.png', fullPage: true });
  }

  // 4) Repeatedly click the button if it exists
  while (true) {
    const loadMoreBtn = await page.$(SHOW_MORE_SELECTOR);
    if (!loadMoreBtn) {
      console.log('No more "Show more results" button. Stopping.');
      break;
    }

    console.log('Clicking "Show more results"...');
    await loadMoreBtn.click();
    // wait for new results or network to idle
    await page.waitForTimeout(3000);
  }

  // 5) Dump final HTML
  const finalHtml = await page.content();
  // Take a screenshot to see final state
  await page.screenshot({ path: 'final_state.png', fullPage: true });

  // 6) Extract perfume links
  const $ = cheerio.load(finalHtml);
  let perfumeLinks = [];
  $(PERFUME_LINK_SELECTOR).each((_, el) => {
    let href = $(el).attr('href');
    if (href) {
      if (href.endsWith(':')) href = href.slice(0, -1);
      if (!href.startsWith('http')) {
        href = new URL(href, SEARCH_URL).href;
      }
      perfumeLinks.push(href);
    }
  });
  perfumeLinks = [...new Set(perfumeLinks)];
  console.log('Found perfume links:', perfumeLinks);

  await page.close();
  await browser.close();
})();
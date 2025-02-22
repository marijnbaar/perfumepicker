const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

const SEARCH_URL = 'https://www.fragrantica.com/search';
const SHOW_MORE_SELECTOR = 'button.button';
const PERFUME_LINK_SELECTOR = '.cell.card.fr-news-box .card-section a[href]';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 120000 });

  // ... handleCookiePopup() if needed ...

  // Wait for "Show more results" button
  try {
    await page.waitForSelector(SHOW_MORE_SELECTOR, { timeout: 10000 });
    console.log('"Show more results" button is present.');
  } catch (err) {
    console.log('No "Show more results" button found:', err.message);
  }

  // Attempt multiple clicks
  while (true) {
    const loadMoreBtn = await page.$(SHOW_MORE_SELECTOR);
    if (!loadMoreBtn) {
      console.log('No more "Show more results" button. Stopping.');
      break;
    }

    // Screenshot for debugging
    await page.screenshot({ path: 'debug_before_click.png', fullPage: true });

    // Scroll it into view
    await loadMoreBtn.evaluate(btn => btn.scrollIntoView());
    await page.waitForTimeout(500);

    // Try direct Puppeteer click
    try {
      await loadMoreBtn.click();
      console.log('Clicked the button via Puppeteer.');
    } catch (clickErr) {
      console.log('Puppeteer click failed, trying JS evaluate:', clickErr.message);

      // If that fails, do a direct JS click
      await page.evaluate(() => {
        const btn = document.querySelector('button.button');
        if (btn) btn.click();
      });
    }

    // Wait a bit for new results to load
    await page.waitForTimeout(3000);
  }

  // Collect final HTML
  const html = await page.content();
  const $ = cheerio.load(html);

  // Extract links
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
  console.log('Perfume links found:', perfumeLinks);

  await page.close();
  await browser.close();
})();
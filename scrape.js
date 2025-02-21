const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

// Example: Rabanne's designer page
// You can replace this with any other designer page URL.
const DESIGNER_URL = 'https://www.fragrantica.com/designers/Rabanne.html';

// A realistic User-Agent helps bypass some anti-scraping measures.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

async function main() {
  // 1. Launch Puppeteer (disable sandbox if needed on certain CI/CD or Linux distros)
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  // 2. Scrape the designer page for perfume links
  console.log(`Visiting designer page: ${DESIGNER_URL}`);
  await page.goto(DESIGNER_URL, { waitUntil: 'networkidle2' });
  let html = await page.content();
  let $ = cheerio.load(html);

  // Containers typically have this class based on your screenshot:
  // "cell text-left prefumeHbox px1-box-shadow"
  const perfumeContainers = $('div.cell.text-left.prefumeHbox.px1-box-shadow');

  // Collect perfume links in an array
  const perfumeLinks = [];
  perfumeContainers.each((_, container) => {
    const link = $(container).find('h3 a[href*="/perfume/"]').attr('href');
    if (link) {
      // Build absolute URL if it's relative
      const absoluteUrl = link.startsWith('http')
        ? link
        : new URL(link, DESIGNER_URL).href;
      perfumeLinks.push(absoluteUrl);
    }
  });

  console.log(`Found ${perfumeLinks.length} perfume links on the designer page.`);

  // 3. Visit each perfume page to scrape details
  const perfumesData = [];
  for (const perfumeUrl of perfumeLinks) {
    try {
      console.log(`Scraping perfume page: ${perfumeUrl}`);
      await page.goto(perfumeUrl, { waitUntil: 'networkidle2' });
      const detailHtml = await page.content();
      const $$ = cheerio.load(detailHtml);

      // --- Basic Fields ---
      const name = $$('h1').first().text().trim();
      const brand = $$('.breadcrumb a').eq(1).text().trim();
      const thumbnail = $$('#mainpicbox > img').attr('src') || '';

      // Example: Extract a description (adjust selector if needed)
      const description = $$('#info .content').first().text().trim();

      // --- Example Notes Extraction ---
      // If the site uses .noteItem with .noteCategory and .noteName
      // you can parse top/middle/base notes like this:
      const topNotes = [];
      const middleNotes = [];
      const baseNotes = [];

      $$('.noteItem').each((_, elem) => {
        const noteCategory = $$(elem).find('.noteCategory').text().trim().toLowerCase();
        const noteName = $$(elem).find('.noteName').text().trim();
        if (noteCategory.includes('top')) {
          topNotes.push(noteName);
        } else if (noteCategory.includes('heart') || noteCategory.includes('middle')) {
          middleNotes.push(noteName);
        } else if (noteCategory.includes('base')) {
          baseNotes.push(noteName);
        }
      });

      // Build a structured object
      const perfumeData = {
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

      perfumesData.push(perfumeData);
    } catch (error) {
      console.error(`Error scraping perfume page ${perfumeUrl}:`, error);
      perfumesData.push({ url: perfumeUrl, error: error.toString() });
    }
  }

  // 4. Close the browser and save all data to JSON
  await browser.close();
  fs.writeFileSync('perfumesData.json', JSON.stringify(perfumesData, null, 2));
  console.log('Scraping complete. Data saved in perfumesData.json');
}

main().catch(error => {
  console.error('Fatal error in main:', error);
});
const puppeteer = require('puppeteer');
const fs = require('fs');
const cheerio = require('cheerio');

const DESIGNER_URL = 'https://www.fragrantica.com/designers/Lanvin.html';

async function scrapeDesignerPage() {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );
    await page.goto(DESIGNER_URL, { waitUntil: 'networkidle2' });

    const html = await page.content();
    const $ = cheerio.load(html);

    const fragranceContainers = $('div.cell.text-left.prefumeHbox.px1-box-shadow');
    const fragrances = [];

    for (let i = 0; i < fragranceContainers.length; i++) {
      const container = fragranceContainers.eq(i);
      const name = container.find('div:nth-child(1) > div:nth-child(3) > h3 > a').text().trim();
      const genderText = container.find('div:nth-child(2) > span:nth-child(1)').text().trim().toLowerCase();
      const releaseYearText = container.find('div:nth-child(2) > span:nth-child(2)').text().trim();
      const releaseYear = parseInt(releaseYearText, 10);
      const relativeUrl = container.find('div:nth-child(1) > div:nth-child(3) > h3 > a').attr('href');
      const detailUrl = new URL(relativeUrl, DESIGNER_URL).href;

      fragrances.push({ name, gender: genderText, releaseYear, detailUrl });
    }

    await browser.close();

    fs.writeFileSync('scrapedData.json', JSON.stringify(fragrances, null, 2));
    console.log('Data saved in scrapedData.json');
  } catch (error) {
    console.error('Error scraping designer page with Puppeteer:', error);
  }
}

scrapeDesignerPage();
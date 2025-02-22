const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Example: Rabanne's designer page – replace if needed.
const DESIGNER_URL = 'https://www.fragrantica.com/designers/Rabanne.html';

// A realistic User-Agent.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

// Helper delay function.
async function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function main() {
  // 1. Launch Puppeteer.
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  // 2. Scrape the designer page for perfume links.
  console.log(`Visiting designer page: ${DESIGNER_URL}`);
  await page.goto(DESIGNER_URL, { waitUntil: 'networkidle2' });
  let html = await page.content();
  let $ = cheerio.load(html);

  // Based on your screenshot, the containers have this class.
  const perfumeContainers = $('div.cell.text-left.prefumeHbox.px1-box-shadow');

  // Collect perfume links in an array.
  const perfumeLinks = [];
  perfumeContainers.each((_, container) => {
    const link = $(container).find('h3 a[href*="/perfume/"]').attr('href');
    if (link) {
      // Build absolute URL if it's relative.
      const absoluteUrl = link.startsWith('http')
        ? link
        : new URL(link, DESIGNER_URL).href;
      perfumeLinks.push(absoluteUrl);
    }
  });

  console.log(`Found ${perfumeLinks.length} perfume links on the designer page.`);

  // 3. Process each perfume page to scrape details.
  const batchSize = 5;
  const resultsFile = path.join(process.cwd(), 'perfumesData.json');
  let batch = [];
  let totalScraped = 0;

  // Create file if it doesn't exist.
  if (!fs.existsSync(resultsFile)) {
    fs.writeFileSync(resultsFile, JSON.stringify([], null, 2));
  }

  // Helper function to append a batch to the JSON file.
  function appendDataToJsonFile(filePath, dataArray) {
    if (!dataArray || dataArray.length === 0) {
      console.log('No new data to write in this batch.');
      return;
    }
    let existingData = [];
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      if (fileContent.trim().length > 0) {
        existingData = JSON.parse(fileContent);
      }
    } catch (e) {
      console.error('Error reading existing JSON file, starting fresh:', e);
      existingData = [];
    }
    const combined = existingData.concat(dataArray);
    fs.writeFileSync(filePath, JSON.stringify(combined, null, 2));
    console.log(`Successfully wrote ${combined.length} items to ${filePath}`);
    const check = fs.readFileSync(filePath, 'utf-8');
    console.log('File snippet:', check.substring(0, 200));
  }

  // Helper function to commit and push the updated JSON file.
  function commitFile(filePath, message) {
    try {
      // Configure Git user (adjust as needed).
      execSync('git config --global user.email "action@github.com"');
      execSync('git config --global user.name "GitHub Action"');
      // Stage the file.
      execSync(`git add ${filePath}`);
      // Commit changes.
      execSync(`git commit -m "${message}"`);
      // Push changes.
      execSync('git push');
      console.log(`Committed and pushed ${filePath} with message: "${message}"`);
    } catch (err) {
      console.error('Error during git commit/push:', err);
    }
  }

  // Loop through each perfume link sequentially.
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
      const description = $$('#info .content').first().text().trim();

      // --- Notes Extraction ---
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

      batch.push(perfumeData);
      totalScraped++;

      // Flush batch to file if batch size is reached.
      if (batch.length >= batchSize) {
        console.log('Batch data:', batch);
        appendDataToJsonFile(resultsFile, batch);
        commitFile(resultsFile, `Update perfumesData.json - batch ending at ${totalScraped}`);
        console.log(`Flushed batch of ${batch.length} perfumes to JSON. Total so far: ${totalScraped}`);
        batch = [];
      }

      // Optional: delay between pages.
      await delay(1000);
    } catch (error) {
      console.error(`Error scraping perfume page ${perfumeUrl}:`, error);
      batch.push({ url: perfumeUrl, error: error.toString() });
    }
  }

  // Flush any remaining data.
  if (batch.length > 0) {
    appendDataToJsonFile(resultsFile, batch);
    commitFile(resultsFile, `Final update perfumesData.json - total ${totalScraped + batch.length}`);
    totalScraped += batch.length;
    console.log(`Flushed final batch of ${batch.length} perfumes to JSON. Total so far: ${totalScraped}`);
  }

  await browser.close();
  console.log('Scraping complete. Data saved in', resultsFile);
}

main().catch(error => {
  console.error('Fatal error in main:', error);
});
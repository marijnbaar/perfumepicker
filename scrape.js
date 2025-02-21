const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Use HTTPS for the base URL
const BASE_URL = 'https://www.fragrantica.com';
const DESIGNER_URL = `${BASE_URL}/designers/Lanvin.html`;

const layers = ['base', 'mid', 'top'];

const genderToEnum = {
  'male': 'MASCULINE',
  'female': 'FEMININE',
  'unisex': 'UNISEX'
};

async function scrapeDesignerPage() {
  try {
    const { data } = await axios.get(DESIGNER_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const $ = cheerio.load(data);

    // Select all fragrance containers based on the expected class name.
    const fragranceContainers = $('div.cell.text-left.prefumeHbox.px1-box-shadow');
    const fragrances = [];

    for (let i = 0; i < fragranceContainers.length; i++) {
      const container = fragranceContainers.eq(i);

      // Extract basic info from the container.
      const name = container.find('div:nth-child(1) > div:nth-child(3) > h3 > a').text().trim();
      const genderText = container.find('div:nth-child(2) > span:nth-child(1)').text().trim().toLowerCase();
      const gender = genderToEnum[genderText] || genderText;
      const releaseYearText = container.find('div:nth-child(2) > span:nth-child(2)').text().trim();
      const releaseYear = parseInt(releaseYearText, 10);

      // Build the detail page URL.
      const relativeUrl = container.find('div:nth-child(1) > div:nth-child(3) > h3 > a').attr('href');
      const detailUrl = new URL(relativeUrl, DESIGNER_URL).href;

      // Create a fragrance object with data from the list page.
      const fragrance = { name, gender, releaseYear };

      // Fetch and merge additional detail data from the fragrance's page.
      const detailData = await scrapeFragranceDetail(detailUrl);
      Object.assign(fragrance, detailData);

      fragrances.push(fragrance);
    }

    // Write the collected fragrance data to a JSON file.
    fs.writeFileSync('scrapedData.json', JSON.stringify(fragrances, null, 2));
    console.log('Data saved in scrapedData.json');
  } catch (error) {
    console.error('Error scraping designer page:', error);
  }
}

async function scrapeFragranceDetail(detailUrl) {
  try {
    const { data } = await axios.get(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const $ = cheerio.load(data);

    // Extract thumbnail URL.
    const thumbnail = $('#mainpicbox > img').attr('src') || '';

    // Extract brand information.
    const brand = $('#col1 > div > div > p > span:nth-child(1) > span > a > span')
      .first()
      .text()
      .trim();

    // Extract and split the title to update the fragrance name and gender details.
    const h1Text = $('h1 span').first().text().trim();
    let detailedName = h1Text;
    let detailGender = '';
    if (h1Text.includes(`${brand} for `)) {
      const parts = h1Text.split(`${brand} for `);
      detailedName = parts[0].trim();
      detailGender = parts[1].trim();
    }

    // Extract perfumers.
    const perfumers = $('#col1 > div > div > div:nth-child(7) > p')
      .find('a b')
      .map((i, el) => $(el).text().trim())
      .get();

    // Extract notes: select note elements, reverse their order, and parse each set of notes.
    let noteElements = $('#col1 > div > div > div:nth-child(13) > div:nth-child(1) > p').get();
    noteElements.reverse(); // Reverse the list to match original ordering.
    const notes = noteElements.map(el => parseNotes(cheerio.load(el)));

    // Build a notes object pairing each layer with its corresponding notes.
    const notesObj = {};
    layers.forEach((layer, idx) => {
      notesObj[layer] = notes[idx] || [];
    });

    return {
      thumbnail,
      brand,
      detailedName,
      detailGender,
      perfumers,
      notes: notesObj
    };
  } catch (error) {
    console.error('Error scraping detail page:', error);
    return {};
  }
}

function parseNotes($el) {
  // Extract the 'alt' attribute from all img tags within span elements.
  return $el('span img')
    .map((i, el) => $el(el).attr('alt'))
    .get();
}

// Run the scraper.
scrapeDesignerPage();
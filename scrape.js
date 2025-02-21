const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Target a specific perfume page
const FRAGRANTICA_URL = 'https://www.fragrantica.com/perfume/Lattafa-Perfumes/Khamrah-75805.html';

async function scrapeFragrantica() {
  try {
    // Fetch the page HTML
    const { data: html } = await axios.get(FRAGRANTICA_URL);
    const $ = cheerio.load(html);

    // Extract the perfume name – typically contained in an h1 tag with an appropriate attribute
    const name = $('h1[itemprop="name"]').text().trim();

    // Extract the brand name – adjust the selector if needed (for example, if it’s part of a header section)
    const brand = $('div.perfumeHeader a[href*="/perfume/"]').first().text().trim();

    // Extract the description – this might be in a container with class "description" or similar
    const description = $('div#info > p, div.description').first().text().trim();

    // Extract the image URL – usually found in the main image container
    const imageUrl = $('div.perfumeMainImage img').attr('src');

    // Extract notes (top, middle, base) if available.
    // The notes are often displayed in separate sections with distinct classes.
    const topNotes = [];
    const middleNotes = [];
    const baseNotes = [];

    // Example selectors for note sections (you may need to update these)
    $('div.notes div.note.top-note span.note-name').each((i, el) => {
      topNotes.push($(el).text().trim());
    });
    $('div.notes div.note.middle-note span.note-name').each((i, el) => {
      middleNotes.push($(el).text().trim());
    });
    $('div.notes div.note.base-note span.note-name').each((i, el) => {
      baseNotes.push($(el).text().trim());
    });

    const perfumeDetails = {
      name,
      brand,
      description,
      imageUrl,
      notes: {
        top: topNotes,
        middle: middleNotes,
        base: baseNotes
      }
    };

    // Save the scraped data to a JSON file
    fs.writeFileSync('scrapedData.json', JSON.stringify(perfumeDetails, null, 2));
    console.log('Data saved in scrapedData.json');
  } catch (error) {
    console.error('Error during scraping:', error);
  }
}

// Run the scraper
scrapeFragrantica();
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const FRAGRANTICA_URL = 'https://www.fragrantica.com/perfume/Lattafa-Perfumes/Khamrah-75805.html';

async function scrapeFragrantica() {
  try {
    const { data: html } = await axios.get(FRAGRANTICA_URL);
    const $ = cheerio.load(html);

    // Optional: Save the raw HTML for inspection
    // fs.writeFileSync('raw.html', html);

    // Attempt to select the perfume name. Often, the title is in the only <h1> tag.
    const name = $('h1').first().text().trim();
    console.log('Name:', name);

    // Attempt to select the brand name. Often a breadcrumb is used.
    const brand = $('.breadcrumb a').eq(1).text().trim();
    console.log('Brand:', brand);

    // Attempt to select a description.
    // This may vary – try a couple of selectors based on what you see in the HTML.
    const description = $('#info .content, #description').first().text().trim();
    console.log('Description:', description);

    // Attempt to select the main image URL.
    // Check if there’s an element with an id or class that contains the image.
    const imageUrl = $('div#perfumeImage img').attr('src') || $('img.perfumeImage').attr('src');
    console.log('Image URL:', imageUrl);

    // Attempt to extract note data.
    // These selectors are guesses – inspect the page and update if necessary.
    const topNotes = [];
    const middleNotes = [];
    const baseNotes = [];

    // Example: If the notes are contained in elements with the class 'noteItem'
    $('div.noteItem').each((i, elem) => {
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
    console.log('Top Notes:', topNotes);
    console.log('Middle Notes:', middleNotes);
    console.log('Base Notes:', baseNotes);

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

    fs.writeFileSync('scrapedData.json', JSON.stringify(perfumeDetails, null, 2));
    console.log('Data saved in scrapedData.json');
  } catch (error) {
    console.error('Error during scraping:', error);
  }
}

scrapeFragrantia();
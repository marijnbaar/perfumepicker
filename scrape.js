const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const FRAGRANTICA_URL = 'https://www.fragrantica.com/perfume/Lattafa-Perfumes/Khamrah-75805.html';

async function scrapeFragrantia() {
  try {
    const { data: html } = await axios.get(FRAGRANTICA_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(html);

    // Inspect the HTML structure to choose the correct selectors
    const name = $('h1').first().text().trim();
    console.log('Name:', name);

    const brand = $('.breadcrumb a').eq(1).text().trim();
    console.log('Brand:', brand);

    const description = $('#info .content, #description').first().text().trim();
    console.log('Description:', description);

    const imageUrl = $('div#perfumeImage img').attr('src') || $('img.perfumeImage').attr('src');
    console.log('Image URL:', imageUrl);

    // Example extraction for note data (update selectors as needed)
    const topNotes = [];
    const middleNotes = [];
    const baseNotes = [];

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
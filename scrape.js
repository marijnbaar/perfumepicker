const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Vervang de URL door de Fragrantia-URL of de specifieke pagina die je wilt scrapen
const FRAGRANTIA_URL = 'https://www.fragrantia.com/';

async function scrapeFragrantia() {
  try {
    // Haal de HTML-inhoud van de website op
    const response = await axios.get(FRAGRANTIA_URL);
    const html = response.data;
    
    // Laad de HTML in cheerio om de DOM te manipuleren
    const $ = cheerio.load(html);
    
    // Initialiseer een array om de gescrapete data op te slaan
    let perfumes = [];
    
    // Zoek naar de elementen die de parfumdata bevatten. Pas de CSS-selectoren aan
    $('.perfume-card').each((i, elem) => {
      const name = $(elem).find('.perfume-name').text().trim();
      const description = $(elem).find('.perfume-description').text().trim();
      const notes = $(elem).find('.perfume-notes').text().trim();
      const imageUrl = $(elem).find('img').attr('src');
      
      if (name && notes) {
        perfumes.push({ name, description, notes, imageUrl });
      }
    });
    
    // Sla de gescrapete data op in een JSON-bestand
    fs.writeFileSync('scrapedData.json', JSON.stringify(perfumes, null, 2));
    console.log('Data opgeslagen in scrapedData.json');
  } catch (error) {
    console.error('Fout tijdens scrapen:', error);
  }
}

// Voer de scraper functie uit
scrapeFragrantia();

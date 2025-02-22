const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

puppeteer.use(
  StealthPlugin(),
);

const SEARCH_URL =
  "https://www.fragrantica.com/search";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

// Adjust to your actual link selector on the search results.
const PERFUME_LINK_SELECTOR =
  ".cell.card.fr-news-box .card-section a.link-span";

// The "Show more results" button has class "button" in your screenshot.
const SHOW_MORE_SELECTOR =
  "button.button";

function cleanUrl(
  url,
) {
  return url.endsWith(
    ":",
  )
    ? url.slice(
        0,
        -1,
      )
    : url;
}

async function delay(
  ms,
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  );
}

async function getPerfumeLinksFromSearch(
  page,
) {
  console.log(
    `Navigating to: ${SEARCH_URL}`,
  );
  await page.goto(
    SEARCH_URL,
    {
      waitUntil:
        "networkidle2",
      timeout: 120000,
    },
  );

  // Repeatedly click "Show more results" button if it exists
  while (true) {
    try {
      const loadMoreBtn =
        await page.$(
          SHOW_MORE_SELECTOR,
        );
      if (
        !loadMoreBtn
      ) {
        console.log(
          'No more "Show more results" button found. Stopping scroll.',
        );
        break;
      }

      console.log(
        'Clicking "Show more results" button...',
      );
      await loadMoreBtn.click();

      // Wait a bit for new items to load. You can also use "networkidle2" or a specific waitForSelector.
      await delay(
        3000,
      );
    } catch (err) {
      console.error(
        'Error clicking "Show more results":',
        err,
      );
      break;
    }
  }

  // Now collect the final HTML
  const html =
    await page.content();
  const $ =
    cheerio.load(
      html,
    );

  // Extract perfume links
  let perfumeLinks =
    [];
  $(
    PERFUME_LINK_SELECTOR,
  ).each(
    (_, el) => {
      let href = $(
        el,
      ).attr(
        "href",
      );
      if (href) {
        href =
          cleanUrl(
            href,
          );
        // Convert relative -> absolute if needed
        if (
          !href.startsWith(
            "http",
          )
        ) {
          href =
            new URL(
              href,
              SEARCH_URL,
            ).href;
        }
        perfumeLinks.push(
          href,
        );
      }
    },
  );

  // Deduplicate
  perfumeLinks =
    Array.from(
      new Set(
        perfumeLinks,
      ),
    );
  console.log(
    `Found ${perfumeLinks.length} perfume links in total.`,
  );
  return perfumeLinks;
}

(async function main() {
  const browser =
    await puppeteer.launch(
      {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],
      },
    );

  const page =
    await browser.newPage();
  await page.setUserAgent(
    USER_AGENT,
  );
  page.setDefaultNavigationTimeout(
    120000,
  );
  page.setDefaultTimeout(
    120000,
  );

  // 1) Grab all perfume links from the search page
  const perfumeLinks =
    await getPerfumeLinksFromSearch(
      page,
    );
  console.log(
    "Perfume Links:",
    perfumeLinks,
  );

  // 2) (Optional) Scrape each perfume link
  //    for (const link of perfumeLinks) {
  //      await scrapePerfumePage(browser, link);
  //    }

  await page.close();
  await browser.close();
  console.log(
    "Done!",
  );
})();

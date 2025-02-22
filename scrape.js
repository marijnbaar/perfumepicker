const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

puppeteer.use(
  StealthPlugin(),
);

// Replace with the actual URL if it's different
const SEARCH_URL =
  "https://www.fragrantica.com/search/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

// Selector for the "Show more results" button
const SHOW_MORE_SELECTOR =
  "button.button";

// Selector for the perfume links
const PERFUME_LINK_SELECTOR =
  ".cell.card.fr-news-box .card-section a.link-span";

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

/**
 * Repeatedly clicks the "Show more results" button if it appears,
 * then extracts perfume links from the final HTML.
 */
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

  // Wait up to 15s for the button to appear (in case the page is slow).
  // If the button never appears, the script logs a message and continues.
  try {
    await page.waitForSelector(
      SHOW_MORE_SELECTOR,
      {
        timeout: 15000,
      },
    );
    console.log(
      '"Show more results" button is present, proceeding...',
    );
  } catch (err) {
    console.log(
      'No "Show more results" button found within 15s:',
      err.message,
    );
  }

  // Repeatedly click the button if it still exists in the DOM
  while (true) {
    const loadMoreBtn =
      await page.$(
        SHOW_MORE_SELECTOR,
      );
    if (
      !loadMoreBtn
    ) {
      console.log(
        'No more "Show more results" button found. Stopping.',
      );
      break;
    }

    console.log(
      'Clicking "Show more results" button...',
    );
    await loadMoreBtn.click();

    // Wait for new results to load. You can also use:
    // await page.waitForNetworkIdle({ idleTime: 2000, timeout: 30000 });
    // or wait for a specific new element. For simplicity, a fixed delay:
    await delay(
      3000,
    );
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
        // Convert relative to absolute if needed
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

  // 2) Optionally, scrape each link individually
  // for (const link of perfumeLinks) {
  //   await scrapePerfumePage(browser, link);
  // }

  await page.close();
  await browser.close();
  console.log(
    "Done!",
  );
})();

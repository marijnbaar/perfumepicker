const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

puppeteer.use(
  StealthPlugin(),
);

const SEARCH_URL =
  "https://www.fragrantica.com/search/";

// The actual "Accept" button for the cookie popup
// Replace with the real ID, class, or text-based selector
const COOKIE_ACCEPT_SELECTOR =
  'button[data-testid="cookie-accept"]';

// The "Show more results" button
const SHOW_MORE_SELECTOR =
  "button.button";

// The link selector for perfumes
const PERFUME_LINK_SELECTOR =
  ".cell.card.fr-news-box .card-section a[href]";

// Use a real user agent
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

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

// Attempt to close cookie popup
async function handleCookiePopup(
  page,
) {
  try {
    await page.waitForSelector(
      COOKIE_ACCEPT_SELECTOR,
      {
        timeout: 10000,
      },
    );
    console.log(
      "Cookie popup found, clicking Accept...",
    );
    await page.click(
      COOKIE_ACCEPT_SELECTOR,
    );
    await delay(
      2000,
    ); // let it disappear
  } catch (err) {
    console.log(
      "No cookie popup or could not click accept:",
      err.message,
    );
  }
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

  // 1) Accept cookie popup
  await handleCookiePopup(
    page,
  );

  // 2) Wait for "Show more results" button if it appears
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

  // 3) Repeatedly click the button if it exists
  while (true) {
    const loadMoreBtn =
      await page.$(
        SHOW_MORE_SELECTOR,
      );
    if (
      !loadMoreBtn
    ) {
      console.log(
        'No more "Show more results" button. Stopping.',
      );
      break;
    }

    console.log(
      'Clicking "Show more results" button...',
    );
    // Scroll it into view if needed
    await loadMoreBtn.evaluate(
      (btn) =>
        btn.scrollIntoView(),
    );
    await loadMoreBtn.click();

    // Wait for new items to load
    await delay(
      3000,
    );
  }

  // 4) Extract final HTML
  const html =
    await page.content();
  const $ =
    cheerio.load(
      html,
    );

  // 5) Extract perfume links
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
  perfumeLinks = [
    ...new Set(
      perfumeLinks,
    ),
  ];
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

  const perfumeLinks =
    await getPerfumeLinksFromSearch(
      page,
    );
  console.log(
    "Perfume Links:",
    perfumeLinks,
  );

  // You could scrape each link here
  // for (const link of perfumeLinks) {
  //   await scrapePerfumePage(browser, link);
  // }

  await page.close();
  await browser.close();
  console.log(
    "Done!",
  );
})();

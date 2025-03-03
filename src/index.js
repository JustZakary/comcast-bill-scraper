import dotenv from 'dotenv';
import {executablePath} from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
dotenv.config();

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

(async () => {
  // Launch browser with options (proxy support commented out)
  const browser = await puppeteer.launch({
    executablePath: executablePath(),
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      // '--proxy-server=YOUR_PROXY', // Uncomment to enable proxy
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' + '(KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');
    await page.setViewport({width: 1200, height: 800});

    // Navigate to bill page (which redirects to login)
    await page.goto('https://business.comcast.com/account/bill', {
      waitUntil: 'networkidle2',
    });
    await sleep(2000);

    // Accept cookies if the banner appears
    try {
      const cookieButton = await page.waitForSelector('#onetrust-accept-btn-handler', {
        visible: true,
        timeout: 5000,
      });
      await cookieButton.click();
    } catch (e) {
      // Cookie banner not found – continue
    }

    // === Email Entry with Retry ===
    let emailEntered = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.waitForSelector('#user', {visible: true, timeout: 5000});
        await page.type('#user', process.env.COMCAST_USERNAME, {delay: 50});
        await sleep(500);
        await page.keyboard.press('Enter');

        // Wait for the password field to verify navigation succeeded
        await page.waitForSelector('#passwd, #password, input[type=password]', {
          visible: true,
          timeout: 10000,
        });
        emailEntered = true;
        break; // Exit loop if successful
      } catch (err) {
        console.error(`Email entry attempt ${attempt} failed.`);
        if (attempt === 3) {
          throw new Error('Failed to login to account');
        }
      }
    }

    // === Password Entry with Retry ===
    let passwordEntered = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.waitForSelector('#passwd, #password, input[type=password]', {
          visible: true,
          timeout: 5000,
        });
        await page.type('#passwd, #password, input[type=password]', process.env.COMCAST_PASSWORD, {delay: 50});
        await sleep(500);
        await page.keyboard.press('Enter');

        // Wait for navigation to bill page – adjust selector as needed
        await page.waitForNavigation({waitUntil: 'networkidle2', timeout: 15000});
        passwordEntered = true;
        break;
      } catch (err) {
        console.error(`Password entry attempt ${attempt} failed.`);
        if (attempt === 3) {
          throw new Error('Failed to login to account');
        }
      }
    }

    // Refresh bill page to ensure complete load
    await page.reload({waitUntil: 'networkidle2'});
    await sleep(2000);

    // === Scrape bill data and click latest PDF button ===
    // Adjust selector if needed – here we assume the first item is the latest
    const pdfButtonSelector = '.bsd-bill-summaries-list .bsd-bill-summaries-list-item:first-child button[data-tracking*="Download Invoice"]';
    await page.waitForSelector(pdfButtonSelector, {visible: true, timeout: 5000});
    await page.click(pdfButtonSelector);
    // Wait for the PDF to process/download (adjust timing as needed)
    await sleep(5000);

    // === Extract bill data ===
    const bills = await page.evaluate(() => {
      // Get all bill summary items
      const items = document.querySelectorAll('.bsd-bill-summaries-list-item');
      const bills = [];

      items.forEach((item) => {
        const bill = {};

        // Extract header details: Date and Total Amount
        const header = item.querySelector('.bsd-bill-summaries-list-header');
        if (header) {
          const spans = header.querySelectorAll('span');
          bill.date = spans[0] ? spans[0].textContent.trim() : null;
          bill.totalAmount = spans[1] ? spans[1].textContent.trim() : null;
        }

        // Extract PDF button details
        const pdfButton = item.querySelector('.bsd-bill-summaries-download-btn');
        if (pdfButton) {
          bill.pdfTestId = pdfButton.getAttribute('data-testid');
          // Extract the PDF title from the <title> inside the <svg>
          const titleEl = pdfButton.querySelector('title');
          bill.pdfTitle = titleEl ? titleEl.textContent.trim() : null;
        }

        // Extract detailed bill line items from the accordion content
        bill.lineItems = [];
        const lineItems = item.querySelectorAll('.bsd-line-item');
        lineItems.forEach((lineItem) => {
          const spans = lineItem.querySelectorAll('span');
          if (spans.length >= 2) {
            const label = spans[0].textContent.trim();
            const value = spans[1].textContent.trim();
            bill.lineItems.push({label, value});
          }
        });

        bills.push(bill);
      });
      return bills;
    });

    console.log('Extracted Bill Data:', bills);

    // Optional: Save screenshot for debugging
    await page.screenshot({path: 'screenshot.png', fullPage: true});
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    // Uncomment to close the browser when done
    await browser.close();
  }
})();

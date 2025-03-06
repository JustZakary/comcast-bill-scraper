import dotenv from 'dotenv';
import {executablePath} from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

dotenv.config();
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({blockTrackers: true}));

// Cached environment variables
const COUNTRY = process.env.COUNTRY || 'US';
const STATE = process.env.STATE || 'CA';
const STATE_NAME = process.env.STATE_NAME || 'California';
const CONTINENT = process.env.CONTINENT || 'NA';
const USERNAME = process.env.COMCAST_USERNAME;
const PASSWORD = process.env.COMCAST_PASSWORD;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry a task function multiple times before failing.
 * @param {Function} task - A function representing the task to retry.
 * @param {number} retries - Maximum number of attempts.
 * @returns {Promise<any>} - The result of the task function.
 */
async function retry(task, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await task(attempt);
    } catch (error) {
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) {
        throw error;
      }
      await sleep(500); // delay before next attempt
    }
  }
}

(async () => {
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

  let page;
  try {
    page = await browser.newPage();
    console.log('New page created.');
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');
    await page.setViewport({width: 1200, height: 800});

    // Setup request interception for geolocation requests
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const geoUrl = 'https://geolocation.onetrust.com/cookieconsentpub/v1/geo/location';
      if (request.url().includes(geoUrl)) {
        const locationData = {country: COUNTRY, state: STATE, stateName: STATE_NAME, continent: CONTINENT};
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(locationData),
        });
      } else {
        request.continue();
      }
    });

    console.log('Navigating to bill page...');
    await page.goto('https://business.comcast.com/account/bill', {waitUntil: 'networkidle2'});
    await sleep(2000);

    // Accept cookies if banner appears
    try {
      console.log('Checking for cookie banner...');
      const cookieButton = await page.waitForSelector('#onetrust-accept-btn-handler', {
        visible: true,
        timeout: 5000,
      });
      await cookieButton.click();
      console.log('Cookie banner accepted.');
    } catch {
      console.log('No cookie banner found.');
    }

    // Email entry with retry
    await retry(async (attempt) => {
      console.log(`Email entry attempt ${attempt}...`);
      await page.waitForSelector('#user', {visible: true, timeout: 5000});
      await page.type('#user', USERNAME, {delay: 50});
      await sleep(500);
      await page.keyboard.press('Enter');
      await page.waitForSelector('#passwd, #password, input[type=password]', {visible: true, timeout: 10000});
      console.log('Email entered successfully.');
    });

    // Password entry with retry
    await retry(async (attempt) => {
      console.log(`Password entry attempt ${attempt}...`);
      await page.waitForSelector('#passwd, #password, input[type=password]', {visible: true, timeout: 5000});
      await page.type('#passwd, #password, input[type=password]', PASSWORD, {delay: 50});
      await sleep(500);
      await page.keyboard.press('Enter');
      await page.waitForNavigation({waitUntil: 'networkidle2', timeout: 15000});
      console.log('Password entered successfully.');
    });

    console.log('Reloading bill page...');
    await page.reload({waitUntil: 'networkidle2'});
    await sleep(2000);

    // Continue with additional actions like scraping...
    // (For brevity, only modular retry and error handling are showcased)
  } catch (error) {
    console.error('An error occurred:', error.message);
    // Capture a screenshot for debugging if available
    if (page) {
      await page.screenshot({path: 'error.png', fullPage: true});
      console.log('Error screenshot saved as error.png.');
    }
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed.');
  }
})();

# Comcast Bill Scraper

## Prerequisites

- Node.js (version 14 or higher)

## Installation

1. Clone the repository
2. Run `npm install` in the project directory
3. Create a `.env` file in the project directory with the following content:

```env
COMCAST_USERNAME=
COMCAST_PASSWORD=
```

3. Run `npm run start` to start the scraper using Puppeteer
4. The scraper will output the bill details to the console, save the bill details to a file, and save the bill PDF to downloads folder

# Notes:

- After around 20 repeat login attempts the scraper will be blocked by Comcast.
- If the password is typed to fast it will block the login attempt. This script types it out with 50ms delay between each character.
- The if the email entry fails it will retry a max of 3 times before failing. (Same with password entry)
- The page will redirect to a canadian site if the IP lookup request returns Canada, This script overrides the location request to return customized values (Defaults to California)
- This script heavily relies on `puppeteer-extra-plugin-stealth` which is a plugin that helps bypass bot detection. and `puppeteer-extra-plugin-adblocker` which blocks ads and trackers. Tracker blocking is important because Comcast uses trackers to detect bots.
- The biggest blocker seems to be temp ban on repeated login attempts. Limiting the number of times the script is run in a day will help avoid this.

# The Process:

1. **Launch Browser**: The script starts by launching a Puppeteer browser instance with specific configurations to avoid detection and block ads and trackers.

2. **Create New Page**: A new page is created in the browser, and the user agent is set to mimic a real browser.

3. **Intercept Requests**: The script sets up request interception to handle geolocation requests, ensuring the location data is customized to avoid redirection to a Canadian site.

4. **Navigate to Bill Page**: The script navigates to the Comcast bill page and waits for the network to be idle.

5. **Handle Cookie Banner**: If a cookie consent banner appears, the script accepts it to proceed.

6. **Enter Email**: The script attempts to enter the email address with retries in case of failure. It waits for the email input field, types the email, and submits it.

7. **Enter Password**: Similarly, the script attempts to enter the password with retries. It waits for the password input field, types the password with a delay, and submits it.

8. **Reload Bill Page**: After logging in, the script reloads the bill page to ensure all elements are properly loaded.

9. **Scrape Bill Details**: The script proceeds with additional actions like scraping the bill details, saving them to a file, and downloading the bill PDF.

10. **Error Handling**: If any errors occur during the process, the script captures a screenshot for debugging and logs the error message.

11. **Close Browser**: Finally, the script closes the browser instance to clean up resources.

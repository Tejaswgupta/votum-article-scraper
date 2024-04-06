// https://www.livelaw.in/ - livelaw, Web Scrapping 

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'livelaw.json';

function updateFile(dataList) {
    const filePath = path.join(__dirname, fileName);

    let existingData = [];

    try {
        const existingDataString = fs.readFileSync(filePath, 'utf-8');

        if (existingDataString.trim() !== '') {
            existingData = JSON.parse(existingDataString);
        }
    } catch (error) {
        console.log('Error reading existing data:', error);
    }

    // Filter out null values before combining data
    const validDataList = dataList.filter(item => item !== null);

    const combinedData = existingData.concat(validDataList);

    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2), 'utf-8');
}

async function getData(url) {  
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const jsons = $('script[type="application/ld+json"]')
            .map((index, element) => {
                return JSON.parse($(element).text());
            }).get();

        const article = jsons
            .filter(obj => obj['@type'] == 'NewsArticle')[0];

        return {
            'headline': article['headline'],
            'data': article['articleBody'].replace('    ', '\n')
        }
    } catch (error) {
        console.error('Website page not found:', url);
        return null;
    }
}

async function main() {
    let i = 1;

    while (i <= 297) {
        const baseUrl = 'https://www.livelaw.in/articles';
        let targetUrl = `${baseUrl}/${i}`;
        console.log(`${i}`)

        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `livelaw.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            const $ = cheerio.load(htmlContent);

            // Use a Set to store unique URLs
            const uniqueUrls = new Set();

            const elements = $('div.homepage_supreme_court_cntr2 a').map((index, element) => {
                let href = $(element).attr('href');
                let fullUrl = `https://www.livelaw.in/articles${href}`;

                // Add the URL to the Set, which automatically ensures uniqueness
                uniqueUrls.add(fullUrl);

                // Return the full URL for further processing
                return fullUrl; 
            }).get();

            if (elements.length === 0) {
                break; // No more pages
            }

            // Convert the Set back to an array if needed
            const uniqueElements = [...uniqueUrls].filter(url => url.split('-').length - 1 > 3 && url.includes('article'));

            const tasks = uniqueElements.map(element => getData(element));
            const dataList = await Promise.all(tasks); // concurrent API requests for parallelizing

            updateFile(dataList);

            i++;
        } catch (error) {
            console.error('Error:', error.message);
            break;
        }
    }
}

main(); 
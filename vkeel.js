// https://www.vkeel.com/legal-blog - vKeel - Legal Blog, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'vkeel.json';

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

    const combinedData = existingData.concat(validDataList)

    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2), 'utf-8');
}

function hindiMoreThanXPercents(inputString, maxPercentage=40) {
    const hindiRegex = /[\u0900-\u097F]/g;

    const hindiSymbolsCount = (inputString.match(hindiRegex) || []).length;
    const percentage = (hindiSymbolsCount / inputString.length) * 100;
    return percentage > maxPercentage;
}

async function getData(headlineRaw) {
    try {
        const dataString = headlineRaw
            .replace(/[\n\t]+/g, ' ')
            .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
            .trim();

        const newsItem = {
            'headline': dataString,
        };

        if (hindiMoreThanXPercents(dataString)) {
            return null;
        }

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function main() {
    let i = 1;

    while (i <= 31) {
        const baseUrl = 'https://www.vkeel.com/legal-blog';
        let targetUrl = `${baseUrl}?page=${i}`;
 
        try {
            const response = await axios.get(targetUrl);
            console.log(targetUrl)
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `vkeel.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            // Continue with the rest of your processing
            const $ = cheerio.load(htmlContent);
            const elements = $('div.blog-compact-item-content h3').map((index, element) => $(element).text()).get();

            const tasks = elements.map(element => getData(element));
            const dataList = await Promise.all(tasks);

            updateFile(dataList);
 
            i++;
        } catch (error) {
            console.error('Error:', error.message);
            break;
        }
    }
}

main();
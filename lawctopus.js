// https://lawctopus.com/clatalogue/clat-pg/ - lawctopus, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'lawctopus.json';

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
 
        const title = $('.post-title').text().replace(/\[.*?]/g, '').trim();
        const paragraphs = $('.post-content h2, .post-content p, .post-content ul li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/\[.*?]/g, '')
                .trim();

            if (clearParagraph && clearParagraph !== "") {
                clearParagraphs.push(clearParagraph);
            }
        })

        let dataString = clearParagraphs.join(' ');

        dataString = dataString.replace(/<img.*?>/g, '');
 
        if (title.startsWith('/*! elementor') && dataString === "") {
            return null;
        }

        const newsItem = {
            'headline': title, 
            'data': dataString
        };

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function main() {

    const baseUrl = 'https://lawctopus.com/clatalogue/clat-pg/';
    let targetUrl = `${baseUrl}`;

    try {
        const response = await axios.get(targetUrl);
        const htmlContent = response.data;

        // Save HTML content to a file
        const fileName = `lawctopus.html`;  // for sitemap, better for web scrawling
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, htmlContent, 'utf-8');

        // Continue with the rest of your processing
        const $ = cheerio.load(htmlContent);
        const elements = $('section div a').map((index, element) => {
            const href = $(element).attr('href');
            // Add the prefix only if it starts with '/clatalogue'
            return href.startsWith('/clatalogue') ? `https://lawctopus.com${href}` : null;
        }).get();

        // Filter out null values (i.e., URLs that didn't start with '/clatalogue')
        const filteredElements = elements.filter(element => element !== null);

        const tasks = filteredElements.map(element => getData(element));
        const dataList = await Promise.all(tasks);

        updateFile(dataList);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
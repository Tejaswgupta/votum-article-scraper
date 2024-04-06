// https://strictlylegal.in/blog/- strictlylegal, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'strictlylegal.json';

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
 
async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.entry-title').text()
            .replace('\xa0', ' ')
            .replace(/[\n\t]+/g, ' ')
            .trim();
        const paragraphs = $('.entry-content p:not(:has(mark)):not(.ez-toc-title), .entry-content h2, .entry-content ol li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            let clearParagraph = paragraph
                .replace(/&nbsp;/g, ' ')
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/(\[.*]?)/g, '')
                .trim();

            if (paragraph && paragraph.trim() !== "") {
                clearParagraphs.push(clearParagraph);
            }
        })

        // Join paragraphs and clean up unwanted characters
        let dataString = clearParagraphs.join(' ');

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
    const baseUrl = 'https://strictlylegal.in/blog/';
    let targetUrl = `${baseUrl}`;

    try {
        const response = await axios.get(targetUrl);
        const htmlContent = response.data;

        // Save HTML content to a file
        const fileName = `strictlylegal.html`;  // for sitemap, better for web crawling
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, htmlContent, 'utf-8');

        // Continue with the rest of your processing
        const $ = cheerio.load(htmlContent);
        const elements = $('h4.uagb-post__title a').map((index, element) => $(element).attr('href')).get();

        const tasks = elements.map(element => getData(element));
        const dataList = await Promise.all(tasks);

        updateFile(dataList);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
// https://www.juscorpus.com/category/blogs/ - juscorpus, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'juscorpus.json';

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

        const title = $('.page-title-title h1').text().trim();
        const paragraphs = $('.elementor-text-editor h4, .elementor-text-editor p, .elementor-text-editor ol li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/Author\(s.*\)/g, '')
                .replace(/(\[\d+]?)/g, '')
                .trim();

            if (clearParagraph && clearParagraph !== "") {
                clearParagraphs.push(clearParagraph);
            }
        })

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
    const pageSize = 10;
    const baseUrl = 'https://www.juscorpus.com/category/blogs/';

    let currentPage = 1;

    let hasNextPage = true;

    while (hasNextPage) {
        try {
            const targetUrl = (currentPage > 1) ? `${baseUrl}page/${currentPage}` : `${baseUrl}`;

            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `juscorpus.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            const $ = cheerio.load(htmlContent);
            const elements = $('.post-read-more a').map((index, element) => $(element).attr('href')).get();

            const tasks = elements.map(element => getData(element));
            const dataList = await Promise.all(tasks);

            updateFile(dataList);

            if (elements.length !== pageSize) {
                hasNextPage = false;
            }

            currentPage++;
        } catch (error) {
            console.error(`Error:`, error.message);
            break;
        }
    }
}

main();
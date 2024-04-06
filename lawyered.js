// https://www.lawyered.in/legal-disrupt/ - lawyered, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'lawyered.json';

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

        const title = $('.blog-top h3').text().trim(); 
        const paragraphs = $('.content p, .content ul li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
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

    const baseUrl = 'https://www.lawyered.in/legal-disrupt/';
    let targetUrl = `${baseUrl}`;

    try {
        const response = await axios.get(targetUrl);
        const htmlContent = response.data;

        // Save HTML content to a file
        const fileName = `lawyered.html`;  // for sitemap, better for web crawling
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, htmlContent, 'utf-8');

        const $ = cheerio.load(htmlContent);

        const elements = $('.content h5 a').map((index, element) => {
            const href = $(element).attr('href');
            // Add the prefix only if it doesn't start with 'http'
            return href.startsWith('http') ? href : `https://www.lawyered.in${href}`;
        }).get();

        const tasks = elements.map(element => getData(element));
        const dataList = await Promise.all(tasks);

        updateFile(dataList);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
// https://www.scconline.com/blog - scconline, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'scconline.json';

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

        const title = $('h1.entry-title').text().trim();
        const paragraphs = $('.entry-content p, .entry-content h2, .entry-content ol li, .entry-content h3').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];
        paragraphs.forEach((paragraph) => {
            let clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
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
        return null;
    }
}

async function main() {
    const baseUrl = `https://www.scconline.com/post/category/casebriefs/`;

    try {
        const response = await axios.get(baseUrl);
        const htmlContent = response.data;

        // Save HTML content to a file
        const fileName = `scconline.html`;  // for sitemap, better for web scrawling
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, htmlContent, 'utf-8');

        const $ = cheerio.load(htmlContent);
        const elements = $('h2.entry-title a').map((index, element) => $(element).attr('href')).get();

        const tasks = elements.map(element => getData(element));
        const dataList = await Promise.all(tasks); // this allows to parallelize the program/code

        updateFile(dataList);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main(); 
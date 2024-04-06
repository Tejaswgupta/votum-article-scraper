// https://leggerhythms.org/category/law-articles/ - Law Web, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'leggerhythms.json';

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

        const title = $('h1.title').text().trim();

        // Select and extract text from <p> elements inside the div with id 'content'
        const paragraphs = $('#content p:not(:has(em>strong)), #content li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {

            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace('&nbsp;', ' ')
                .replace(/\[.*?]/g, ' ')
                .trim();

            if (clearParagraph && clearParagraph !== "" &&
                !clearParagraph.toLowerCase().includes('this article is') &&
                !clearParagraph.toLowerCase().includes('this article has been')
            ) {
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
    let i = 1;

    while (i <= 42) {
        const baseUrl = 'https://leggerhythms.org/category/law-articles';
        let targetUrl = `${baseUrl}/`;

        if( i > 1) {
            targetUrl = `${baseUrl}/category/law-articles/page/${i}/`;
        }
        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `leggerhythms.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            // Continue with the rest of your processing
            const $ = cheerio.load(htmlContent);
            const elements = $('h2.title a').map((index, element) => $(element).attr('href')).get();
            
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
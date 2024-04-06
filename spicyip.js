// https://spicyip.com - spicyip, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'spicyip.json';

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

        const title = $('h3.entry-title').text().trim();
        const elements = $('.entry-content p').map((index, element) => $(element).text()).get();

        let clearElements = [];

        elements.forEach((element) => {
            let clearElement = element
                .replace(/[\n\t\r]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/\[.*?].?/g, '')
                .trim();

            if (clearElement && clearElement !== "") {
                clearElements.push(clearElement);
            }
        })
  
        // Join paragraphs and clean up unwanted characters
        let dataString = clearElements.join(' ');

        const newsItem = {
            'headline': title.replace(/[\n\t\r]+/g, ' ').replace(/[\s\u200B-\u200D\uFEFF]+/g, ' '), 
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

    while (i <= 631) {
        const baseUrl = 'https://spicyip.com';
        let targetUrl = `${baseUrl}/`;
 
        if(i > 1) {
            targetUrl = `https://spicyip.com/page/${i}`
        }
        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `spicyip.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            // Continue with the rest of your processing
            const $ = cheerio.load(htmlContent);
            const elements = $('h2.entry-title a').map((index, element) => $(element).attr('href')).get();
            
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
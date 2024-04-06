// https://www.lawweb.in/ - Law Web, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'lawweb.json';
const urls = new Set([]);

function saveUrls(urls) {
    fs.writeFileSync('urls.json', JSON.stringify(urls, null, 2), 'utf-8');
}

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
    if (urls.has(url)) {
        return null;
    }
    try {
        const response = await axios.get(url);
        console.log(`article resp: ${response.status}`);
        const $ = cheerio.load(response.data);

        const title = $('h3.entry-title').text().trim();
        const elements = $('.post-body p').map((index, element) => $(element).text()).get();

        // Join paragraphs and clean up unwanted characters
        let dataString = elements.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ');
        dataString = dataString.trim();

        if (dataString.startsWith("https://drive.google.com")) {
            console.log(`${dataString.slice(0, 50)}: ${url}; OOPS< DRIVE< BAILING`)
            return null;
        }

        const newsItem = {
            'headline': title, 
            'data': dataString
        };
        console.log(`Done: ${urls.size}`);
        urls.add(url);
        saveUrls([...urls]);
        updateFile([newsItem]);

        return newsItem;
    } catch (error) {
        console.log('AAAA')
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}
 
async function main() {
    try {
        const existingUrlsString = fs.readFileSync('urls.json', 'utf-8');

        if (existingUrlsString.trim() !== '') {
            existingData = JSON.parse(existingUrlsString);
        }
        existingData.forEach(url => {
            urls.add(url);
        });
    } catch (error) {
        console.log('Error reading existing data:', error);
    }
    let i = 1;
    const max = 4019;
    // const max = 5;

    while (i <= max) {
        const baseUrl = 'https://www.lawweb.in';
        let targetUrl = `${baseUrl}/`;

        if( i > 1) {
            targetUrl = `${baseUrl}/search?updated-max=2023-11-14T18%3A14%3A00%2B05%3A30&max-results=50#PageNo=${i}`;
        }
        try {
            console.log(targetUrl);
            const response = await axios.get(targetUrl);
            console.log(response.status);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('h3.entry-title a').map((index, element) => $(element).attr('href')).get();
            console.log(elements);
            const tasks = elements.map(element => getData(element));
            // const dataList = await Promise.all(tasks);

            // updateFile(dataList);
 
            i++;
        } catch (error) {
            console.error('Error:', error);
            break;
        }
    }
}

main();
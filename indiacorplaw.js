// https://indiacorplaw.in - indiacorplaw, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");

const parser = new XMLParser();

const fileName = 'indiacorplaw.json';

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
        const $ = cheerio.load(response.data);

        const title = $('.entry-title').text().trim();
 
        const paragraphs = $('.entry-content p').map((index, element) => $(element).text()).get();
   
        // Join paragraphs and clean up unwanted characters
        let dataString = paragraphs.join('').replace(/[\n\t]+/g, ' ').replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ').replace(/\[.* are .* students at .*\] /g, '');
 
        const newsItem = {
            'headline': title, 
            'paragraph': dataString
        };

        console.log(`Done: ${urls.size}`);
        urls.add(url);
        saveUrls([...urls]);
        updateFile([newsItem]);

        return newsItem;
    } catch (error) {
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

    const sitemap = parser.parse((await axios.get('https://indiacorplaw.in/sitemap-2.xml')).data);

    const elements = sitemap['urlset']['url'].map(loc => loc['loc']);
    while (true) {
        console.log(elements.length);
        const tasks = elements.map(async (element) => {
            // const data = await getData(element);
            const data = await getData(element);
            // sleep so we don't get rate-limited
            await new Promise(resolve => setTimeout(resolve, 2000));
            return data;
        });
        const dataList = await Promise.all(tasks);
    }
    const tasks = elements.map(async (element) => {
        // const data = await getData(element);
        const data = await getData(element);
        // sleep so we don't get rate-limited
        await new Promise(resolve => setTimeout(resolve, 2000));
        return data;
    });
    const dataList = await Promise.all(tasks);
    // updateFile(dataList);
    process.exit();
  

    let i = 1;

    while (true) {
        const baseUrl = 'https://indiacorplaw.in';
        let targetUrl = `${baseUrl}/`;
 
        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `indiacorplaw.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            // Continue with the rest of your processing
            const $ = cheerio.load(htmlContent);
            const elements = $('h2.entry-title a').map((index, element) => $(element).attr('href')).get();
            
            const tasks = elements.map(element => getData(element));
            const dataList = await Promise.all(tasks);

            // updateFile(dataList);
 
            i++;
        } catch (error) {
            console.error('Error:', error);
            break;
        }
    }
}

main();
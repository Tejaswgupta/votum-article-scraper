// https://cyberblogindia.in/blog/ - cyberblogindia, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;

const fileName = 'cyberblogindia.json';

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
 
        const contentElements = $('.entry-content p, .entry-content ul li, .entry-content ol li, .entry-content table, .entry-content h2, .entry-content h3').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).text()
        }).get();
   
        // Join paragraphs and clean up unwanted characters
        let dataString = contentElements.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ').trim();
        dataString = dataString.replace(/Featured Image Credits: Image by \w+\b/g, '');

        // filter Hindi text
        if ([...dataString].some(char => 0x0900 <= char.codePointAt(0) && char.codePointAt(0) <= 0x097F)) {
            console.warn(`Found Hindi text on '${title}', skipping`);
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
    let pages = 28;

    while (i <= pages) {
        const baseUrl = 'https://cyberblogindia.in/blog/';
        let targetUrl = `${baseUrl}`;

        if(i > 1) {
            targetUrl = `${baseUrl}page/${i}/?utm_source=feedspot`
        }
 
        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;
 
            const fileName = `cyberblogindia.html`;   
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');
 
            const $ = cheerio.load(htmlContent);
            pages = parseInt($('.x-pagination a.last').map((index, element) => $(element).text()).get()[0], 10);
            const elements = $('h2.entry-title a').map((index, element) => $(element).attr('href')).get();
            
            const tasks = elements.map(element => getData(element));
            const dataList = await Promise.all(tasks);

            // updateFile(dataList);
 
            i++;
        } catch (error) {
            console.error('Error:', error.message);
            break;
        }
    }
}

main();
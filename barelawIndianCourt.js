// https://www.barelaw.in/legal-drafts/ - barelaw, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;

const fileName = 'barelawIndianCourt.json';

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

        const title = $('.post-title').text().trim(); 
        const paragraphs = $('.dropcap-content h2, .dropcap-content p, .dropcap-content ul li, .dropcap-content ol li, .dropcap-content table').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).find("br").replaceWith("\n").end().text();
        }).get();
   
        // Join paragraphs and clean up unwanted characters
        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ');
        dataString = dataString.replace(/For More Drafts Related To Indian Courts- Link Below\s?(https:\/\/www\.barelaw\.in\/indian-courts-2\/)?/g, '')

        const newsItem = {
            'headline': title, 
            'data': dataString
        };

        console.log(`Done: ${urls.size}`);
        urls.add(url);
        saveUrls([...urls]);

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; 
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
    const baseUrl = 'https://www.barelaw.in/indian-courts-2/';
    let targetUrl = `${baseUrl}`;

    try {
        const response = await axios.get(targetUrl);
        const htmlContent = response.data;

        // Save HTML content to a file
        const fileName = `barelawIndianCourt.html`;  // for sitemap, better for web scrawling
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, htmlContent, 'utf-8');

        // Continue with the rest of your processing
        const $ = cheerio.load(htmlContent);
        const elements = $('.post-item-title a').map((index, element) => $(element).attr('href')).get();
        
        const tasks = elements.map(element => getData(element));
        const dataList = await Promise.all(tasks);

        updateFile(dataList);
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

main();
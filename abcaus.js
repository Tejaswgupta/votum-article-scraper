// https://abcaus.in - abcaus, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;

const fileName = 'abcaus.json';
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

        const title = $('.title').text().trim(); 
        const paragraphs = $('.thecontent p, .thecontent ul:not(.wp-block-latest-posts) li, .thecontent ol li, .thecontent table').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).find("br").replaceWith("\n").end().text();
        }).get();
        
        // Join paragraphs and clean up unwanted characters
        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ').trim();

        const newsItem = {
            'headline': title, 
            'data': dataString
        };

        console.log(urls);
        urls.add(url);
        saveUrls(urls);

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', error);
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
    const pageNums = 1370;
    while (i < pageNums) {
        try {
            const baseUrl = 'https://abcaus.in';
            let targetUrl = i == 1 ? baseUrl : `${baseUrl}/page/${i}`;

            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `abcaus.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            // Continue with the rest of your processing
            const $ = cheerio.load(htmlContent);
            const elements = $('h2.title a').map((index, element) => $(element).attr('href')).get();

            console.log(elements);
            
            const tasks = elements.map(element => getData(element));
            const dataList = await Promise.all(tasks);
            
            updateFile(dataList);
            i++;
        } catch (error) {
            console.error(error.message);
        }
    }
    process.exit();
}

main();
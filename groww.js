// https://groww.in/sitemap.xml - groww, Web Scrapping

// * URL not working / ALSO MENTIONED TO TEGAS WITH A LIST OF NON-WORKING SITES *

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");

const parser = new XMLParser();

const fileName = 'groww.json';

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

    const combinedData = existingData.concat(dataList.filter(x => !!x));

    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2), 'utf-8');
}
 
async function getData(url) {
    if (url === 'https://groww.in/blog') {
        // don't scrape blog root
        return null;
    }
    if (urls.has(url)) {
        return null;
    }
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('h1').text().trim();

        // Select and extract text from <p> elements inside the div with id 'content'
        const paragraphs = $('div.bc91ContentDiv').map((index, element) => NodeHtmlMarkdown.translate($(element).html())).get();
  
        // Combine the text from paragraphs and list items
        const dataString = paragraphs.join('\n').replace('\\.', '.').replace('\n\n', '\n').trim();

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
        console.error(error);
        return {}; // Return null for unsuccessful requests
    }
}

async function main() {
    const sitemapmap = parser.parse((await axios.get('https://groww.in/sitemap.xml')).data);
    const sitemaps = sitemapmap['sitemapindex']['sitemap']
        .map(loc => loc['loc'])
        .filter(loc => loc.includes("blog"));
    const siteUrls = await Promise.all(sitemaps.map(async (sitemapUrl) => {
        return parser.parse((await axios.get(sitemapUrl)).data)['urlset']['url'].map(loc => loc['loc']);
    }));
    const dataList = await Promise.all(siteUrls.flat().map(url => getData(url)));
    updateFile(dataList);
    return;

    let i = 1;

    while (i <= 42) {
        const baseUrl = 'https://groww.in/sitemap.xml';
        let targetUrl = `${baseUrl}`;
 
        // try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `groww.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            // Continue with the rest of your processing
            const $ = cheerio.load(htmlContent);
            const elements = $('h2.title a').map((index, element) => $(element).attr('href')).get();
            
            const tasks = elements.slice(0, 15).map(element => getData(element));
            const dataList = await Promise.all(tasks);

            updateFile(dataList);
 
            i++;
        // } catch (error) {
        //     console.error('Error:', error.message);
        //     break;
        // }
    }
}

main();
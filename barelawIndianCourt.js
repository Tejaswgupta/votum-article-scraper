// https://www.barelaw.in/legal-drafts/ - barelaw, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;
const supabase = require('./supabaseClient');

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

    const validDataList = dataList.filter(item => item !== null);
    const combinedData = existingData.concat(validDataList);

    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2), 'utf-8');
}

async function saveToSupabase(data) {
    const { headline, dataString, url } = data;

    const { error } = await supabase
        .from('votum_article_scrapers')
        .upsert({ title: headline, content: dataString, url });

    if (error) {
        console.error('Error saving to Supabase:', error.message);
    } else {
        console.log(`Data saved to Supabase for URL: ${url}`);
    }
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
   
        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ');
        dataString = dataString.replace(/For More Drafts Related To Indian Courts- Link Below\s?(https:\/\/www\.barelaw\.in\/indian-courts-2\/)?/g, '');

        const newsItem = {
            headline: title, 
            dataString: dataString,
            url: url
        };

        console.log(`Done: ${urls.size}`);
        urls.add(url);
        saveUrls([...urls]);

        await saveToSupabase(newsItem);

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

        const fileName = `barelawIndianCourt.html`;
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, htmlContent, 'utf-8');

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
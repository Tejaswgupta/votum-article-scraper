// https://cleartax.in/ - cleartax, Web Scrapping

const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const axios = require('axios');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");

const parser = new XMLParser();

const fileName = 'cleartax.json';

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

        const title = $('h1').text().trim();
        const pdiv = $($('#authorBio').get()[0].previousSibling);
        const paragraphs = pdiv.find('p, h2, h3, h4, ol li, ul li, table').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).text()
        }).get();

        // Join paragraphs and clean up unwanted characters
        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ');

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
    const sitemap = parser.parse((await axios.get('https://cleartax.in/s/sitemap.xml')).data);

    const elements = sitemap['urlset']['url'].map(loc => loc['loc']);
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
    // let page = 1;
    // const baseUrl = `https://blog.clear.in/page`;
    // while (true) {
    //     try {
    //         const response = await axios.get(`${baseUrl}/${page}`);
    //         const htmlContent = response.data;
    //         const $ = cheerio.load(htmlContent);
    //         const elements = $('.post-info h3 a').map((index, element) => {
    //             const relativeUrl = $(element).attr('href');
    //             const prefixedUrl = `https://blog.clear.in${relativeUrl}`;
    //             return prefixedUrl;
    //         }).get();
    //         const tasks = elements.map(element => getData(element));
    //         const dataList = await Promise.all(tasks);
    //         updateFile(dataList);
    //         page++;
    //     } catch (AxiosError) {
    //         // 404, no more pages. we can exit now.
    //         console.log("No more pages.");
    //         break;
    //     }
    // }
}

main(); 
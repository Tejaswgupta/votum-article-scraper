// https://www.etmoney.com/learn - etmoney, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");

const parser = new XMLParser();

const fileName = 'etmoney.json';

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
        const isArticle = $('.entry-content').length > 0;
        if (!isArticle) {
            return null;
        }
        const title = $('.entry-title').text().trim();
        const paragraphs = $('.entry-content p, .entry-content h2, .entry-content ol li, .entry-content ul li, .entry-content table').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).text()
        }).get();
  
        // Join paragraphs and clean up unwanted characters
        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ');
        if (!dataString) {
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
    const sitemap = parser.parse((await axios.get('https://www.etmoney.com/learn-sitemap.xml')).data);

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
    // await (async () => {
    //     let initialJSON = (await axios.get('https://www.etmoney.com/learn/wp-admin/admin-ajax.php?id=&post_id=1&slug=home&posts_per_page=9&offset=0&post_type=post&repeater=default&seo_start_page=1&preloaded=false&preloaded_amount=0&order=DESC&orderby=date&action=alm_get_posts&query_type=standard&canonical_url=https%3A%2F%2Fwww.etmoney.com%2Flearn&page=0')).data;
    //     const totalPosts = initialJSON['meta']['totalposts'];
    //     let fullJSON = (await axios.get(`https://www.etmoney.com/learn/wp-admin/admin-ajax.php?id=&post_id=1&slug=home&posts_per_page=${totalPosts}&offset=0&post_type=post&repeater=default&seo_start_page=1&preloaded=false&preloaded_amount=0&order=DESC&orderby=date&action=alm_get_posts&query_type=standard&canonical_url=https%3A%2F%2Fwww.etmoney.com%2Flearn&page=0`)).data;
    //     fs.writeFileSync('fulljson.json', JSON.stringify(fullJSON));
    //     // const fullJSON = JSON.parse(fs.readFileSync('fulljson.json'));
    //     const htmlContent = fullJSON['html'];
    //     const $ = cheerio.load(htmlContent);
    //     const elements = $('.entry-title a').map((index, element) => $(element).attr('href')).get();
    //     const tasks = elements.slice(0, 20).map(async (element) => {
    //         // const data = await getData(element);
    //         const data = await getData(element);
    //         // sleep so we don't get rate-limited
    //         await new Promise(resolve => setTimeout(resolve, 2000));
    //         return data;
    //     });
    //     const dataList = await Promise.all(tasks);
    //     updateFile(dataList);
    // })();
}

main();
// https://www.etmoney.com/learn - etmoney, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;
const { XMLParser } = require("fast-xml-parser");
const supabase = require('./supabaseClient'); // Import the Supabase client

const parser = new XMLParser();

const urls = new Set([]);

function saveUrls(urls) {
    fs.writeFileSync('urls.json', JSON.stringify(urls, null, 2), 'utf-8');
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
        const isArticle = $('.entry-content').length > 0;
        if (!isArticle) {
            return null;
        }
        const title = $('.entry-title').text().trim();
        const paragraphs = $('.entry-content p, .entry-content h2, .entry-content ol li, .entry-content ul li, .entry-content table').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).text();
        }).get();
  
        // Join paragraphs and clean up unwanted characters
        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ');
        if (!dataString) {
            return null;
        }
        const newsItem = {
            'headline': title, 
            'dataString': dataString, // Use dataString to match the first code
            'url': url // Include the URL
        };

        console.log(`Done: ${urls.size}`);
        urls.add(url);
        saveUrls([...urls]);
        
        await saveToSupabase(newsItem); // Save to Supabase instead of updating a file
        
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
        const data = await getData(element);
        // sleep so we don't get rate-limited
        await new Promise(resolve => setTimeout(resolve, 2000));
        return data;
    });
    const dataList = await Promise.all(tasks);
    process.exit();
}

main();

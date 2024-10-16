// https://indiacorplaw.in - indiacorplaw, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const { XMLParser } = require("fast-xml-parser");
const supabase = require('./supabaseClient');

const parser = new XMLParser();
const urls = new Set([]);

function saveUrls(urls) {
    fs.writeFileSync('urls.json', JSON.stringify([...urls], null, 2), 'utf-8');
}

async function saveToSupabase(data) {
    const { headline, paragraph, url } = data;

    const { error } = await supabase
        .from('votum_article_scrapers')
        .upsert({ title: headline, content: paragraph, url });

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

        const title = $('.entry-title').text().trim();
        const paragraphs = $('.entry-content p').map((index, element) => $(element).text()).get();

        // Join paragraphs and clean up unwanted characters
        let dataString = paragraphs.join('').replace(/[\n\t]+/g, ' ').replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ').replace(/\[.* are .* students at .*\] /g, '');

        const newsItem = {
            headline: title,
            paragraph: dataString,
            url: url
        };

        console.log(`Done: ${urls.size}`);
        urls.add(url);
        saveUrls([...urls]);

        await saveToSupabase(newsItem); // Save to Supabase

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
            const existingData = JSON.parse(existingUrlsString);
            existingData.forEach(url => {
                urls.add(url);
            });
        }
    } catch (error) {
        console.log('Error reading existing data:', error);
    }

    const sitemap = parser.parse((await axios.get('https://indiacorplaw.in/sitemap-2.xml')).data);
    const elements = sitemap['urlset']['url'].map(loc => loc['loc']);

    while (true) {
        console.log(elements.length);
        const tasks = elements.map(async (element) => {
            const data = await getData(element);
            // Sleep to avoid being rate-limited
            await new Promise(resolve => setTimeout(resolve, 2000));
            return data;
        });
        const dataList = await Promise.all(tasks);
        // You can handle dataList here if needed
    }

    process.exit();
}

main();

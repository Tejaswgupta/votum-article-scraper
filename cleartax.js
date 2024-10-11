// https://cleartax.in/ - cleartax, Web Scrapping

const cheerio = require('cheerio');
const axios = require('axios');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;
const { XMLParser } = require("fast-xml-parser");
const supabase = require('./supabaseClient');
const fs = require('fs');

const parser = new XMLParser();
const urls = new Set([]);

function saveUrls(urls) {
    fs.writeFileSync('urls.json', JSON.stringify([...urls], null, 2), 'utf-8');
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

        const title = $('h1').text().trim();
        const pdiv = $($('#authorBio').get()[0].previousSibling);
        const paragraphs = pdiv.find('p, h2, h3, h4, ol li, ul li, table').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).text();
        }).get();

        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ');

        const newsItem = {
            headline: title,
            dataString: dataString,
            url: url
        };

        console.log(`Done: ${urls.size}`);
        urls.add(url);
        saveUrls(urls);  // Save URLs to file

        await saveToSupabase(newsItem);

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;
    }
}

async function main() {
    try {
        const sitemap = parser.parse((await axios.get('https://cleartax.in/s/sitemap.xml')).data);

        const elements = sitemap['urlset']['url'].map(loc => loc['loc']);
        const tasks = elements.map(async (element) => {
            const data = await getData(element);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return data;
        });
        await Promise.all(tasks);
    } catch (error) {
        console.log('Error during scraping:', error);
    }
    process.exit();
}

main();


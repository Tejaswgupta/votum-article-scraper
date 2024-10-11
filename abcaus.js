const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;
const supabase = require('./supabaseClient');

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

        const title = $('.title').text().trim();
        const paragraphs = $('.thecontent p, .thecontent ul:not(.wp-block-latest-posts) li, .thecontent ol li, .thecontent table').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).find("br").replaceWith("\n").end().text();
        }).get();

        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ').trim();

        const newsItem = {
            headline: title,
            dataString: dataString,
            url: url
        };

        urls.add(url);
        saveUrls(urls);

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
            const existingData = JSON.parse(existingUrlsString);
            existingData.forEach(url => {
                urls.add(url);
            });
        }
    } catch (error) {
        console.log('Error reading existing data:', error);
    }

    let i = 1;
    const pageNums = 1370;
    while (i < pageNums) {
        try {
            const baseUrl = 'https://abcaus.in';
            let targetUrl = i === 1 ? baseUrl : `${baseUrl}/page/${i}`;

            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            const fileName = `abcaus.html`; 
            const filePath = path.join(__dirname, fileName);
            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            const $ = cheerio.load(htmlContent);
            const elements = $('h2.title a').map((index, element) => $(element).attr('href')).get();

            console.log(elements);
            
            const tasks = elements.map(element => getData(element));
            await Promise.all(tasks);

            i++;
        } catch (error) {
            console.error(error.message);
        }
    }
    process.exit();
}

main();

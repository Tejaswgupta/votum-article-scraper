const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const supabase = require('./supabaseClient'); // Import Supabase client

async function checkExistingUrl(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('url')
        .eq('url', url);

    if (error) {
        console.error('Error checking existing URL:', error);
        return false;
    }
    return data.length > 0; // Return true if URL exists
}

async function saveToSupabase(title, content, url) {
    const { error } = await supabase
        .from('votum_article_scrapers')
        .insert([{ title, content, url }]);

    if (error) {
        console.error('Error saving data to Supabase:', error);
    }
}

async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('h1.title').text().trim();
        const paragraphs = $('#content p:not(:has(em>strong)), #content li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace('&nbsp;', ' ')
                .replace(/\[.*?]/g, ' ')
                .trim();

            if (clearParagraph && clearParagraph !== "" &&
                !clearParagraph.toLowerCase().includes('this article is') &&
                !clearParagraph.toLowerCase().includes('this article has been')
            ) {
                clearParagraphs.push(clearParagraph);
            }
        });

        let dataString = clearParagraphs.join(' ');

        const newsItem = {
            'title': title,
            'content': dataString,
            'url': url
        };

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;
    }
}

async function main() {
    let i = 1;

    while (i <= 42) {
        const baseUrl = 'https://leggerhythms.org/category/law-articles';
        let targetUrl = `${baseUrl}/`;

        if (i > 1) {
            targetUrl = `${baseUrl}/category/law-articles/page/${i}/`;
        }
        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('h2.title a').map((index, element) => $(element).attr('href')).get();

            const tasks = elements.map(async (element) => {
                const newsItem = await getData(element);
                if (newsItem && !(await checkExistingUrl(newsItem.url))) {
                    await saveToSupabase(newsItem.title, newsItem.content, newsItem.url);
                }
            });

            await Promise.all(tasks);
            i++;
        } catch (error) {
            console.error('Error:', error.message);
            break;
        }
    }
}

main();

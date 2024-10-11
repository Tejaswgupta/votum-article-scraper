// https://www.lawyered.in/legal-disrupt/ - lawyered, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const supabase = require('./supabaseClient');

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
    const { data, error } = await supabase
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

        const title = $('.blog-top h3').text().trim();
        const paragraphs = $('.content p, .content ul li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .trim();

            if (clearParagraph && clearParagraph !== "") {
                clearParagraphs.push(clearParagraph);
            }
        });

        let dataString = clearParagraphs.join(' ');

        return {
            title,
            content: dataString,
            url
        };
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function main() {
    const baseUrl = 'https://www.lawyered.in/legal-disrupt/';
    let targetUrl = `${baseUrl}`;

    try {
        const response = await axios.get(targetUrl);
        const htmlContent = response.data;

        const $ = cheerio.load(htmlContent);

        const elements = $('.content h5 a').map((index, element) => {
            const href = $(element).attr('href');
            return href.startsWith('http') ? href : `https://www.lawyered.in${href}`;
        }).get();

        const tasks = elements.map(async (element) => {
            const newsItem = await getData(element);
            if (newsItem && !(await checkExistingUrl(newsItem.url))) {
                await saveToSupabase(newsItem.title, newsItem.content, newsItem.url);
            }
        });

        await Promise.all(tasks);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

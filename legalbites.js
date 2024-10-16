const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const supabase = require('./supabaseClient');

async function checkUrlExists(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('url')
        .eq('url', url)
        .single();

    if (error) {
        console.error('Error checking URL:', error);
        return false;
    }

    return data !== null;
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

        const title = $('.page-title').text().trim(); 
        const paragraphs = $('.entry-main-content p, div.story p, h2.description p').map((index, element) => $(element).text()).get();
        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            if (
                paragraph.includes('Important Links') ||
                paragraph.includes('Law Library:') ||
                paragraph.includes('Law Aspirants:')
            ) {
                return;
            }

            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .trim();

            if (clearParagraph && clearParagraph !== "") {
                clearParagraphs.push(clearParagraph);
            }
        });

        let dataString = clearParagraphs.join(' ');

        if (title !== "" && dataString !== "") {
            return { title, content: dataString, url };
        }

    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function main() {
    let i = 1;

    while (i <= 88) {
        const baseUrl = 'https://www.legalbites.in/topics/articles';
        let targetUrl = `${baseUrl}`;

        if (i > 1) {
            targetUrl = `${baseUrl}/${i}`;
        }

        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('h3.post-title a').map((index, element) => $(element).attr('href')).get();

            const modifiedUrls = elements.map(element => {
                const formattedElement = element.startsWith('/') ? element.substring(1) : element;
                return `https://www.legalbites.in/${formattedElement.replace('/topics/articles/', '')}`;
            });

            for (const url of modifiedUrls) {
                const exists = await checkUrlExists(url);
                if (!exists) {
                    const data = await getData(url);
                    if (data) {
                        await saveToSupabase(data.title, data.content, url);
                    }
                }
            }

            i++;
        } catch (error) {
            console.error('Error:', error.message);
            break;
        }
    }
}

main();

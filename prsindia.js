const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const supabase = require('./supabaseClient');

let t = 1;

async function checkIfUrlExists(url) {
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

function convertHtmlTableToMarkdown(table) {
    const _$ = cheerio.load(table.html());

    const rows = [];
    table.find('tr').each(function () {
        const cells = [];
        _$(this).find('td, th').each(function () {
            cells.push(_$(this).text());
        });
        rows.push(cells.join(' | '));
    });
    return rows.join('\n');
}

async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.field-item h2').text().trim();

        const paragraphs = $('.field-item p');
        let clearParagraphs = [];
        let tableFound = false;

        paragraphs.each(function (index, element) {
            const paragraph = $(this);
            const paragraphParent = paragraph.parent();

            if (paragraphParent.prop('tagName').toLowerCase() === 'td' && !tableFound) {
                tableFound = true;
                const tableTag = paragraphParent.parent().parent().parent();

                const markdownTable = convertHtmlTableToMarkdown(tableTag);
                if (t === 1) {
                    console.log('--------------------------');
                    console.log();
                    console.log(markdownTable);
                    console.log();
                    console.log('--------------------------');
                    t++;
                }

                clearParagraphs.push(markdownTable);
            } else {
                if (tableFound) {
                    tableFound = false;
                }

                let clearParagraph = paragraph.text()
                    .replace(/[\n\t]+/g, ' ')
                    .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                    .replace(/(\[\d+]?)/g, '')
                    .replace(/\.(,)/g, '.')
                    .replace('  ', ' ')
                    .trim();

                if (clearParagraph && clearParagraph !== "") {
                    clearParagraphs.push(clearParagraph);
                }
            }
        });

        let dataString = clearParagraphs.join(' ');

        return { title, dataString, url }; // Return title, content, and url
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function main() {
    const baseUrl = 'https://prsindia.org/billtrack';
    let targetUrl = `${baseUrl}`;

    try {
        const response = await axios.get(targetUrl);
        const htmlContent = response.data;

        const $ = cheerio.load(htmlContent);
        const elements = $('.cate a').map((index, element) => {
            const href = $(element).attr('href');
            return href.startsWith('/billtrack') ? `https://prsindia.org${href}` : href;
        }).get();

        for (const element of elements) {
            const newsItem = await getData(element);
            if (newsItem) {
                const urlExists = await checkIfUrlExists(newsItem.url);
                if (!urlExists) {
                    await saveToSupabase(newsItem.title, newsItem.dataString, newsItem.url);
                }
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

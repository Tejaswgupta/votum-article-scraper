const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const supabase = require('./supabaseClient');

async function checkIfExists(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('url')
        .eq('url', url);

    if (error) {
        console.error('Error checking URL existence:', error);
        return false;
    }
    return data.length > 0;
}

async function saveToSupabase(title, content, url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .insert([{ title, content, url }]);

    if (error) {
        console.error('Error saving data to Supabase:', error);
    }
}

function hindiMoreThanXPercents(inputString, maxPercentage = 40) {
    const hindiRegex = /[\u0900-\u097F]/g;
    const hindiSymbolsCount = (inputString.match(hindiRegex) || []).length;
    const percentage = (hindiSymbolsCount / inputString.length) * 100;
    return percentage > maxPercentage;
}

async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.homeTitle h1').text().trim();
        const paragraphs = $('.fsize16 p, .fsize16 ul li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.some((paragraph) => {
            let clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/\[.*?]/g, '')
                .replace('  ', ' ')
                .trim();

            if (
                (clearParagraph === 'Authors:') ||
                (clearParagraph.includes('****')) ||
                (clearParagraph.toLowerCase().includes('the author is')) ||
                (clearParagraph.toLowerCase().includes('the author of')) ||
                (clearParagraph.toLowerCase().includes('author can be'))
            ) {
                return true;
            }

            if (clearParagraph.includes('Author can be ')) {
                console.log('try 2: ' + url)
                return true;
            }
            if (clearParagraph.includes('Author can be ')) {
                console.log(url);
            }

            if (/^[0-9]\) [^a-z]*[A-Z][^a-z]*$/.test(clearParagraph)) {
                clearParagraph = '**' + clearParagraph.slice(0, 3) + clearParagraph.slice(3) + '**\n\n';
            } else if (/^[A-Z]\./.test(clearParagraph)) {
                clearParagraph = '**' + clearParagraph.slice(0, 3) + '<u>' + clearParagraph.slice(3) + '</u>**\n\n';
            } else if (clearParagraph[0] === '♦') {
                clearParagraph = '  - ' + clearParagraph.slice(1) + '\n\n';
            } else if (clearParagraph[0] === '→') {
                clearParagraph = '    - ' + clearParagraph.slice(1) + '\n\n';
            }

            if (clearParagraph && clearParagraph !== "") {
                clearParagraphs.push(clearParagraph);
            }

            return false;
        });

        let dataString = clearParagraphs.join(' ');

        if (hindiMoreThanXPercents(title, 20) && hindiMoreThanXPercents(dataString, 30)) {
            return null;
        }

        const newsItem = {
            title,
            content: dataString,
            url
        };

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;  
    }
}

async function main() {
    let i = 1;

    while (i <= 4474) {
        const baseUrl = 'https://taxguru.in/type/articles';
        let targetUrl = `${baseUrl}`;
 
        if (i > 1) {
            targetUrl = `${baseUrl}/page/${i}/`;
        }
        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('.newsBoxPostTitle a').map((index, element) => $(element).attr('href')).get();
            
            const tasks = elements.map(async (element) => {
                const newsItem = await getData(element);
                if (newsItem && !(await checkIfExists(newsItem.url))) {
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

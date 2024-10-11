const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('./supabaseClient');

async function checkIfExists(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('url')
        .eq('url', url)
        .single();

    return data ? true : false;
}

async function saveToSupabase(title, content, url) {
    const { error } = await supabase
        .from('votum_article_scrapers')
        .insert([{ title, content, url }]);

    if (error) {
        console.error('Error saving to Supabase:', error);
    }
}

async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.entry-title').text()
            .replace('\xa0', ' ')
            .replace(/[\n\t]+/g, ' ')
            .trim();
        const paragraphs = $('.entry-content p:not(:has(mark)):not(.ez-toc-title), .entry-content h2, .entry-content ol li')
            .map((index, element) => $(element).text())
            .get();

        let clearParagraphs = [];
        paragraphs.forEach((paragraph) => {
            let clearParagraph = paragraph
                .replace(/&nbsp;/g, ' ')
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/(\[.*]?)/g, '')
                .trim();

            if (clearParagraph) {
                clearParagraphs.push(clearParagraph);
            }
        });

        let dataString = clearParagraphs.join(' ');

        return { title, content: dataString, url };
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function main() {
    const baseUrl = 'https://strictlylegal.in/blog/';
    const targetUrl = baseUrl;

    try {
        const response = await axios.get(targetUrl);
        const htmlContent = response.data;

        const $ = cheerio.load(htmlContent);
        const elements = $('h4.uagb-post__title a').map((index, element) => $(element).attr('href')).get();

        const tasks = elements.map(async (element) => {
            const data = await getData(element);
            if (data) {
                const exists = await checkIfExists(data.url);
                if (!exists) {
                    await saveToSupabase(data.title, data.content, data.url);
                }
            }
        });
        
        await Promise.all(tasks);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

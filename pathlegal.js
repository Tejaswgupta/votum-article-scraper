// https://www.pathlegal.in/ - pathlegal, Web Scrapping

const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('./supabaseClient'); // Importing the Supabase client

async function urlExists(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('url')
        .eq('url', url)
        .single();

    return data !== null; // Returns true if the URL exists
}

async function getData(url) {
    if (!url.startsWith('https://www.pathlegal.in')) return;

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.in-head').text().replace('  ', ' ').trim();
        const paragraphs = $('.qa_content p').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .trim();

            if ((clearParagraph) && (clearParagraph !== "")) {
                clearParagraphs.push(clearParagraph);
            }
        });

        const englishPattern = /^[a-zA-Z !@#$%^&*()_+{}\[\]:;<>,.?~\\/\n-]*$/;

        // Join paragraphs and clean up unwanted characters
        let dataString = clearParagraphs.join(' ');

        if (!dataString || !englishPattern.test(dataString)) {
            return null;
        }

        return { title, dataString, url };
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;
    }
}

async function saveToSupabase(article) {
    const { title, dataString, url } = article;

    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .insert([{ title, content: dataString, url }]);

    if (error) {
        console.error('Error saving to Supabase:', error.message);
    }
}

async function main() {
    const pageSize = 20;
    let currentPage = 1;
    let currentElementsN = 20;

    while (currentElementsN === pageSize) {
        const baseUrl = 'https://www.pathlegal.in/legal_law_help.php?main=any&key=A00000001';
        let targetUrl = `${baseUrl}&offset=${currentPage}`;

        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('span.name a').map((index, element) => {
                let href = $(element).attr('href');
                return `https://www.pathlegal.in/${href}`; 
            }).get();

            currentElementsN = elements.length;

            for (const element of elements) {
                const article = await getData(element);
                if (article && !(await urlExists(article.url))) {
                    await saveToSupabase(article);
                }
            }

            currentPage++;
        } catch (error) {
            console.error('Error:', error.message);
            break;
        }
    }
}

main();

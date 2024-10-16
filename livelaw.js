const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const supabase = require('./supabaseClient');

async function checkIfUrlExists(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('url')
        .eq('url', url)
        .single();

    return data && !error; // Returns true if data exists
}

async function saveToSupabase(title, content, url) {
    const { data, error } = await supabase
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
        const jsons = $('script[type="application/ld+json"]')
            .map((index, element) => {
                return JSON.parse($(element).text());
            }).get();

        const article = jsons
            .filter(obj => obj['@type'] == 'NewsArticle')[0];

        return {
            'headline': article['headline'],
            'data': article['articleBody'].replace('    ', '\n'),
            'url': url
        };
    } catch (error) {
        console.error('Website page not found:', url);
        return null;
    }
}

async function main() {
    let i = 1;

    while (i <= 297) {
        const baseUrl = 'https://www.livelaw.in/articles';
        let targetUrl = `${baseUrl}/${i}`;
        console.log(`${i}`);

        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);

            // Use a Set to store unique URLs
            const uniqueUrls = new Set();

            const elements = $('div.homepage_supreme_court_cntr2 a').map((index, element) => {
                let href = $(element).attr('href');
                let fullUrl = `https://www.livelaw.in/articles${href}`;

                // Add the URL to the Set, which automatically ensures uniqueness
                uniqueUrls.add(fullUrl);

                // Return the full URL for further processing
                return fullUrl; 
            }).get();

            if (elements.length === 0) {
                break; // No more pages
            }

            // Convert the Set back to an array if needed
            const uniqueElements = [...uniqueUrls].filter(url => url.split('-').length - 1 > 3 && url.includes('article'));

            for (const element of uniqueElements) {
                const exists = await checkIfUrlExists(element);
                if (!exists) {
                    const articleData = await getData(element);
                    if (articleData) {
                        await saveToSupabase(articleData.headline, articleData.data, articleData.url);
                    }
                } else {
                    console.log(`Skipping already existing URL: ${element}`);
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

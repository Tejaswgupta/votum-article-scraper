const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('./supabaseClient');

async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.entry-title').text().trim(); 
        const paragraphs = $('.post-content p, .post-content h2, .post-content li').map((index, element) => $(element).text()).get();
  
        // Join paragraphs and clean up unwanted characters
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

        const newsItem = {
            'title': title,
            'content': dataString,
            'url': url
        };

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function saveToSupabase(item) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .insert(item);

    if (error) {
        console.error('Error saving data to Supabase:', error);
    } else {
        console.log('Data saved to Supabase:', data);
    }
}

async function main() {
    let i = 1;

    while (i <= 174) {
        const baseUrl = 'https://www.legalraasta.com/blog/';
        let targetUrl = `${baseUrl}`;
 
        if (i > 1) { 
            targetUrl = `${baseUrl}page/${i}/`;
        }

        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('h2.entry-title a').map((index, element) => $(element).attr('href')).get();
            
            for (const element of elements) {
                // Check if the URL already exists in Supabase
                const { data: existingData, error: fetchError } = await supabase
                    .from('votum_article_scrapers')
                    .select('url')
                    .eq('url', element)
                    .single();

                if (fetchError) {
                    console.error('Error checking URL in Supabase:', fetchError);
                    continue; // Skip this URL if there's an error
                }

                // If data does not exist, scrape and save it
                if (!existingData) {
                    const newsItem = await getData(element);
                    if (newsItem) {
                        await saveToSupabase(newsItem);
                    }
                } else {
                    console.log('URL already exists, skipping:', element);
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

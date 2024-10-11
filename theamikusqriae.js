const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('./supabaseClient'); // Import the Supabase client

async function getData(url) {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const paragraphsAll = $('.entry-title h1, .entry-content:not(form) > p:not(:has(em))');

        paragraphsAll.each(function () {
            const updatedParagraph = $(this).html().replace(/<br>/g, ' ');
            $(this).html(updatedParagraph);
        });

        const paragraphs = paragraphsAll.map((index, element) => $(element).text()).get();

        let clearParagraphs = [];
        paragraphs.some((paragraph) => {
            let clearParagraph = paragraph
                .replace(/&nbsp;/g, ' ')
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/(\[.*]?)/g, '')
                .replace('  ', ' ')
                .trim();

            if (
                (clearParagraph.includes('Author:')) ||
                (clearParagraph.includes('Author ')) ||
                (clearParagraph.includes('University:')) ||
                (clearParagraph.includes('College ')) ||
                (clearParagraph.includes('Faculty Conveners:')) ||
                (clearParagraph === 'Ujjaini Biswas') ||
                (clearParagraph === 'Samridhi Srivastava')
            ) {
                return true;
            }

            if (clearParagraph && clearParagraph.trim() !== "") {
                clearParagraphs.push(clearParagraph);
            }
        });

        let dataString = clearParagraphs.join(' ');
        return dataString; // Return the concatenated paragraphs
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function main() {
    const baseUrl = 'https://theamikusqriae.com/legal-articles/';
    let targetUrl = `${baseUrl}`;

    try {
        const response = await axios.get(targetUrl);
        const htmlContent = response.data;

        const $ = cheerio.load(htmlContent);
        const elements = $('.elementor-post__title a').map((index, element) => $(element).attr('href')).get();

        for (const element of elements) {
            const content = await getData(element);
            if (content) {
                // Check if the URL already exists in the Supabase table
                const { data: existingData, error: fetchError } = await supabase
                    .from('votum_article_scrapers')
                    .select('url')
                    .eq('url', element);

                if (fetchError) {
                    console.error('Error checking existing data:', fetchError);
                    continue;
                }

                // If the URL does not exist, insert the new article
                if (existingData.length === 0) {
                    const title = $('.entry-title h1').text(); // Fetch title from the page
                    const { error: insertError } = await supabase
                        .from('votum_article_scrapers')
                        .insert([{ title, content, url: element }]);

                    if (insertError) {
                        console.error('Error inserting data:', insertError);
                    } else {
                        console.log(`Saved article: ${title} - ${element}`);
                    }
                } else {
                    console.log(`Article already exists for URL: ${element}`);
                }
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

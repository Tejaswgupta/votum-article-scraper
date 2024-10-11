const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const supabase = require('./supabaseClient');

async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('h1.entry-title').text().trim();
        const paragraphs = $('.entry-content p, .entry-content h2, .entry-content ol li, .entry-content h3').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];
        paragraphs.forEach((paragraph) => {
            let clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .trim();

            if (paragraph && paragraph.trim() !== "") {
                clearParagraphs.push(clearParagraph);
            }
        });

        let dataString = clearParagraphs.join(' ');

        return {
            title: title,
            content: dataString,
            url: url
        };
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;
    }
}

async function main() {
    const baseUrl = `https://www.scconline.com/post/category/casebriefs/`;

    try {
        const response = await axios.get(baseUrl);
        const htmlContent = response.data;

        const $ = cheerio.load(htmlContent);
        const elements = $('h2.entry-title a').map((index, element) => $(element).attr('href')).get();

        const tasks = elements.map(element => getData(element));
        const dataList = await Promise.all(tasks); 

        for (const item of dataList) {
            if (item) {
                const { data, error } = await supabase
                    .from('votum_article_scrapers')
                    .select('url')
                    .eq('url', item.url)
                    .single();

                if (!error && data) {
                    console.log(`Data for URL already exists: ${item.url}`);
                } else {
                    const { error: insertError } = await supabase
                        .from('votum_article_scrapers')
                        .insert([{
                            title: item.title,
                            content: item.content,
                            url: item.url
                        }]);
                    
                    if (insertError) {
                        console.error('Error inserting data:', insertError);
                    } else {
                        console.log(`Inserted data for URL: ${item.url}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

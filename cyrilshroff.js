// https://www.cyrilshroff.com/blogs/ - cyrilshroff, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;
const supabase = require('./supabaseClient');

const urls = new Set([]);

function saveUrls(urls) {
    fs.writeFileSync('urls.json', JSON.stringify([...urls], null, 2), 'utf-8');
}

async function saveToSupabase(data) {
    const { headline, dataString, url } = data;

    const { error } = await supabase
        .from('votum_article_scrapers')
        .upsert({ title: headline, content: dataString, url });

    if (error) {
        console.error('Error saving to Supabase:', error.message);
    } else {
        console.log(`Data saved to Supabase for URL: ${url}`);
    }
}

async function getData(url) {
    if (urls.has(url)) {
        return null;
    }
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('h1.lxb_af-template_tags-get_post_title').text().trim();

        // Select and extract text from <p> elements inside the div with id 'content'
        const paragraphs = $('.lxb_af-post_content p, .lxb_af-post_content h3, .lxb_af-post_content h4, .lxb_af-post_content ul li, .lxb_af-post_content ol li, .lxb_af-post_content table').map((index, element) => {
            if (element.tagName === 'table') {
                return "\n" + NodeHtmlMarkdown.translate(`<table>${$(element).html()}</table>`) + "\n";
            }
            return $(element).find("br").replaceWith("\n").end().text();
        }).get();
  
        // Join paragraphs and clean up unwanted characters
        let dataString = paragraphs.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ');
        dataString = dataString.trimStart();
 
        const newsItem = {
            headline: title,
            dataString: dataString,
            url: url
        };

        console.log(`Done: ${urls.size}`);
        urls.add(url);
        saveUrls([...urls]);

        await saveToSupabase(newsItem);

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;  // Return null for unsuccessful requests
    }
}

// Main function for handling blog pages
async function main() {
    const subblogs = ['disputeresolution', 'corporate', 'privateclient', 'tax', 'competition'];
    const subblogTasks = subblogs.map(async (subblog) => {
        let blogPageUrl = `https://${subblog}.cyrilamarchandblogs.com/`;
        while (true) {
            console.log(blogPageUrl);
            const response = await axios.get(blogPageUrl);
            const htmlContent = response.data;
            const $ = cheerio.load(htmlContent);
            const elements = $('h1.lxb_af-template_tags-get_linked_post_title > a').map((index, element) => $(element).attr('href')).get();
            const tasks = elements.map(element => getData(element));
            await Promise.all(tasks);  // Wait for all data to be fetched and saved
            try {
                const nextPageUrl = $('a.lxb_af-template_tags-get_pagination-button-older').map((index, element) => $(element).attr('href')).get()[0];
                blogPageUrl = nextPageUrl;
            } catch (err) {
                // No next page url, end of pages
                break;
            }
        }
    });
    await Promise.all(subblogTasks);
    process.exit();
}

main();

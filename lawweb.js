const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('./supabaseClient');

const urls = new Set([]);

async function checkUrlExists(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('url')
        .eq('url', url)
        .single();

    if (error) {
        console.error('Error checking URL existence:', error);
        return false;
    }
    return data !== null;
}

async function saveData(title, content, url) {
    const { error } = await supabase
        .from('votum_article_scrapers')
        .insert([{ title, content, url }]);

    if (error) {
        console.error('Error saving data:', error);
    }
}

async function getData(url) {
    if (urls.has(url) || await checkUrlExists(url)) {
        return null;
    }
    try {
        const response = await axios.get(url);
        console.log(`article resp: ${response.status}`);
        const $ = cheerio.load(response.data);

        const title = $('h3.entry-title').text().trim();
        const elements = $('.post-body p').map((index, element) => $(element).text()).get();

        let dataString = elements.join('\n').replace(/[\t]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]+/g, ' ').trim();

        if (dataString.startsWith("https://drive.google.com")) {
            console.log(`${dataString.slice(0, 50)}: ${url}; OOPS< DRIVE< BAILING`);
            return null;
        }

        await saveData(title, dataString, url);
        console.log(`Saved: ${title} - ${url}`);
        urls.add(url);

        return { title, content: dataString };
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;
    }
}

async function main() {
    let i = 1;
    const max = 4019;

    while (i <= max) {
        const baseUrl = 'https://www.lawweb.in';
        let targetUrl = `${baseUrl}/`;

        if (i > 1) {
            targetUrl = `${baseUrl}/search?updated-max=2023-11-14T18%3A14%3A00%2B05%3A30&max-results=50#PageNo=${i}`;
        }
        try {
            console.log(targetUrl);
            const response = await axios.get(targetUrl);
            console.log(response.status);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('h3.entry-title a').map((index, element) => $(element).attr('href')).get();
            const tasks = elements.map(element => getData(element));

            await Promise.all(tasks);
            i++;
        } catch (error) {
            console.error('Error:', error);
            break;
        }
    }
}

main();

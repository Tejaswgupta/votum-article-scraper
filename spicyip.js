const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('./supabaseClient');

async function checkExistingData(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('url')
        .eq('url', url)
        .single();
        
    if (error) {
        console.error('Error checking existing data:', error);
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

async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('h3.entry-title').text().trim();
        const elements = $('.entry-content p').map((index, element) => $(element).text()).get();

        let clearElements = [];

        elements.forEach((element) => {
            let clearElement = element
                .replace(/[\n\t\r]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/\[.*?].?/g, '')
                .trim();

            if (clearElement && clearElement !== "") {
                clearElements.push(clearElement);
            }
        });

        let dataString = clearElements.join(' ');

        return { title, dataString, url };
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null; // Return null for unsuccessful requests
    }
}

async function main() {
    let i = 1;

    while (i <= 631) {
        const baseUrl = 'https://spicyip.com';
        let targetUrl = `${baseUrl}/`;
 
        if(i > 1) {
            targetUrl = `https://spicyip.com/page/${i}`;
        }
        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('h2.entry-title a').map((index, element) => $(element).attr('href')).get();
            
            const tasks = elements.map(async (element) => {
                const { title, dataString } = await getData(element);
                if (title && await checkExistingData(element)) {
                    console.log(`Data already exists for URL: ${element}`);
                } else {
                    await saveToSupabase(title, dataString, element);
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

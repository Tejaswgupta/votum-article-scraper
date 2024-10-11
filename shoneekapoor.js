const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('./supabaseClient');

async function checkIfExists(url) {
    const { data, error } = await supabase
        .from('votum_article_scrapers')
        .select('*')
        .eq('url', url)
        .single();

    return data ? true : false;
}

async function saveData(title, content, url) {
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

        const title = $('.auto-container h1').text().trim();
        const paragraphs = $('.text p, .text ol li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];
        paragraphs.forEach((paragraph) => {
            let clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ').replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/[\n\r\t]+/g, ' ')
                .replace(/<iframe.*<\/iframe>/g)
                .replace('  ', ' ')
                .trim();

            if (clearParagraph && clearParagraph.trim() !== "" && !hindiMoreThanXPercents(clearParagraph)) {
                clearParagraphs.push(clearParagraph);
            }
        });
        let dataString = clearParagraphs.join(' ');

        if (hindiMoreThanXPercents(title) || hindiMoreThanXPercents(dataString)) {
            return null;
        }

        return { title, content: dataString, url };
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;
    }
}

async function main() {
    let i = 1;
    const baseUrl = 'https://www.shoneekapoor.com/articles/';
    const url = 'https://www.shoneekapoor.com/wp-admin/admin-ajax.php';
    const headers = {
        'authority': 'www.shoneekapoor.com',
        'accept': '*/*',
        'accept-language': 'uk-UA,uk;q=0.9,en-UA;q=0.8,en;q=0.7,ru-UA;q=0.6,ru;q=0.5,en-US;q=0.4',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
    };

    let hasNextPage = true;

    while (hasNextPage) {
        try {
            let data = `action=load_more&class=Essential_Addons_Elementor%5CElements%5CPost_Grid&args=orderby%3Ddate%26order%3Ddesc%26ignore_sticky_posts%3D1%26post_status%3Dpublish%26posts_per_page%3D10%26offset%3D0%26post_type%3Dpost%26tax_query%255B0%255D%255Btaxonomy%255D%3Dcategory%26tax_query%255B0%255D%255Bfield%255D%3Dterm_id%26tax_query%255B0%255D%255Bterms%255D%255B0%255D%3D27%26tax_query%255Brelation%255D%3DAND&page_id=54787&widget_id=4129d613&nonce=f9d112b6b6&template_info%5Bdir%5D=lite&template_info%5Bfile_name%5D=default.php&template_info%5Bname%5D=Post-Grid&page=${i}`;
            const response = await axios.post(url, data, { headers: headers });
            const htmlContent = response.data;

            const $ = cheerio.load(htmlContent);
            const elements = $('span.eael-entry-title a').map((index, element) => $(element).attr('href')).get();

            if (elements.length === 0) {
                hasNextPage = false;
                break;
            }

            const tasks = elements.map(async (element) => {
                const scrapedData = await getData(element);
                if (scrapedData && !(await checkIfExists(scrapedData.url))) {
                    await saveData(scrapedData.title, scrapedData.content, scrapedData.url);
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

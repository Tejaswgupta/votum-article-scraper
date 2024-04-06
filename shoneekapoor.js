// https://shoneekapoor.com/ - shoneekapoor, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'shoneekapoor.json';

function updateFile(dataList) {
    const filePath = path.join(__dirname, fileName);

    let existingData = [];

    try {
        const existingDataString = fs.readFileSync(filePath, 'utf-8');

        if (existingDataString.trim() !== '') {
            existingData = JSON.parse(existingDataString);
        }
    } catch (error) {
        console.log('Error reading existing data:', error);
    }

    // Filter out null values before combining data
    const validDataList = dataList.filter(item => item !== null);

    const combinedData = existingData.concat(validDataList)

    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2), 'utf-8');
}

function hindiMoreThanXPercents(inputString, maxPercentage=10) {
    const hindiRegex = /[\u0900-\u097F]/g;

    const hindiSymbolsCount = (inputString.match(hindiRegex) || []).length;
    const percentage = (hindiSymbolsCount / inputString.length) * 100;
    return percentage > maxPercentage;
}

async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.auto-container h1').text().trim();

        const paragraphs = $('.text p, .text ol li').map((index, element) => $(element).text()).get();


        // Join paragraphs and clean up unwanted characters
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
        })
        let dataString = clearParagraphs.join(' ');

        const newsItem = {
            'headline': title,
            'data': dataString
        };


        if (hindiMoreThanXPercents(title) || hindiMoreThanXPercents(dataString))
        {
            return null;
        }

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;
    }
}

async function main() {
    let i = 1;

    const baseUrl = 'https://www.shoneekapoor.com/articles/'
    const url = 'https://www.shoneekapoor.com/wp-admin/admin-ajax.php'
    const headers = {
        'authority': 'www.shoneekapoor.com',
        'accept': '*/*',
        'accept-language': 'uk-UA,uk;q=0.9,en-UA;q=0.8,en;q=0.7,ru-UA;q=0.6,ru;q=0.5,en-US;q=0.4',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
    }

    let hasNextPage = true;

    while (hasNextPage) {
        try {
            let data = `action=load_more&class=Essential_Addons_Elementor%5CElements%5CPost_Grid&args=orderby%3Ddate%26order%3Ddesc%26ignore_sticky_posts%3D1%26post_status%3Dpublish%26posts_per_page%3D10%26offset%3D0%26post_type%3Dpost%26tax_query%255B0%255D%255Btaxonomy%255D%3Dcategory%26tax_query%255B0%255D%255Bfield%255D%3Dterm_id%26tax_query%255B0%255D%255Bterms%255D%255B0%255D%3D27%26tax_query%255Brelation%255D%3DAND&page_id=54787&widget_id=4129d613&nonce=f9d112b6b6&template_info%5Bdir%5D=lite&template_info%5Bfile_name%5D=default.php&template_info%5Bname%5D=Post-Grid&page=${i}`;
            const response = await axios.post(url, data, {headers: headers});
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `shoneekapoor.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            const $ = cheerio.load(htmlContent);
            const elements = $('span.eael-entry-title a').map((index, element) => $(element).attr('href')).get();

            if (elements.length === 0) {
                hasNextPage = false;
                break;
            }

            const tasks = elements.map(element => getData(element));
            const dataList = await Promise.all(tasks); // for parallelizing content, concurrent api calls, and fast/efficient way of extracting data

            updateFile(dataList);

            i++;
        } catch (error) {
            console.error('Error:', error.message);
            break
        }
    }

}

main();
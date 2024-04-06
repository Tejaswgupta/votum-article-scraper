// https://taxguru.in/type/articles - taxguru, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'taxguru.json';


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

function hindiMoreThanXPercents(inputString, maxPercentage=40) {
    const hindiRegex = /[\u0900-\u097F]/g;

    const hindiSymbolsCount = (inputString.match(hindiRegex) || []).length;
    const percentage = (hindiSymbolsCount / inputString.length) * 100;
    return percentage > maxPercentage;
}
 
async function getData(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.homeTitle h1').text().trim();
        const paragraphs = $('.fsize16 p, .fsize16 ul li').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.some((paragraph) => {
            let clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .replace(/\[.*?]/g, '')
                .replace('  ', ' ')
                .trim();

            if (
                (clearParagraph === 'Authors:') ||
                (clearParagraph.includes('****')) ||
                (clearParagraph.toLowerCase().includes('the author is')) ||
                (clearParagraph.toLowerCase().includes('the author of')) ||
                (clearParagraph.toLowerCase().includes('author can be'))
            ) {
                return true;
            }

            if (clearParagraph.includes('Author can be ')) {
                console.log('try 2: ' + url)
                return true;
            }
            if (clearParagraph.includes('Author can be ')) {
                console.log(url);
            }

            if (/^[0-9]\) [^a-z]*[A-Z][^a-z]*$/.test(clearParagraph)) {
                clearParagraph = '**' + clearParagraph.slice(0, 3) + clearParagraph.slice(3) + '**\n\n';
            } else if (/^[A-Z]\./.test(clearParagraph)) {
                clearParagraph = '**' + clearParagraph.slice(0, 3) + '<u>' + clearParagraph.slice(3) + '</u>**\n\n';
            } else if (clearParagraph[0] === '♦') {
                clearParagraph = '  - ' + clearParagraph.slice(1) + '\n\n';
            } else if (clearParagraph[0] === '→') {
                clearParagraph = '    - ' + clearParagraph.slice(1) + '\n\n';
            }


            if (clearParagraph && clearParagraph !== "") {
                clearParagraphs.push(clearParagraph);
            }

            return false;
        })

        let dataString = clearParagraphs.join(' ');

        if (hindiMoreThanXPercents(title, 20) && hindiMoreThanXPercents(dataString, 30)) {
            return null;
        }

        const newsItem = {
            'headline': title, 
            'data': dataString
        };

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;  
    }
}

async function main() {
    let i = 1;

    while (i <= 4474) {
        const baseUrl = 'https://taxguru.in/type/articles';
        let targetUrl = `${baseUrl}`;
 
        if(i > 1) {
            targetUrl = `${baseUrl}/page/${i}/`
        }
        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `taxguru.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            // Continue with the rest of your processing
            const $ = cheerio.load(htmlContent);
            const elements = $('.newsBoxPostTitle a').map((index, element) => $(element).attr('href')).get();
            
            const tasks = elements.map(element => getData(element));
            const dataList = await Promise.all(tasks);

            updateFile(dataList);
 
            i++;
        } catch (error) {
            console.error('Error:', error.message);
            break;
        }
    }
}

main();
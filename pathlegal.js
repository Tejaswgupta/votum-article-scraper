// https://www.pathlegal.in/ - pathlegal, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'pathlegal.json';

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
    if(!url.startsWith('https://www.pathlegal.in')) return;

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const title = $('.in-head').text().replace('  ', ' ').trim();
        const paragraphs = $('.qa_content p').map((index, element) => $(element).text()).get();

        let clearParagraphs = [];

        paragraphs.forEach((paragraph) => {
            const clearParagraph = paragraph
                .replace(/[\n\t]+/g, ' ')
                .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
                .trim();

            if ((clearParagraph) && (clearParagraph !== "")) {
                clearParagraphs.push(clearParagraph);
            }
        })

        const englishPattern = /^[a-zA-Z !@#$%^&*()_+{}\[\]:;<>,.?~\\/\n-]*$/;

        // Join paragraphs and clean up unwanted characters
        let dataString = clearParagraphs.join(' ');

        const newsItem = {
            'headline': title,
            'data': dataString
        };

        if (
            (hindiMoreThanXPercents(title) || hindiMoreThanXPercents(dataString)) ||
            !dataString ||
            !englishPattern.test(dataString)
        ) {
            return null;
        }

        return newsItem;
    } catch (error) {
        console.error('Error fetching data from:', url);
        return null;
    }
}

async function main() {

    const pageSize = 20;
    let currentPage = 1;
    let currentElementsN = 20;

    while (currentElementsN === pageSize) {
        const baseUrl = 'https://www.pathlegal.in/legal_law_help.php?main=any&key=A00000001';
        let targetUrl = `${baseUrl}&offset=${currentPage}`;

        try {
            const response = await axios.get(targetUrl);
            const htmlContent = response.data;

            // Save HTML content to a file
            const fileName = `pathlegal.html`;  // for sitemap, better for web scrawling
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            const $ = cheerio.load(htmlContent);
            const elements = $('span.name a').map((index, element) => {
                let href = $(element).attr('href');
                return `https://www.pathlegal.in/${href}`; 
            }).get();

            currentElementsN = elements.length;
            
            const tasks = elements.map(element => getData(element));
            const dataList = await Promise.all(tasks); // concurrent API requests for parallelizing
            
            updateFile(dataList);

            currentPage++;
        } catch (error) {
            console.error('Error:', error.message);
            break;
        }
    }
}

main(); 
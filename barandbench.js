// https://www.barandbench.com/ - barandbench 

// * NO JSON FILE FOR THIS REQUIRES SUBSCRIPTION, TEJAS DENIED FOR WRITING SCRAPPER FOR THIS *

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');
const NHM = require('node-html-markdown');
const NodeHtmlMarkdown = NHM.NodeHtmlMarkdown;

const fileName = 'barandbench.json';

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

    const combinedData = existingData.concat(dataList);

    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2), 'utf-8');
}

async function main() {
    let totalCount = undefined;
    let i = 1;
    let receivedCount = 0;
    const perPage = 20;
    while (totalCount === undefined || receivedCount < totalCount) {
        const response = (await axios.get(`https://www.barandbench.com/api/v1/collections/news?item-type=story&offset=${receivedCount}&limit=${perPage}`)).data;
        if (totalCount === undefined) {
            totalCount = response['total-count'];
        }
        const stories = response['items'].map(item => {
            let paragraphs = item['story']['cards'].map(card => card['story-elements'].map(ste => ste['text'])).join(' ');
            paragraphs = paragraphs.replaceAll('</p><p>', '</p>&nbsp;<p>');
            return {
                'headline': item['story']['headline'],
                'data': NodeHtmlMarkdown.translate(cheerio.load(paragraphs).root().html())
            }
        });
        updateFile(stories);
        receivedCount += perPage;
    }
}

main(); 
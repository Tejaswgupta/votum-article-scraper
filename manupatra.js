// https://articles.manupatra.com/ - manupatra, Web Scrapping

const axios = require('axios');
const path = require('path'); 
const fs = require('fs');

const fileName = 'manupatra.json';

function updateFile(dataList) {
    const filePath = path.join(__dirname, fileName);

    let existingData = [];

    try {
        const existingDataString = fs.readFileSync(filePath, 'utf-8');

        if (existingDataString.trim() !== '') {
            existingData = JSON.parse(existingDataString);
        }
    } catch (error) {
        console.log('Error reading existing data');
    }

    // Filter out null values before combining data
    const validDataList = dataList.filter(item => item !== null);

    const combinedData = existingData.concat(validDataList);

    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2), 'utf-8');
}

async function getArticleId(title) {
    if (!title) return '';

    const apiUrl = 'https://articles.manupatra.com/api/Articles/ArticleIdByTitleAsync';

    const currentDate = new Date(Date.now());
    const formattedDate = currentDate.toISOString();

    const apiPayload = {
        "ArticleCategoryID": "",
        "ArticleCategoryName": "",
        "AuthorName": "",
        "SubjectId": "",
        "SubjectName": "",
        "TitleName": title,
        "FullText": "",
        "Tags": "",
        "JournalId": "",
        "Firm": "",
        "NewsLetterId": "",
        "ByDate": formattedDate,
        "Year": "",
        "ArticleId": "",
        "MailId": "",
        "PageNumber": 0,
        "VerificationCode": ""
    };

    try {
        const response = await axios.post(apiUrl, apiPayload); 
        const articleData = await getArticleData(response?.data?.uArticleGuid);

        return articleData;
    } catch (error) {
        console.error('Error fetching data from API:', apiUrl );
        return null; 
    }
}

async function getArticleData(articleId) {
    if (!articleId) return '';

    const apiUrl = 'https://articles.manupatra.com/api/Articles/GetDataByCategoryIdDisplayAsync';

    const currentDate = new Date(Date.now());
    const formattedDate = currentDate.toISOString();

    const apiPayload = {
        "ArticleCategoryID": "1",
        "ArticleCategoryName": "",
        "AuthorName": "",
        "SubjectId": "",
        "SubjectName": "",
        "TitleName": "",
        "FullText": "",
        "Tags": "",
        "JournalId": "",
        "Firm": "",
        "NewsLetterId": "",
        "ByDate": formattedDate,
        "Year": "",
        "ArticleId": articleId,
        "MailId": "",
        "PageNumber": 0,
        "VerificationCode": ""
    };

    try {
        const response = await axios.post(apiUrl, apiPayload);
        return response?.data?.vPara;
    } catch (error) {
        console.error('Error fetching data from API:', apiUrl );
        return '';  
    }
}

async function scrapePage(pageNumber) {
    const apiUrl = 'https://articles.manupatra.com/api/Articles/GetDataByCategoryIdAsync';

    const currentDate = new Date(Date.now());
    const formattedDate = currentDate.toISOString();

    const payload = {
        "ArticleCategoryID": "1",
        "ArticleCategoryName": "",
        "AuthorName": "",
        "SubjectId": "",
        "SubjectName": "",
        "TitleName": "",
        "FullText": "",
        "Tags": "",
        "JournalId": "",
        "Firm": "",
        "NewsLetterId": "",
        "ByDate": formattedDate,
        "Year": "",
        "ArticleId": "",
        "MailId": "",
        "PageNumber": pageNumber,
        "VerificationCode": ""
    };

    try {
        const response = await axios.post(apiUrl, payload);

        const dataList = await Promise.all(response.data.map(async item => {

            console.log(item)

            return {
                headline: item.vTitle.trim(),
                Paragraph: item.vPara.replace(/[\n\r\t]+/g, ' ').replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ').trim()
            };
        }));

        return dataList;
    } catch (error) {
        console.error('Error fetching data from API:', apiUrl );
        throw null;
    }
}

async function main() {
    const maxPages = 180;
    const promises = [];

    for (let i = 1; i <= maxPages; i++) {
        promises.push(scrapePage(i).then(dataList => updateFile(dataList)));
    }

    try {
        // Wait for all promises to resolve, for parallelizing the scraping
        await Promise.all(promises);
        console.log('Scraping completed successfully.');
    } catch (error) {
        if (error && error.message) {
            console.error('Error:', error.message);
        } else {
            console.error('An unknown error occurred:', error);
        }
    }
}

main();
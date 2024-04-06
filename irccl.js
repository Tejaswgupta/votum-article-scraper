// https://www.irccl.in/blog - irccl, Web Scrapping

const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const fs = require('fs');

const fileName = 'irccl.json';

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

    const combinedData = existingData.concat(validDataList);

    fs.writeFileSync(filePath, JSON.stringify(combinedData, null, 2), 'utf-8');
}
 
async function getData(posts) {
    try {
        const newsItems = [];

        // Loop over the arrays and create pairs
        posts.forEach(post => {
            let dataString = post['content']['blocks'].map(block => block['text']).filter(para => {
                return para.length && !/\[.* (is|are) ?a? .* at .*\]/g.test(para);
            }).join('\n').replace(/[\t\u200B-\u200D\uFEFF]+/g, ' ');
            const newsItem = {
                'headline': post['title'],
                'paragraph': dataString
            };
            newsItems.push(newsItem);
        });

        return newsItems;
    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
}

async function main() {
    let page = 1;
    const pageSize = 24;
    let totalPosts = undefined;
    let gotPosts = 0;
    while (true) {
        const apiUrl = `https://www.irccl.in/blog-frontend-adapter-public/v2/post-feed-page?includeContent=true&languageCode=en&page=${page}&pageSize=${pageSize}&type=ALL_POSTS`;
        try {
            const response = await axios.get(apiUrl, {
/*User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,**;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Cookie: XSRF-TOKEN=1702116630|TlNBZ_oWMBW7; hs=795728959; svSession=15ea15df468b51b5828c9a2ab4bbaa58266e2d04756ce30013af6be6d94c4a40af21dbee824fa19258708272accd530d1e60994d53964e647acf431e4f798bcd4f630e87280d117dc55c167e8f5a19905c1e4bafa5e68ce0f329bd98e8cae1e39cf6a0b45560b9aa1c8afe84791b7c370c4bb9608921c06ce7fa9540305611a006646f3a1ea719f9398b9247c4ccc864; bSession=a5e61725-44e1-42b3-a69c-ce59a90f8a83|2
Upgrade-Insecure-Requests: 1
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: none
Sec-Fetch-User: ?1
TE: trailers*/
                headers: {
                    'User-Agent': "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0",
                    'Cookie': "XSRF-TOKEN=1702116630|TlNBZ_oWMBW7; hs=795728959; svSession=15ea15df468b51b5828c9a2ab4bbaa58266e2d04756ce30013af6be6d94c4a40af21dbee824fa19258708272accd530d1e60994d53964e647acf431e4f798bcd4f630e87280d117dc55c167e8f5a19905c1e4bafa5e68ce0f329bd98e8cae1e39cf6a0b45560b9aa1c8afe84791b7c370c4bb9608921c06ce7fa9540305611a006646f3a1ea719f9398b9247c4ccc864; bSession=a5e61725-44e1-42b3-a69c-ce59a90f8a83|2"
                }
            });
            const apiResponse = response.data;
            const paging = apiResponse['postFeedPage']['posts']['pagingMetaData'];
            totalPosts = paging['total'];
            gotPosts = paging['offset'] + paging['count'];
            if (gotPosts >= totalPosts) {
                break;
            }
            console.log(`Done: ${gotPosts}`);
            const newsItems = await getData(apiResponse['postFeedPage']['posts']['posts']);
            updateFile(newsItems)
            page++;
        } catch (error) {
            console.error('Error:', error);
            break;
        }
    }
}

main();
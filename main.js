const fs = require('fs');
const path = require('path');
const pm2 = require('pm2');

const folderPath = '.'; // Current directory

fs.readdir(folderPath, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    const jsFiles = files.filter((file) => path.extname(file).toLowerCase() === '.js');

    pm2.connect((err) => {
        if (err) {
            console.error('Error connecting to PM2:', err);
            return;
        }

        jsFiles.forEach((file) => {
            pm2.start(file, (err) => {
                if (err) {
                    console.error(`Error starting ${file}:`, err);
                } else {
                    console.log(`Started ${file} with PM2`);
                }
            });
        });

        setInterval(() => {}, 1000);
    });
});

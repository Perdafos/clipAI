const fs = require('fs');
const https = require('https');
const path = require('path');

const binDir = path.join(__dirname, 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir);
}

const dest = path.join(binDir, 'yt-dlp.exe');
const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

console.log(`Downloading yt-dlp.exe to ${dest}...`);

https.get(url, (res) => {
  if (res.statusCode === 302 || res.statusCode === 301) {
    https.get(res.headers.location, (res2) => {
      const file = fs.createWriteStream(dest);
      res2.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Downloaded yt-dlp.exe successfully!');
      });
    });
  } else {
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Downloaded yt-dlp.exe successfully!');
    });
  }
}).on('error', (err) => {
  console.error('Error downloading yt-dlp.exe:', err.message);
});

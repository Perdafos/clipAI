const { fetchVideoMetadata, hasYtdlp, hasFfmpeg } = require('./src/services/videoService.ts');

console.log('hasYtdlp:', hasYtdlp, 'hasFfmpeg:', hasFfmpeg);

async function test() {
  try {
    const meta = await fetchVideoMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('Metadata:', meta.title);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();

import { fetchVideoMetadata, hasYtdlp, hasFfmpeg } from './src/services/videoService';

console.log('hasYtdlp:', hasYtdlp, 'hasFfmpeg:', hasFfmpeg);

async function test() {
  try {
    const url = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const meta = await fetchVideoMetadata(url);
    console.log('Metadata Title:', meta.title);
    console.log('Duration:', meta.duration);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();

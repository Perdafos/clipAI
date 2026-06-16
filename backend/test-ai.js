const { callAI } = require('./src/services/aiService');
const { config } = require('dotenv');
config();

async function test() {
  const res = await callAI({
    task: 'clip_timestamps',
    systemPrompt: 'Return JSON',
    userPrompt: 'Find clips in a 100s video. Format: {"clips": [{"start": 0, "end": 10}], "total_duration": 10}',
    responseFormat: 'json'
  });
  console.log(res);
}

test();

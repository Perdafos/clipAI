import axios from 'axios'

const NINEROUTER_BASE_URL = process.env.NINEROUTER_BASE_URL || 'https://api.9router.com/v1'
const NINEROUTER_API_KEY = process.env.NINEROUTER_API_KEY

export type NineRouterModel =
  | 'big-pickle'
  | 'deepseek-v4-flash-free'
  | 'mimo-v2.5-free'
  | 'qwen3.6-plus-free'
  | 'minimax-m3-free'
  | 'nemotron-3-ultra-free'
  | 'north-mini-code-free'
  | 'mimo-auto'

export type AITask =
  | 'scene_analysis'
  | 'clip_timestamps'
  | 'music_recommend'
  | 'quality_score'
  | 'ffmpeg_command'
  | 'caption_gen'
  | 'fast_extract'

const MODEL_MAP: Record<AITask, NineRouterModel[]> = {
  scene_analysis:   ['big-pickle', 'deepseek-v4-flash-free', 'mimo-auto'],
  clip_timestamps:  ['qwen3.6-plus-free', 'deepseek-v4-flash-free', 'mimo-auto'],
  music_recommend:  ['mimo-v2.5-free', 'mimo-auto'],
  quality_score:    ['nemotron-3-ultra-free', 'mimo-auto'],
  ffmpeg_command:   ['north-mini-code-free', 'mimo-auto'],
  caption_gen:      ['minimax-m3-free', 'mimo-auto'],
  fast_extract:     ['deepseek-v4-flash-free', 'mimo-auto'],
}

interface AICallOptions {
  task: AITask
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'json' | 'text'
}

interface AIResponse<T = unknown> {
  success: boolean
  data: T | null
  error: string | null
  model: string
  tokensUsed: number
}

/**
 * Call 9router AI with automatic model selection and fallback.
 * Throws if ALL models fail — no silent mock data.
 */
export async function callAI<T = unknown>(options: AICallOptions): Promise<AIResponse<T>> {
  const {
    task, systemPrompt, userPrompt,
    temperature = 0.3, maxTokens = 2048, responseFormat = 'json'
  } = options

  if (!NINEROUTER_API_KEY) {
    throw new Error('9router API key is not configured (NINEROUTER_API_KEY). Contact server admin.')
  }

  const models = MODEL_MAP[task]
  let lastError = ''

  for (const model of models) {
    try {
      const response = await axios.post(
        `${NINEROUTER_BASE_URL}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat === 'json' && { response_format: { type: 'json_object' } })
        },
        {
          headers: {
            'Authorization': `Bearer ${NINEROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      )

      const content = response.data.choices?.[0]?.message?.content || ''
      const tokensUsed = response.data.usage?.total_tokens || 0

      if (responseFormat === 'json') {
        const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
        try {
          const parsed = JSON.parse(cleaned) as T
          return { success: true, data: parsed, error: null, model, tokensUsed }
        } catch {
          lastError = `Model ${model} returned invalid JSON. Response: ${cleaned.slice(0, 200)}`
          continue
        }
      }

      if (!content) {
        lastError = `Model ${model} returned empty response`
        continue
      }
      return { success: true, data: content as T, error: null, model, tokensUsed }

    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number, data?: any }, message: string, code?: string }
      if (axiosErr.code === 'ECONNABORTED') {
        lastError = `Model ${model} timed out`
        continue
      }
      if (axiosErr.response?.status === 429) {
        lastError = `Model ${model} rate limited`
        continue
      }
      if (axiosErr.response?.status === 401 || axiosErr.response?.status === 403) {
        throw new Error('9router API authentication failed. Check API key.')
      }
      if (axiosErr.response?.status) {
        lastError = `Model ${model} returned HTTP ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data).slice(0, 200)}`
        continue
      }
      lastError = `${model}: ${axiosErr.message?.slice(0, 200) || 'unknown error'}`
      continue
    }
  }

  // All models failed — throw so the pipeline shows real error, not mock data
  throw new Error(`AI service unavailable (${task}). Tried ${models.length} models. Last error: ${lastError}`)
}

// ─── Specialized AI Functions ────────────────────────────────────

export interface SceneAnalysisResult {
  scenes: Array<{
    start: number
    end: number
    score: number
    type: 'highlight' | 'transition' | 'skip'
    clip_type: 'dunk' | 'ankle_breaker' | 'block' | 'steal' | 'three_pointer' | 'highlight' | 'other'
    reason: string
    mood: string
  }>
  recommended_duration: number
  dominant_mood: string
  suggested_music_genre: string
}

export async function analyzeVideoScenes(metadata: {
  title: string
  duration: number
  platform: string
  description?: string
}): Promise<SceneAnalysisResult> {
  const title = metadata.title.toLowerCase()
  const desc = (metadata.description || '').toLowerCase()
  const isBasketball = ['nba', 'basketball', 'dunk', 'lakers', 'celtics', 'knicks', 'warriors', 'lebron', 'curry', 'hoop', 'highlights', 'nbl', 'ncaa'].some(kw => title.includes(kw) || desc.includes(kw))

  const systemPrompt = isBasketball
    ? `You are an expert NBA highlight editor. Identify the most exciting basketball plays: dunks, ankle breakers, blocks, steals, and three-pointers. Respond with valid JSON only.`
    : `You are an expert video editor. Analyze the video and identify the most engaging moments. Respond with valid JSON only.`

  const sportContext = isBasketball ? `
This is an NBA/basketball video. Look for these specific play types:
- dunk: slam dunks, alley-oops, reverse dunks
- ankle_breaker: crossover dribbles that leave defenders falling
- block: shot blocks, rejections
- steal: defensive steals, interceptions
- three_pointer: 3-point shots, corner threes, buzzer beaters
- highlight: other exciting moments (fast breaks, celebrations, clutch plays)

For each scene, set "clip_type" to one of: "dunk", "ankle_breaker", "block", "steal", "three_pointer", "highlight"
` : '\nFor each scene, set "clip_type" to "highlight" or "other"'

  const result = await callAI<SceneAnalysisResult>({
    task: 'scene_analysis',
    systemPrompt,
    userPrompt: `Analyze this video and identify the top highlight moments:

Title: "${metadata.title}"
Platform: ${metadata.platform}
Duration: ${metadata.duration} seconds
Description: ${metadata.description?.slice(0, 500) || 'N/A'}
${sportContext}

Return JSON with this EXACT structure (no other keys):
{
  "scenes": [
    {
      "start": 10,
      "end": 18,
      "score": 0.97,
      "type": "highlight",
      "clip_type": "dunk",
      "reason": "Spectacular reverse dunk over two defenders",
      "mood": "energetic"
    }
  ],
  "recommended_duration": 60,
  "dominant_mood": "energetic",
  "suggested_music_genre": "hiphop"
}

Rules:
- Create 5-10 scenes covering different parts of the video
- Score range 0.0-1.0 (higher = more exciting)
- Scenes should NOT overlap
- Total selected scenes duration should be around 60-90 seconds
- Types: highlight, transition, skip
- Spread clips across the full duration of the video`,
    temperature: 0.4,
    maxTokens: 2000,
  })

  if (!result.data) throw new Error('AI scene analysis returned no data')
  return result.data
}

export interface MusicRecommendationResult {
  recommended_track_id: string
  confidence: number
  reason: string
  alternative_track_ids: string[]
}

export async function recommendMusic(params: {
  dominantMood: string
  suggestedGenre: string
  targetDuration: number
  platform: string
  availableTracks: Array<{ id: string; title: string; genre: string[]; mood: string[]; bpm: number }>
}): Promise<MusicRecommendationResult> {
  const result = await callAI<MusicRecommendationResult>({
    task: 'music_recommend',
    systemPrompt: 'You are a music supervisor for social media video content. Match music to video mood. Respond with valid JSON only.',
    userPrompt: `Select the best music track for this video:

Video mood: ${params.dominantMood}
Suggested genre: ${params.suggestedGenre}
Target duration: ${params.targetDuration}s
Platform: ${params.platform}

Available tracks:
${JSON.stringify(params.availableTracks, null, 2)}

Return JSON:
{
  "recommended_track_id": "track_id_here",
  "confidence": 0.87,
  "reason": "Why this track fits",
  "alternative_track_ids": ["alt1", "alt2"]
}`,
    temperature: 0.5,
  })

  if (!result.data) throw new Error('AI music recommendation returned no data')
  return result.data
}

export interface ClipTimestampsResult {
  clips: Array<{
    start: number
    end: number
    transition: 'cut' | 'fade' | 'dissolve'
  }>
  total_duration: number
}

export async function generateClipTimestamps(params: {
  scenes: SceneAnalysisResult['scenes']
  targetDuration: number
  videoDuration: number
}): Promise<ClipTimestampsResult> {
  const result = await callAI<ClipTimestampsResult>({
    task: 'clip_timestamps',
    systemPrompt: 'You are a video editor. Select and arrange video scenes into an engaging highlight clip. Respond with valid JSON only.',
    userPrompt: `Create a ${params.targetDuration}-second highlight clip from these scenes:

Available scenes:
${JSON.stringify(params.scenes, null, 2)}

Video total duration: ${params.videoDuration}s
Target clip duration: ${params.targetDuration}s (can be ±5s)

Select the best scenes and order them for maximum engagement.
Return JSON:
{
  "clips": [
    { "start": 10, "end": 25, "transition": "cut" },
    { "start": 45, "end": 60, "transition": "fade" }
  ],
  "total_duration": 60
}`,
    temperature: 0.3,
  })

  if (!result.data) throw new Error('AI clip timestamp generation returned no data')
  return result.data
}

export async function generateFFmpegCommand(params: {
  inputFile: string
  clips: ClipTimestampsResult['clips']
  musicFile: string | null
  outputFile: string
  musicVolume: number
  fadeIn: number
  fadeOut: number
  aspectRatio?: '9:16' | '1:1' | '16:9'
}): Promise<string | null> {
  const result = await callAI<string>({
    task: 'ffmpeg_command',
    systemPrompt: 'You are an FFmpeg expert. Generate precise FFmpeg commands. Return ONLY the command, no explanation, no markdown.',
    userPrompt: `Generate an FFmpeg command to create a video clip:

Input video: "${params.inputFile}"
Clips to extract (seconds):
${params.clips.map((c, i) => `  Clip ${i + 1}: ${c.start}s to ${c.end}s`).join('\n')}
Music file: ${params.musicFile || 'none'}
Music volume: ${params.musicVolume}
Fade in: ${params.fadeIn}s
Fade out: ${params.fadeOut}s
Aspect Ratio: ${params.aspectRatio || '16:9'}
Output: "${params.outputFile}"

Requirements:
- Concatenate all clips in order
- Mix music at specified volume if provided
- Apply fade in/out effects
- Output as MP4 H.264
- Keep original audio mixed with music
- Resize/crop the video to the specified aspect ratio
- For '9:16': crop and scale to 1080x1920
- For '1:1': crop and scale to 1080x1080
- For '16:9': scale to 1920x1080

Return ONLY the ffmpeg command.`,
    temperature: 0.1,
    responseFormat: 'text',
  })

  return result.data as string | null
}

export async function scoreClipQuality(params: {
  title: string
  duration: number
  clipCount: number
  hasMusic: boolean
  dominantMood: string
}): Promise<{ score: number; feedback: string }> {
  const result = await callAI<{ score: number; feedback: string }>({
    task: 'quality_score',
    systemPrompt: 'You are a video quality reviewer. Score video clips on engagement potential. Respond with valid JSON only.',
    userPrompt: `Score this video clip on quality and engagement potential:

Original title: "${params.title}"
Clip duration: ${params.duration}s
Number of cuts: ${params.clipCount}
Has background music: ${params.hasMusic}
Dominant mood: ${params.dominantMood}

Return JSON:
{
  "score": 0.85,
  "feedback": "Short constructive feedback"
}`,
    temperature: 0.3,
  })

  if (!result.data) throw new Error('AI quality scoring returned no data')
  return result.data
}

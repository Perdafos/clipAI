import { exec, execSync, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import _ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

export const ffmpegPath: string = (_ffmpegPath as string) || ''
const ffprobePath: string = (ffprobeStatic as any)?.path || ''
const ytdlpPath = path.resolve(__dirname, '../../bin/yt-dlp.exe')

const execAsync = promisify(exec)

export let hasYtdlp = fs.existsSync(ytdlpPath)
export let hasFfmpeg = !!ffmpegPath && !!ffprobePath

console.log(`[ClipAI System Check] yt-dlp available: ${hasYtdlp}, ffmpeg available: ${hasFfmpeg}`)

/**
 * Downloads a tiny sample MP4 video (~700KB) to act as a template for local mock development.
 * This guarantees the user's downloaded clip is a valid playable MP4.
 */
export async function ensureSampleVideoCached(): Promise<string> {
  const templateDir = './uploads'
  const templatePath = path.join(templateDir, 'sample_template.mp4')

  if (fs.existsSync(templatePath)) {
    return templatePath
  }

  console.log('[ClipAI Fallback] Downloading playable sample video template (~700KB)...')
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir, { recursive: true })
  }

  try {
    const response = await axios({
      method: 'get',
      url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      responseType: 'stream',
      timeout: 15000,
    })

    const writer = fs.createWriteStream(templatePath)
    response.data.pipe(writer)

    return new Promise((resolve) => {
      writer.on('finish', () => {
        console.log('[ClipAI Fallback] Playable sample video template cached successfully.')
        resolve(templatePath)
      })
      writer.on('error', (err) => {
        console.error('[ClipAI Fallback] Failed to write template video:', err.message)
        resolve('')
      })
    })
  } catch (err: any) {
    console.error('[ClipAI Fallback] Failed to download sample template video:', err.message)
    return ''
  }
}

export interface VideoMetadata {
  id: string
  title: string
  description: string
  duration: number
  thumbnail: string
  platform: 'youtube' | 'tiktok' | 'instagram'
  uploader: string
  viewCount?: number
  likeCount?: number
  uploadDate?: string
  webpage_url: string
  chapters?: { title: string; start_time: number; end_time: number }[]
}

/**
 * Fetch video metadata without downloading using yt-dlp
 */
export async function fetchVideoMetadata(url: string): Promise<VideoMetadata> {
  const platform = detectPlatformFromUrl(url)

  if (!hasYtdlp) {
    console.warn(`[ClipAI Fallback] yt-dlp is not installed. Returning mock metadata for ${url}`)
    return {
      id: 'mock_video_id',
      title: `Mock Video (${platform})`,
      description: `This is a mock description for ${url}. Local development is running in fallback/mock mode because yt-dlp is not installed on your system.`,
      duration: 120, // 2 minutes
      thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800',
      platform,
      uploader: 'ClipAI Mock Uploader',
      viewCount: 1500,
      likeCount: 120,
      uploadDate: '2026-06-16',
      webpage_url: url
    }
  }

  const { stdout } = await execAsync(
    `"${ytdlpPath}" --dump-json --no-download --no-warnings "${url}"`,
    { timeout: 30000 }
  )

  const raw = JSON.parse(stdout)

  // Extract chapters from yt-dlp (YouTube chapters)
  const chapters = (raw.chapters && Array.isArray(raw.chapters) && raw.chapters.length > 0)
    ? raw.chapters.map((ch: any, i: number) => ({
        title: ch.title || `Chapter ${i + 1}`,
        start_time: Math.round(ch.start_time || 0),
        end_time: Math.round(ch.end_time || (ch.start_time || 0) + 30),
      }))
    : []

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description?.slice(0, 1000) || '',
    duration: raw.duration,
    thumbnail: raw.thumbnail,
    platform,
    uploader: raw.uploader || raw.channel || 'Unknown',
    viewCount: raw.view_count,
    likeCount: raw.like_count,
    uploadDate: raw.upload_date,
    webpage_url: raw.webpage_url || url,
    chapters,
  }
}

/**
 * Download video to local path with progress callback
 */
export async function downloadVideo(
  url: string,
  outputPath: string,
  onProgress: (percent: number) => void
): Promise<string> {
  if (!hasYtdlp) {
    console.warn(`[ClipAI Fallback] Simulating download for ${url}`)
    return new Promise(async (resolve) => {
      const templatePath = await ensureSampleVideoCached()
      let percent = 0
      const interval = setInterval(() => {
        percent += 20
        if (percent > 100) percent = 100
        onProgress(percent)
        if (percent === 100) {
          clearInterval(interval)
          if (templatePath && fs.existsSync(templatePath)) {
            fs.copyFileSync(templatePath, outputPath)
          } else {
            fs.writeFileSync(outputPath, 'mock video content')
          }
          resolve(outputPath)
        }
      }, 300)
    })
  }

  return new Promise((resolve, reject) => {
    // Use .mp4 directly — avoid temp file rename that causes WinError 32 on Windows
    const args = [
      '--ffmpeg-location', ffmpegPath,
      '-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-warnings',
      '--no-part',
      '-o', outputPath,
      url
    ]

    const proc = spawn(ytdlpPath, args)
    let lastPercent = 0

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      const match = text.match(/(\d+(?:\.\d+)?)%/)
      if (match) {
        const percent = Math.floor(parseFloat(match[1]))
        if (percent !== lastPercent) {
          lastPercent = percent
          onProgress(percent)
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      console.error('yt-dlp stderr:', data.toString())
    })

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath)
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

/**
 * Extract audio from video for analysis
 */
export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  if (!hasFfmpeg) {
    console.warn(`[ClipAI Fallback] Simulating audio extraction from ${videoPath}`)
    fs.writeFileSync(outputPath, 'mock audio content')
    return outputPath
  }

  await execAsync(
    `"${ffmpegPath}" -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${outputPath}" -y -threads 2`,
    { timeout: 120000 }
  )
  return outputPath
}

function detectPlatformFromUrl(url: string): 'youtube' | 'tiktok' | 'instagram' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  return 'youtube'
}

/**
 * Get video duration in seconds using ffprobe
 */
export async function getVideoDuration(filePath: string): Promise<number> {
  if (!hasFfmpeg) {
    return 120
  }

  const { stdout } = await execAsync(
    `"${ffprobePath}" -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
    { timeout: 10000 }
  )
  return parseFloat(stdout.trim())
}

/**
 * Create job directory structure
 */
export function createJobDir(jobId: string): {
  jobDir: string
  videoPath: string
  audioPath: string
  outputPath: string
} {
  const jobDir = path.join('./uploads', jobId)
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true })
  }
  return {
    jobDir,
    videoPath: path.join(jobDir, 'original.mp4'),
    audioPath: path.join(jobDir, 'audio.wav'),
    outputPath: path.join(jobDir, 'final_output.mp4'),
  }
}

/**
 * Cleanup job files (called after 1 hour)
 */
export function cleanupJob(jobId: string): void {
  const jobDir = path.join('./uploads', jobId)
  if (fs.existsSync(jobDir)) {
    fs.rmSync(jobDir, { recursive: true, force: true })
  }
}

// Restart trigger

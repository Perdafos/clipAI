import { exec, execSync, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import _ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

export const ffmpegPath: string = (_ffmpegPath as string) || ''
const ffprobePath: string = (ffprobeStatic as any)?.path || ''

// Try system yt-dlp first, then bundled
function resolveYtdlp(): { path: string; isAvailable: boolean } {
  try {
    execSync('yt-dlp --version', { timeout: 5000, stdio: 'pipe' })
    return { path: 'yt-dlp', isAvailable: true }
  } catch {
    const bundled = path.resolve(__dirname, '../../bin/yt-dlp')
    if (fs.existsSync(bundled)) {
      try {
        fs.accessSync(bundled, fs.constants.X_OK)
      } catch {
        fs.chmodSync(bundled, 0o755)
      }
      try {
        execSync(`"${bundled}" --version`, { timeout: 5000, stdio: 'pipe' })
        return { path: bundled, isAvailable: true }
      } catch {}
    }
    return { path: '', isAvailable: false }
  }
}

const ytdlp = resolveYtdlp()
export let hasYtdlp = ytdlp.isAvailable
export let ytdlpPath = ytdlp.path
export let hasFfmpeg = !!ffmpegPath && !!ffprobePath

console.log(`[ClipAI] yt-dlp: ${hasYtdlp ? ytdlpPath : 'NOT FOUND'}, ffmpeg: ${hasFfmpeg ? ffmpegPath : 'NOT FOUND'}`)

/**
 * Downloads a tiny sample MP4 video (~700KB) to act as a template for local mock development.
 */
export async function ensureSampleVideoCached(): Promise<string> {
  const templateDir = './uploads'
  const templatePath = path.join(templateDir, 'sample_template.mp4')
  if (fs.existsSync(templatePath)) return templatePath

  console.log('[ClipAI] Downloading sample video template (~700KB)...')
  if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true })

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
      writer.on('finish', () => { console.log('[ClipAI] Sample video cached.'); resolve(templatePath) })
      writer.on('error', () => resolve(''))
    })
  } catch { return '' }
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

export async function fetchVideoMetadata(url: string): Promise<VideoMetadata> {
  const platform = detectPlatformFromUrl(url)

  if (!hasYtdlp) {
    throw new Error('yt-dlp is not installed on this server. Install with: pip install yt-dlp')
  }

  try {
    const { stdout } = await execAsync(
      `"${ytdlpPath}" --dump-json --no-download --no-warnings --no-playlist "${url}"`,
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    )
    const raw = JSON.parse(stdout)

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
  } catch (err: unknown) {
    const e = err as Error & { stderr?: string; code?: number }
    const stderr = (e.stderr || '').slice(0, 500)
    const msg = e.message?.includes('ETIMEDOUT') || e.message?.includes('ENOTFOUND')
      ? 'Network error: cannot reach video platform. Check server internet connection.'
      : e.message?.includes('Private video') || e.message?.includes('removed') || e.message?.includes('HTTP Error 404')
        ? 'Video is private, removed, or does not exist.'
        : e.message?.includes('HTTP Error 429')
          ? 'Rate limited by platform. Try again in a few minutes.'
          : e.message?.includes('HTTP Error 403')
            ? 'Video is region-locked or age-restricted.'
            : stderr.includes('Unsupported URL')
              ? `URL format not supported by yt-dlp: ${url}`
              : `Failed to get video info: ${e.message?.slice(0, 200) || 'unknown error'}`
    throw new Error(msg)
  }
}

export async function downloadVideo(
  url: string,
  outputPath: string,
  onProgress: (percent: number) => void
): Promise<string> {
  if (!hasYtdlp) {
    throw new Error('yt-dlp is not installed. Cannot download video.')
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-warnings',
      '--no-part',
      '--no-playlist',
      '--retries', '3',
      '--fragment-retries', '3',
      '-o', outputPath,
      url
    ]

    const proc = spawn(ytdlpPath, args, { timeout: 600000 })
    let lastPercent = 0

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      const match = text.match(/(\d+(?:\.\d+)?)%/)
      if (match) {
        const percent = Math.floor(parseFloat(match[1]))
        if (percent !== lastPercent) { lastPercent = percent; onProgress(percent) }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      console.error('yt-dlp stderr:', data.toString())
    })

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath)
      else reject(new Error(`Download failed (exit code ${code}). Video may be private, region-locked, or require login.`))
    })
    proc.on('error', (err) => reject(new Error(`Failed to start yt-dlp: ${err.message}`)))
  })
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  if (!hasFfmpeg) {
    console.warn(`[ClipAI] FFmpeg not available, skipping audio extraction`)
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

export async function getVideoDuration(filePath: string): Promise<number> {
  if (!hasFfmpeg) return 120
  const { stdout } = await execAsync(
    `"${ffprobePath}" -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
    { timeout: 10000 }
  )
  return parseFloat(stdout.trim())
}

export function createJobDir(jobId: string): {
  jobDir: string
  videoPath: string
  audioPath: string
  outputPath: string
} {
  const jobDir = path.join('./uploads', jobId)
  if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true })
  return {
    jobDir,
    videoPath: path.join(jobDir, 'original.mp4'),
    audioPath: path.join(jobDir, 'audio.wav'),
    outputPath: path.join(jobDir, 'final_output.mp4'),
  }
}

export function cleanupJob(jobId: string): void {
  const jobDir = path.join('./uploads', jobId)
  if (fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true })
}

const execAsync = promisify(exec)

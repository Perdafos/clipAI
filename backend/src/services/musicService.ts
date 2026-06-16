import path from 'path'
import fs from 'fs'

export interface MusicTrack {
  id: string
  title: string
  artist: string
  duration: number
  genre: string[]
  mood: string[]
  bpm: number
  previewUrl: string
  filePath: string
  license: 'royalty-free'
}

// Built-in royalty-free music library
// In production, replace file paths with actual audio files
const MUSIC_LIBRARY: MusicTrack[] = [
  // Electronic / EDM
  { id: 'elec_001', title: 'Neon Pulse', artist: 'ClipAI Beats', duration: 180, genre: ['electronic', 'edm'], mood: ['energetic', 'upbeat'], bpm: 128, previewUrl: '', filePath: './public/music/elec_001.mp3', license: 'royalty-free' },
  { id: 'elec_002', title: 'Digital Rush', artist: 'ClipAI Beats', duration: 165, genre: ['electronic', 'edm'], mood: ['intense', 'energetic'], bpm: 140, previewUrl: '', filePath: './public/music/elec_002.mp3', license: 'royalty-free' },
  { id: 'elec_003', title: 'Synth Wave', artist: 'ClipAI Beats', duration: 200, genre: ['electronic', 'synthwave'], mood: ['nostalgic', 'cool'], bpm: 110, previewUrl: '', filePath: './public/music/elec_003.mp3', license: 'royalty-free' },

  // Hip-hop / Trap
  { id: 'hiphop_001', title: 'Street Vibes', artist: 'ClipAI Beats', duration: 170, genre: ['hip-hop', 'trap'], mood: ['cool', 'confident'], bpm: 90, previewUrl: '', filePath: './public/music/hiphop_001.mp3', license: 'royalty-free' },
  { id: 'hiphop_002', title: 'Bass Drop', artist: 'ClipAI Beats', duration: 185, genre: ['hip-hop', 'trap'], mood: ['intense', 'energetic'], bpm: 85, previewUrl: '', filePath: './public/music/hiphop_002.mp3', license: 'royalty-free' },
  { id: 'hiphop_003', title: 'City Nights', artist: 'ClipAI Beats', duration: 195, genre: ['hip-hop'], mood: ['chill', 'cool'], bpm: 80, previewUrl: '', filePath: './public/music/hiphop_003.mp3', license: 'royalty-free' },

  // Cinematic / Epic
  { id: 'epic_001', title: 'Rising Dawn', artist: 'ClipAI Orchestra', duration: 210, genre: ['cinematic', 'epic'], mood: ['inspiring', 'dramatic'], bpm: 75, previewUrl: '', filePath: './public/music/epic_001.mp3', license: 'royalty-free' },
  { id: 'epic_002', title: 'The Awakening', artist: 'ClipAI Orchestra', duration: 225, genre: ['cinematic', 'epic'], mood: ['powerful', 'dramatic'], bpm: 85, previewUrl: '', filePath: './public/music/epic_002.mp3', license: 'royalty-free' },
  { id: 'epic_003', title: 'Horizon', artist: 'ClipAI Orchestra', duration: 190, genre: ['cinematic'], mood: ['inspiring', 'calm'], bpm: 70, previewUrl: '', filePath: './public/music/epic_003.mp3', license: 'royalty-free' },

  // Acoustic / Chill
  { id: 'chill_001', title: 'Golden Hour', artist: 'ClipAI Acoustic', duration: 175, genre: ['acoustic', 'chill'], mood: ['happy', 'warm'], bpm: 72, previewUrl: '', filePath: './public/music/chill_001.mp3', license: 'royalty-free' },
  { id: 'chill_002', title: 'Breezy Morning', artist: 'ClipAI Acoustic', duration: 160, genre: ['acoustic', 'chill'], mood: ['peaceful', 'calm'], bpm: 65, previewUrl: '', filePath: './public/music/chill_002.mp3', license: 'royalty-free' },
  { id: 'chill_003', title: 'Lazy Sunday', artist: 'ClipAI Acoustic', duration: 205, genre: ['acoustic', 'lo-fi'], mood: ['relaxed', 'chill'], bpm: 68, previewUrl: '', filePath: './public/music/chill_003.mp3', license: 'royalty-free' },

  // Pop / Upbeat
  { id: 'pop_001', title: 'Summer Bounce', artist: 'ClipAI Pop', duration: 178, genre: ['pop', 'upbeat'], mood: ['happy', 'energetic'], bpm: 120, previewUrl: '', filePath: './public/music/pop_001.mp3', license: 'royalty-free' },
  { id: 'pop_002', title: 'Feel Good', artist: 'ClipAI Pop', duration: 182, genre: ['pop'], mood: ['happy', 'upbeat'], bpm: 115, previewUrl: '', filePath: './public/music/pop_002.mp3', license: 'royalty-free' },
  { id: 'pop_003', title: 'Celebration', artist: 'ClipAI Pop', duration: 172, genre: ['pop', 'upbeat'], mood: ['joyful', 'energetic'], bpm: 125, previewUrl: '', filePath: './public/music/pop_003.mp3', license: 'royalty-free' },

  // Sports / Action
  { id: 'action_001', title: 'Full Send', artist: 'ClipAI Action', duration: 155, genre: ['rock', 'action'], mood: ['intense', 'energetic'], bpm: 145, previewUrl: '', filePath: './public/music/action_001.mp3', license: 'royalty-free' },
  { id: 'action_002', title: 'No Limits', artist: 'ClipAI Action', duration: 168, genre: ['rock', 'action'], mood: ['powerful', 'intense'], bpm: 138, previewUrl: '', filePath: './public/music/action_002.mp3', license: 'royalty-free' },
]

export function getMusicLibrary(filters?: {
  genre?: string
  mood?: string
  page?: number
  limit?: number
}): MusicTrack[] {
  let tracks = [...MUSIC_LIBRARY]

  if (filters?.genre) {
    tracks = tracks.filter(t => t.genre.some(g => g.toLowerCase().includes(filters.genre!.toLowerCase())))
  }
  if (filters?.mood) {
    tracks = tracks.filter(t => t.mood.some(m => m.toLowerCase().includes(filters.mood!.toLowerCase())))
  }

  const page = filters?.page || 1
  const limit = filters?.limit || 20
  const start = (page - 1) * limit

  return tracks.slice(start, start + limit)
}

export function getMusicTrackById(id: string): MusicTrack | null {
  return MUSIC_LIBRARY.find(t => t.id === id) || null
}

export function getMusicFilePath(id: string): string | null {
  const track = getMusicTrackById(id)
  if (!track) return null
  // Return path if file exists, otherwise null (dev mode)
  if (fs.existsSync(track.filePath)) return track.filePath
  return null
}

export function getMusicLibraryTotal(): number {
  return MUSIC_LIBRARY.length
}

export function getMusicTrackForClient(track: MusicTrack) {
  // Never expose server file paths to client
  const { filePath, ...clientTrack } = track
  return clientTrack
}

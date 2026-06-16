#!/bin/bash
# ClipAI Quick Start Script
# Run: chmod +x start-dev.sh && ./start-dev.sh

set -e

echo "🎬 ClipAI — Starting development environment..."
echo ""

# Check dependencies
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from nodejs.org"; exit 1; }
command -v yt-dlp >/dev/null 2>&1 || { echo "⚠️  yt-dlp not found. Install: pip install yt-dlp"; }
command -v ffmpeg >/dev/null 2>&1 || { echo "⚠️  ffmpeg not found. Install from ffmpeg.org"; }

echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🚀 To start development:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend && npm run dev"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend && npm run dev"
echo ""
echo "  Then open: http://localhost:5173"
echo ""
echo "📖 Read README.md and AI_WORKFLOW.md before making changes."

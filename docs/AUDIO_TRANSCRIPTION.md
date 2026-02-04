# Audio Transcription Integration Guide

This guide explains how to use the real-time audio transcription feature in the Reander Meet screen.

## Overview

The Meet screen now connects to a Python backend service that provides real-time audio transcription using:

- **faster-whisper** for fast, accurate speech-to-text
- **WebRTC VAD** for voice activity detection (only transcribes when speaking)
- **5-second audio chunks** for optimal latency/accuracy balance
- **WebSocket streaming** for real-time updates

## Architecture

```
┌─────────────────┐     HTTP/WebSocket     ┌──────────────────┐
│  React Frontend │◄──────────────────────►│  Python Backend  │
│  (Meet Screen)  │                        │  (Port 8000)     │
└────────┬────────┘                        └────────┬─────────┘
         │                                          │
         │                                          │
    ┌────▼─────┐                              ┌────▼─────┐
    │ useAudio │                              │  Audio   │
    │Transcrip-│                              │  Route   │
    │tion Hook │                              │          │
    └──────────┘                              └────┬─────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              │                    │                    │
                         ┌────▼─────┐        ┌────▼─────┐        ┌────▼─────┐
                         │ WebSocket│        │  pyaudio │        │ Whisper  │
                         │  Stream  │        │  Capture │        │  Model   │
                         └──────────┘        └──────────┘        └──────────┘
```

## Files Created/Modified

### Frontend

1. **`src/renderer/hooks/useAudioTranscription.ts`** - React hook for audio transcription
2. **`src/renderer/screens/meet/index.tsx`** - Updated to use real transcription API
3. **`src/renderer/screens/meet/_components/meeting-panel.tsx`** - Added connection status UI

### Backend

1. **`python/routes/audio_route.py`** - FastAPI audio routes with WebSocket support
2. **`python/pyproject.toml`** - Added dependencies (faster-whisper, pyaudio, webrtcvad)

## Usage

### Starting a Recording Session

1. Open the Meet screen
2. Enter a meeting name (optional)
3. Click "Start Recording"
4. The app will:
   - Connect to the Python backend via HTTP
   - Start microphone capture
   - Open a WebSocket for real-time transcription
   - Display live transcriptions as they arrive

### Connection States

The UI shows the current connection state:

- **🟡 Connecting** - Initializing WebSocket connection to backend
- **🔴 Recording** - Actively recording and transcribing audio
- **⏸️ Paused** - Recording paused (WebSocket closed but session active)
- **⚪ Idle** - No active session

### Error Handling

If connection fails:

- An error banner appears at the top
- The session is automatically cleaned up
- User can retry by starting a new session

The hook includes automatic reconnection logic for WebSocket disconnections.

## API Endpoints

### HTTP Endpoints

- `POST /audio/start` - Start recording session
- `POST /audio/stop` - Stop and get all transcriptions
- `GET /audio/status` - Check current status

### WebSocket Endpoint

- `ws://localhost:8000/audio/stream` - Real-time transcription stream

## Technical Details

### Audio Configuration

- Sample Rate: 16kHz (required for VAD)
- Chunk Duration: 5 seconds
- Format: 16-bit PCM mono
- VAD Aggressiveness: Level 2 (balanced)

### Transcription Format

```typescript
interface TranscriptionMessage {
  text: string;
  timestamp: string; // ISO 8601
  is_final: boolean; // Currently always true
}
```

### Voice Activity Detection (VAD)

- Analyzes audio in 30ms frames
- Requires >20% of frames to contain speech
- Skips silent chunks to save compute

## Testing

### 1. Start the Python Backend

```bash
cd python
uv run python main.py
```

The server will start on `http://localhost:8000`

### 2. Start the Frontend

```bash
# In another terminal
bun run dev
```

### 3. Test Recording

1. Navigate to the Meet screen
2. Click "Start Recording"
3. Speak into your microphone
4. Watch transcriptions appear in real-time

## Troubleshooting

### PortAudio Error

If you see `portaudio.h file not found`:

```bash
# macOS
brew install portaudio

# Ubuntu/Debian
sudo apt-get install portaudio19-dev
```

### Microphone Permissions

On macOS:

1. System Preferences → Security & Privacy → Microphone
2. Enable for your application

### WebSocket Connection Failed

- Ensure Python backend is running on port 8000
- Check firewall settings
- Verify no other service is using port 8000

### No Transcriptions Appearing

- Check that your microphone is working
- Speak clearly and at normal volume
- Check browser console for errors
- Verify VAD is detecting speech (check Python logs)

## Future Enhancements

- [ ] Speaker diarization (identify different speakers)
- [ ] Persistent session storage
- [ ] Export transcriptions to various formats
- [ ] Real-time translation
- [ ] Noise cancellation
- [ ] Custom VAD thresholds

## Dependencies

### Frontend

- React (already included)
- WebSocket API (native browser)

### Backend

- `faster-whisper>=1.0.0` - Fast transcription
- `pyaudio>=0.2.14` - Microphone capture
- `webrtcvad>=2.0.10` - Voice activity detection
- `numpy>=1.26.0` - Audio processing

## License

Same as the main project.

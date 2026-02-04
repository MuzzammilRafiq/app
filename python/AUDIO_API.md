# Audio Transcription API

Real-time streaming audio transcription using faster-whisper with Voice Activity Detection (VAD).

## Features

- **5-second audio chunks** with intelligent VAD filtering
- **WebSocket streaming** for real-time transcription
- **HTTP endpoints** for start/stop control with AbortController support
- **Automatic silence filtering** - only transcribes when speech detected
- **Thread-safe** background recording

## API Endpoints

### HTTP Endpoints

#### Start Recording

```bash
POST /audio/start
```

Returns:

```json
{
  "status": "recording",
  "session_id": "20250202_123456_789012",
  "message": "Recording started. Session ID: 20250202_123456_789012"
}
```

#### Stop Recording

```bash
POST /audio/stop
```

Returns:

```json
{
  "status": "stopped",
  "session_id": "20250202_123456_789012",
  "transcriptions": [
    {
      "text": "Hello world this is a test",
      "timestamp": "2025-02-02T12:34:56.789012",
      "is_final": true
    }
  ]
}
```

#### Get Status

```bash
GET /audio/status
```

Returns:

```json
{
  "status": "active",
  "session_id": "20250202_123456_789012",
  "is_recording": true,
  "transcription_count": 5
}
```

### WebSocket Endpoint

#### Real-time Streaming

```
WebSocket ws://localhost:8000/audio/stream
```

**Client Example (JavaScript):**

```javascript
const ws = new WebSocket("ws://localhost:8000/audio/stream");

ws.onopen = () => {
  console.log("Connected to transcription stream");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "status") {
    console.log("Status:", data.status);
  } else if (data.type === "transcription") {
    console.log("Transcription:", data.data.text);
  }
};

// Stop recording
ws.send("stop");
```

**Full HTTP Example with AbortController:**

```javascript
const controller = new AbortController();

// Start recording
fetch("http://localhost:8000/audio/start", {
  method: "POST",
  signal: controller.signal,
})
  .then((response) => response.json())
  .then((data) => {
    console.log("Started:", data.session_id);
  });

// Poll for status
const checkStatus = async () => {
  const response = await fetch("http://localhost:8000/audio/status");
  const data = await response.json();
  console.log("Status:", data);
};

// Abort recording (calls stop endpoint)
controller.abort();

// Or explicitly stop
fetch("http://localhost:8000/audio/stop", { method: "POST" })
  .then((response) => response.json())
  .then((data) => {
    console.log("Stopped. Transcriptions:", data.transcriptions);
  });
```

## Python Client Example

```python
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    if data['type'] == 'transcription':
        print(f"Transcribed: {data['data']['text']}")

def on_open(ws):
    print("Connected to audio stream")

ws = websocket.WebSocketApp("ws://localhost:8000/audio/stream",
                           on_message=on_message,
                           on_open=on_open)

# Run for 30 seconds then close
import threading
def close_after_timeout():
    import time
    time.sleep(30)
    ws.send('stop')
    ws.close()

threading.Thread(target=close_after_timeout).start()
ws.run_forever()
```

## Technical Details

### Audio Configuration

- **Sample Rate**: 16kHz (required for VAD)
- **Chunk Duration**: 5 seconds
- **Format**: 16-bit PCM mono
- **VAD Aggressiveness**: Level 2 (balanced)

### VAD (Voice Activity Detection)

- Analyzes audio in 30ms frames
- Requires >20% of frames to contain speech
- Skips transcription for silent chunks (saves compute)

### Thread Safety

- Background recording thread
- Thread-safe queue for audio chunks
- Session manager handles concurrent access

## Dependencies

- `faster-whisper` - Fast transcription model
- `pyaudio` - Microphone capture (requires PortAudio)
- `webrtcvad` - Voice activity detection
- `numpy` - Audio processing

## Installation

```bash
# macOS - install PortAudio first
brew install portaudio

# Install Python dependencies
uv sync

# Run server
uv run python main.py
```

## Troubleshooting

### PortAudio not found

If you get `portaudio.h file not found` error:

```bash
brew install portaudio
```

### No microphone detected

Make sure your microphone is connected and has permissions in System Preferences > Security & Privacy > Microphone

### WebSocket connection refused

Ensure the server is running and check the port:

```bash
uv run python main.py
```

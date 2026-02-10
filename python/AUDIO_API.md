# Audio Transcription API

Microphone-only transcription API with two control endpoints.

## Endpoints

### Start Listening

```bash
POST /transcription/start-listening
```

Optional JSON body:

```json
{
  "vad_threshold": 0.013,
  "pre_roll_seconds": 0.5,
  "silence_timeout": 0.3,
  "max_chunk_duration": 5.0
}
```

Response:

```json
{
  "status": "recording",
  "session_id": "20260210_123456_789012",
  "message": "Recording started. Session ID: 20260210_123456_789012"
}
```

### Stop Listening

```bash
POST /transcription/stop-listening
```

Response:

```json
{
  "status": "stopped",
  "session_id": "20260210_123456_789012",
  "transcriptions": [
    {
      "text": "Hello world this is a test",
      "timestamp": "2026-02-10T12:34:56.789012",
      "is_final": true
    }
  ]
}
```

## Notes

- Input source is server microphone only (no file audio upload endpoint).
- Single active session model: starting a new session stops any existing active one.
- Invalid config values return `422 Unprocessable Entity`.

## Example

```javascript
const startRes = await fetch("http://localhost:8000/transcription/start-listening", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    vad_threshold: 0.013,
    pre_roll_seconds: 0.5,
    silence_timeout: 0.3,
    max_chunk_duration: 5.0,
  }),
});
const started = await startRes.json();
console.log(started);

const stopRes = await fetch("http://localhost:8000/transcription/stop-listening", {
  method: "POST",
});
const stopped = await stopRes.json();
console.log(stopped.transcriptions);
```

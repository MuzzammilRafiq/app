# Whisper Rust Backend

A high-performance Rust-based transcription server supporting both OpenAI Whisper and NVIDIA Parakeet models. Built with Axum for async HTTP handling and whisper-rs for local inference.

## Features

- **Dual Engine Support**: Switch between Whisper (GGML/GGUF) and Parakeet models
- **Async HTTP API**: Built with Axum for high concurrency
- **Request Queueing**: Configurable job queue with backpressure handling
- **Metal GPU Acceleration**: Supports Metal on macOS for faster inference
- **Health Checks**: Built-in health endpoint for monitoring
- **Request Size Limits**: Configurable max payload size protection

## Installation

### Prerequisites

- Rust 1.75+ (2024 edition)
- For Whisper: GGML or GGUF model file (e.g., from [huggingface](https://huggingface.co/ggerganov/whisper.cpp))
- For Parakeet: Model directory with ONNX files
- macOS with Metal (optional, for GPU acceleration)

### Build

```bash
# Clone the repository
cd ww

# Build release binary
cargo build --release

# Or run directly
cargo run -- --model-path /path/to/model.bin
```

## Usage

### Starting the Server

```bash
# Basic usage with Whisper model
cargo run -- --model-path /path/to/whisper.bin

# With custom bind address
cargo run -- \
  --model-path /path/to/whisper.bin \
  --bind 0.0.0.0:3000

# Using Parakeet engine
cargo run -- \
  --model-path /path/to/parakeet/model/dir \
  --engine parakeet

# Full configuration
cargo run -- \
  --model-path /path/to/model.bin \
  --engine whisper \
  --bind 127.0.0.1:8080 \
  --max-bytes 50000000 \
  --queue-capacity 8
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--model-path` | Path to model file (Whisper) or directory (Parakeet) | **Required** |
| `--engine` | Transcription engine: `whisper` or `parakeet` | `whisper` |
| `--bind` | Server bind address | `127.0.0.1:8080` |
| `--max-bytes` | Max request body size in bytes | `50_000_000` (50MB) |
| `--queue-capacity` | Max queued transcription jobs | `8` |

### API Endpoints

#### POST /transcribe

Transcribe PCM audio data.

**Headers:**
- `Content-Type: application/octet-stream` (required)

**Body:**
- Raw PCM audio data (16-bit little-endian, 16kHz sample rate, mono)

**Response:**
```json
{
  "text": "Transcribed text from audio"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/transcribe \
  -H "Content-Type: application/octet-stream" \
  --data-binary @audio.pcm
```

#### GET /health

Health check endpoint returning server status.

**Response:**
```json
{
  "status": "ok",
  "engine": "whisper",
  "model_path": "/path/to/model.bin"
}
```

### Python Test Client

The included `test_transcribe.py` provides a convenient way to test the server:

```bash
# Start server and test with synthetic audio
python test_transcribe.py --start-server --model-path /path/to/model.bin

# Test with microphone input
python test_transcribe.py --mic

# Test existing server
python test_transcribe.py --url http://localhost:8080/transcribe

# Stream microphone input continuously
python test_transcribe.py --listen --mic

# Full options
python test_transcribe.py \
  --start-server \
  --model-path /path/to/model.bin \
  --engine whisper \
  --bind 127.0.0.1:8080 \
  --max-bytes 50000000 \
  --queue-capacity 8 \
  --listen \
  --mic
```

## Audio Format

The server expects raw PCM audio with the following specifications:

- **Sample Rate**: 16,000 Hz (16 kHz)
- **Bit Depth**: 16-bit signed integer (little-endian)
- **Channels**: Mono (1 channel)
- **Format**: Raw PCM (no headers)

### Converting Audio

Use ffmpeg to convert audio files to the required format:

```bash
# Convert any audio file to PCM 16kHz mono
ffmpeg -i input.mp3 -ar 16000 -ac 1 -f s16le output.pcm

# Convert WAV to PCM
ffmpeg -i input.wav -ar 16000 -ac 1 -f s16le output.pcm
```

## Architecture

### Components

1. **HTTP Server** (`server.rs`): Axum-based async HTTP server with request routing
2. **Transcriber** (`transcriber.rs`): Abstraction over Whisper and Parakeet engines
3. **Audio Processing** (`audio.rs`): PCM format conversion and validation
4. **CLI** (`cli.rs`): Command-line argument parsing with clap

### Request Flow

1. Client sends PCM audio to `/transcribe`
2. Server validates Content-Type and payload size
3. Audio bytes converted to f32 samples
4. Job queued for transcription worker
5. Worker processes audio through selected engine
6. Response returned as JSON

### Worker Thread

The transcription runs in a dedicated worker thread to avoid blocking the async runtime:

- Single worker processes jobs sequentially
- Channel-based job queue with configurable capacity
- Warm-up inference on startup to initialize models
- Proper error handling and worker recovery

## Error Handling

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200 OK` | Successful transcription |
| `400 Bad Request` | Invalid audio payload or format |
| `415 Unsupported Media Type` | Missing or incorrect Content-Type |
| `503 Service Unavailable` | Queue full or worker unavailable |
| `500 Internal Server Error` | Transcription failure |

### Error Responses

Errors return plain text descriptions:

```
Content-Type must be application/octet-stream
Empty audio payload
PCM byte length must be even
transcription queue is full
```

## Performance Tuning

### Queue Capacity

Increase `--queue-capacity` for burst handling:

```bash
cargo run -- --model-path model.bin --queue-capacity 16
```

### Request Size

Adjust `--max-bytes` for longer audio:

```bash
# Allow up to 100MB (~17 minutes at 16kHz)
cargo run -- --model-path model.bin --max-bytes 100000000
```

### Chunked Processing

For real-time streaming, send audio in 5-10 second chunks:

```python
# Example: Process microphone stream in chunks
python test_transcribe.py --listen --mic
```

## Logging

Set log level via environment variable:

```bash
RUST_LOG=debug cargo run -- --model-path model.bin
```

Levels: `error`, `warn`, `info`, `debug`, `trace`

## Dependencies

- **axum**: Async web framework
- **whisper-rs**: OpenAI Whisper bindings with Metal support
- **transcribe-rs**: Parakeet transcription engine
- **tokio**: Async runtime
- **tower-http**: HTTP middleware (request limits)
- **anyhow**: Error handling
- **serde**: Serialization
- **clap**: CLI parsing

## Development

### Running Tests

```bash
# Run unit tests
cargo test

# Run with logging
cargo test -- --nocapture
```

### Project Structure

```
ww/
├── Cargo.toml
├── Cargo.lock
├── src/
│   ├── main.rs          # Entry point
│   ├── cli.rs           # CLI arguments
│   ├── server.rs        # HTTP server & worker
│   ├── transcriber.rs   # Engine abstraction
│   └── audio.rs         # Audio format handling
├── test_transcribe.py   # Python test client
├── models/              # Model storage (not in repo)
└── README.md
```

## Model Sources

### Whisper Models

Download GGML/GGUF models from:
- [whisper.cpp Models](https://huggingface.co/ggerganov/whisper.cpp)
- [OpenAI Whisper](https://github.com/openai/whisper)

Recommended: `ggml-base.bin` or `ggml-small.bin` for good quality/speed balance.

### Parakeet Models

Parakeet models require ONNX format in a directory structure. See [transcribe-rs documentation](https://docs.rs/transcribe-rs) for details.

## License

[Add your license here]

## Troubleshooting

### Model Loading Errors

```
Failed to load whisper model: ...
```
- Verify model file exists and is valid GGML/GGUF format
- Check file permissions
- Ensure sufficient RAM (models range 100MB-3GB)

### Audio Format Errors

```
PCM byte length must be even
```
- Ensure audio is 16-bit PCM (2 bytes per sample)
- Check ffmpeg conversion command

### Queue Full Errors

```
transcription queue is full
```
- Increase `--queue-capacity`
- Add rate limiting on client side
- Process audio in smaller chunks

### Metal/GPU Issues

If Metal acceleration fails, the server falls back to CPU. Check logs for:
```
Metal not available, using CPU
```

## Examples

### Basic Transcription

```bash
# Terminal 1: Start server
cargo run -- --model-path models/ggml-base.bin

# Terminal 2: Send audio
curl -X POST http://localhost:8080/transcribe \
  -H "Content-Type: application/octet-stream" \
  --data-binary @sample.pcm
```

### Python Integration

```python
import urllib.request

# Read PCM audio
with open('audio.pcm', 'rb') as f:
    audio_data = f.read()

# Send request
req = urllib.request.Request(
    'http://localhost:8080/transcribe',
    data=audio_data,
    headers={'Content-Type': 'application/octet-stream'},
    method='POST'
)

with urllib.request.urlopen(req) as response:
    result = response.read().decode('utf-8')
    print(result)  # {"text": "Hello world"}
```

### Batch Processing

```bash
#!/bin/bash
# Process multiple audio files

SERVER="http://localhost:8080/transcribe"

for file in *.pcm; do
    echo "Processing $file..."
    curl -X POST "$SERVER" \
      -H "Content-Type: application/octet-stream" \
      --data-binary "@$file" \
      -o "${file%.pcm}.json"
done
```

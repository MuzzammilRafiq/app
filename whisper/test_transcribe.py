import argparse
import concurrent.futures
import json
import math
import sys
import time
import urllib.request


SAMPLE_RATE_HZ = 16000
DURATION_SECONDS = 5
FREQUENCY_HZ = 440.0
AMPLITUDE = 0.2
BYTES_PER_SAMPLE = 2  # int16 mono
BYTES_PER_SECOND = SAMPLE_RATE_HZ * BYTES_PER_SAMPLE


class CircularBuffer:
    """Fixed-size circular buffer for pre-roll audio."""

    def __init__(self, duration_seconds, sample_rate=16000):
        self.max_samples = int(duration_seconds * sample_rate)
        self.buffer = bytearray()
        self.bytes_per_sample = 2  # int16

    def add(self, chunk):
        """Add audio chunk, discarding oldest if full."""
        self.buffer.extend(chunk)
        max_bytes = self.max_samples * self.bytes_per_sample
        if len(self.buffer) > max_bytes:
            # Keep only the most recent audio
            self.buffer = self.buffer[-max_bytes:]

    def get_all(self):
        """Get all buffered audio."""
        return bytes(self.buffer)

    def clear(self):
        """Clear the buffer."""
        self.buffer.clear()


def detect_voice_activity(samples, threshold=0.02):
    """
    Detect if audio samples contain voice activity using RMS energy.

    Args:
        samples: Audio samples (int16 numpy array)
        threshold: RMS energy threshold (0.0 to 1.0)

    Returns:
        True if voice activity detected
    """
    try:
        import numpy as np
    except Exception as exc:
        raise RuntimeError("numpy is required for VAD") from exc

    # Convert to float32 normalized [-1, 1]
    normalized = samples.astype(np.float32) / 32768.0

    # Calculate RMS energy
    rms = np.sqrt(np.mean(normalized**2))

    return rms > threshold


def build_pcm():
    total_samples = SAMPLE_RATE_HZ * DURATION_SECONDS
    samples = bytearray()
    for i in range(total_samples):
        t = i / SAMPLE_RATE_HZ
        value = math.sin(2.0 * math.pi * FREQUENCY_HZ * t) * AMPLITUDE
        i16 = int(max(-1.0, min(1.0, value)) * 32767.0)
        samples.extend(i16.to_bytes(2, byteorder="little", signed=True))
    return bytes(samples)


def record_pcm():
    try:
        import sounddevice as sd
        import numpy as np
    except Exception as exc:
        raise RuntimeError(
            "sounddevice and numpy are required for microphone recording"
        ) from exc

    frames = int(SAMPLE_RATE_HZ * DURATION_SECONDS)
    audio = sd.rec(frames, samplerate=SAMPLE_RATE_HZ, channels=1, dtype="int16")
    sd.wait()
    return np.asarray(audio).reshape(-1).tobytes()


def stream_with_vad(
    chunk_size_seconds=0.1,
    max_duration=5.0,
    pre_roll_duration=0.5,
    silence_timeout=0.3,
    vad_threshold=0.02,
):
    """
    Stream audio with voice activity detection.

    Yields audio chunks only when speech is detected, with:
    - Pre-roll buffer to capture start of speech (default 0.5 sec)
    - Maximum chunk duration (default 5 sec)
    - Automatic cutoff after silence timeout (default 0.3 sec)

    Args:
        chunk_size_seconds: Size of each read for responsive VAD (default 0.1 sec)
        max_duration: Maximum chunk duration in seconds (default 5.0)
        pre_roll_duration: Pre-roll buffer duration in seconds (default 0.5)
        silence_timeout: Silence duration before ending speech (default 0.3)
        vad_threshold: VAD energy threshold 0.0-1.0 (default 0.02)

    Yields:
        bytes: PCM audio chunks when speech is detected
    """
    try:
        import sounddevice as sd
        import numpy as np
    except Exception as exc:
        raise RuntimeError(
            "sounddevice and numpy are required for microphone recording"
        ) from exc

    # Initialize buffers and state
    pre_roll = CircularBuffer(pre_roll_duration, SAMPLE_RATE_HZ)
    current_chunk = bytearray()
    speech_active = False
    silence_duration = 0.0
    chunk_duration = 0.0

    frames_per_read = max(1, int(SAMPLE_RATE_HZ * chunk_size_seconds))

    try:
        with sd.InputStream(
            samplerate=SAMPLE_RATE_HZ, channels=1, dtype="int16"
        ) as stream:
            while True:
                # Read small chunk for responsive VAD
                audio_chunk, _ = stream.read(frames_per_read)
                audio_array = np.asarray(audio_chunk).reshape(-1)
                audio_bytes = audio_array.tobytes()
                chunk_seconds = len(audio_bytes) / BYTES_PER_SECOND

                # Always update pre-roll buffer
                pre_roll.add(audio_bytes)

                # Check for voice activity
                has_voice = detect_voice_activity(audio_array, vad_threshold)

                if has_voice:
                    if not speech_active:
                        # Start new speech segment with pre-roll
                        speech_active = True
                        current_chunk = bytearray(pre_roll.get_all())
                        chunk_duration = len(current_chunk) / BYTES_PER_SECOND
                        silence_duration = 0.0

                    # Add current audio
                    current_chunk.extend(audio_bytes)
                    chunk_duration += chunk_seconds
                    silence_duration = 0.0

                    # Check if chunk is full
                    if chunk_duration >= max_duration:
                        yield bytes(current_chunk)
                        current_chunk = bytearray()
                        chunk_duration = 0.0
                        # Stay in speech_active mode

                elif speech_active:
                    # No voice, but we're in speech mode
                    current_chunk.extend(audio_bytes)
                    chunk_duration += chunk_seconds
                    silence_duration += chunk_seconds

                    # Check for silence timeout or max duration
                    if (
                        silence_duration >= silence_timeout
                        or chunk_duration >= max_duration
                    ):
                        yield bytes(current_chunk)
                        current_chunk = bytearray()
                        chunk_duration = 0.0
                        silence_duration = 0.0
                        speech_active = False
    except KeyboardInterrupt:
        # Allow graceful shutdown with a final flush below.
        pass

    if speech_active and current_chunk:
        yield bytes(current_chunk)


def send_request(url, payload):
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/octet-stream"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8")


def send_request_timed(url, payload, chunk_id):
    started = time.perf_counter()
    body = send_request(url, payload)
    elapsed = time.perf_counter() - started
    return chunk_id, elapsed, body


def print_response(body):
    try:
        parsed = json.loads(body)
        print(json.dumps(parsed, indent=2))
    except json.JSONDecodeError:
        print(body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8080/transcribe")
    parser.add_argument("--mic", action="store_true")
    parser.add_argument("--listen", action="store_true")
    parser.add_argument("--queue-capacity", type=int, default=8)
    parser.add_argument(
        "--vad-threshold",
        type=float,
        default=0.013,
        help="Voice activity detection threshold (0.0-1.0)",
    )
    parser.add_argument(
        "--pre-roll-seconds",
        type=float,
        default=0.5,
        help="Pre-roll buffer duration in seconds",
    )
    parser.add_argument(
        "--silence-timeout",
        type=float,
        default=0.3,
        help="Silence duration before ending speech segment",
    )
    parser.add_argument(
        "--max-chunk-duration",
        type=float,
        default=5.0,
        help="Maximum chunk duration in seconds",
    )
    args = parser.parse_args()

    try:
        if args.listen:
            if not args.mic:
                args.mic = True
            pending = []
            max_in_flight = max(1, args.queue_capacity)
            max_pending = max_in_flight * 2
            chunk_id = 0
            dropped_chunks = 0
            dropped_bytes = 0
            
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=max_in_flight
            ) as executor:
                print(
                    f"[INFO] Using VAD-aware streaming (threshold={args.vad_threshold}, "
                    f"pre-roll={args.pre_roll_seconds}s, silence-timeout={args.silence_timeout}s, "
                    f"max-chunk={args.max_chunk_duration}s)"
                )
                stream = stream_with_vad(
                    chunk_size_seconds=0.1,
                    max_duration=args.max_chunk_duration,
                    pre_roll_duration=args.pre_roll_seconds,
                    silence_timeout=args.silence_timeout,
                    vad_threshold=args.vad_threshold,
                )
                
                for payload in stream:
                    chunk_id += 1

                    # Handle completed requests
                    done_now = []
                    for future in pending:
                        if future.done():
                            done_now.append(future)
                    if done_now:
                        for future in done_now:
                            try:
                                finished_id, elapsed, body = future.result()
                                print(f"chunk {finished_id} took {elapsed:.2f}s")
                                print_response(body)
                            except Exception as exc:
                                print(f"Request failed: {exc}", file=sys.stderr)
                            pending.remove(future)

                    can_send = len(pending) < max_pending

                    # VAD mode: send immediately
                    duration = len(payload) / BYTES_PER_SECOND
                    if can_send:
                        print(
                            f"[VAD] Sending chunk {chunk_id}, size: {len(payload)} bytes, "
                            f"duration: {duration:.2f}s"
                        )
                        pending.append(
                            executor.submit(
                                send_request_timed, args.url, payload, chunk_id
                            )
                        )
                    else:
                        dropped_chunks += 1
                        dropped_bytes += len(payload)
                        if dropped_chunks == 1 or dropped_chunks % 10 == 0:
                            print(
                                f"[WARN] Dropping VAD chunk {chunk_id} due to backlog "
                                f"(dropped={dropped_chunks}, bytes={dropped_bytes})",
                                file=sys.stderr,
                            )
        else:
            payload = record_pcm() if args.mic else build_pcm()
            started = time.perf_counter()
            body = send_request(args.url, payload)
            elapsed = time.perf_counter() - started
            print(f"chunk 1 took {elapsed:.2f}s")
            print_response(body)
    except KeyboardInterrupt:
        pass
    finally:
        if "pending" in locals() and pending:
            done_now, _ = concurrent.futures.wait(pending, timeout=5)
            for future in list(done_now):
                try:
                    finished_id, elapsed, body = future.result()
                    print(f"chunk {finished_id} took {elapsed:.2f}s")
                    print_response(body)
                except Exception as exc:
                    print(f"Request failed: {exc}", file=sys.stderr)
                pending.remove(future)
            if pending:
                for future in pending:
                    future.cancel()
                print(
                    f"[WARN] {len(pending)} request(s) still in flight; exiting.",
                    file=sys.stderr,
                )

if __name__ == "__main__":
    main()

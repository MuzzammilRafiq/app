import io
import threading
import time
import wave
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pyaudio
from faster_whisper import WhisperModel
from fastapi import APIRouter, Body, HTTPException
from logger import log_error, log_info, log_warning
from pydantic import BaseModel, Field

audio_router = APIRouter()


SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2  # int16 mono
BYTES_PER_SECOND = SAMPLE_RATE * BYTES_PER_SAMPLE
READ_INTERVAL_SECONDS = 0.1
DEFAULT_TRANSCRIPTION_LANGUAGE = "en"


class StartListeningRequest(BaseModel):
    vad_threshold: float = Field(default=0.013, ge=0.0, le=1.0)
    pre_roll_seconds: float = Field(default=0.5, gt=0.0)
    silence_timeout: float = Field(default=0.3, gt=0.0)
    max_chunk_duration: float = Field(default=5.0, gt=0.0)


class StartResponse(BaseModel):
    status: str
    session_id: str
    message: str


class StopResponse(BaseModel):
    status: str
    session_id: str
    transcriptions: List[Dict[str, Any]]


class AudioSession:
    def __init__(self, config: StartListeningRequest):
        self.is_recording = False
        self.config = config
        self.transcriptions: List[Dict[str, Any]] = []
        self.thread: Optional[threading.Thread] = None
        self.stop_event = threading.Event()
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")


class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, AudioSession] = {}
        self.model: Optional[WhisperModel] = None

    def get_or_create_model(self) -> WhisperModel:
        if self.model is None:
            log_info("Loading Whisper model (small.en)...")
            self.model = WhisperModel("small.en", compute_type="int8")
            log_info("Whisper model loaded successfully")
        return self.model

    def create_session(self, config: StartListeningRequest) -> AudioSession:
        session = AudioSession(config)
        self.sessions[session.session_id] = session
        return session

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]


session_manager = SessionManager()


class CircularBuffer:
    """Fixed-size circular buffer for pre-roll audio."""

    def __init__(self, duration_seconds: float, sample_rate: int = SAMPLE_RATE):
        self.max_samples = int(duration_seconds * sample_rate)
        self.bytes_per_sample = BYTES_PER_SAMPLE
        self.buffer = bytearray()

    def add(self, chunk: bytes):
        self.buffer.extend(chunk)
        max_bytes = self.max_samples * self.bytes_per_sample
        if len(self.buffer) > max_bytes:
            self.buffer = self.buffer[-max_bytes:]

    def get_all(self) -> bytes:
        return bytes(self.buffer)

    def clear(self):
        self.buffer.clear()


def detect_voice_activity(samples: np.ndarray, threshold: float) -> bool:
    """Detect if audio samples contain voice activity using RMS energy."""
    if samples.size == 0:
        return False
    normalized = samples.astype(np.float32) / 32768.0
    rms = float(np.sqrt(np.mean(normalized**2)))
    return rms > threshold


def transcribe_audio(audio_bytes: bytes, model: WhisperModel) -> Optional[str]:
    """Transcribe audio bytes using Whisper."""
    try:
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(BYTES_PER_SAMPLE)
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(audio_bytes)

        wav_buffer.seek(0)

        segments, _ = model.transcribe(
            wav_buffer,
            language=DEFAULT_TRANSCRIPTION_LANGUAGE,
            condition_on_previous_text=True,
        )

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)

        result = " ".join(text_parts).strip()
        return result if result else None
    except Exception as exc:
        log_error(f"Transcription error: {exc}")
        return None


def add_transcription(session: AudioSession, text: str):
    transcription = {
        "text": text,
        "timestamp": datetime.now().isoformat(),
        "is_final": True,
    }
    session.transcriptions.append(transcription)
    log_info(f"Transcription: {text[:50]}...")


def process_speech_chunk(session: AudioSession, model: WhisperModel, chunk: bytes):
    text = transcribe_audio(chunk, model)
    if text:
        add_transcription(session, text)


def record_audio_thread(session: AudioSession, model: WhisperModel):
    """Background thread for microphone capture and VAD-driven transcription."""
    log_info(f"Starting audio recording thread for session {session.session_id}")

    p = pyaudio.PyAudio()
    stream = None

    try:
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=max(1, int(SAMPLE_RATE * READ_INTERVAL_SECONDS)),
        )

        config = session.config
        pre_roll = CircularBuffer(config.pre_roll_seconds, SAMPLE_RATE)
        current_chunk = bytearray()
        speech_active = False
        silence_duration = 0.0
        chunk_duration = 0.0
        frames_per_read = max(1, int(SAMPLE_RATE * READ_INTERVAL_SECONDS))

        while not session.stop_event.is_set():
            try:
                audio_bytes = stream.read(frames_per_read, exception_on_overflow=False)
                chunk_seconds = len(audio_bytes) / BYTES_PER_SECOND
                audio_array = np.frombuffer(audio_bytes, dtype=np.int16)

                pre_roll.add(audio_bytes)
                has_voice = detect_voice_activity(audio_array, config.vad_threshold)

                if has_voice:
                    if not speech_active:
                        speech_active = True
                        current_chunk = bytearray(pre_roll.get_all())
                        chunk_duration = len(current_chunk) / BYTES_PER_SECOND
                        silence_duration = 0.0

                    current_chunk.extend(audio_bytes)
                    chunk_duration += chunk_seconds
                    silence_duration = 0.0

                    if chunk_duration >= config.max_chunk_duration:
                        process_speech_chunk(session, model, bytes(current_chunk))
                        current_chunk = bytearray()
                        chunk_duration = 0.0
                        silence_duration = 0.0
                elif speech_active:
                    current_chunk.extend(audio_bytes)
                    chunk_duration += chunk_seconds
                    silence_duration += chunk_seconds

                    if (
                        silence_duration >= config.silence_timeout
                        or chunk_duration >= config.max_chunk_duration
                    ):
                        process_speech_chunk(session, model, bytes(current_chunk))
                        current_chunk = bytearray()
                        chunk_duration = 0.0
                        silence_duration = 0.0
                        speech_active = False
                        pre_roll.clear()
            except Exception as exc:
                log_error(f"Error in recording loop: {exc}")
                time.sleep(0.1)

        if speech_active and current_chunk:
            process_speech_chunk(session, model, bytes(current_chunk))
    except Exception as exc:
        log_error(f"Error opening audio stream: {exc}")
    finally:
        if stream is not None:
            try:
                stream.stop_stream()
                stream.close()
            except Exception:
                pass
        p.terminate()
        log_info(f"Audio recording thread stopped for session {session.session_id}")


def get_active_session() -> tuple[Optional[str], Optional[AudioSession]]:
    for sid, sess in list(session_manager.sessions.items()):
        if sess.is_recording:
            return sid, sess
    return None, None


def create_and_start_session(config: StartListeningRequest) -> AudioSession:
    for sid, sess in list(session_manager.sessions.items()):
        if sess.is_recording:
            log_warning(f"Stopping existing session {sid}")
            sess.stop_event.set()
            sess.is_recording = False
            if sess.thread and sess.thread.is_alive():
                sess.thread.join(timeout=2)
            session_manager.remove_session(sid)

    session = session_manager.create_session(config)
    session.is_recording = True

    model = session_manager.get_or_create_model()
    session.thread = threading.Thread(
        target=record_audio_thread,
        args=(session, model),
        daemon=True,
    )
    session.thread.start()
    return session


def start_session(config: StartListeningRequest) -> StartResponse:
    session = create_and_start_session(config)
    log_info(f"Started recording session: {session.session_id}")
    return StartResponse(
        status="recording",
        session_id=session.session_id,
        message=f"Recording started. Session ID: {session.session_id}",
    )


def stop_active_session() -> StopResponse:
    active_id, active_session = get_active_session()
    if not active_session or not active_id:
        log_warning("No active recording session found")
        raise HTTPException(status_code=404, detail="No active recording session")

    session_id = active_id
    active_session.stop_event.set()
    active_session.is_recording = False

    if active_session.thread and active_session.thread.is_alive():
        active_session.thread.join(timeout=5)

    transcriptions = active_session.transcriptions.copy()
    session_manager.remove_session(session_id)

    log_info(f"Stopped recording session: {session_id}")
    return StopResponse(
        status="stopped",
        session_id=session_id,
        transcriptions=transcriptions,
    )


@audio_router.post("/transcription/start-listening", response_model=StartResponse)
async def start_listening(
    config: Optional[StartListeningRequest] = Body(default=None),
):
    """Start microphone listening/transcription session."""
    return start_session(config or StartListeningRequest())


@audio_router.post("/transcription/stop-listening", response_model=StopResponse)
async def stop_listening():
    """Stop listening and return captured transcription segments."""
    return stop_active_session()

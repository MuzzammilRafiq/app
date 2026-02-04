from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
import threading
import queue
import time
import numpy as np
import io
import wave
from faster_whisper import WhisperModel
import webrtcvad
import pyaudio
from typing import Optional, Dict, Any, List
from logger import log_info, log_error, log_warning
import asyncio
from datetime import datetime

audio_router = APIRouter()


# Global state
class AudioSession:
    def __init__(self):
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.transcriptions: List[Dict[str, Any]] = []
        self.thread: Optional[threading.Thread] = None
        self.stop_event = threading.Event()
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")


# Singleton session manager
class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, AudioSession] = {}
        self.model: Optional[WhisperModel] = None
        self.vad: Optional[webrtcvad.Vad] = None

    def get_or_create_model(self) -> WhisperModel:
        if self.model is None:
            log_info("Loading Whisper model (small.en)...")
            self.model = WhisperModel("small.en", compute_type="int8")
            log_info("Whisper model loaded successfully")
        return self.model

    def get_or_create_vad(self) -> webrtcvad.Vad:
        if self.vad is None:
            self.vad = webrtcvad.Vad(2)  # Aggressiveness 0-3, 2 is balanced
        return self.vad

    def create_session(self) -> AudioSession:
        session = AudioSession()
        self.sessions[session.session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[AudioSession]:
        return self.sessions.get(session_id)

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]


session_manager = SessionManager()

# Audio configuration
CHUNK_DURATION = 5  # seconds
SAMPLE_RATE = 16000  # 16kHz required by webrtcvad
FRAME_DURATION_MS = 30  # 30ms frames for VAD
CHUNK_SIZE = int(SAMPLE_RATE * CHUNK_DURATION)


def has_speech(audio_bytes: bytes, vad: webrtcvad.Vad) -> bool:
    """Check if audio chunk contains speech using VAD."""
    frame_duration = FRAME_DURATION_MS
    frame_bytes = int(SAMPLE_RATE * frame_duration / 1000) * 2  # 16-bit = 2 bytes

    # Process frames
    offset = 0
    speech_frames = 0
    total_frames = 0

    while offset + frame_bytes <= len(audio_bytes):
        frame = audio_bytes[offset : offset + frame_bytes]
        try:
            is_speech = vad.is_speech(frame, SAMPLE_RATE)
            if is_speech:
                speech_frames += 1
            total_frames += 1
        except:
            pass
        offset += frame_bytes

    # Require at least 20% of frames to have speech
    if total_frames == 0:
        return False
    return (speech_frames / total_frames) > 0.2


def transcribe_audio(audio_bytes: bytes, model: WhisperModel) -> Optional[str]:
    """Transcribe audio bytes using Whisper."""
    try:
        # Convert to WAV format in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(audio_bytes)

        wav_buffer.seek(0)

        # Transcribe
        segments, info = model.transcribe(
            wav_buffer, language="en", condition_on_previous_text=True
        )

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)

        result = " ".join(text_parts).strip()
        return result if result else None

    except Exception as e:
        log_error(f"Transcription error: {e}")
        return None


def record_audio_thread(
    session: AudioSession,
    session_manager: SessionManager,
    model: Optional[WhisperModel],
    vad: Optional[webrtcvad.Vad],
):
    """Background thread for recording audio."""
    log_info(f"Starting audio recording thread for session {session.session_id}")

    # Lazy load model and VAD inside the thread
    if model is None:
        model = session_manager.get_or_create_model()
    if vad is None:
        vad = session_manager.get_or_create_vad()

    p = pyaudio.PyAudio()
    stream = None

    try:
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=int(SAMPLE_RATE * 0.1),  # 100ms buffer
        )

        log_info("Audio stream opened successfully")

        buffer = bytearray()
        chunk_target = CHUNK_SIZE * 2  # 16-bit = 2 bytes per sample

        while not session.stop_event.is_set():
            try:
                # Read audio data (timeout to allow checking stop_event)
                data = stream.read(int(SAMPLE_RATE * 0.1), exception_on_overflow=False)
                buffer.extend(data)

                # Process when we have enough data
                while len(buffer) >= chunk_target:
                    chunk = bytes(buffer[:chunk_target])
                    buffer = buffer[chunk_target:]

                    # Check for speech using VAD
                    if has_speech(chunk, vad):
                        log_info(
                            f"Speech detected in session {session.session_id}, transcribing..."
                        )
                        text = transcribe_audio(chunk, model)

                        if text:
                            transcription = {
                                "text": text,
                                "timestamp": datetime.now().isoformat(),
                                "is_final": True,
                            }
                            session.transcriptions.append(transcription)
                            session.audio_queue.put(transcription)
                            log_info(f"Transcription: {text[:50]}...")
                    else:
                        log_info(
                            f"No speech detected in session {session.session_id}, skipping..."
                        )

            except Exception as e:
                log_error(f"Error in recording loop: {e}")
                time.sleep(0.1)

    except Exception as e:
        log_error(f"Error opening audio stream: {e}")
    finally:
        if stream is not None:
            try:
                stream.stop_stream()
                stream.close()
            except:
                pass
        p.terminate()
        log_info(f"Audio recording thread stopped for session {session.session_id}")


# HTTP Endpoints


class StartResponse(BaseModel):
    status: str
    session_id: str
    message: str


class StopResponse(BaseModel):
    status: str
    session_id: str
    transcriptions: List[Dict[str, Any]]


class StatusResponse(BaseModel):
    status: str
    session_id: Optional[str]
    is_recording: bool
    transcription_count: int


@audio_router.post("/audio/start", response_model=StartResponse)
async def start_recording():
    """Start audio recording session."""
    # Stop any existing recording
    for sid, sess in list(session_manager.sessions.items()):
        if sess.is_recording:
            log_warning(f"Stopping existing session {sid}")
            sess.stop_event.set()
            if sess.thread and sess.thread.is_alive():
                sess.thread.join(timeout=2)
            session_manager.remove_session(sid)

    # Create new session
    session = session_manager.create_session()
    session.is_recording = True

    # Start recording thread (model will be loaded inside the thread)
    session.thread = threading.Thread(
        target=record_audio_thread,
        args=(session, session_manager, None, None),
        daemon=True,
    )
    session.thread.start()

    log_info(f"Started recording session: {session.session_id}")

    return StartResponse(
        status="recording",
        session_id=session.session_id,
        message=f"Recording started. Session ID: {session.session_id}",
    )


@audio_router.post("/audio/stop", response_model=StopResponse)
async def stop_recording():
    """Stop audio recording session."""
    # Find active session
    active_session = None
    active_id: str = ""

    for sid, sess in session_manager.sessions.items():
        if sess.is_recording:
            active_session = sess
            active_id = sid
            break

    if not active_session or not active_id:
        log_warning("No active recording session found")
        raise HTTPException(status_code=404, detail="No active recording session")

    # At this point, active_id is guaranteed to be a non-empty string
    session_id: str = active_id

    # Stop recording
    active_session.stop_event.set()
    active_session.is_recording = False

    if active_session.thread and active_session.thread.is_alive():
        active_session.thread.join(timeout=5)

    log_info(f"Stopped recording session: {session_id}")

    # Prepare response
    transcriptions = active_session.transcriptions.copy()

    # Cleanup
    session_manager.remove_session(session_id)

    return StopResponse(
        status="stopped", session_id=session_id, transcriptions=transcriptions
    )


@audio_router.get("/audio/status", response_model=StatusResponse)
async def get_status():
    """Get current recording status."""
    for sid, sess in session_manager.sessions.items():
        if sess.is_recording:
            return StatusResponse(
                status="active",
                session_id=sid,
                is_recording=True,
                transcription_count=len(sess.transcriptions),
            )

    return StatusResponse(
        status="idle", session_id=None, is_recording=False, transcription_count=0
    )


# WebSocket Endpoint


@audio_router.websocket("/audio/stream")
async def websocket_stream(websocket: WebSocket):
    """WebSocket endpoint for real-time transcription streaming."""
    await websocket.accept()
    log_info("WebSocket connection established")

    # Start recording if not already
    session = None
    for sid, sess in session_manager.sessions.items():
        if sess.is_recording:
            session = sess
            break

    if not session:
        # Auto-start recording (model will be loaded in thread)
        session = session_manager.create_session()
        session.is_recording = True
        session.thread = threading.Thread(
            target=record_audio_thread,
            args=(session, session_manager, None, None),
            daemon=True,
        )
        session.thread.start()
        await websocket.send_json(
            {"type": "status", "status": "started", "session_id": session.session_id}
        )

    sent_count = 0
    try:
        # Stream transcriptions
        while session.is_recording:
            # Check for new transcriptions
            while sent_count < len(session.transcriptions):
                transcription = session.transcriptions[sent_count]
                await websocket.send_json(
                    {"type": "transcription", "data": transcription}
                )
                sent_count += 1

            # Small delay to prevent busy-waiting
            await asyncio.sleep(0.1)

            # Check for stop command from client
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                if message == "stop":
                    break
            except asyncio.TimeoutError:
                pass

    except WebSocketDisconnect:
        log_info("WebSocket disconnected")
    except Exception as e:
        log_error(f"WebSocket error: {e}")
    finally:
        # Cleanup
        if session and session.is_recording:
            session.stop_event.set()
            session.is_recording = False
            if session.thread and session.thread.is_alive():
                session.thread.join(timeout=2)

            # Send final transcriptions
            try:
                final_transcriptions = session.transcriptions[sent_count:]
                for transcription in final_transcriptions:
                    try:
                        await websocket.send_json(
                            {"type": "transcription", "data": transcription}
                        )
                    except:
                        break
            except NameError:
                pass  # sent_count not defined yet

            if session.session_id:
                session_manager.remove_session(session.session_id)

        try:
            await websocket.close()
        except:
            pass

        log_info("WebSocket connection closed")


# Import HTTPException for error handling
from fastapi import HTTPException

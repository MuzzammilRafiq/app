use crate::audio;
use crate::cli::EngineKind;
use crate::transcriber::Transcriber;
use anyhow::{anyhow, Result};
use axum::{
    body::Bytes,
    extract::State,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use log::{info, warn};
use serde::Serialize;
use std::sync::Arc;
use std::{fmt, fmt::Display};
use tokio::sync::{mpsc, oneshot};
use tower_http::limit::RequestBodyLimitLayer;

#[derive(Clone, Debug)]
pub struct ServerConfig {
    pub engine: EngineKind,
    pub model_path: String,
    pub bind: String,
    pub max_bytes: usize,
    pub queue_capacity: usize,
}

#[derive(Clone)]
struct AppState {
    worker: WorkerClient,
    config: Arc<ServerConfig>,
}

#[derive(Debug)]
struct Job {
    audio: Vec<f32>,
    reply: oneshot::Sender<Result<String, String>>,
}

#[derive(Clone)]
struct WorkerClient {
    sender: mpsc::Sender<Job>,
}

impl WorkerClient {
    fn new(sender: mpsc::Sender<Job>) -> Self {
        Self { sender }
    }

    async fn transcribe(
        &self,
        audio: Vec<f32>,
    ) -> Result<String, WorkerError> {
        let (reply_tx, reply_rx) = oneshot::channel();
        let job = Job {
            audio,
            reply: reply_tx,
        };

        self.sender
            .try_send(job)
            .map_err(|err| match err {
                mpsc::error::TrySendError::Closed(_) => WorkerError::WorkerGone,
                mpsc::error::TrySendError::Full(_) => WorkerError::QueueFull,
            })?;

        match reply_rx.await {
            Ok(Ok(text)) => Ok(text),
            Ok(Err(err)) => Err(WorkerError::Transcription(err)),
            Err(_) => Err(WorkerError::WorkerGone),
        }
    }
}

#[derive(Debug)]
enum WorkerError {
    QueueFull,
    WorkerGone,
    Transcription(String),
}

impl WorkerError {
    fn status_code(&self) -> StatusCode {
        match self {
            WorkerError::QueueFull => StatusCode::SERVICE_UNAVAILABLE,
            WorkerError::WorkerGone => StatusCode::SERVICE_UNAVAILABLE,
            WorkerError::Transcription(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl Display for WorkerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WorkerError::QueueFull => write!(f, "transcription queue is full"),
            WorkerError::WorkerGone => write!(f, "transcription worker unavailable"),
            WorkerError::Transcription(err) => write!(f, "transcription failed: {err}"),
        }
    }
}

#[derive(Debug, Serialize)]
struct TranscribeResponse {
    text: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    engine: String,
    model_path: String,
}

pub async fn run(config: ServerConfig) -> Result<()> {
    let bind_addr = config.bind.clone();
    let max_bytes = config.max_bytes;
    let (tx, rx) = mpsc::channel::<Job>(config.queue_capacity);
    spawn_worker(config.engine, &config.model_path, rx)?;

    let state = AppState {
        worker: WorkerClient::new(tx),
        config: Arc::new(config),
    };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/transcribe", post(transcribe_handler))
        .layer(RequestBodyLimitLayer::new(max_bytes))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    info!("HTTP server listening on {}", bind_addr);
    axum::serve(listener, app).await?;
    Ok(())
}

fn spawn_worker(engine: EngineKind, model_path: &str, rx: mpsc::Receiver<Job>) -> Result<()> {
    let mut transcriber = Transcriber::new(engine, model_path)?;
    info!("Loaded model for engine {} from {}", engine.as_str(), model_path);
    let warmup = audio::silent_chunk();
    if let Err(err) = transcriber.transcribe(warmup) {
        warn!("Warm-up inference failed: {}", err);
    }
    std::thread::Builder::new()
        .name("transcription-worker".to_string())
        .spawn(move || worker_loop(&mut transcriber, rx))
        .map_err(|e| anyhow!("Failed to spawn worker thread: {e}"))?;
    info!("Transcription worker ready");
    Ok(())
}

fn worker_loop(transcriber: &mut Transcriber, mut rx: mpsc::Receiver<Job>) {
    while let Some(job) = rx.blocking_recv() {
        let result = transcriber
            .transcribe(job.audio)
            .map_err(|err| err.to_string());
        let _ = job.reply.send(result);
    }
}

async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        engine: state.config.engine.as_str().to_string(),
        model_path: state.config.model_path.clone(),
    })
}

async fn transcribe_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<axum::response::Response, (StatusCode, String)> {
    let started = std::time::Instant::now();
    let content_type = headers.get(header::CONTENT_TYPE).and_then(|v| v.to_str().ok());
    if content_type != Some("application/octet-stream") {
        return Err((
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "Content-Type must be application/octet-stream".to_string(),
        ));
    }
    if body.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Empty audio payload".to_string()));
    }
    info!("Received PCM audio ({} bytes)", body.len());
    let audio = audio::load_pcm_i16le_bytes(&body)
        .map_err(|err| (StatusCode::BAD_REQUEST, err.to_string()))?;
    if audio.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No audio samples found".to_string()));
    }

    let text = state
        .worker
        .transcribe(audio)
        .await
        .map_err(|err| {
            let status = err.status_code();
            warn!("Transcription failed: {}", err);
            (status, err.to_string())
        })?;

    let response = TranscribeResponse {
        text,
    };

    info!("Transcription completed in {:?}", started.elapsed());
    let mut response = Json(response).into_response();
    response
        .headers_mut()
        .insert(header::CONNECTION, HeaderValue::from_static("keep-alive"));
    Ok(response)
}

use clap::{Parser, ValueEnum};

#[derive(Parser, Debug)]
#[command(name = "whisper-cli")]
#[command(about = "Long-running transcription server")]
#[command(version)]
pub struct Cli {
    /// Engine to use
    #[arg(long, value_enum, default_value = "whisper")]
    pub engine: EngineKind,
    /// Path to Whisper model file (GGML/GGUF) or Parakeet model directory
    #[arg(long = "model-path")]
    pub model_path: String,
    /// Bind address, e.g. 127.0.0.1:8080
    #[arg(long, default_value = "127.0.0.1:8080")]
    pub bind: String,
    /// Max request body size in bytes
    #[arg(long, default_value_t = 50_000_000)]
    pub max_bytes: usize,
    /// Max number of queued transcription jobs
    #[arg(long, default_value_t = 8)]
    pub queue_capacity: usize,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, ValueEnum)]
pub enum EngineKind {
    Whisper,
    Parakeet,
}

impl EngineKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            EngineKind::Whisper => "whisper",
            EngineKind::Parakeet => "parakeet",
        }
    }
}

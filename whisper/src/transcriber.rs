use crate::cli::EngineKind;
use anyhow::{anyhow, Result};
use std::path::Path;
use transcribe_rs::{
    engines::parakeet::{
        ParakeetEngine, ParakeetInferenceParams, ParakeetModelParams, TimestampGranularity,
    },
    TranscriptionEngine,
};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

enum LoadedEngine {
    Whisper(WhisperContext),
    Parakeet(Box<ParakeetEngine>),
}

pub struct Transcriber {
    engine: LoadedEngine,
}

impl Transcriber {
    pub fn new(engine: EngineKind, model_path: impl AsRef<Path>) -> Result<Self> {
        let path = model_path.as_ref();
        if !path.exists() {
            return Err(anyhow!("Model path not found: {:?}", path));
        }

        let engine = match engine {
            EngineKind::Whisper => {
                if !path.is_file() {
                    return Err(anyhow!("Whisper model path must be a file"));
                }
                let ctx_params = WhisperContextParameters::default();
                let context = WhisperContext::new_with_params(
                    path.to_str().ok_or_else(|| anyhow!("Invalid model path"))?,
                    ctx_params,
                )
                .map_err(|e| anyhow!("Failed to load whisper model: {}", e))?;
                LoadedEngine::Whisper(context)
            }
            EngineKind::Parakeet => {
                if !path.is_dir() {
                    return Err(anyhow!("Parakeet model path must be a directory"));
                }
                let mut engine = ParakeetEngine::new();
                engine
                    .load_model_with_params(path, ParakeetModelParams::int8())
                    .map_err(|e| anyhow!("Failed to load parakeet model: {}", e))?;
                LoadedEngine::Parakeet(Box::new(engine))
            }
        };

        Ok(Self { engine })
    }

    pub fn transcribe(&mut self, audio: Vec<f32>) -> Result<String> {
        match &mut self.engine {
            LoadedEngine::Whisper(context) => {
                let mut state = context
                    .create_state()
                    .map_err(|e| anyhow!("Failed to create state: {}", e))?;

                let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
                params.set_language(None);
                params.set_translate(false);
                params.set_print_special(false);
                params.set_print_progress(false);
                params.set_print_realtime(false);
                params.set_print_timestamps(false);

                state
                    .full(params, &audio)
                    .map_err(|e| anyhow!("Whisper transcription failed: {}", e))?;

                let num_segments = state
                    .full_n_segments()
                    .map_err(|e| anyhow!("Failed to get segments: {}", e))?;

                let mut text = String::new();
                for i in 0..num_segments {
                    let segment = state
                        .full_get_segment_text(i)
                        .map_err(|e| anyhow!("Failed to get segment: {}", e))?;
                    text.push_str(&segment);
                    text.push(' ');
                }

                Ok(text.trim().to_string())
            }
            LoadedEngine::Parakeet(engine) => {
                let params = ParakeetInferenceParams {
                    timestamp_granularity: TimestampGranularity::Segment,
                };
                let result = engine
                    .transcribe_samples(audio, Some(params))
                    .map_err(|e| anyhow!("Parakeet transcription failed: {}", e))?;
                Ok(result.text)
            }
        }
    }
}

use anyhow::{anyhow, Result};

pub const SAMPLE_RATE_HZ: usize = 16_000;
pub const CHUNK_SECONDS: usize = 10;
pub const SAMPLES_PER_CHUNK: usize = SAMPLE_RATE_HZ * CHUNK_SECONDS;
pub const BYTES_PER_SAMPLE: usize = 2;

pub fn load_pcm_i16le_bytes(bytes: &[u8]) -> Result<Vec<f32>> {
    if bytes.is_empty() {
        return Err(anyhow!("Empty audio payload"));
    }
    if !bytes.len().is_multiple_of(BYTES_PER_SAMPLE) {
        return Err(anyhow!("PCM byte length must be even"));
    }

    let total_samples = bytes.len() / BYTES_PER_SAMPLE;
    let mut samples = Vec::with_capacity(total_samples);
    for chunk in bytes.chunks_exact(BYTES_PER_SAMPLE) {
        let value = i16::from_le_bytes([chunk[0], chunk[1]]);
        samples.push(value as f32 / i16::MAX as f32);
    }

    Ok(samples)
}

pub fn silent_chunk() -> Vec<f32> {
    vec![0.0; SAMPLES_PER_CHUNK]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_pcm_bytes_converts_to_f32() {
        let bytes = vec![0u8; SAMPLES_PER_CHUNK * BYTES_PER_SAMPLE];
        let samples = load_pcm_i16le_bytes(&bytes).unwrap();
        assert_eq!(samples.len(), SAMPLES_PER_CHUNK);
        assert!(samples.iter().all(|v| *v == 0.0));
    }

    #[test]
    fn load_pcm_rejects_odd_length() {
        let bytes = vec![0u8; SAMPLES_PER_CHUNK * BYTES_PER_SAMPLE - 1];
        let err = load_pcm_i16le_bytes(&bytes).unwrap_err();
        assert!(err.to_string().contains("even"));
    }
}

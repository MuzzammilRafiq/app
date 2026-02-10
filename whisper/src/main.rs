mod audio;
mod cli;
mod server;
mod transcriber;

use anyhow::Result;
use clap::Parser;
use env_logger::Env;
use whisper_rs::install_whisper_log_trampoline;

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();
    install_whisper_log_trampoline();
    let cli = cli::Cli::parse();

    let config = server::ServerConfig {
        engine: cli.engine,
        model_path: cli.model_path.clone(),
        bind: cli.bind.clone(),
        max_bytes: cli.max_bytes,
        queue_capacity: cli.queue_capacity,
    };
    server::run(config).await?;
    Ok(())
}

wl:
	cargo run -- --model-path ./models/ggml-large-v3-turbo.bin --engine whisper --bind 127.0.0.1:8080 --queue-capacity 8

ws:
	cargo run -- --model-path ./models/ggml-small.bin --engine whisper --bind 127.0.0.1:8080 --queue-capacity 8

para:
	cargo run -- --model-path ./models/parakeet-tdt-0.6b-v3-int8 --engine parakeet --bind 127.0.0.1:8080 --queue-capacity 8

py:
	uv run  test_transcribe.py --listen --mic --url http://127.0.0.1:8080/transcribe --queue-capacity 8
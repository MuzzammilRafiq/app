from faster_whisper import WhisperModel

model = WhisperModel("large-v3-turbo", compute_type="int8")  
segments, info = model.transcribe("audio_5s.wav")

for segment in segments:
    print(segment.text)





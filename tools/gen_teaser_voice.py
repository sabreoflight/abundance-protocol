#!/usr/bin/env python3
"""Generate the teaser-a voiceover lines with Kokoro TTS, matching the
settings used for the 8 lesson videos (see commit c33356b):
  am_michael, +1 semitone, 0.95x speed.

Lines and timecodes are taken directly from the on-screen script already
baked into production/animations/teaser_a_taught_to_compete.html (the SC
scene list), not rewritten. The brand card at 0:35 is not voiced, matching
how the lesson intro/outro bumpers are also left silent.

Writes one .wav per line into voice/teaser-a/<m-ss>.wav, ready for
tools/mix_voiceover.sh.
"""
import sys
from pathlib import Path

from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "tools" / ".models"
OUT = ROOT / "voice" / "teaser-a"
OUT.mkdir(parents=True, exist_ok=True)

LINES = [
    ("0-00", "You were taught to compete. For money. For attention. For enough."),
    ("0-13", "What if enough was never the problem?"),
    ("0-21", "What if it was your lens?"),
    ("0-28", "There is another way to see. Eight steps. Five minutes a day."),
]

def main():
    kokoro = Kokoro(
        str(MODELS / "kokoro-v1.0.int8.onnx"),
        str(MODELS / "voices-v1.0.bin"),
    )
    for name, text in LINES:
        audio, sr = kokoro.create(text, voice="am_michael", speed=0.95, lang="en-us")
        out_path = OUT / f"{name}.wav"
        import soundfile as sf
        sf.write(out_path, audio, sr)
        print(f"wrote {out_path} ({len(audio)/sr:.2f}s)")

if __name__ == "__main__":
    main()

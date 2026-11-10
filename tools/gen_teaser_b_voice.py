#!/usr/bin/env python3
"""Generate the teaser-b voiceover lines with Kokoro TTS, matching the
settings used for teaser-a and the 8 lesson videos (see commit 9ce4ffd
and c33356b): am_michael, +1 semitone, 0.95x speed.

Lines and timecodes are taken directly from the on-screen script already
baked into production/animations/teaser_b_notice_the_rush.html (the SC
scene list), not rewritten. The brand card at 0:37 is not voiced, matching
teaser-a and the lesson intro/outro bumpers.

Writes one .wav per line into voice/teaser-b/<m-ss>.wav, ready for
tools/mix_voiceover.sh.
"""
from pathlib import Path

from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "tools" / ".models"
OUT = ROOT / "voice" / "teaser-b"
OUT.mkdir(parents=True, exist_ok=True)

LINES = [
    ("0-00", "Notice the rush. The tight chest. The quick breath."),
    ("0-08", "The comparing. The never enough."),
    ("0-15", "That isn't your life. That's your lens."),
    ("0-23", "Gratitude is the bridge. From lack to abundance."),
    ("0-31", "One practice. Five minutes a morning."),
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

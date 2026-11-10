#!/usr/bin/env bash
# Mix Michael's TTS voiceover into a teaser trailer, same treatment as teaser-a
# (commit 9ce4ffd): +1 semitone pitch shift (rubberband), ducked under the
# existing music bed. Teasers have no branded intro bumper, so timecodes in
# voice/<slug>/ are scene-start offsets with no added delay.
#
# Usage: tools/mix_teaser_voice.sh <slug>
#   reads voice/<slug>/<m-ss>.wav, the current public/media/<slug>.mp4 as the
#   music-only master, and writes public/media/<slug>-v2.mp4.
# Needs: ffmpeg built with --enable-librubberband
set -euo pipefail
cd "$(dirname "$0")/.."
MUSIC_LEVEL=0.55
PITCH=1.059463   # 2^(1/12), +1 semitone

slug="${1:?usage: mix_teaser_voice.sh <slug>}"
src="public/media/$slug.mp4"
out="public/media/$slug-v2.mp4"
[ -f "$src" ] || { echo "missing $src"; exit 1; }
[ -d "voice/$slug" ] || { echo "missing voice/$slug/"; exit 1; }

inputs=(-i "$src"); filters=""; labels=""; n=0
for f in voice/"$slug"/*.wav; do
  [ -f "$f" ] || continue
  base=$(basename "${f%.*}")
  if [[ ! "$base" =~ ^([0-9]+)-([0-9]{2})$ ]]; then echo "  skipping $f (name it like 1-35.wav)"; continue; fi
  ms=$(( (10#${BASH_REMATCH[1]} * 60 + 10#${BASH_REMATCH[2]}) * 1000 ))
  n=$((n+1)); inputs+=(-i "$f")
  filters+="[$n:a]rubberband=pitch=${PITCH},aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms}[v$n];"
  labels+="[v$n]"
done
[ "$n" -eq 0 ] && { echo "$slug: no recordings found"; exit 1; }

echo "$slug: mixing $n line(s)"
filters+="${labels}amix=inputs=$n:normalize=0:duration=longest,dynaudnorm=f=250:g=15,apad,asplit=2[vo][key];"
filters+="[0:a]volume=${MUSIC_LEVEL}[mus];[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];"
filters+="[duck][vo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[mix]"
ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$filters" -map 0:v -map "[mix]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$out"
echo "  -> $out"

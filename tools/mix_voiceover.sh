#!/usr/bin/env bash
# Mix your recorded voice-over into the lesson videos and export audio-only MP3s.
#
# Put recordings in voice/<lesson-slug>/, one file per script block, named by the block's
# timecode from the voice-over script (minutes-seconds), e.g.:
#   voice/the-foundation/0-00.wav   (block that starts at 0:00)
#   voice/the-foundation/0-14.wav   (block that starts at 0:14)
# Or one continuous file, voice/<lesson-slug>.wav, recorded from 0:00 of the script.
# Timecodes in the scripts exclude the 7-second branded intro; this script adds it.
# Formats: .wav, .mp3, .m4a, .flac
#
# Usage: tools/mix_voiceover.sh [lesson-slug ...]     (no arguments = every lesson with recordings)
# Needs: ffmpeg
set -euo pipefail
cd "$(dirname "$0")/.."
INTRO=7
MUSIC_LEVEL=0.55      # music level under the voice (0–1)
mkdir -p content/media-original content/audio

slugs=("$@")
if [ ${#slugs[@]} -eq 0 ]; then
  for d in voice/*; do [ -e "$d" ] || continue; b=$(basename "$d"); slugs+=("${b%.*}"); done
fi
[ ${#slugs[@]} -eq 0 ] && { echo "No recordings found in voice/. See the comments at the top of this script."; exit 0; }

for slug in $(printf '%s\n' "${slugs[@]}" | sort -u); do
  src="content/media-original/$slug.mp4"
  [ -f "$src" ] || cp "content/media/$slug.mp4" "$src"   # keep the music-only master once
  inputs=(-i "$src"); filters=""; labels=""; n=0
  if [ -d "voice/$slug" ]; then
    for f in voice/"$slug"/*.{wav,mp3,m4a,flac}; do
      [ -f "$f" ] || continue
      base=$(basename "${f%.*}")
      if [[ ! "$base" =~ ^([0-9]+)-([0-9]{2})$ ]]; then echo "  skipping $f (name it like 1-35.wav)"; continue; fi
      ms=$(( (10#${BASH_REMATCH[1]} * 60 + 10#${BASH_REMATCH[2]} + INTRO) * 1000 ))
      n=$((n+1)); inputs+=(-i "$f")
      filters+="[$n:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms}[v$n];"; labels+="[v$n]"
    done
  else
    for f in voice/"$slug".{wav,mp3,m4a,flac}; do
      [ -f "$f" ] || continue
      ms=$((INTRO * 1000)); n=1; inputs+=(-i "$f")
      filters+="[1:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms}[v1];"; labels="[v1]"; break
    done
  fi
  [ "$n" -eq 0 ] && { echo "$slug: no recordings, skipped"; continue; }
  echo "$slug: mixing $n recording(s)"
  # Voice: combine clips, gentle leveling. Music: lowered, then ducked under the voice.
  filters+="${labels}amix=inputs=$n:normalize=0:duration=longest,dynaudnorm=f=250:g=15,apad,asplit=2[vo][key];"
  filters+="[0:a]volume=${MUSIC_LEVEL}[mus];[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];"
  filters+="[duck][vo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[mix]"
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$filters" -map 0:v -map "[mix]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "content/media/$slug.tmp.mp4"
  mv "content/media/$slug.tmp.mp4" "content/media/$slug.mp4"
  ffmpeg -y -loglevel error -i "content/media/$slug.mp4" -vn -c:a libmp3lame -b:a 128k "content/audio/$slug.mp3"
  echo "  → content/media/$slug.mp4 and content/audio/$slug.mp3"
done
echo "Done. Restart the site to pick up new audio files."

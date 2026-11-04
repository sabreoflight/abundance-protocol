# Production sources

Everything used to make the videos, so any of them can be re-rendered or edited.

| Folder | What's inside |
|---|---|
| `animations/` | The 2D animation for every lesson and both vertical teasers. Each is one HTML file with a deterministic `render(seconds)` function on a canvas. Open one in a browser and add `#play` to the URL to watch it live (the lesson files). |
| `brand/` | Mission Abundance intro (7 s) and credits (10 s) bumpers for each episode. |
| `render/` | `render_frames.js` renders an animation to JPEG frames with Playwright. `ambient_soundtrack.py` synthesizes the pad and chimes (numpy). `bumper_audio.py` makes the bumper audio. `make_vertical_clip.sh` turns a 16:9 episode segment into a 9:16 social clip. |
| `worksheets/` | `worksheets.json` holds all worksheet text. `make_worksheets.py` and `worksheets_to_pdf.js` build the one-page Letter PDFs. |
| `hub/` | The private project hub page (library, worksheets, campaign, launch plan). |

## Re-rendering a lesson (outline)

1. Render frames: `node render/render_frames.js <worker> <workers>` from a folder holding the animation HTML (one process per CPU core). It writes `frames/f000000.jpg`…
2. Make the soundtrack: `python3 render/ambient_soundtrack.py` (set `DUR` and the chime times at the top).
3. Encode: `ffmpeg -framerate 24 -i frames/f%06d.jpg -i ambient.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest main.mp4`
4. Wrap with the bumpers: concatenate `intro`, `main` and `outro` with ffmpeg's `concat` filter.

These scripts were written in the original cloud build environment. Some contain absolute paths from there (`/tmp/claude-0/...`, `/home/user/...`), so adjust them before reuse. Needs Node 22 with Playwright, Python 3 with numpy, and ffmpeg.

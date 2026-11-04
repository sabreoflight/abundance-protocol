#!/bin/bash
# usage: mkvert.sh SRC START DUR "HOOK LINE 1" "HOOK LINE 2" OUT
SRC=$1; ST=$2; D=$3; H1=$4; H2=$5; OUT=$6
SERIF=/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf
SANS=/usr/share/fonts/opentype/inter/Inter-Medium.otf
printf '%s' "$H1" > h1.txt; printf '%s' "$H2" > h2.txt
printf '%s' "M I S S I O N   A B U N D A N C E" > b1.txt
printf '%s' "The full 7-part practice · link in bio" > b2.txt
FO=$(echo "$D-1.2" | bc)
ffmpeg -y -loglevel error -ss $ST -t $D -i "$SRC" -filter_complex "
[0:v]split[a][b];
[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:2,eq=brightness=-0.12[bg];
[b]scale=1080:-2[fg];
[bg][fg]overlay=0:(H-h)/2-20,
drawtext=fontfile=$SERIF:textfile=h1.txt:fontsize=68:fontcolor=0xF6F2E8:x=(w-text_w)/2:y=380:alpha='min(1,t/1.0)',
drawtext=fontfile=$SERIF:textfile=h2.txt:fontsize=68:fontcolor=0xF2C46D:x=(w-text_w)/2:y=470:alpha='min(1,max(0,(t-0.6)/1.0))',
drawtext=fontfile=$SANS:textfile=b1.txt:fontsize=30:fontcolor=0xF2C46D:x=(w-text_w)/2:y=1440,
drawtext=fontfile=$SANS:textfile=b2.txt:fontsize=34:fontcolor=0xD8DEEE:x=(w-text_w)/2:y=1500,
fade=t=in:st=0:d=0.6,fade=t=out:st=$FO:d=1.2[v];
[0:a]afade=t=in:st=0:d=0.8,afade=t=out:st=$FO:d=1.2[au]" -map "[v]" -map "[au]" -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -r 24 -c:a aac -b:a 128k -movflags +faststart "$OUT"

#!/usr/bin/env python3
"""Rebuild content/course.json from docs/course_copy.md (run after editing the copy).

Usage: python3 tools/build_content.py
"""
import json, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
md = open(os.path.join(ROOT, 'docs', 'course_copy.md'), encoding='utf-8').read()

FILES = {  # slug -> (video, worksheet, duration seconds)
    'the-foundation': ('the-foundation.mp4', 'worksheet_ep0_the_foundation.pdf', 461),
    'choosing-abundance': ('choosing-abundance.mp4', 'worksheet_ep1_choosing_abundance.pdf', 317),
    'the-clear-vision': ('the-clear-vision.mp4', 'worksheet_step2_the_clear_vision.pdf', 317),
    'release-the-contest': ('release-the-contest.mp4', 'worksheet_ep2_release_the_contest.pdf', 317),
    'the-daily-work': ('the-daily-work.mp4', 'worksheet_ep3_the_daily_work.pdf', 317),
    'give-first': ('give-first.mp4', 'worksheet_ep4_give_first.pdf', 317),
    'unhurried': ('unhurried.mp4', 'worksheet_ep5_unhurried.pdf', 317),
    'the-morning-practice': ('the-morning-practice.mp4', 'worksheet_ep6_the_morning_practice.pdf', 317),
}

def section(start, end):
    return md[md.index(start):md.index(end)]

a6 = section('### A6.', '### A7.')
PITCH = {re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-'): p.strip() for t, p in re.findall(r'^\| \d+ \| \*\*([^*]+)\*\* \| (.+?) \|$', a6, re.M)}
b3 = section('### B3. Module 1', '### B4. Module 2')
lessons = []
for block in [b for b in b3.split('\n---\n') if b.strip().startswith('**Lesson')]:
    n, title = re.search(r'\*\*Lesson (\d+) · ([^*]+)\*\*', block).groups()
    meta = re.search(r'^\*([^*]+)\*$', block, re.M).group(1)
    meta_short = ' · '.join(p for p in meta.split(' · ') if not p.startswith('Download'))
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    video, worksheet, dur = FILES[slug]
    lessons.append({
        'n': int(n), 'slug': slug, 'title': title.strip(), 'meta': meta_short,
        'pitch': PITCH[slug],
        'description': re.search(r'\*\*Description\.\*\* (.+)', block).group(1).strip(),
        'inThisLesson': re.findall(r'^- (.+)$', block.split('**In this lesson**')[1].split('**Three takeaways**')[0], re.M),
        'takeaways': re.findall(r'^\d\. (.+)$', block.split('**Three takeaways**')[1].split('**Your practice:**')[0], re.M),
        'practice': re.search(r'\*\*Your practice:\*\* (.+)', block).group(1).strip(),
        'video': video, 'worksheet': worksheet, 'audio': slug + '.mp3', 'poster': slug + '.jpg', 'duration': dur,
    })

def paras(text):
    out = []
    for p in re.split(r'\n\s*\n', text.strip()):
        p = p.strip()
        if p and not p.startswith('*Video') and not p.startswith('**Lesson'):
            out.append(p)
    return out

b2 = section('### B2. Module 0', '### B3. Module 1')
welcome = b2.split('**Lesson 0.1 · Welcome**')[1].split('**Lesson 0.2')[0]
howto = b2.split('**Lesson 0.2 · How to use this course**')[1].split('**Lesson 0.3')[0]
downloads = b2.split('**Lesson 0.3 · Your downloads**')[1]
b4 = section('### B4. Module 2', '### B5.')
b5 = section('### B5.', '## Part C')
aff = re.findall(r'^> (.+)$', b4, re.M)

course = {
    'title': 'The Abundance Protocol',
    'subtitle': 'Eight steps. Five minutes a day.',
    'steps': ['Choose the lens', 'Clarify the vision', 'Gratitude', 'Release competition',
              'Act daily in a Certain Way', 'Give first', 'Release hurry and hold faith', 'Daily alignment'],
    'affirmation': aff,
    'startHere': {
        'welcome': paras(welcome),
        'howTo': re.findall(r'^- (.+)$', howto, re.M),
        'downloads': paras(downloads),
    },
    'daily': {
        'morning': b4.split('**Lesson 2.1 · The Morning Practice (pinned)**')[1].split('**Lesson 2.2')[0].strip(),
        'tracker': b4.split('**Lesson 2.3 · Your 30-day tracker**')[1].strip(),
    },
    'completion': paras(b5.split('\n', 1)[1]),
    'lessons': lessons,
    'extraDownloads': [],
}
json.dump(course, open(os.path.join(ROOT, 'content', 'course.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print(f'Wrote content/course.json with {len(lessons)} lessons')

// Course content: lessons and copy from content/course.json, media from content/.
const fs = require('fs');
const path = require('path');
const { CONTENT_DIR } = require('./config');

const course = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'course.json'), 'utf8'));
const lessons = course.lessons;
const bySlug = Object.fromEntries(lessons.map((l) => [l.slug, l]));

const exists = (sub, file) => Boolean(file) && fs.existsSync(path.join(CONTENT_DIR, sub, file));
const hasAudio = (l) => exists('audio', l.audio);
const hasWorksheet = (l) => exists('downloads', l.worksheet);

function nextLesson(slug) {
  const i = lessons.findIndex((l) => l.slug === slug);
  return i >= 0 ? lessons[i + 1] || null : null;
}

// Only files referenced in course.json may be served.
const allowedMedia = new Set(lessons.map((l) => l.video));
const allowedDownloads = new Set([...lessons.map((l) => l.worksheet), ...(course.extraDownloads || []).map((d) => d.file)]);
const allowedAudio = new Set(lessons.map((l) => l.audio));

module.exports = { course, lessons, bySlug, nextLesson, hasAudio, hasWorksheet, allowedMedia, allowedDownloads, allowedAudio, CONTENT_DIR };

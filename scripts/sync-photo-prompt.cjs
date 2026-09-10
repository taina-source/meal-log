// The plain text file is the only prompt source. No network/dependencies needed.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const prompt = fs.readFileSync(path.join(root, 'src/prompts/chatgpt-photo.txt'), 'utf8').replace(/\r\n/g, '\n').trim();
const file = path.join(root, 'docs/CHATGPT_PHOTO.md');
const doc = fs.readFileSync(file, 'utf8');
const pattern = /<!-- PHOTO_PROMPT_START -->[\s\S]*?<!-- PHOTO_PROMPT_END -->/g;
if ([...doc.matchAll(pattern)].length !== 1) throw new Error('Photo prompt markers must occur exactly once.');
fs.writeFileSync(file, doc.replace(pattern, () => `<!-- PHOTO_PROMPT_START -->\n\x60\x60\x60text\n${prompt}\n\x60\x60\x60\n<!-- PHOTO_PROMPT_END -->`));
console.log('Photo prompt documentation synchronized.');

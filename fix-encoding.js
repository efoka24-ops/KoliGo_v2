const fs = require('fs');
const path = require('path');

// Compute the mojibake representation of a Unicode string.
// Mojibake happens when UTF-8 bytes are re-interpreted as Latin-1,
// then that Latin-1 text is saved again as UTF-8.
// getMojibake(s) gives us the corrupted string we need to match.
function getMojibake(s) {
  return Buffer.from(s, 'utf8').toString('latin1');
}

// Build the fix list: pairs of [corrupted, correct]
const CHARS_TO_FIX = [
  // French accented lowercase
  'é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'ô', 'î', 'ï',
  'ù', 'û', 'ü', 'ú', 'ó', 'ò', 'ñ', 'í', 'ì', 'æ', 'ø',
  // French accented uppercase
  'É', 'È', 'Ê', 'Ë', 'À', 'Â', 'Ç', 'Ô', 'Î', 'Ï',
  'Ù', 'Û', 'Ü', 'Ú', 'Ó', 'Ò', 'Ñ', 'Í', 'Ì', 'Æ', 'Ø',
  // Ligatures
  'œ', 'Œ',
  // Arrow
  '→', '←',
  // Punctuation
  '’', // right single quotation mark '
  '‘', // left single quotation mark '
  '“', // left double quotation mark "
  '”', // right double quotation mark "
  '—', // em dash —
  '–', // en dash –
  '…', // ellipsis …
  '•', // bullet •
  '─', // box drawing horizontal ─
  // Circled letters (step labels like Ⓐ Ⓑ)
  'Ⓐ', // Ⓐ
  'Ⓑ', // Ⓑ
  'Ⓒ', // Ⓒ
];

const FIXES = CHARS_TO_FIX.map(c => [getMojibake(c), c]);

// For circled numbers like ① ②
for (let i = 1; i <= 9; i++) {
  const c = String.fromCodePoint(0x245F + i); // ① = U+2460
  FIXES.push([getMojibake(c), c]);
}

// Emoji: 4-byte sequences get double-encoded differently.
// Compute: emoji UTF-8 bytes → each byte as Latin-1 char → then those chars UTF-8 encoded
function getEmojiMojibake(emoji) {
  const bytes = Buffer.from(emoji, 'utf8');
  // Each byte treated as a code point 0x80-0xFF → Latin-1 → those chars UTF-8-encoded
  const latin1str = bytes.toString('latin1');
  return latin1str; // when written/read as UTF-8, this matches the mojibake in files
}

const EMOJIS = [
  '📄', '📦', '🔗', '💡', '🚴', '🚀', '🛵', '🔑', '👤',
  '📅', '📈', '📊', '💰', '💳', '📲', '📱', '🔧', '📌',
  '🔍', '📝', '💬', '📢', '🔔', '🔕', '👀', '🌍', '🌟',
  '🤝', '🆗', '🆕', '✅', '✔', '❌', '❗', '❓', '⭐',
  '🇨🇲', '📸', '🎯', '🏠', '📩', '📨', '📬', '🚚', '🏍',
];

for (const emoji of EMOJIS) {
  FIXES.push([getEmojiMojibake(emoji), emoji]);
}

function fixContent(content) {
  let result = content;
  for (const [from, to] of FIXES) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }
  return result;
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      results.push(...walk(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const root = path.join(__dirname, 'mobile', 'src');
const files = walk(root);
let fixedCount = 0;

for (const filePath of files) {
  const original = fs.readFileSync(filePath, 'utf8');
  const fixed = fixContent(original);
  if (fixed !== original) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    fixedCount++;
    console.log('Fixed: ' + path.relative(root, filePath));
  }
}

console.log('\nDone. ' + fixedCount + ' file(s) fixed out of ' + files.length + ' scanned.');

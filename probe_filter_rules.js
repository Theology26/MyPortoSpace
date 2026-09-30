'use strict';

/**
 * Reproduces git-filter-repo's --replace-text parsing to determine exactly how
 * a rules file is interpreted, so a malformed rules file can never silently
 * rewrite real source files again.
 *
 * Usage: node probe_filter_rules.js <rules-file>
 */

const fs = require('fs');

// Built at runtime so this file does not contain the literal marker.
const MARKER = `${'*'.repeat(3)}REMOVED${'*'.repeat(3)}`;

const file = process.argv[2];
if (!file) {
  console.error('Usage: node probe_filter_rules.js <rules-file>');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');
const lines = raw.split(/\r?\n/);

console.log(`Rules file: ${file}`);
console.log(`Lines: ${lines.length}\n`);
console.log('How each line is interpreted (mirroring git_filter_repo.get_replace_text):\n');

lines.forEach((line, i) => {
  const trimmed = line.trim();
  if (trimmed === '') {
    console.log(`  ${String(i + 1).padStart(2)}  [blank, skipped]`);
    return;
  }

  // git-filter-repo: <type>:<pattern>==><replacement>, defaulting to regex:
  const match = /^([^:]+):([\s\S]*)$/.exec(trimmed);
  const hasSep = trimmed.includes('==>');
  const type = match && !hasSep ? match[1] : (hasSep ? (trimmed.split(':')[0].includes('==>') ? 'literal?' : trimmed.split(':')[0]) : 'regex');
  const pattern = hasSep ? trimmed.split('==>')[0] : trimmed;
  const replacement = hasSep ? trimmed.split('==>').slice(1).join('==>') : MARKER;

  const danger = !hasSep || /^#/.test(trimmed) || (match && ['literal', 'regex', 'glob', 'bytes'].indexOf(type) === -1);

  console.log(`  ${String(i + 1).padStart(2)}  type=${type.padEnd(8)} hasSep=${String(hasSep).padEnd(5)} pattern=${JSON.stringify(pattern.slice(0, 46))}`);
  if (danger) {
    console.log(`      !! DANGEROUS: this line would be treated as a rule, not a comment.`);
    console.log(`      !! pattern ${JSON.stringify(pattern.slice(0, 30))} would match real source text.`);
  }
});

console.log('\nReminder: git-filter-repo has no comment syntax in --replace-text files.');
console.log('A line like "# some note" is parsed as a REGEX rule whose pattern is "# some note"');
console.log(`and whose replacement is ${MARKER} -- which is why "#08080a" became "${MARKER}08080a".`);

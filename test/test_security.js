'use strict';

const S = require('../src/security/Sanitizer');
const CryptoUtil = require('../src/security/CryptoUtil');
const RateLimiter = require('../src/security/RateLimiter');

let pass = 0;
let fail = 0;
function t(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` + (ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
}

console.log('--- Sanitizer.url ---');
t('javascript: blocked', S.url('javascript:alert(1)'), '#');
t('JaVaScRiPt: blocked', S.url('JaVaScRiPt:alert(1)'), '#');
t('data: blocked', S.url('data:text/html,<script>'), '#');
t('vbscript: blocked', S.url('vbscript:msgbox'), '#');
t('protocol-relative blocked', S.url('//evil.com/x'), '#');
t('tab-smuggled scheme blocked', S.url('java\tscript:alert(1)'), '#');
t('newline-smuggled scheme blocked', S.url('java\nscript:alert(1)'), '#');
t('null-byte smuggle blocked', S.url('java\0script:alert(1)'), '#');
t('https allowed', S.url('https://github.com/Theology26'), 'https://github.com/Theology26');
t('root-relative allowed', S.url('/api/cv/download'), '/api/cv/download');
t('mailto allowed', S.url('mailto:a@b.com'), 'mailto:a@b.com');
t('empty -> #', S.url(''), '#');
t('non-string -> #', S.url({ toString: () => 'javascript:x' }), '#');

console.log('\n--- Sanitizer.text ---');
t('escapes tags', S.text('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
t('escapes quotes', S.text('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
t('null-safe', S.text(null), '');

console.log('\n--- Sanitizer.filename ---');
t('strips CRLF + colon', S.filename('Theo\r\nX-Evil: yes'), 'TheoX-Evil_yes');
t('strips slashes', S.filename('a/b\\c'), 'abc');
t('empty falls back', S.filename(''), 'document');
t('null falls back', S.filename(null), 'document');

console.log('\n--- Sanitizer.sanitizeDeep ---');
const polluted = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1},"ok":1}');
t('blocks __proto__/constructor', S.sanitizeDeep(polluted), { ok: 1 });
t('no Object.prototype pollution', {}.polluted, undefined);
const deep = { a: {} }; deep.a.self = deep;
t('depth-capped, no infinite recursion', S.sanitizeDeep(deep, 0).a === null || typeof S.sanitizeDeep(deep).a === 'object', true);
t('handles arrays', S.sanitizeDeep([1, { __proto__: { z: 1 }, b: 2 }]), [1, { b: 2 }]);

console.log('\n--- CryptoUtil ---');
const rec = CryptoUtil.hashSecret('correct horse battery staple');
t('verify correct secret', CryptoUtil.verifySecret('correct horse battery staple', rec), true);
t('reject wrong secret', CryptoUtil.verifySecret('wrong', rec), false);
t('reject malformed record', CryptoUtil.verifySecret('x', null), false);
t('reject empty record', CryptoUtil.verifySecret('x', { salt: 'a' }), false);
t('salts differ per hash', CryptoUtil.hashSecret('same').salt !== CryptoUtil.hashSecret('same').salt, true);
t('timingSafeEqual equal', CryptoUtil.timingSafeEqual('abc', 'abc'), true);
t('timingSafeEqual unequal len', CryptoUtil.timingSafeEqual('abc', 'abcd'), false);
t('timingSafeEqual different', CryptoUtil.timingSafeEqual('abc', 'xyz'), false);
t('hex compare rejects len mismatch', CryptoUtil.timingSafeEqualHex('aabb', 'aabbcc'), false);

console.log('\n--- RateLimiter (IP spoofing) ---');
process.env.TRUST_PROXY = '0';
const spoofReq = (ip) => ({ headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: '10.0.0.9' } });
const rl = new RateLimiter({ maxRequests: 3, windowMs: 60000, message: 'slow down' });
const spoofKey = RateLimiter.resolveClientIp(spoofReq('6.6.6.6'));
t('ignores XFF when TRUST_PROXY off', spoofKey, '10.0.0.9');
process.env.TRUST_PROXY = '1';
t('honours XFF when TRUST_PROXY on', RateLimiter.resolveClientIp(spoofReq('6.6.6.6')), '6.6.6.6');
t('takes first XFF hop', RateLimiter.resolveClientIp({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }, socket: {} }), '1.1.1.1');
process.env.TRUST_PROXY = '0';

t('allows up to max', [1, 2, 3].map(() => rl.hit('k').allowed), [true, true, true]);
t('blocks over max', rl.hit('k').allowed, false);
t('separate key unaffected', rl.hit('other').allowed, true);
t('reset clears counter', (rl.reset('k'), rl.hit('k').allowed), true);
const capped = new RateLimiter({ maxRequests: 1, windowMs: 60000, message: 'x', maxKeys: 3 });
['a', 'b', 'c', 'd', 'e', 'f'].forEach((k) => capped.hit(k));
t('store never exceeds maxKeys', capped.store.size <= 3, true);

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail === 0 ? 0 : 1);

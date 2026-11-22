// Run: node tests/ptpmath.test.cjs
// Checks the gPTP arithmetic used by the course labs.
const assert = require('node:assert/strict');
const P = require('../assets/js/ptpmath.js');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

console.log('Intervals');
t('log -3 = 125 ms', () => assert.equal(P.logToMs(-3), 125));
t('log 0 = 1 s', () => assert.equal(P.logToMs(0), 1000));
t('31.25 ms = log -5', () => assert.equal(P.msToLog(31.25), -5));

console.log('correctionField (ns · 2^16)');
t('1 ns = 0x0000000000010000', () => assert.equal(P.hex(P.encodeCorrection(1)), '0000000000010000'));
t('0.5 ns = 0x...8000', () => assert.equal(P.hex(P.encodeCorrection(0.5)), '0000000000008000'));
t('-1 ns two\'s complement', () => assert.equal(P.hex(P.encodeCorrection(-1)), 'ffffffffffff0000'));
t('round trip 1234.5678 ns', () => near(P.decodeCorrection(P.encodeCorrection(1234.5678)), 1234.5678, 2 ** -16));

console.log('Timestamp (48-bit s + 32-bit ns)');
t('encode/decode', () => {
  const b = P.encodeTimestamp(1700000000, 123456789);
  assert.equal(P.hex(b), '00006553f100075bcd15');
  const d = P.decodeTimestamp(b); assert.equal(d.sec, 1700000000n); assert.equal(d.ns, 123456789);
});
t('rejects ns >= 1e9', () => assert.throws(() => P.encodeTimestamp(0, 1e9)));

console.log('cumulativeScaledRateOffset ((r-1) · 2^41)');
t('1 ppm', () => assert.equal(P.encodeRateOffset(1 + 1e-6), Math.round(1e-6 * 2 ** 41)));
t('-100 ppm round trip', () => near(P.ratioToPpm(P.decodeRateOffset(P.encodeRateOffset(P.ppmToRatio(-100)))), -100, 1e-6));
t('out of range throws', () => assert.throws(() => P.encodeRateOffset(1.002)));

console.log('Pdelay');
t('symmetric link, equal clocks', () => assert.equal(P.meanLinkDelay({ t1: 1000, t2: 58250, t3: 5058250, t4: 5001250 }), 125));
t('rate ratio removes turnaround error', () => {
  const D = 25, rr = 1 + 100e-6, turn = 1e7;
  const t1 = 0, t2 = 5e6 + D * rr, t3 = t2 + turn, t4 = 2 * D + turn / rr;
  near(P.meanLinkDelay({ t1, t2, t3, t4, nrr: rr }), D * rr, 1e-6);
  near(P.meanLinkDelay({ t1, t2, t3, t4, nrr: 1 }) - D, -turn * (1 - 1 / rr) / 2, 1e-6);
});
t('neighborRateRatio from two exchanges', () => near(P.neighborRateRatio(0, 0, 1000100, 1000000), 1.0001, 1e-12));

console.log('Relay correction');
t('rateRatio 1: residence + link delay', () => {
  const r = P.relayCorrection({ correctionIn: 100, syncIngress: 1000, syncEgress: 6000, linkDelay: 50 });
  assert.equal(r.residence, 5000); assert.equal(r.correctionOut, 100 + 5000 + 50);
});
t('rateRatio scales the local interval', () => {
  const r = P.relayCorrection({ correctionIn: 0, syncIngress: 0, syncEgress: 1e6, linkDelay: 0, rateRatio: 1 + 50e-6 });
  near(r.correctionOut, 1e6 + 50, 1e-6);
});
t('slave offset', () => assert.equal(P.offsetFromMaster({ syncIngress: 1000002000, preciseOrigin: 1e9, correction: 1250, linkDelay: 250 }), 500));

console.log('BMCA');
const base = { priority1: 248, clockClass: 248, clockAccuracy: 0xfe, variance: 0x436a, priority2: 248, clockIdentity: '0000000000000002' };
t('priority1 wins first', () => assert.ok(P.compareSystem({ ...base, priority1: 246 }, { ...base, clockClass: 6 }) < 0));
t('clockIdentity breaks ties', () => { assert.ok(P.compareSystem({ ...base, clockIdentity: '0000000000000001' }, base) < 0); assert.equal(P.decidingField({ ...base, clockIdentity: '01' }, base), 'clockIdentity'); });

console.log('Header');
t('34-byte header round trip', () => {
  const h = { majorSdoId: 1, messageType: 8, minorVersionPTP: 1, versionPTP: 2, messageLength: 76, domainNumber: 0, flags: 0x0008,
    correctionNs: 1.5, clockIdentity: P.macToClockIdentity('00:1b:21:aa:bb:cc'), portNumber: 1, sequenceId: 4242, controlField: 2, logMessageInterval: -3 };
  const b = P.buildHeader(h); assert.equal(b.length, 34);
  assert.equal(b[0], 0x18); assert.equal(b[1], 0x12);
  const p = P.parseHeader(b);
  assert.equal(p.messageName, 'Follow_Up'); assert.equal(p.correctionNs, 1.5); assert.equal(p.clockIdentity, '001b21fffeaabbcc');
  assert.equal(p.sequenceId, 4242); assert.equal(p.logMessageInterval, -3);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

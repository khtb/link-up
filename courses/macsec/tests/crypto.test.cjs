// Run: node tests/crypto.test.cjs
// Verifies the course crypto against published test vectors.
const assert = require('node:assert/strict');
const C = require('../assets/js/crypto.js');
const { hex, unhex } = C;

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

(async () => {
  console.log('AES-CMAC (RFC 4493)');
  const K = unhex('2b7e151628aed2a6abf7158809cf4f3c');
  const M = unhex('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710');
  await t('empty message', async () => assert.equal(hex(await C.cmac(K, M.subarray(0, 0))), 'bb1d6929e95937287fa37d129b756746'));
  await t('16 bytes', async () => assert.equal(hex(await C.cmac(K, M.subarray(0, 16))), '070a16b46b4d4144f79bdd9dd04a287c'));
  await t('40 bytes', async () => assert.equal(hex(await C.cmac(K, M.subarray(0, 40))), 'dfa66747de9ae63030ca32611497c827'));
  await t('64 bytes', async () => assert.equal(hex(await C.cmac(K, M)), '51f0bebf7e3b9d92fc49741779363cfe'));

  console.log('AES Key Wrap (RFC 3394 §4.1)');
  await t('wrap 128-bit key with 128-bit KEK', async () => {
    const w = await C.wrapKey(unhex('000102030405060708090A0B0C0D0E0F'), unhex('00112233445566778899AABBCCDDEEFF'));
    assert.equal(hex(w), '1fa68b0a8112b447aef34bd8fb5a7b829d3e862371d2cfe5');
  });
  await t('unwrap round-trip', async () => {
    const kek = unhex('000102030405060708090A0B0C0D0E0F');
    const w = await C.wrapKey(kek, unhex('00112233445566778899AABBCCDDEEFF'));
    assert.equal(hex(await C.unwrapKey(kek, w)), '00112233445566778899aabbccddeeff');
  });

  console.log('MACsec GCM-AES-128 (IEEE 802.1AE Annex C)');
  const sak = unhex('AD7A2BD03EAC835A6F620FDCB506B345');
  const sci = unhex('12153524C0895E81');
  const pn = 0xB2C28465;
  const daSa = 'D609B1F056637A0D46DF998D';
  const body = '0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F3031323334';
  await t('C.1.1 54-octet frame, integrity only (ICV)', async () => {
    const frame = unhex(daSa + '0800' + body + '0001');
    const r = await C.protectFrame({ sak, sci, pn, an: 2, frame, encrypt: false });
    assert.equal(hex(r.tag), '88e5222ab2c2846512153524c0895e81');
    assert.equal(hex(r.out.subarray(r.out.length - 16)), 'f09478a9b09007d06f46e9b6a1da25dd');
  });
  await t('confidentiality mode: SecTAG E/C bits set, payload hidden, ICV appended', async () => {
    const frame = unhex(daSa + '0800' + body + '0002');
    const r = await C.protectFrame({ sak, sci, pn, an: 2, frame, encrypt: true });
    assert.equal(hex(r.tag), '88e52e2ab2c2846512153524c0895e81');   // TCI 0x2E = SC|E|C|AN2, SL=42
    assert.equal(r.out.length, 12 + 16 + 42 + 16);
    assert.notEqual(hex(r.out.subarray(28, 70)), hex(frame.subarray(12)));
  });
  await t('validate + decrypt round-trip, tamper detection', async () => {
    const frame = unhex(daSa + '0800' + body + '0002');
    const r = await C.protectFrame({ sak, sci, pn, an: 2, frame, encrypt: true });
    const v = await C.validateFrame({ sak, sci, macsecFrame: r.out });
    assert.ok(v.ok); assert.equal(hex(v.frame), hex(frame));
    const bad = r.out.slice(); bad[30] ^= 1;
    assert.equal((await C.validateFrame({ sak, sci, macsecFrame: bad })).ok, false);
  });

  console.log('802.1X KDF (ICK/KEK)');
  await t('deterministic, correct lengths, ICK != KEK', async () => {
    const cak = unhex('135bd758b0ee5c11c55ff6ab19fdb199');
    const ckn = unhex('96437a93ccf10d9dfe347846cce52c7d');
    const ick = await C.deriveICK(cak, ckn), kek = await C.deriveKEK(cak, ckn);
    assert.equal(ick.length, 16); assert.equal(kek.length, 16); assert.notEqual(hex(ick), hex(kek));
    const cak256 = unhex('135bd758b0ee5c11c55ff6ab19fdb199'.repeat(2));
    assert.equal((await C.deriveICK(cak256, ckn)).length, 32);
    console.log('       ICK=' + hex(ick) + '  KEK=' + hex(kek));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

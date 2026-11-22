/*
 * Educational crypto helpers for the MACsec/MKA course, built on Web Crypto.
 * Works in browsers (secure context: https, localhost or file://) and in Node 20+.
 *
 *  - AES-CMAC (RFC 4493)                         -> MKPDU ICV, PRF of the 802.1X KDF
 *  - IEEE 802.1X KDF (AES-CMAC based)            -> ICK / KEK derivation from CAK
 *  - AES Key Wrap (RFC 3394)                     -> SAK distribution under the KEK
 *  - GCM-AES-128/256 MACsec frame protection     -> IEEE 802.1AE
 *
 * NOT for production use. It exists so learners can see real bytes.
 */
(function (root) {
  'use strict';
  const subtle = (root.crypto && root.crypto.subtle) || null;

  // ---------- byte utils ----------
  function hex(bytes, sep = '') {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(sep);
  }
  function unhex(s) {
    s = String(s).replace(/[^0-9a-fA-F]/g, '');
    if (s.length % 2) throw new Error('hex string has odd length');
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }
  function concat(...arrs) {
    const n = arrs.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }
  const utf8 = s => new TextEncoder().encode(s);
  function u32be(n) { return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); }
  function u16be(n) { return new Uint8Array([(n >>> 8) & 255, n & 255]); }
  function random(n) { const b = new Uint8Array(n); root.crypto.getRandomValues(b); return b; }
  function need() { if (!subtle) throw new Error('Web Crypto is unavailable. Open the course via ./start.sh (http://localhost) or file://.'); }

  // ---------- raw AES (via AES-CBC with zero IV) ----------
  async function cbcZeroIV(key, data) {
    need();
    const k = await subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['encrypt']);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, k, data));
    return ct.subarray(0, data.length); // drop the PKCS#7 padding block
  }
  const aesBlock = (key, block16) => cbcZeroIV(key, block16);

  // ---------- AES-CMAC (RFC 4493) ----------
  function dbl(b) {
    const out = new Uint8Array(16);
    let carry = 0;
    for (let i = 15; i >= 0; i--) { out[i] = ((b[i] << 1) | carry) & 255; carry = b[i] >>> 7; }
    if (b[0] & 0x80) out[15] ^= 0x87;
    return out;
  }
  async function cmac(key, msg) {
    const L = await aesBlock(key, new Uint8Array(16));
    const K1 = dbl(L), K2 = dbl(K1);
    const n = Math.max(1, Math.ceil(msg.length / 16));
    const complete = msg.length > 0 && msg.length % 16 === 0;
    const m = new Uint8Array(n * 16);
    m.set(msg);
    if (!complete) m[msg.length] = 0x80;
    const sub = complete ? K1 : K2;
    for (let i = 0; i < 16; i++) m[(n - 1) * 16 + i] ^= sub[i];
    const c = await cbcZeroIV(key, m);
    return c.slice((n - 1) * 16, n * 16);
  }

  // ---------- IEEE 802.1X KDF (counter mode, PRF = AES-CMAC) ----------
  // KDF(Key, Label, Context, L) = PRF(Key, i || Label || 0x00 || Context || L) for i = 1..ceil(L/128)
  async function kdf(key, label, context, bits) {
    const blocks = Math.ceil(bits / 128);
    const parts = [];
    for (let i = 1; i <= blocks; i++) {
      parts.push(await cmac(key, concat(new Uint8Array([i]), utf8(label), new Uint8Array([0]), context, u16be(bits))));
    }
    return concat(...parts).slice(0, bits / 8);
  }
  // Context for ICK/KEK = first 16 octets of the CKN, zero-padded if shorter.
  function cknContext(ckn) { const c = new Uint8Array(16); c.set(ckn.subarray(0, 16)); return c; }
  const deriveICK = (cak, ckn) => kdf(cak, 'IEEE8021 ICK', cknContext(ckn), cak.length * 8);
  const deriveKEK = (cak, ckn) => kdf(cak, 'IEEE8021 KEK', cknContext(ckn), cak.length * 8);

  // ---------- AES Key Wrap (RFC 3394) ----------
  async function wrapKey(kek, keyBytes) {
    need();
    const w = await subtle.importKey('raw', kek, { name: 'AES-KW' }, false, ['wrapKey']);
    const k = await subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, true, ['encrypt']);
    return new Uint8Array(await subtle.wrapKey('raw', k, w, { name: 'AES-KW' }));
  }
  async function unwrapKey(kek, wrapped) {
    need();
    const w = await subtle.importKey('raw', kek, { name: 'AES-KW' }, false, ['unwrapKey']);
    const k = await subtle.unwrapKey('raw', wrapped, w, { name: 'AES-KW' }, { name: 'AES-GCM' }, true, ['encrypt']);
    return new Uint8Array(await subtle.exportKey('raw', k));
  }

  // ---------- MACsec (802.1AE) GCM-AES frame protection ----------
  /**
   * Build a SecTAG.  tci bits: V(0) ES SC SCB E C AN(2)
   * opts: { an, pn, sci (8 bytes) | null, encrypt, es, scb, sl }
   */
  function secTag(opts) {
    const sc = !!opts.sci;
    const tci = (opts.es ? 0x40 : 0) | (sc ? 0x20 : 0) | (opts.scb ? 0x10 : 0) |
      (opts.encrypt ? 0x0c : 0) | (opts.an & 3);
    const parts = [new Uint8Array([0x88, 0xe5, tci, opts.sl & 0x3f]), u32be(opts.pn)];
    if (sc) parts.push(opts.sci);
    return concat(...parts);
  }

  /**
   * Protect an Ethernet frame.
   * frame = DA(6) SA(6) EtherType(2) payload...   (no FCS)
   * Returns { out, tag, iv, aadLen, ctLen }
   */
  async function protectFrame({ sak, sci, pn, an = 0, frame, includeSci = true, encrypt = true }) {
    need();
    const da = frame.subarray(0, 6), sa = frame.subarray(6, 12);
    const userData = frame.subarray(12);             // original EtherType + payload
    const sl = userData.length < 48 ? userData.length : 0;
    const tag = secTag({ an, pn, sci: includeSci ? sci : null, encrypt, sl });
    const iv = concat(sci, u32be(pn));               // 96-bit IV = SCI || PN (non-XPN suites)
    const key = await subtle.importKey('raw', sak, { name: 'AES-GCM' }, false, ['encrypt']);
    let aad, pt;
    if (encrypt) { aad = concat(da, sa, tag); pt = userData; }      // confidentiality offset 0
    else { aad = concat(da, sa, tag, userData); pt = new Uint8Array(0); } // integrity only (GMAC)
    const res = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, pt));
    const body = encrypt ? res : concat(userData, res);
    return { out: concat(da, sa, tag, body), tag, iv, aadLen: aad.length, ctLen: body.length - 16 };
  }

  /** Verify + decrypt a MACsec frame. Returns { ok, frame?, pn, an, error? } */
  async function validateFrame({ sak, sci, macsecFrame }) {
    need();
    const f = macsecFrame;
    if (f[12] !== 0x88 || f[13] !== 0xe5) return { ok: false, error: 'not a MACsec frame (EtherType != 0x88E5)' };
    const tci = f[14];
    const sc = !!(tci & 0x20), enc = !!(tci & 0x08);
    const tagLen = sc ? 16 : 8;
    const pn = ((f[16] << 24) | (f[17] << 16) | (f[18] << 8) | f[19]) >>> 0;
    const txSci = sc ? f.subarray(20, 28) : sci;
    const tag = f.subarray(12, 12 + tagLen);
    const body = f.subarray(12 + tagLen);
    const iv = concat(txSci, u32be(pn));
    const key = await subtle.importKey('raw', sak, { name: 'AES-GCM' }, false, ['decrypt']);
    try {
      let user;
      if (enc) {
        const aad = concat(f.subarray(0, 12), tag);
        user = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, body));
      } else {
        user = body.subarray(0, body.length - 16);
        const aad = concat(f.subarray(0, 12), tag, user);
        await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, body.subarray(body.length - 16));
      }
      return { ok: true, frame: concat(f.subarray(0, 12), user), pn, an: tci & 3 };
    } catch (e) {
      return { ok: false, pn, an: tci & 3, error: 'ICV check failed — frame dropped (InPktsNotValid / InPktsBadTag)' };
    }
  }

  const api = { hex, unhex, concat, utf8, u32be, u16be, random, aesBlock, cmac, kdf, cknContext,
    deriveICK, deriveKEK, wrapKey, unwrapKey, secTag, protectFrame, validateFrame };
  root.MKACrypto = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/*
 * gPTP (IEEE 802.1AS) arithmetic helpers used by the course labs.
 * Works in browsers and in Node (see tests/ptpmath.test.cjs).
 *
 *  - log message interval  <-> milliseconds
 *  - Timestamp (UInteger48 seconds + UInteger32 ns, 10 bytes)
 *  - correctionField: Integer64 of nanoseconds * 2^16 ("scaled ns")
 *  - cumulativeScaledRateOffset: (rateRatio - 1) * 2^41 as Integer32
 *  - Peer delay (meanLinkDelay) and neighborRateRatio
 *  - Time-aware relay: correctionField update for the next hop
 *  - Slave offset from master
 *  - BMCA systemIdentity / priority vector comparison
 *  - Building and parsing the 34-byte common PTP header
 *
 * Educational code: it mirrors the formulas in 802.1AS-2020 clauses 10/11 but is not a PTP stack.
 */
(function (root) {
  'use strict';

  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const unhex = s => {
    s = String(s).replace(/[^0-9a-f]/gi, '');
    if (s.length % 2) throw new Error('odd hex length');
    return Uint8Array.from(s.match(/../g) || [], h => parseInt(h, 16));
  };

  // ---------- intervals ----------
  const logToMs = l => 1000 * Math.pow(2, l);
  const msToLog = ms => Math.round(Math.log2(ms / 1000));

  // ---------- Timestamp: 48-bit seconds + 32-bit nanoseconds ----------
  function encodeTimestamp(sec, ns) {
    sec = BigInt(sec);
    if (sec < 0n || sec >= (1n << 48n)) throw new Error('seconds out of UInteger48 range');
    if (ns < 0 || ns >= 1e9) throw new Error('nanoseconds must be 0 … 999999999');
    const b = new Uint8Array(10);
    for (let i = 0; i < 6; i++) b[i] = Number((sec >> BigInt(8 * (5 - i))) & 0xffn);
    new DataView(b.buffer).setUint32(6, ns >>> 0);
    return b;
  }
  function decodeTimestamp(b) {
    let sec = 0n;
    for (let i = 0; i < 6; i++) sec = (sec << 8n) | BigInt(b[i]);
    const ns = new DataView(b.buffer, b.byteOffset, 10).getUint32(6);
    return { sec, ns };
  }

  // ---------- correctionField: Integer64, units of 2^-16 ns ----------
  function encodeCorrection(ns) {
    const v = BigInt(Math.round(ns * 65536));
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigInt64(0, v);
    return b;
  }
  function decodeCorrection(b) {
    const v = new DataView(b.buffer, b.byteOffset, 8).getBigInt64(0);
    return Number(v) / 65536; // exact for |ns| < 2^37 (≈ 137 s)
  }

  // ---------- cumulativeScaledRateOffset: (rateRatio − 1) · 2^41, Integer32 ----------
  function encodeRateOffset(rateRatio) {
    const v = Math.round((rateRatio - 1) * Math.pow(2, 41));
    if (v < -2147483648 || v > 2147483647) throw new Error('rate offset out of Integer32 range (|ppm| < ~976)');
    return v;
  }
  const decodeRateOffset = v => 1 + v / Math.pow(2, 41);
  const ppmToRatio = ppm => 1 + ppm * 1e-6;
  const ratioToPpm = r => (r - 1) * 1e6;

  // ---------- Peer delay ----------
  /**
   * t1: Pdelay_Req egress (initiator clock)   t2: Pdelay_Req ingress (responder clock)
   * t3: Pdelay_Resp egress (responder clock)  t4: Pdelay_Resp ingress (initiator clock)
   * nrr: neighborRateRatio = responder frequency / initiator frequency
   * Result is in the responder's time base (802.1AS-2020 11.2.19.3.4 / 2011 11.2.15.2.4).
   */
  function meanLinkDelay({ t1, t2, t3, t4, nrr = 1 }) {
    return ((t4 - t1) * nrr - (t3 - t2)) / 2;
  }
  /** neighborRateRatio from two Pdelay exchanges: (t3_N − t3_0) / (t4_N − t4_0). */
  function neighborRateRatio(t3a, t4a, t3b, t4b) {
    return (t3b - t3a) / (t4b - t4a);
  }

  // ---------- Time-aware relay ----------
  /**
   * Correction carried in the Follow_Up sent on a master port of a time-aware relay
   * (802.1AS-2020 11.1.3 / 11.2.14.2.2, two-step):
   *   upstreamTxTime = syncIngress − linkDelay/nrr
   *   correction_out = correction_in + rateRatio · (syncEgress − upstreamTxTime)
   * All times in ns of the local clock; linkDelay is the upstream meanLinkDelay (responder time base).
   * rateRatio = GM frequency / local frequency (upstream rateRatio · nrr).
   */
  function relayCorrection({ correctionIn, syncIngress, syncEgress, linkDelay, nrr = 1, rateRatio = 1 }) {
    const upstreamTxTime = syncIngress - linkDelay / nrr;
    const residence = syncEgress - syncIngress;
    return {
      residence,
      upstreamTxTime,
      added: rateRatio * (syncEgress - upstreamTxTime),
      correctionOut: correctionIn + rateRatio * (syncEgress - upstreamTxTime),
    };
  }

  /** Slave: offset = local Sync ingress − (preciseOriginTimestamp + correction + linkDelay). ns. */
  function offsetFromMaster({ syncIngress, preciseOrigin, correction, linkDelay }) {
    return syncIngress - (preciseOrigin + correction + linkDelay);
  }

  // ---------- BMCA ----------
  /**
   * systemIdentity order (802.1AS 10.3.2): priority1, clockClass, clockAccuracy,
   * offsetScaledLogVariance, priority2, clockIdentity. Lower wins.
   * Then stepsRemoved (lower wins). Returns negative if a is better.
   */
  function compareSystem(a, b) {
    const keys = ['priority1', 'clockClass', 'clockAccuracy', 'variance', 'priority2'];
    for (const k of keys) if (a[k] !== b[k]) return a[k] - b[k];
    const ia = String(a.clockIdentity).toLowerCase(), ib = String(b.clockIdentity).toLowerCase();
    if (ia !== ib) return ia < ib ? -1 : 1;
    return (a.stepsRemoved || 0) - (b.stepsRemoved || 0);
  }
  function decidingField(a, b) {
    const keys = ['priority1', 'clockClass', 'clockAccuracy', 'variance', 'priority2'];
    for (const k of keys) if (a[k] !== b[k]) return k;
    if (String(a.clockIdentity).toLowerCase() !== String(b.clockIdentity).toLowerCase()) return 'clockIdentity';
    return 'stepsRemoved';
  }

  // ---------- Common header (34 bytes) ----------
  const MSG = { 0x0: 'Sync', 0x1: 'Delay_Req', 0x2: 'Pdelay_Req', 0x3: 'Pdelay_Resp', 0x8: 'Follow_Up',
    0x9: 'Delay_Resp', 0xA: 'Pdelay_Resp_Follow_Up', 0xB: 'Announce', 0xC: 'Signaling', 0xD: 'Management' };

  function buildHeader(h) {
    const b = new Uint8Array(34), dv = new DataView(b.buffer);
    b[0] = ((h.majorSdoId ?? 1) << 4) | (h.messageType & 0xf);
    b[1] = ((h.minorVersionPTP ?? 1) << 4) | (h.versionPTP ?? 2);
    dv.setUint16(2, h.messageLength);
    b[4] = h.domainNumber ?? 0;
    b[5] = h.minorSdoId ?? 0;
    dv.setUint16(6, h.flags ?? 0);
    b.set(encodeCorrection(h.correctionNs ?? 0), 8);
    dv.setUint32(16, h.messageTypeSpecific ?? 0);
    b.set(unhex(h.clockIdentity ?? '0000000000000000'), 20);
    dv.setUint16(28, h.portNumber ?? 1);
    dv.setUint16(30, h.sequenceId ?? 0);
    b[32] = h.controlField ?? 0;
    dv.setInt8(33, h.logMessageInterval ?? 0);
    return b;
  }
  function parseHeader(b) {
    const dv = new DataView(b.buffer, b.byteOffset, 34);
    const t = b[0] & 0xf;
    return {
      majorSdoId: b[0] >> 4, messageType: t, messageName: MSG[t] || 'reserved',
      minorVersionPTP: b[1] >> 4, versionPTP: b[1] & 0xf,
      messageLength: dv.getUint16(2), domainNumber: b[4], minorSdoId: b[5],
      flags: dv.getUint16(6), correctionNs: decodeCorrection(b.subarray(8, 16)),
      messageTypeSpecific: dv.getUint32(16),
      clockIdentity: hex(b.subarray(20, 28)), portNumber: dv.getUint16(28),
      sequenceId: dv.getUint16(30), controlField: b[32], logMessageInterval: dv.getInt8(33),
    };
  }
  /** EUI-48 MAC -> EUI-64 clockIdentity (insert FF:FE, the common practice in 802.1AS). */
  function macToClockIdentity(mac) {
    const m = unhex(mac);
    if (m.length !== 6) throw new Error('MAC must be 6 bytes');
    return hex(Uint8Array.from([m[0], m[1], m[2], 0xff, 0xfe, m[3], m[4], m[5]]));
  }

  const api = { hex, unhex, MSG, logToMs, msToLog, encodeTimestamp, decodeTimestamp, encodeCorrection, decodeCorrection,
    encodeRateOffset, decodeRateOffset, ppmToRatio, ratioToPpm, meanLinkDelay, neighborRateRatio, relayCorrection,
    offsetFromMaster, compareSystem, decidingField, buildHeader, parseHeader, macToClockIdentity };
  root.PTPMath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

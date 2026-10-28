// Group 7 Lampo interaction: mirror a physical button; a human reads the flashes.
export const MORSE_TIMEOUT_S = 25; // Original suitcase heartbeat is every 10 s.
export const MORSE_MAX_HOLD_S = 10;
export const MORSE_DASH_MS = 400;
const PASSCODE = '2026';

export function validMorse(d) {
  if (d?.module === 'suitcase') return d.event === 'online' &&
    (d.uptime_s === undefined || Number.isSafeInteger(d.uptime_s) && d.uptime_s >= 0);
  return d?.module === 'morse_button' &&
    (typeof d.lampo_toggle === 'boolean' || ['pressed', 'released'].includes(d.state));
}

export class Morse {
  constructor() {
    this.source = '';this.lastSeen = null;this.lastUptime = null;
    this.reset();
  }
  reset() {
    this.state = 'idle';this.lamp = false;this.onAt = null;
    this.bypassed = false;this.roundId = null;this.resultId = null;
    this.heistRoundId = null;this.result = null;this.feedback = '';
    this.signals = [];this.signalCount = 0;
    this.notice = 'Watch the lamp. Read your partner\'s signal, then enter the passcode.';
  }
  selectSource(name, lastSeen = null) {
    if (this.state === 'receiving') throw Error('Clear the signal before changing the Morse device.');
    this.reset();this.source = name;this.lastSeen = lastSeen;this.lastUptime = null;
  }
  fresh(now) { return this.lastSeen !== null && now - this.lastSeen < MORSE_TIMEOUT_S; }
  fault(reason) {
    this.lamp = false;this.onAt = null;
    if (this.state !== 'receiving') return;
    this.state = 'fault';this.notice = reason + ' Reset the receiver or use the presenter bypass.';
  }
  tick(now) {
    if (!this.fresh(now)) this.fault('Morse device stopped sending.');
    if (this.onAt !== null && now - this.onAt >= MORSE_MAX_HOLD_S) this.fault('Signal held for ten seconds without a release.');
  }
  ingest(sender, d, now) {
    if (sender !== this.source || !validMorse(d)) return false;
    this.tick(now);
    this.lastSeen = now;
    if (d.module === 'suitcase') {
      if (this.lastUptime !== null && d.uptime_s < this.lastUptime) this.fault('Morse device restarted.');
      if (d.uptime_s !== undefined) this.lastUptime = d.uptime_s;
      return true;
    }
    if (this.state === 'solved' || this.state === 'fault') return true;
    const on = typeof d.lampo_toggle === 'boolean' ? d.lampo_toggle : d.state === 'pressed';
    if (on) {
      this.roundId ??= crypto.randomUUID();
      this.state = 'receiving';
      if (!this.lamp) this.onAt = now;
      this.notice = 'Receiving your partner\'s signal. Clear when you are ready to enter the code.';
    } else {
      if (this.lamp && this.onAt !== null) {
        const ms = Number.isFinite(d.duration_ms) && d.duration_ms > 0 ? d.duration_ms : (now - this.onAt) * 1000;
        if (ms > 0 && ms < MORSE_MAX_HOLD_S * 1000) {
          this.signals.push(ms >= MORSE_DASH_MS ? '-' : '.');this.signalCount++;
          if (this.signals.length > 30) this.signals.splice(0, 5); // Keep whole five-signal rows.
        }
      }
      this.onAt = null;
    }
    this.lamp = on;
    return true;
  }
  clearSignal() {
    this.lamp = false;this.onAt = null;this.feedback = '';this.signals = [];this.signalCount = 0;
    if (this.state === 'solved' || this.state === 'fault') return;
    this.state = 'idle';this.notice = 'Signal cleared. Enter the code, or ask your partner to repeat.';
  }
  verify(code, heistRoundId = null) {
    if (this.state === 'solved') return true;
    const attempt = String(code ?? '').trim().toUpperCase();
    if (attempt !== PASSCODE) {
      this.feedback = attempt ? 'Wrong code. Read the signal again.' : 'Type the code first.';
      return false;
    }
    this.complete(false, heistRoundId);return true;
  }
  bypass(heistRoundId = null) { this.complete(true, heistRoundId); }
  complete(bypassed, heistRoundId) {
    if (this.state === 'solved') return;
    this.roundId ??= crypto.randomUUID();this.heistRoundId = heistRoundId;
    this.resultId = crypto.randomUUID();this.state = 'solved';this.bypassed = bypassed;
    this.lamp = false;this.onAt = null;this.feedback = '';
    this.notice = bypassed ? 'Passed by presenter bypass.' : 'Passcode accepted. Morse override complete.';
    // Keep their terminal/solved event for existing downstream listeners.
    this.result = {module:'terminal',event:'solved',solved:true,puzzle_id:'morse',
      result_id:this.resultId,round_id:heistRoundId || this.roundId,puzzle_round_id:this.roundId,
      bypassed,completion_method:bypassed?'presenter_bypass':'played'};
  }
  takeResult() { const result = this.result;this.result = null;return result; }
  snapshot(now) {
    return {state:this.state,source:this.source,fresh:this.fresh(now),lamp:this.lamp,
      notice:this.notice,feedback:this.feedback,bypassed:this.bypassed,
      signals:[...this.signals],signal_count:this.signalCount,dash_threshold_ms:MORSE_DASH_MS,
      round_id:this.roundId,result_id:this.resultId};
  }
}

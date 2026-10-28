// Vault-lock puzzle. Inputs match firmware/Skidule_Controls/Skidule_Controls.ino.
// Network identity and freshness are separate from selecting the visible module.
export const SKIDULE_BARS = 4;
export const MATCH_TOLERANCE = 0.04;
export const WARM_TOLERANCE = 0.15;
export const CONTROL_TIMEOUT_S = 2.5;
// New controls send slider as a percentage. Keep the normalized legacy field.
function controlHeight(d){return d.bar_height!==undefined?d.bar_height:Number.isFinite(d.slider)?d.slider/100:NaN;}

export function normalizeControls(input){
  if(!input||typeof input!=='object')return null;
  let d=input;
  const mapKnob=d.bar_count===10||(d.bar_count===undefined&&d.knob!==undefined);
  if(mapKnob){
    if(!Number.isFinite(d.knob)||d.knob<0||d.knob>1||!Number.isInteger(d.bar_index)||d.bar_index<0||d.bar_index>9)return null;
    d={...d,bar_index:Math.min(3,Math.floor(d.knob*4)),bar_count:4,input_mapping:'knob_to_four',input_bar_index:input.bar_index};
  }
  const valid=d?.module === 'skidule_controls' &&
    typeof d.boot_id === 'string' && d.boot_id.length > 0 && d.boot_id.length <= 64 &&
    Number.isSafeInteger(d.seq) && d.seq >= 0 &&
    Number.isInteger(d.bar_index) && d.bar_index >= 0 && d.bar_index < SKIDULE_BARS &&
    (d.bar_count === undefined || d.bar_count === SKIDULE_BARS) &&
    Number.isFinite(controlHeight(d)) && controlHeight(d) >= 0 && controlHeight(d) <= 1 &&
    Number.isSafeInteger(d.button_press_count) && d.button_press_count >= 0 &&
    ['online', 'state', 'pressed', 'released'].includes(d.event);
  return valid?d:null;
}
export function validControls(d){return normalizeControls(d)!==null;}

export class Skidule {
  constructor() {
    this.source = '';
    this.boot = null;
    this.seq = -1;
    this.lastSeen = null;
    this.lastPress = 0;
    this.controlHeight = 0.5;
    this.selected = 0;
    this.inputMapping='native';this.inputBarIndex=0;
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.bypassed = false;
    this.roundId = null;
    this.resultId = null;
    this.heistRoundId = null;
    this.targets = [];
    this.heights = Array(SKIDULE_BARS).fill(0);
    this.locked = Array(SKIDULE_BARS).fill(false);
    this.notice = 'Connect your controls, then start the lock.';
    this.result = null;
  }

  selectSource(name) {
    if (this.state === 'running') throw Error('Reset the lock before changing its controls.');
    this.reset();
    this.source = name;
    this.boot = null;
    this.seq = -1;
    this.lastSeen = null;
    this.lastPress = 0;
    this.selected = 0;
  }

  fresh(now) {
    return this.lastSeen !== null && now - this.lastSeen < CONTROL_TIMEOUT_S;
  }

  start(now, heistRoundId = null, random = Math.random) {
    if (this.state !== 'idle') throw Error('Reset the lock before starting a new attempt.');
    if (!this.source || !this.fresh(now)) throw Error('Select controls with a fresh connection first.');
    this.targets = Array.from({length: SKIDULE_BARS}, () => 0.1 + random() * 0.8);
    this.heights.fill(0);
    this.heights[this.selected] = this.controlHeight;
    this.locked.fill(false);
    this.roundId = crypto.randomUUID();
    this.heistRoundId = heistRoundId;
    this.state = 'running';
    this.notice = 'Adjust the selected bar. Lock it when the signal shows MATCH.';
  }

  fault(reason) {
    if (this.state !== 'running') return;
    this.state = 'fault';
    this.notice = reason + ' Inspect the connection and reset the lock.';
  }

  tick(now) {
    if (!this.fresh(now)) this.fault('Skidule controls stopped sending.');
  }

  feedback(index = this.selected) {
    if (!this.targets.length) return 'ready';
    const distance = Math.abs(this.heights[index] - this.targets[index]);
    if (distance <= MATCH_TOLERANCE + 1e-9) return 'match';
    return distance <= WARM_TOLERANCE + 1e-9 ? 'warm' : 'cold';
  }

  ingest(sender, d, now) {
    if (sender !== this.source || !(d=normalizeControls(d))) return false;
    if (d.boot_id === this.boot && d.seq <= this.seq) return false;
    this.tick(now); // A late recovery packet cannot conceal an outage.
    if (this.boot !== null && this.boot !== d.boot_id) {
      this.fault('Skidule controls restarted.');
      this.lastPress = d.button_press_count; // Never replay a press from a new boot.
    }
    const newPress = this.boot === d.boot_id && d.button_press_count > this.lastPress;
    this.boot = d.boot_id;
    this.seq = d.seq;
    this.lastSeen = now;
    this.lastPress = Math.max(this.lastPress, d.button_press_count);
    this.selected = d.bar_index;
    this.inputMapping=d.input_mapping||'native';this.inputBarIndex=d.input_bar_index??d.bar_index;
    this.controlHeight = controlHeight(d);
    if (this.state !== 'running') {
      if (this.state === 'idle') this.notice = 'Controls connected. Start the lock when ready.';
      return true;
    }
    if (!this.locked[this.selected]) this.heights[this.selected] = this.controlHeight;
    if (d.event === 'pressed' && newPress) this.confirm();
    return true;
  }

  confirm() {
    const index = this.selected;
    if (this.locked[index]) {
      this.locked[index] = false;
      this.heights[index] = this.controlHeight;
      this.notice = `Bar ${index + 1} unlocked. Adjust its height.`;
    } else if (this.feedback() === 'match') {
      this.locked[index] = true;
      this.notice = `Bar ${index + 1} locked. Select the next bar.`;
    } else {
      this.notice = `Bar ${index + 1} is not matched yet. Keep adjusting.`;
    }
    if (this.locked.every(Boolean)) this.complete();
  }

  bypass(heistRoundId = null) {
    if (this.state === 'solved') return;
    this.roundId ??= crypto.randomUUID();
    this.heistRoundId ??= heistRoundId;
    this.complete(true);
  }

  complete(bypassed = false) {
    this.state = 'solved';
    this.bypassed = bypassed;
    this.resultId = crypto.randomUUID();
    this.notice = bypassed ? 'Passed by presenter bypass. Continue to the next module.' : 'All four bars are locked. The lock puzzle is complete.';
    this.result = {
      module: 'skidule', event: 'solved', solved: true,
      locked_count: this.locked.filter(Boolean).length, bar_count: SKIDULE_BARS, bypassed,
      completion_method: bypassed ? 'presenter_bypass' : 'played',
      puzzle_id: 'skidule', result_id: this.resultId,
      round_id: this.heistRoundId || this.roundId, puzzle_round_id: this.roundId
    };
  }

  takeResult() {
    const result = this.result;
    this.result = null;
    return result;
  }

  snapshot(now) {
    return {
      state: this.state, bypassed: this.bypassed, source: this.source, fresh: this.fresh(now), selected: this.selected,
      heights: [...this.heights], locked: [...this.locked], feedback: this.feedback(),
      locked_count: this.locked.filter(Boolean).length, bar_count: SKIDULE_BARS, control_height: this.controlHeight,
      input_mapping:this.inputMapping,input_bar_index:this.inputBarIndex,
      round_id: this.roundId, result_id: this.resultId, notice: this.notice
    }; // Target heights intentionally stay out of the display state.
  }
}

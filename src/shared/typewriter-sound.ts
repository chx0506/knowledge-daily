/**
 * 打字机 / 盖章音效：WebAudio 现场合成，无音频素材。
 * 必须在用户手势链路里首次调用（出报按钮的 click → generate），
 * 这样 AudioContext 才能通过自动播放策略。
 */

let ctx: AudioContext | null = null;
let typing = false;

function ensureCtx(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 单次击键：短噪声脉冲 + 带通，频率轻微随机更像真键盘。 */
function clack(c: AudioContext): void {
  const dur = 0.028;
  const t = c.currentTime;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2000 + Math.random() * 900;
  filter.Q.value = 1.1;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.16, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t);
}

/** 步骤完成盖章：低频落戳 + 一点点高频纸响。 */
function stampThump(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(170, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.28, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.15);
  clack(c);
}

/** 开始打字声：不规则节奏的连击，像看山在敲键盘。 */
export function startTyping(): void {
  const c = ensureCtx();
  if (!c || typing) return;
  typing = true;
  const tick = (): void => {
    if (!typing) return;
    clack(c);
    window.setTimeout(tick, 55 + Math.random() * 75);
  };
  tick();
}

export function stopTyping(): void {
  typing = false;
}

/** 一步完成：盖章一声。 */
export function stamp(): void {
  const c = ensureCtx();
  if (!c) return;
  stampThump(c);
}

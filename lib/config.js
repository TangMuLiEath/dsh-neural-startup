export const defaults = {
  enabled: true, mode: 'session', speed: 1, allowSkip: true,
  sound: true, soundVolume: .9, soundButton: true,
  voice: true, voiceName: '', voiceVolume: .5, voiceRate: .86, voicePitch: .72,
  line1: 'Identity confirmed. Prime authority.', line2: 'Welcome back.',
  title1: 'DEEPSEEK', title2: 'HARNESS', subtitle: '深度求索 · 神经核心已同步', badge: '高授权者 · PRIME AUTHORITY · 已识别'
}
const ranges = { speed: [.3, 3], soundVolume: [0, 1], voiceVolume: [0, 1], voiceRate: [.5, 2], voicePitch: [0, 2] }
export function normalize(input) {
  const source = input && typeof input === 'object' ? input : {}
  const out = { ...defaults }
  for (const [key, fallback] of Object.entries(defaults)) {
    if (!Object.hasOwn(source, key)) continue
    const value = source[key]
    if (typeof fallback === 'boolean') out[key] = value === true || value === 'true' || value === 1
    else if (ranges[key]) { const number = Number(value); if (Number.isFinite(number)) out[key] = Math.min(ranges[key][1], Math.max(ranges[key][0], number)) }
    else if (key === 'mode') { if (['always', 'session', 'daily'].includes(value)) out[key] = value }
    else if (typeof value === 'string') out[key] = value.slice(0, 160)
  }
  return out
}

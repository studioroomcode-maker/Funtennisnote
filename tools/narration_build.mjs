// Round-4: rewrite the 18-line script with curiosity/twist storytelling, then rebuild narration.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = 'D:/MakingApps/Apps/Tennis/TMA/Ads/fun_tennisnote/output/episodes/FTN-PILOT-02';

const LINES = [
  '전 세계 코트를 점령한 이 형광 노란 테니스공, 사실 이제 쉰 살을 갓 넘긴 신입입니다.',
  '테니스의 역사는 백 년을 훌쩍 넘는데, 그 긴 세월 코트의 주인공은 뜻밖에도 흰 공과 검은 공이었죠.',
  '밝은 잔디 위에서는 검은 공, 어두운 코트 위에서는 흰 공. 배경에 따라 공 색을 바꿔 쓰던 시절이었습니다.',
  '그런데 테니스가 안방 텔레비전 속으로 들어오면서, 묘한 문제가 하나 생깁니다.',
  '흑백 화면 속 흰 공이 흰 라인 위를 지나는 순간, 공이 감쪽같이 사라져 버린 겁니다.',
  '카메라가 공을 쫓고 시청자가 화면을 노려봐도, 정작 주인공이 보이지 않는 이상한 중계였죠.',
  '연구자들은 화면에서 가장 잘 살아남는 색을 찾아 나섰고, 그 답이 바로 형광 노란색이었습니다.',
  '코트에서도 화면에서도, 어떤 배경 위에서도 끝까지 또렷하게 남는 색이었기 때문입니다.',
  '그런데 문제가 하나 더 있었습니다. 당시 규칙서는 흰 공만 인정하고 있었던 겁니다.',
  '더 잘 보이는 공을 찾아냈는데, 정작 규칙이 그 공의 입장을 막아선 상황이었죠.',
  '그렇다면 규칙은 왜 바로 문을 열어주지 않았을까요?',
  '국제테니스연맹은 무려 2년 동안 실제 경기에서 노란 공을 굴려 보며 신중하게 검증했습니다.',
  '그리고 1972년, 노란 공은 마침내 규칙서에 정식으로 이름을 올립니다.',
  '규칙은 흰 공을 지운 게 아니라 노란색에 한 자리를 내준 것뿐이라, 흰 공은 지금도 합법입니다.',
  '반으로 갈라 보면 속은 완전히 같은 공. 바뀐 건 오직 겉옷 색깔 하나뿐이었죠.',
  '끝까지 흰 공을 고집하던 윔블던도 108년 만인 1986년, 결국 노란 공에 자리를 내줍니다.',
  '결국 노란 공을 코트의 표준으로 만든 건 선수가 아니라, 화면 앞 시청자의 눈이었습니다.',
  '오늘 저녁 화면 속을 통통 튀어 다니는 저 노란 공, 알고 보면 보는 사람을 위해 허용된 색이었던 것이었습니다.'
];
console.log('total chars:', LINES.join('').replace(/\s/g, '').length);

const script = JSON.parse(fs.readFileSync(base + '/script.json', 'utf8'));
script.scriptLines = LINES;
script.updatedAt = new Date().toISOString();
script.scriptSource = 'claude-story-rewrite-v4';
fs.writeFileSync(base + '/script.json', JSON.stringify(script, null, 1));

const plan = JSON.parse(fs.readFileSync(base + '/visual-plan.json', 'utf8'));
plan.scriptLines = LINES;
plan.generatedAt = new Date().toISOString();
fs.writeFileSync(base + '/visual-plan.json', JSON.stringify(plan, null, 1));
console.log('script + plan updated');

// narration: per-sentence, tempo 1.15, loudnorm, concat
const KEY = process.env.TYPECAST_API_KEY;
if (!KEY) throw new Error('no key');
const segDir = `${process.cwd()}/tts_v5`;
fs.mkdirSync(segDir, { recursive: true });
async function tts(text, out) {
  const res = await fetch('https://api.typecast.ai/v1/text-to-speech', {
    method: 'POST', headers: { 'X-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_id: 'tc_68257f68bc6e3c161ab5078d', text, model: 'ssfm-v30', language: 'kor',
      output: { volume: 100, audio_pitch: 0, audio_tempo: 1.2, audio_format: 'wav' } })
  });
  if (!res.ok) throw new Error('typecast ' + res.status + ': ' + (await res.text()).slice(0, 200));
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}
const dur = f => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const GAP = 0.1;
const timeline = []; let t = 0; const inputs = [];
for (let i = 0; i < 18; i++) {
  const raw = `${segDir}/line${String(i + 1).padStart(2, '0')}.wav`;
  const norm = `${segDir}/norm${String(i + 1).padStart(2, '0')}.wav`;
  await tts(LINES[i], raw);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '44100', norm], { stdio: 'inherit' });
  const d = dur(norm);
  timeline.push({ cut: i + 1, start: t, end: t + d, duration: d, text: LINES[i] });
  t += d + (i < 17 ? GAP : 0);
  inputs.push('-i', norm);
  console.log(`line ${i + 1}: ${d.toFixed(2)}s`);
}
const parts = [];
timeline.forEach((_, i) => { parts.push(`[${i}:a]`); if (i < 17) parts.push(`[g${i}]`); });
const silence = timeline.slice(0, -1).map((_, i) => `aevalsrc=0:d=${GAP}:s=44100[g${i}]`).join(';');
const filter = `${silence};${parts.join('')}concat=n=${parts.length}:v=0:a=1[out]`;
const finalWav = `${base}/audio/typecast_piljae.wav`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', '-ar', '44100', finalWav], { stdio: 'inherit' });
fs.writeFileSync(`${base}/audio/narration_timeline.json`, JSON.stringify({ generatedAt: new Date().toISOString(), gapSeconds: GAP, tempo: 1.2, totalDuration: dur(finalWav), segments: timeline }, null, 1));
console.log('narration rebuilt:', dur(finalWav).toFixed(2) + 's');

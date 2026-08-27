// Assemble v2 master: kling clips + per-sentence timeline + animated evidence overlays.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = 'D:/MakingApps/Apps/Tennis/TMA/Ads/fun_tennisnote/output/episodes/FTN-PILOT-02';
const tl = JSON.parse(fs.readFileSync(base + '/audio/narration_timeline.json', 'utf8'));
const segs = tl.segments;
const GAP = tl.gapSeconds;
const TAIL = 0.8;

// video segment durations: sentence + gap (last: + tail)
const durs = segs.map((s, i) => i < segs.length - 1 ? s.duration + GAP : s.duration + TAIL);
const starts = [];
let acc = 0;
for (const d of durs) { starts.push(acc); acc += d; }

const segDir = `${process.cwd()}/seg_redo`;
fs.mkdirSync(segDir, { recursive: true });
const listLines = [];
const STILL_CUTS = new Set([6, 13, 14, 15, 17, 18]); // clips that drifted off-model: use keyframe with strong push-in instead
const PUSH_CUTS = new Set([16]); // real clips that feel static: add digital push-in
for (let i = 0; i < 18; i++) {
  const cut = i + 1;
  const out = `${segDir}/seg${String(cut).padStart(2, '0')}.mp4`;
  if (STILL_CUTS.has(cut)) {
    const img = `${base}/stills/c${String(cut).padStart(2, '0')}.png`;
    const frames = Math.round(durs[i] * 30);
    // stronger, clearly visible push-in with a slight upward drift
    const vf = `scale=1620:2880,zoompan=z='1+0.0011*in':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-0.45*in':d=${frames}:fps=30:s=1080x1920,setsar=1`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', img, '-vf', vf, '-frames:v', String(frames),
      '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: 'inherit' });
    listLines.push(`file '${out.replace(/'/g, "'\\''")}'`);
    console.log(`seg ${cut} ${durs[i].toFixed(2)}s (still push-in)`);
    continue;
  }
  const src = `${base}/clips/c${String(cut).padStart(2, '0')}_silent.mp4`;
  // time-stretch the whole clip to the segment length so camera motion runs to the last frame (no freeze padding)
  const clipDur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
  const factor = durs[i] / clipDur;
  const pushIn = PUSH_CUTS.has(cut) ? `,scale=1620:2880,zoompan=z='1+0.0007*in':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30` : '';
  const vf = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=${factor.toFixed(5)}*PTS,fps=30${pushIn},setsar=1`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', vf, '-t', durs[i].toFixed(3),
    '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: 'inherit' });
  listLines.push(`file '${out.replace(/'/g, "'\\''")}'`);
  console.log(`seg ${cut} ${durs[i].toFixed(2)}s (stretch x${factor.toFixed(2)} from ${clipDur.toFixed(2)}s)`);
}
fs.writeFileSync(`${segDir}/concat.txt`, listLines.join('\n'));

// silent concat first
const silent = `${segDir}/concat_silent.mp4`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${segDir}/concat.txt`, '-c', 'copy', silent], { stdio: 'inherit' });

// ---- animated evidence overlays (post infographics, meaning-anchored) ----
const FONT = 'C\\:/Windows/Fonts/arialbd.ttf';
const YEL = '0xDFFF4F', WHT = '0xFFFFFF', RED = '0xFF5A5A';
// cut, label, color, size, x-expr, y-base
const overlays = [
  [7, 'BETTER ON TV', YEL, 60, '(w-text_w)/2', 620],
  [9, 'WHITE ONLY', RED, 64, '(w-text_w)/2', 470],
  [13, '1972', YEL, 150, '(w-text_w)/2', 430],
  [15, 'SAME BALL', WHT, 60, '(w-text_w)/2', 1440],
  [17, 'EASIER TO SEE', YEL, 62, '(w-text_w)/2', 480],
];
const chains = overlays.map(([cut, label, color, size, xe, y0]) => {
  const i = cut - 1;
  const ts = (starts[i] + Math.min(1.0, segs[i].duration * 0.3)).toFixed(2);
  const hold = 1.4;
  const te = Math.min(starts[i] + durs[i] - 0.3, parseFloat(ts) + hold).toFixed(2);
  const alpha = `if(lt(t\\,${ts}+0.3)\\,(t-${ts})/0.3\\,if(gt(t\\,${te}-0.3)\\,(${te}-t)/0.3\\,1))`;
  const yexpr = `${y0}+14*(1-min((t-${ts})/0.35\\,1))`; // slide-up entrance
  return `drawtext=fontfile='${FONT}':text='${label}':fontcolor=${color}:fontsize=${size}:borderw=4:bordercolor=0x000000CC:x=${xe}:y=${yexpr}:alpha='${alpha}':enable='between(t,${ts},${te})'`;
});
const vfChain = chains.join(',');

fs.mkdirSync(`${base}/final`, { recursive: true });
const master = `${base}/final/master_kling_v2.mp4`;
// explanatory motion-graphic sequences (transparent PNG series) anchored to their cuts
const GFX = [
  { cut: 3, dir: 'gfx/g03' },
  { cut: 5, dir: 'gfx/g05' },
  { cut: 8, dir: 'gfx/g08' },
  { cut: 12, dir: 'gfx/g12' },
  { cut: 16, dir: 'gfx/g16' },
];
const logo = 'D:/MakingApps/Apps/Tennis/TMA/Ads/fun_tennisnote/reference/테니스노트로고White.png';
const lgStart = (starts[17] + 1.2).toFixed(2);
const args = ['-y', '-loglevel', 'error', '-i', silent, '-loop', '1', '-i', logo, '-i', `${base}/audio/typecast_piljae.wav`];
const fcParts = [`[0:v]${vfChain}[t0]`];
let cur = 't0';
GFX.forEach((g, k) => {
  const inputIdx = 3 + k;
  args.push('-framerate', '30', '-i', `${process.cwd()}/${g.dir}/f_%03d.png`);
  const frames = fs.readdirSync(`${process.cwd()}/${g.dir}`).length;
  const st = (starts[g.cut - 1] + 0.45).toFixed(2);
  const en = Math.min(starts[g.cut - 1] + durs[g.cut - 1] - 0.1, parseFloat(st) + frames / 30).toFixed(2);
  fcParts.push(`[${inputIdx}:v]format=rgba,setpts=PTS-STARTPTS+${st}/TB[q${k}]`);
  fcParts.push(`[${cur}][q${k}]overlay=0:0:enable='between(t,${st},${en})'[t${k + 1}]`);
  cur = `t${k + 1}`;
});
fcParts.push(`[1:v]scale=340:-1,format=rgba,fade=t=in:st=${lgStart}:d=0.7:alpha=1[lg]`);
fcParts.push(`[${cur}][lg]overlay=(W-w)/2:H-240:enable='gte(t,${lgStart})'[outv]`);
execFileSync('ffmpeg', [...args,
  '-filter_complex', fcParts.join(';'), '-map', '[outv]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', master], { stdio: 'inherit' });
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', master]).toString().trim();
console.log(`MASTER v2: ${master} duration=${probe}s`);

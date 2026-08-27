import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { buildEpisodeCatalog, buildUnifiedEpisodeCatalog, catalogCategories } from "./catalog.mjs";

const dashboardDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dashboardDir, "..");
const publicDir = path.join(dashboardDir, "public");
const dataDir = path.join(dashboardDir, "data");
const stateFile = path.join(dataDir, "state.json");
const promptPackage = path.join(projectRoot, "docs", "FTN_EP01_yellow_ball_78s_prompt_package.md");
const outputDir = path.join(projectRoot, "output");
const episodeProjectsDir = path.join(outputDir, "episodes");
const legacyEpisodeId = "FTN-PILOT-02";
const requestedPort = Number(process.env.FTN_DASHBOARD_PORT || 4175);
const episodeCatalog = buildEpisodeCatalog();
const unifiedEpisodeCatalog = buildUnifiedEpisodeCatalog();
const allEpisodes = unifiedEpisodeCatalog;
const typecastApiBase = "https://api.typecast.ai";
const higgsfieldExecutable = process.platform === "win32"
  ? path.join(process.env.APPDATA || "", "npm", "node_modules", "@higgsfield", "cli", "vendor", "hf.exe")
  : "higgsfield";
const higgsfieldImageModelMap = Object.freeze({
  "nano-banana-2-lite": { jobType: "nano_banana_2_lite", resolution: "1k", credits: 1 },
  "nano-banana-2": { jobType: "nano_banana_flash", resolution: "2k", credits: 1.5 },
  "nano-banana-pro": { jobType: "nano_banana_pro", resolution: "2k", credits: 2 }
});
const higgsfieldVideoModelMap = Object.freeze({
  "cinema-studio-4": { jobType: "cinematic_studio_video_4_0", resolution: "720p", credits: 32.5, supportsAudioToggle: true, supportsReferences: true, cinemaMode: true },
  "seedance-2": { jobType: "seedance_2_0", resolution: "720p", credits: 22.5, supportsAudioToggle: true, supportsReferences: true },
  "kling-3-motion": { jobType: "kling3_0_turbo", resolution: "720p", credits: 7.5, supportsAudioToggle: false, supportsReferences: false }
});
let higgsfieldStatusCache = { checkedAt: 0, value: null };
const activeHiggsfieldJobs = new Set();
const referenceAssetDefinitions = Object.freeze([
  { id: "court", group: "shape", label: "테니스 코트", file: "reference/basicrefer_court.png" },
  { id: "ball", group: "shape", label: "테니스공", file: "reference/basicrefer_tennisball.png" },
  { id: "net", group: "shape", label: "테니스 네트", file: "reference/basicrefer_net.png" },
  { id: "racket", group: "shape", label: "테니스 라켓", file: "reference/basicrefer_racket.png" },
  { id: "tedori-sheet", group: "character", label: "테돌이 캐릭터 시트", file: "reference/tedori_character_sheet_final.png" },
  { id: "tedori-original", group: "character", label: "테돌이 원본", file: "reference/tedori_original_reference.png" },
  { id: "tennisnote-logo", group: "brand", label: "테니스노트 로고", file: "reference/테니스노트로고.png" },
  { id: "tennisnote-logo-white", group: "brand", label: "테니스노트 흰색 로고", file: "reference/테니스노트로고White.png" },
  { id: "tennisnote-icon", group: "brand", label: "테니스노트 아이콘", file: "reference/tennisnote_icon.png" }
]);

const providerModels = {
  flow: ["veo-3.1-lite", "veo-3.1-fast", "veo-3.1-quality", "gemini-omni-flash"],
  higgsfield: ["cinema-studio-4", "seedance-2", "kling-3-motion"]
};
const imageModels = {
  flow: ["nano-banana-2-lite", "nano-banana-2", "nano-banana-pro"]
};
const imageCreditSamples = {
  updatedAt: "2026-08-26",
  label: "Higgsfield CLI 이미지",
  basis: "인증된 Plus 워크스페이스 · CLI cost 실측 · 이미지 1장",
  source: "https://higgsfield.ai/cli",
  models: {
    "nano-banana-2-lite": { level: "절약", display: "1cr", credits: 1, condition: "1K · 실제 자동 생성" },
    "nano-banana-2": { level: "표준", display: "1.5cr", credits: 1.5, condition: "2K · 실제 자동 생성" },
    "nano-banana-pro": { level: "고품질", display: "2cr", credits: 2, condition: "2K · 실제 자동 생성" }
  }
};
const defaultKeyframeCuts = new Set([1, 3, 5, 7, 10, 14, 18]);
const creditSamples = {
  updatedAt: "2026-08-26",
  flow: {
    label: "Google Flow",
    basis: "Google AI Pro · 비 Ultra · 1회 생성 기준",
    source: "https://support.google.com/flow/answer/16526234?hl=en",
    models: {
      "veo-3.1-lite": { level: "절약", credits: 10, display: "10cr", condition: "4·6·8초" },
      "veo-3.1-fast": { level: "보통", credits: 20, display: "20cr", condition: "4·6·8초" },
      "veo-3.1-quality": { level: "매우 높음", credits: 100, display: "100cr", condition: "8초" },
      "gemini-omni-flash": { level: "보통", creditsByDuration: { "4": 15, "6": 20, "8": 25, "10": 30 }, display: "15–30cr", condition: "4·6·8·10초" }
    }
  },
  higgsfield: {
    label: "Higgsfield",
    basis: "공식 블로그 샘플 · 5초 · 720p · 대략값",
    source: "https://higgsfield.ai/blog/ai-video-credits-explained",
    models: {
      "kling-3-motion": { level: "절약", credits: 7.5, display: "7.5cr", condition: "CLI 실측 · 5초·720p" },
      "seedance-2": { level: "보통", credits: 22.5, display: "22.5cr", condition: "CLI 실측 · 5초·720p" },
      "cinema-studio-4": { level: "높음", credits: 32.5, display: "32.5cr", condition: "CLI 실측 · 5초·720p" }
    }
  }
};
const stageIds = ["brief", "shots", "voice", "keyframes", "video", "edit", "qa"];
const allowedModes = ["auto", "review", "manual"];
const allowedStatuses = ["not_started", "planned", "running", "ready_review", "waiting_external", "blocked", "complete", "error"];
const allowedKeyframeStatuses = ["not_required", "planned", "waiting_external", "ready_review", "approved", "error"];
const allowedScriptRhythms = ["auto", "time", "object", "rule", "result", "physics", "history"];
const scriptRhythmProfiles = {
  time: { label: "시간 압축", intro: "정확한 시간 단위나 접촉 시간을 던진 뒤, 그 짧은 순간에 무엇이 결정되는지 질문합니다.", crisis: "반응 한계를 테니스의 받기·타이밍 어휘로 짧게 끊습니다.", reversal: "시간, 타점 또는 각도의 조건 하나를 바꿉니다.", close: "첫 질문의 시간 단위를 다시 불러 답을 다정하게 정리합니다." },
  object: { label: "무관심 대상", intro: "익숙한 공·선·그립·스트링을 보여주고 왜 이런 모양인지 자연스럽게 질문합니다.", crisis: "평범한 대상이 통제 불가능해지는 순간을 한 문장으로 끊습니다.", reversal: "잡는 위치, 맞는 지점 또는 배치를 바꿉니다.", close: "처음 본 대상이 왜 그렇게 만들어졌는지 쉬운 답으로 회수합니다." },
  rule: { label: "규정 인용", intro: "규정 문구나 숫자 하나를 보여주고 왜 이런 규칙이 생겼는지 질문합니다.", crisis: "규정을 지키면 풀 수 없고 어기면 경기가 흔들리는 딜레마를 짧게 끊습니다.", reversal: "규칙의 빈틈이 아니라 조건의 해석이나 설계 방향을 바꿉니다.", close: "한 줄 규정이 무엇을 지키려 했는지 첫 질문에 답합니다." },
  result: { label: "결과 선행", intro: "믿기 어려운 기록·판정·속도·패배를 먼저 보여주고 원인을 질문합니다.", crisis: "상식적인 원인으로는 그 결과를 설명할 수 없다고 짧게 선언합니다.", reversal: "숨은 변수 하나를 드러내며 원인과 결과를 다시 연결합니다.", close: "처음 제시한 결과가 나온 이유를 쉬운 한 문장으로 답합니다." },
  physics: { label: "물리 한계", intro: "힘·회전·압력·마찰 중 하나를 보여주고 왜 예상과 반대로 움직이는지 질문합니다.", crisis: "사람의 힘이나 반응만으로는 해결되지 않는 한계를 짧게 끊습니다.", reversal: "힘을 더 쓰는 대신 각도·회전·탄성·상대 속도를 이용합니다.", close: "성능이 힘 하나가 아니라 균형에서 나왔음을 부드럽게 회수합니다." },
  history: { label: "인물·역사", intro: "선수·심판·개발자의 이상한 결정을 먼저 보여주고 왜 그랬는지 질문합니다.", crisis: "기존 선택지가 모두 막힌 순간을 경기 어휘로 짧게 끊습니다.", reversal: "누군가 정석과 반대되는 행동을 선택하며 흐름을 바꿉니다.", close: "그 선택이 오늘의 테니스에 무엇을 남겼는지 다정하게 정리합니다." }
};
function resolveScriptRhythmProfile(episode, selected = "auto") {
  const ids = allowedScriptRhythms.filter((id) => id !== "auto");
  const hash = [...String(episode?.id || episode?.title || "tennis")].reduce((sum, character) => sum + character.codePointAt(0), 0);
  const id = ids.includes(selected) ? selected : ids[hash % ids.length];
  return { id, ...scriptRhythmProfiles[id], selection: selected === "auto" ? "에피소드별 자동 순환" : "사용자 선택" };
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body, null, 2));
}

function within(base, candidate) {
  const resolved = path.resolve(base, candidate);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new Error("허용되지 않은 경로입니다.");
  return resolved;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function parseTimecode(range) {
  const parts = range.split("–").map((value) => value.trim());
  const seconds = (value) => {
    const bits = value.split(":").map(Number);
    return bits.length === 2 ? bits[0] * 60 + bits[1] : Number(value);
  };
  return Math.max(0, Number((seconds(parts[1]) - seconds(parts[0])).toFixed(1)));
}

async function parsePromptPackage() {
  const markdown = await fs.readFile(promptPackage, "utf8");
  const chunks = markdown.split(/^### CUT /m).slice(1);
  return chunks.map((chunk) => {
    const header = chunk.match(/^(\d+) · ([^\r\n]+)/);
    const narration = chunk.match(/내레이션 기준 문장:\s*([^\r\n]+)/);
    const ko = chunk.match(/#### 한국어 프롬프트\s*\r?\n\r?\n```text\s*\r?\n([\s\S]*?)```/);
    const en = chunk.match(/#### English Prompt\s*\r?\n\r?\n```text\s*\r?\n([\s\S]*?)```/);
    const index = Number(header?.[1] || 0);
    const time = header?.[2]?.trim() || "";
    return {
      index,
      time,
      duration: parseTimecode(time),
      narration: narration?.[1]?.trim() || "",
      promptKo: ko?.[1]?.trim() || "",
      promptEn: en?.[1]?.trim() || ""
    };
  }).filter((shot) => shot.index > 0);
}

async function parseNarrationScript() {
  const markdown = await fs.readFile(promptPackage, "utf8");
  return (markdown.match(/## 최종 내레이션 대본\s*\r?\n([\s\S]*?)(?=\r?\n## )/)?.[1] || "")
    .trim()
    .replace(/\r?\n\s*\r?\n/g, "\n\n");
}

function referenceFiles(group) {
  return referenceAssetDefinitions.filter((asset) => !group || asset.group === group).map((asset) => asset.file);
}

function shotReferenceBundle(shot, episode) {
  const text = [episode?.title, shot?.narration, shot?.evidence?.claim, shot?.evidence?.visualKo, shot?.evidence?.visualEn, shot?.visualDesign?.tedoriExtra?.roleKo, shot?.visualDesign?.tedoriExtra?.roleEn, shot?.visualDesign?.tedoriExtra?.placementKo, shot?.visualDesign?.tedoriExtra?.placementEn].filter(Boolean).join(" ").toLowerCase();
  const tests = {
    court: /(코트|베이스라인|서비스라인|라인|잔디|클레이|court|baseline|service box|grass|clay)/i,
    ball: /(테니스공|공 |공이|볼 |볼이|회전|바운드|ball|spin|bounce)/i,
    net: /(네트|그물|net|mesh)/i,
    racket: /(라켓|스트링|그립|스윙웨이트|헤드|racquet|racket|string|grip|swingweight)/i
  };
  const explicitIds = Array.isArray(shot?.referenceIds) ? shot.referenceIds : [];
  const priorities = referenceAssetDefinitions.filter((asset) => asset.group === "shape" && (explicitIds.length ? explicitIds.includes(asset.id) : tests[asset.id].test(text))).map((asset) => asset.file);
  const useTedori = shot?.visualDesign?.tedoriExtra?.enabled === true || /(테돌이|마스코트|진행 캐릭터|설명 캐릭터|엑스트라|mascot|presenter character|reaction character|background extra)/i.test(text);
  const useBrand = /(테니스노트|간판|패키지|스코어보드|tennisnote|signage|packaging|scoreboard)/i.test(text);
  return {
    requiredShapeReferences: referenceFiles("shape"),
    priorityShapeReferences: priorities,
    characterReferences: referenceFiles("character"),
    brandReferences: referenceFiles("brand"),
    useTedori,
    useTennisnoteBrand: useBrand,
    policy: {
      geometry: "테니스 코트·공·네트·라켓의 비율과 구조는 레퍼런스 형태를 잠그고 왜곡·융해·중복·비대칭 변형을 금지합니다.",
      character: "마스코트·진행 캐릭터가 필요한 경우에만 테돌이를 사용하며 임의 캐릭터를 만들지 않습니다.",
      brand: "간판·브랜드·로고·아이콘이 필요하면 테니스노트 자산만 사용하고 임의 브랜드를 만들지 않습니다."
    }
  };
}

function appendReferenceAnchor(prompt, language, bundle) {
  const source = String(prompt || "").trim();
  if (!source || source.includes("[REFERENCE LOCK]")) return source;
  const shapeFiles = Array.isArray(bundle?.priorityShapeReferences) ? bundle.priorityShapeReferences : [];
  const characterFiles = bundle?.useTedori ? (bundle.characterReferences || []) : [];
  const brandFiles = bundle?.useTennisnoteBrand ? (bundle.brandReferences || []) : [];
  const files = [...new Set([...shapeFiles, ...characterFiles, ...brandFiles])].map((file) => String(file).replaceAll("\\", "/"));
  const ko = [
    "[REFERENCE LOCK] 아래 파일은 이 컷에 등장하는 피사체의 형태 기준입니다. 장면 자체를 복사하지 않습니다.",
    files.length ? `입력 레퍼런스: ${files.join(", ")}` : "이 컷에는 별도의 테니스 장비 레퍼런스가 필요하지 않습니다.",
    "실제로 화면에 등장하는 장비만 레퍼런스와 같은 비율·구조로 만듭니다. 지시하지 않은 코트·공·네트·라켓은 추가하지 않습니다.",
    "피사체를 휘게 하거나 녹이거나 복제하지 않습니다. 잘못된 솔기, 추가 스트링, 비대칭 프레임, 임의 로고를 금지합니다.",
    bundle?.useTedori ? "테돌이는 지정된 캐릭터 레퍼런스와 정확히 일치시킵니다." : "캐릭터는 넣지 않습니다.",
    bundle?.useTennisnoteBrand ? "브랜드가 필요하면 테니스노트 로고 또는 아이콘만 사용합니다." : "브랜드와 로고는 넣지 않습니다."
  ].join("\n");
  const en = [
    "[REFERENCE LOCK] The files below define only the geometry of subjects that actually appear in this cut; do not copy their scenes.",
    files.length ? `Input references: ${files.join(", ")}` : "No tennis-equipment reference is required for this cut.",
    "Match only visible equipment to the referenced proportions and construction. Do not add a court, ball, net or racket unless the scene explicitly asks for it.",
    "No warping, melting, duplication, false seams, extra strings, asymmetric frames or invented logos.",
    bundle?.useTedori ? "Match Tedori exactly to the supplied character references." : "Show no character.",
    bundle?.useTennisnoteBrand ? "If a brand mark is required, use only the Tennisnote logo or icon." : "Show no brand or logo."
  ].join("\n");
  return source + "\n\n" + (language === "ko" ? ko : en);
}

function applyReferenceAnchors(shots, episode, visualResearch = null) {
  return shots.map((shot) => {
    const referenceBundle = {
      ...shotReferenceBundle(shot, episode),
      topicReferences: selectedVisualReferenceFiles(visualResearch)
    };
    const withLocks = (prompt, language) => appendTopicVisualReference(appendReferenceAnchor(prompt, language, referenceBundle), language, visualResearch);
    return {
      ...shot,
      referenceBundle,
      promptKo: withLocks(shot.promptKo, "ko"),
      promptEn: withLocks(shot.promptEn, "en"),
      stillPromptKo: withLocks(shot.stillPromptKo || shot.promptKo, "ko"),
      stillPromptEn: withLocks(shot.stillPromptEn || shot.promptEn, "en"),
      motionPromptKo: withLocks(shot.motionPromptKo || shot.promptKo, "ko"),
      motionPromptEn: withLocks(shot.motionPromptEn || shot.promptEn, "en")
    };
  });
}

async function referenceLibraryStatus() {
  const assets = await Promise.all(referenceAssetDefinitions.map(async (asset) => {
    const full = path.join(projectRoot, asset.file);
    const stat = await fs.stat(full).catch(() => null);
    return { ...asset, exists: Boolean(stat), bytes: stat?.size || 0, mediaUrl: "/media?path=" + encodeURIComponent(asset.file) };
  }));
  const groups = ["shape", "character", "brand"].map((group) => {
    const items = assets.filter((asset) => asset.group === group);
    return { group, ready: items.every((asset) => asset.exists), available: items.filter((asset) => asset.exists).length, total: items.length };
  });
  return { ready: assets.every((asset) => asset.exists), assets, groups };
}

function episodeSubject(episode) {
  const subjects = {
    ball: "테니스공", racket: "테니스 라켓", string: "스트링베드", court: "테니스 코트",
    rules: "테니스 규칙", serve: "서브 동작", stroke: "테니스 스윙", strategy: "한 포인트",
    history: "오래된 테니스 기록", venue: "테니스 경기장", technology: "판정 시스템", mystery: "익숙한 테니스 상식"
  };
  return subjects[episode.category] || "테니스 대상";
}

function scaffoldLines(episode) {
  const subject = episodeSubject(episode);
  return [
    `익숙한 ${subject}, 왜 지금 모습일까요?`,
    "[사람들이 자연스럽게 떠올릴 예상을 입력합니다.]",
    "[그 예상과 다른 실제 결과를 입력합니다.]",
    "[평범한 상태가 작동하는 방식을 쉽게 설명합니다.]",
    "[사건에서 달라진 한 가지를 입력합니다.]",
    "[그 변화가 만든 첫 움직임을 입력합니다.]",
    "[앞 움직임이 다음 결과로 이어진 이유를 풉니다.]",
    "[공·라켓·코트·판정에 생긴 차이를 입력합니다.]",
    "[선수·대회·규칙이 만난 실제 문제를 입력합니다.]",
    "[그대로 둘 수 없었던 이유를 짧게 정리합니다.]",
    "[해결의 기준이나 관점이 바뀌는 문장을 입력합니다.]",
    "[처음 취한 조치나 해결책을 입력합니다.]",
    "[그 조치가 필요했던 검토 근거를 입력합니다.]",
    "[최종 규칙·설계·전술이 정리된 결과를 입력합니다.]",
    "[전문 내용을 처음 듣는 사람의 말로 다시 풉니다.]",
    "[흔히 생길 오해 하나를 바로잡습니다.]",
    "[첫 질문에 대한 명확한 답을 입력합니다.]",
    `결국 익숙한 ${subject}의 모습도 분명한 이유로 정해졌습니다.`
  ];
}

function episodeFolderName(episodeId) {
  const episode = allEpisodes.find((item) => item.id === episodeId);
  if (!episode) throw new Error("알 수 없는 에피소드입니다.");
  return episode.number ? `FTN-EP-${String(episode.number).padStart(3, "0")}` : episodeId;
}

function episodeProjectDir(episodeId) {
  return within(outputDir, path.join("episodes", episodeFolderName(episodeId)));
}

function episodeScriptFile(episodeId) {
  return path.join(episodeProjectDir(episodeId), "script.json");
}

function episodeResearchFile(episodeId) {
  return path.join(episodeProjectDir(episodeId), "official-research.json");
}

function episodeVisualReferenceFile(episodeId) {
  return path.join(episodeProjectDir(episodeId), "visual-references", "research.json");
}

function episodeVisualPlanFile(episodeId) {
  return path.join(episodeProjectDir(episodeId), "visual-plan.json");
}

function researchFromStoredScript(stored) {
  const sources = Array.isArray(stored?.sources) ? stored.sources.filter((source) => /^https?:\/\//.test(String(source?.url || ""))) : [];
  const evidence = Array.isArray(stored?.evidence) ? stored.evidence : [];
  if (sources.length < 2 || evidence.length < 8) return null;
  return {
    episodeId: stored.episodeId || "",
    completedAt: stored.researchCompletedAt || stored.updatedAt || null,
    provider: "codex-search",
    facts: evidence.map((item, index) => ({
      id: `F${String(index + 1).padStart(2, "0")}`,
      fact: String(item?.claim || "").trim(),
      proof: String(item?.proof || "").trim(),
      graphic: String(item?.graphic || "NONE").trim(),
      sourceUrls: sources.map((source) => source.url)
    })).filter((item) => item.fact && item.proof),
    sources,
    factWarnings: Array.isArray(stored.factWarnings) ? stored.factWarnings.map(String) : [],
    migratedFromScript: true
  };
}

async function loadEpisodeResearch(episodeId, storedScript = null) {
  const cached = await readJson(episodeResearchFile(episodeId), null);
  if (cached && Array.isArray(cached.facts) && cached.facts.length >= 8 && Array.isArray(cached.sources) && cached.sources.length >= 2) return cached;
  return researchFromStoredScript(storedScript);
}

function researchSummary(research) {
  const complete = Boolean(research && Array.isArray(research.facts) && research.facts.length >= 8 && Array.isArray(research.sources) && research.sources.length >= 2);
  return {
    complete,
    completedAt: complete ? research.completedAt || null : null,
    sourceCount: complete ? research.sources.length : 0,
    factCount: complete ? research.facts.length : 0,
    warningCount: complete && Array.isArray(research.factWarnings) ? research.factWarnings.length : 0,
    reusable: complete
  };
}

async function loadVisualReferenceResearch(episodeId) {
  const research = await readJson(episodeVisualReferenceFile(episodeId), null);
  if (!research || !research.geometry || !Array.isArray(research.references) || research.references.length < 2) return null;
  return research;
}

function visualReferenceSummary(research) {
  const references = Array.isArray(research?.references) ? research.references : [];
  const selected = references.filter((item) => item.selected !== false);
  const local = selected.filter((item) => item.localFile);
  const complete = Boolean(research?.completedAt && research?.geometry && references.length >= 2);
  return {
    complete,
    approved: Boolean(complete && research.approvedAt),
    completedAt: complete ? research.completedAt : null,
    approvedAt: complete ? research.approvedAt || null : null,
    referenceCount: references.length,
    selectedCount: selected.length,
    localCount: local.length,
    provider: research?.provider || null
  };
}

function visualReferenceClientData(research) {
  const summary = visualReferenceSummary(research);
  if (!summary.complete) return { ...summary, geometry: null, references: [], warnings: [] };
  return {
    ...summary,
    geometry: research.geometry,
    promptAnchorKo: research.promptAnchorKo,
    promptAnchorEn: research.promptAnchorEn,
    references: research.references.map((item) => ({
      ...item,
      mediaUrl: item.localFile ? `/media?path=${encodeURIComponent(item.localFile)}&v=${encodeURIComponent(research.updatedAt || research.completedAt || "1")}` : null
    })),
    warnings: Array.isArray(research.warnings) ? research.warnings : []
  };
}

function selectedVisualReferenceFiles(research) {
  if (!research?.approvedAt) return [];
  return [...new Set((research.references || []).filter((item) => item.selected !== false && item.localFile).map((item) => item.localFile))];
}

function appendTopicVisualReference(prompt, language, research) {
  const source = String(prompt || "").trim();
  if (!source || !research?.approvedAt || source.includes("[TOPIC VISUAL REFERENCE]")) return source;
  const geometry = research.geometry || {};
  const selected = (research.references || []).filter((item) => item.selected !== false);
  const files = selectedVisualReferenceFiles(research);
  const shortList = (value, limit) => (Array.isArray(value) ? value : []).filter(Boolean).slice(0, limit).join("; ");
  const sourceKinds = [...new Set(selected.map((item) => item.sourceType).filter(Boolean))].join(", ");
  const ko = [
    "[TOPIC VISUAL REFERENCE] 승인된 주제 전용 형태 기준입니다. 출처의 장면·구도·브랜드를 복제하지 말고 물체 구조만 따릅니다.",
    `대상 정체성: ${geometry.subjectKo || "주제의 실제 물체"}`,
    `압축 구조 잠금: ${research.promptAnchorKo || shortList(geometry.invariantsKo, 4)}`,
    `우선 금지 오류: ${shortList(geometry.commonErrorsKo, 4)}`,
    files.length ? `반드시 입력할 로컬 도면: ${files.join(", ")}` : "로컬 도면 없음: 승인된 구조 잠금만 따릅니다.",
    `교차 검증 유형: ${sourceKinds || "공식자료"}`
  ].join("\n");
  const en = [
    "[TOPIC VISUAL REFERENCE] Approved subject-specific geometry lock. Do not copy source composition, scene, or branding; preserve object construction only.",
    `Identity: ${geometry.subjectEn || "the real subject described by the topic"}`,
    `Compact construction lock: ${research.promptAnchorEn || shortList(geometry.invariantsEn, 4)}`,
    `Priority forbidden errors: ${shortList(geometry.commonErrorsEn, 4)}`,
    files.length ? `Required local drawing inputs: ${files.join(", ")}` : "No local drawing: follow the approved construction lock only.",
    `Cross-checked source types: ${sourceKinds || "official sources"}`
  ].join("\n");
  return source + "\n\n" + (language === "ko" ? ko : en);
}

function normalizeScriptLines(text) {
  const source = String(text || "").trim();
  if (!source) return [];
  let lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) lines = source.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  return lines;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds - minutes * 60).toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${rest}`;
}
const visualPlanEnums = Object.freeze({
  presentationMode: ["hero-object", "historical-diorama", "comparison", "macro", "cross-section", "exploded-view", "mechanism-simulation", "wide-context", "archive-review", "rule-diagram"],
  cameraAngle: ["eye-level", "high-angle", "low-angle", "top-down", "isometric", "side-orthographic", "oblique-macro"],
  shotSize: ["extreme-wide", "wide", "full", "medium", "close-up", "extreme-close-up", "section-detail"],
  lens: ["18mm", "24mm", "35mm", "50mm", "85mm", "100mm-macro", "orthographic"],
  cameraMove: ["locked", "dolly-in", "dolly-out", "orbit", "top-down-drop", "macro-track", "path-follow", "rack-focus", "tilt-reveal"],
  infographicType: ["none", "leader-line", "force-vector", "motion-path", "section-highlight", "comparison-bracket", "timeline-marker", "ban-marker", "measurement"]
});

const visualPlanLabelsKo = Object.freeze({
  "hero-object": "대상 히어로", "historical-diorama": "역사 장면", comparison: "물리 비교", macro: "재료 매크로",
  "cross-section": "정밀 단면", "exploded-view": "분해 구조", "mechanism-simulation": "작동 시뮬레이션",
  "wide-context": "맥락 전경", "archive-review": "기록 검토", "rule-diagram": "규칙 도해",
  "eye-level": "아이레벨", "high-angle": "하이앵글", "low-angle": "로우앵글", "top-down": "탑다운",
  isometric: "아이소메트릭", "side-orthographic": "측면 직교", "oblique-macro": "사선 매크로",
  "extreme-wide": "익스트림 와이드", wide: "와이드", full: "풀샷", medium: "미디엄",
  "close-up": "클로즈업", "extreme-close-up": "익스트림 클로즈업", "section-detail": "단면 디테일",
  locked: "고정", "dolly-in": "달리 인", "dolly-out": "달리 아웃", orbit: "오비트",
  "top-down-drop": "탑다운 전환", "macro-track": "매크로 트래킹", "path-follow": "경로 추적",
  "rack-focus": "랙 포커스", "tilt-reveal": "틸트 리빌"
});

const referenceShortsGrammar = Object.freeze({
  sourceUrls: [
    "https://www.youtube.com/shorts/YOXXmgy-02s",
    "https://www.youtube.com/shorts/uUN1Bw0elY8",
    "https://www.youtube.com/shorts/Ht6FCXabKYM"
  ],
  summaryKo: "같은 대상 정면샷을 반복하지 않고 맥락 전경→단면→작동 매크로→평면도·규칙 도해→사람에게 생긴 영향→요약 전경을 교차합니다. 카메라는 규모·깊이·힘의 경로를 설명할 때만 움직입니다. 빨간 선과 화살표는 실제 구조·이동·하중·규정 지점에 물리적으로 고정하고 장식으로 쓰지 않습니다."
});

const tedoriExtraAllowedModes = new Set(["wide-context", "hero-object"]);

function isSeriousEpisode(episode) {
  return /(사망|죽음|숨졌|참사|비극|중상|부상|사고|재난|질병|학대|폭력|실종|추모)/.test(`${episode?.title || ""} ${episode?.summary || ""} ${episode?.hook || ""}`);
}

function disabledTedoriExtra() {
  return { enabled: false, roleKo: "", roleEn: "", placementKo: "", placementEn: "", actionKo: "", actionEn: "" };
}

function defaultTedoriExtra() {
  return {
    enabled: true,
    roleKo: "테돌이는 설명자가 아니라 장면을 조용히 구경하는 숨은 엑스트라입니다.",
    roleEn: "Tedori is a quiet hidden background extra, never the presenter or the source of evidence.",
    placementKo: "기존 배경의 화면 가장자리 3분할 지점에 두고, 프레임 높이의 15~20%만 차지하며 핵심 피사체와 인포그래픽 여백을 가리지 않습니다.",
    placementEn: "Place Tedori near an existing background edge on a rule-of-thirds point, only 15–20% of frame height, never blocking the primary evidence or infographic space.",
    actionKo: "핵심 피사체를 바라보다가 끝에 고개를 아주 살짝 기울입니다. 말하기·립싱크·설명 제스처·물건 접촉은 없습니다.",
    actionEn: "Tedori watches the primary subject and makes one tiny head tilt near the end. No speech, lip-sync, explanatory gesture or contact with the evidence object."
  };
}

function ensureTedoriExtras(episode, designs = []) {
  const normalized = designs.map((design) => ({ ...design, tedoriExtra: design?.tedoriExtra && typeof design.tedoriExtra === "object" ? { ...disabledTedoriExtra(), ...design.tedoriExtra, enabled: design.tedoriExtra.enabled === true } : disabledTedoriExtra() }));
  if (isSeriousEpisode(episode)) return normalized.map((design) => ({ ...design, tedoriExtra: disabledTedoriExtra() }));
  if (normalized.some((design) => design.tedoriExtra.enabled === true)) return normalized;
  const candidates = normalized.filter((design) => tedoriExtraAllowedModes.has(design.presentationMode) && design?.playfulBridge?.enabled !== true);
  if (!candidates.length) return normalized;
  const hash = [...String(episode?.id || episode?.title || "tedori")].reduce((sum, character) => sum + character.codePointAt(0), 0);
  const selectedCut = candidates[hash % candidates.length].cut;
  return normalized.map((design) => Number(design.cut) === Number(selectedCut) ? { ...design, tedoriExtra: defaultTedoriExtra() } : design);
}

function visualPlanSchema() {
  const enumString = (values) => ({ type: "string", enum: values });
  const strings = { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } };
  return {
    type: "object", additionalProperties: false, required: ["designs"],
    properties: {
      designs: {
        type: "array", minItems: 18, maxItems: 18,
        items: {
          type: "object", additionalProperties: false,
          required: ["cut", "narrativeFunction", "presentationMode", "cameraAngle", "shotSize", "lens", "cameraMove", "startFrameKo", "startFrameEn", "actionKo", "actionEn", "movementKo", "movementEn", "infographic", "mustShowKo", "mustShowEn", "mustAvoidKo", "mustAvoidEn", "evidenceFactIds", "tedoriExtra"],
          properties: {
            cut: { type: "integer", minimum: 1, maximum: 18 }, narrativeFunction: { type: "string" },
            presentationMode: enumString(visualPlanEnums.presentationMode), cameraAngle: enumString(visualPlanEnums.cameraAngle),
            shotSize: enumString(visualPlanEnums.shotSize), lens: enumString(visualPlanEnums.lens), cameraMove: enumString(visualPlanEnums.cameraMove),
            startFrameKo: { type: "string" }, startFrameEn: { type: "string" }, actionKo: { type: "string" }, actionEn: { type: "string" },
            movementKo: { type: "string" }, movementEn: { type: "string" }, mustShowKo: strings, mustShowEn: strings, mustAvoidKo: strings, mustAvoidEn: strings,
            evidenceFactIds: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
            infographic: {
              type: "object", additionalProperties: false, required: ["type", "labelEnglish", "factKo", "factEn", "placementKo", "placementEn"],
              properties: { type: enumString(visualPlanEnums.infographicType), labelEnglish: { type: "string" }, factKo: { type: "string" }, factEn: { type: "string" }, placementKo: { type: "string" }, placementEn: { type: "string" } }
            },
            playfulBridge: {
              type: "object", additionalProperties: false, required: ["enabled", "openingImageKo", "openingImageEn", "transitionKo", "transitionEn", "factualBoundaryKo", "factualBoundaryEn", "maxSeconds"],
              properties: { enabled: { type: "boolean" }, openingImageKo: { type: "string" }, openingImageEn: { type: "string" }, transitionKo: { type: "string" }, transitionEn: { type: "string" }, factualBoundaryKo: { type: "string" }, factualBoundaryEn: { type: "string" }, maxSeconds: { type: "number", minimum: 0.6, maximum: 1.2 } }
            },
            tedoriExtra: {
              type: "object", additionalProperties: false, required: ["enabled", "roleKo", "roleEn", "placementKo", "placementEn", "actionKo", "actionEn"],
              properties: { enabled: { type: "boolean" }, roleKo: { type: "string" }, roleEn: { type: "string" }, placementKo: { type: "string" }, placementEn: { type: "string" }, actionKo: { type: "string" }, actionEn: { type: "string" } }
            }
          }
        }
      }
    }
  };
}

function visualPlanPrompt(episode, officialResearch, visualResearch, lines, evidence) {
  const geometry = visualResearch?.geometry || {};
  const researchPack = {
    facts: officialResearch?.facts || [], factWarnings: officialResearch?.factWarnings || [],
    geometry: { invariantsKo: geometry.invariantsKo || [], constructionKo: geometry.constructionKo || [], mechanismKo: geometry.mechanismKo || [], commonErrorsKo: geometry.commonErrorsKo || [] }
  };
  return `당신은 사실 기반 9:16 지식 쇼츠의 시각 감독입니다. 웹 검색을 하지 않고 저장된 공식자료와 구조 레퍼런스만 사용해 정확히 18컷의 시각 설계를 만드십시오.

에피소드: ${JSON.stringify({ id: episode.id, title: episode.title, targetSeconds: episode.targetSeconds || 90 }, null, 2)}
18문장: ${JSON.stringify(lines, null, 2)}
컷별 저장 근거: ${JSON.stringify(evidence, null, 2)}
공식·구조 자료: ${JSON.stringify(researchPack, null, 2)}

참고 영상에서 추출한 편집 문법(장면을 복제하지 말고 기능만 적용):
${referenceShortsGrammar.summaryKo}

절대 규칙:
- 한 컷은 해당 번호의 내레이션 한 문장만 시각화합니다. 에피소드 전체를 매 컷 반복하지 않습니다.
- startFrame은 프레임 0의 실제 장소·피사체·공간 관계를 구체적으로 씁니다. ‘대상을 보여준다’처럼 추상적으로 쓰지 않습니다.
- 저장 자료 밖의 실험 장비, 인물, 숫자, 날짜, 기관 행동을 만들지 않습니다. 자료에 장치가 없으면 카메라·발사기·마이크 같은 장비를 발명하지 않습니다.
- 인접 컷은 presentationMode, cameraAngle, shotSize, cameraMove를 반복하지 않습니다.
- 전체에 presentationMode 7종 이상, cameraAngle 6종 이상, shotSize 6종 이상, cameraMove 7종 이상을 사용합니다.
- 정면으로 세운 라켓과 베이지 스튜디오 제품사진은 합계 3컷 이하입니다. 실제 코트·검사대·기록실·재료 단면·규칙 도해처럼 문장에 맞는 맥락을 사용합니다.
- 최소 2개의 매크로, 2개의 단면/분해/작동 시뮬레이션, 1개의 역사적 인간 영향, 1개의 넓은 맥락, 1개의 기록/규칙 도해를 포함합니다.
- 이름·형태·재료에서 바로 이해되는 시각적 말장난이 있으면 정확히 1컷, 정말 강한 경우에만 최대 2컷에 playfulBridge를 사용합니다. 첫 질문 또는 낯선 용어가 처음 등장하는 컷을 우선합니다.
- playfulBridge는 0.6~1.2초의 짧은 오프닝입니다. 예: 스파게티 면발이 곧게 펴져 나일론 라켓 줄로 바뀐 뒤 정확한 3층 스트링 단면으로 정렬됩니다. 은유 대상은 전환이 끝나면 완전히 사라져야 합니다.
- playfulBridge는 사실 설명이 아닙니다. factualBoundary에 ‘이것은 이름을 기억시키는 시각적 전환이며 실제 구조는 전환 뒤 화면’임을 명시합니다. 사고·부상·인물의 고통을 희화화하지 않습니다.
- 모든 컷에 tedoriExtra 객체를 반환합니다. 죽음·부상·사고·재난 소재라면 전부 enabled=false입니다. 그 외에는 18컷 중 기본 1컷, 정말 자연스러운 경우에만 최대 2컷을 enabled=true로 둡니다.
- 테돌이는 wide-context 또는 hero-object 컷에서만 화면 가장자리의 숨은 엑스트라로 씁니다. 매크로·단면·분해도·규칙 도해·비교·실험·역사 기록 컷에는 넣지 않습니다. playfulBridge와 같은 컷에도 넣지 않습니다.
- 테돌이는 프레임 높이의 15~20%만 차지하고 핵심 피사체·붉은 지시선·인포그래픽 여백을 가리지 않습니다. 진행자처럼 정면을 보며 설명하거나 손가락으로 가리키지 않고, 말하기·립싱크도 하지 않습니다.
- enabled=true이면 role·placement·action에 이 컷의 실제 배경 안에서 가능한 작은 행동 하나를 구체적으로 씁니다. 지정된 테돌이 레퍼런스의 형태·색·비율을 그대로 유지하며 임의 캐릭터를 만들지 않습니다. enabled=false이면 나머지 문자열은 비워 둡니다.
- action은 피사체의 실제 물리 동작 하나입니다. movement는 그 정보를 읽게 하는 카메라 이동 하나이며, dolly-out은 규모, orbit은 층의 깊이, macro-track은 접촉, path-follow는 힘·이동 경로에만 사용합니다.
- infographic은 컷당 하나의 검증된 근거만 사용합니다. labelEnglish는 최대 3단어이며 저장된 graphic을 우선합니다. 수치·날짜는 공식자료에 있을 때만 씁니다.
- labelEnglish는 후반 편집 오버레이입니다. 생성 모델이 글자를 그리게 하지 않습니다. 빨간 화살표·브래킷·경로선은 실제 힘·이동·규정 지점에 고정될 때만 사용합니다.
- 공은 스트링 내부에 갇히지 않고, 라켓·공·코트·네트의 형태는 레퍼런스를 정확히 유지합니다.
- 3D 포토리얼 미니어처 디오라마, detail_level 2, 핵심 대상 풀컬러, 배경 저채도라는 톤만 통일합니다. 구도와 장소는 반복하지 않습니다.
- 영상은 무음입니다. 나레이션·대사·음악·효과음·생성 자막이 없습니다.
- evidenceFactIds에는 반드시 저장된 F 식별자를 넣습니다.

지정된 JSON 스키마만 출력하십시오.`;
}

function visualPlanDiversity(designs = []) {
  const count = (field) => new Set(designs.map((item) => item?.[field]).filter(Boolean)).size;
  const centeredProductShots = designs.filter((item) => /(중성|베이지|스튜디오).*(정면|세워)|centered.*studio|studio.*frontal/i.test(`${item.startFrameKo || ""} ${item.startFrameEn || ""}`)).length;
  return {
    presentationModes: count("presentationMode"), cameraAngles: count("cameraAngle"), shotSizes: count("shotSize"), cameraMoves: count("cameraMove"), centeredProductShots,
    playfulBridges: designs.filter((item) => item?.playfulBridge?.enabled === true).length,
    tedoriExtras: designs.filter((item) => item?.tedoriExtra?.enabled === true).length,
    modeSequence: designs.map((item) => item.presentationMode)
  };
}

function validateVisualPlan(value, episode, lines, officialResearch, provider = "codex") {
  const source = Array.isArray(value?.designs) ? value.designs : [];
  if (source.length !== 18) throw new Error(`시각 설계는 정확히 18컷이어야 합니다. 현재 ${source.length}컷입니다.`);
  const allowedFacts = new Set((officialResearch?.facts || []).map((fact) => String(fact.id)));
  let designs = source.map((item, offset) => {
    const cut = offset + 1;
    if (Number(item.cut) !== cut) throw new Error(`시각 설계 CUT ${cut} 순서가 맞지 않습니다.`);
    for (const field of ["presentationMode", "cameraAngle", "shotSize", "lens", "cameraMove"]) {
      if (!visualPlanEnums[field].includes(item[field])) throw new Error(`CUT ${cut}의 ${field} 값이 허용 범위를 벗어났습니다.`);
    }
    if (!visualPlanEnums.infographicType.includes(item.infographic?.type)) throw new Error(`CUT ${cut}의 인포그래픽 유형이 잘못됐습니다.`);
    const factIds = (item.evidenceFactIds || []).map(String).filter((id) => allowedFacts.has(id));
    if (!factIds.length && allowedFacts.size) throw new Error(`CUT ${cut}에 공식 사실 ID가 없습니다.`);
    return { ...item, cut, evidenceFactIds: factIds, narration: lines[offset], tedoriExtra: item?.tedoriExtra && typeof item.tedoriExtra === "object" ? { ...disabledTedoriExtra(), ...item.tedoriExtra, enabled: item.tedoriExtra.enabled === true } : disabledTedoriExtra() };
  });
  designs = ensureTedoriExtras(episode, designs);
  for (let i = 1; i < designs.length; i += 1) {
    for (const field of ["presentationMode", "cameraAngle", "shotSize", "cameraMove"]) {
      if (designs[i - 1][field] === designs[i][field]) throw new Error(`CUT ${i}–${i + 1}의 ${field}가 반복됩니다.`);
    }
  }
  const diversity = visualPlanDiversity(designs);
  for (const design of designs.filter((item) => item?.playfulBridge?.enabled === true)) {
    const seconds = Number(design.playfulBridge.maxSeconds);
    if (seconds < 0.6 || seconds > 1.2) throw new Error(`CUT ${design.cut}의 시각적 브리지는 0.6~1.2초여야 합니다.`);
  }
  if (diversity.playfulBridges > 2) throw new Error(`시각적 말장난은 최대 2컷입니다. 현재 ${diversity.playfulBridges}컷입니다.`);
  if (isSeriousEpisode(episode) && diversity.tedoriExtras > 0) throw new Error("죽음·부상·사고·재난 소재에는 테돌이 엑스트라를 사용하지 않습니다.");
  if (!isSeriousEpisode(episode) && (diversity.tedoriExtras < 1 || diversity.tedoriExtras > 2)) throw new Error(`테돌이 엑스트라는 한 편에 1~2컷만 사용합니다. 현재 ${diversity.tedoriExtras}컷입니다.`);
  for (const design of designs.filter((item) => item?.tedoriExtra?.enabled === true)) {
    if (!tedoriExtraAllowedModes.has(design.presentationMode)) throw new Error(`CUT ${design.cut}의 테돌이는 와이드 맥락 또는 마무리 히어로 컷에서만 엑스트라로 사용할 수 있습니다.`);
    if (design?.playfulBridge?.enabled === true) throw new Error(`CUT ${design.cut}에 재미 브리지와 테돌이를 동시에 넣을 수 없습니다.`);
  }
  if (diversity.presentationModes < 7 || diversity.cameraAngles < 6 || diversity.shotSizes < 6 || diversity.cameraMoves < 7 || diversity.centeredProductShots > 3) {
    throw new Error(`시각 다양성 검수 실패: 모드 ${diversity.presentationModes}, 앵글 ${diversity.cameraAngles}, 샷 ${diversity.shotSizes}, 이동 ${diversity.cameraMoves}, 제품 정면 ${diversity.centeredProductShots}`);
  }
  return { version: 4, episodeId: episode.id, generatedAt: new Date().toISOString(), provider, scriptLines: [...lines], sourceReferences: referenceShortsGrammar.sourceUrls, diversity, designs };
}

function spaghettiFallbackDesigns(lines, evidence, facts) {
  const modes = ["wide-context", "historical-diorama", "exploded-view", "macro", "cross-section", "mechanism-simulation", "macro", "mechanism-simulation", "historical-diorama", "wide-context", "comparison", "archive-review", "comparison", "rule-diagram", "macro", "comparison", "cross-section", "hero-object"];
  const angles = ["isometric", "high-angle", "side-orthographic", "oblique-macro", "isometric", "side-orthographic", "oblique-macro", "low-angle", "eye-level", "top-down", "isometric", "high-angle", "top-down", "side-orthographic", "oblique-macro", "isometric", "low-angle", "eye-level"];
  const sizes = ["wide", "medium", "section-detail", "extreme-close-up", "close-up", "section-detail", "extreme-close-up", "close-up", "full", "extreme-wide", "medium", "full", "wide", "section-detail", "extreme-close-up", "medium", "close-up", "full"];
  const lenses = ["35mm", "50mm", "orthographic", "100mm-macro", "orthographic", "85mm", "100mm-macro", "100mm-macro", "35mm", "24mm", "50mm", "35mm", "24mm", "orthographic", "100mm-macro", "50mm", "85mm", "35mm"];
  const moves = ["dolly-in", "rack-focus", "orbit", "macro-track", "top-down-drop", "path-follow", "macro-track", "orbit", "dolly-in", "dolly-out", "tilt-reveal", "rack-focus", "top-down-drop", "orbit", "macro-track", "path-follow", "tilt-reveal", "dolly-out"];
  const framesKo = [
    "현대 코트 옆 선수 벤치를 3/4로 내려다봅니다. 평범한 라켓 한 자루가 수건 옆에 기대 있고, 한 평면의 균일한 스트링 면이 주변 코트 맥락과 함께 읽힙니다.",
    "1977년 장비 검사실의 목재 테이블 위에 다층 스트링 라켓이 옆으로 놓여 있습니다. 얕은 측면 시선에서 헤드 안의 서로 다른 깊이만 처음 드러납니다.",
    "같은 정상 프레임 하나를 공간 분해도로 보여줍니다. 프레임은 그대로 두고 단일 스트링 면과 다층 스트링 구조가 프레임 밖으로 단계적으로 분리돼, 바뀐 곳이 스트링뿐임을 보여줍니다.",
    "합법적인 현대 스트링 교차점 하나를 재료 매크로로 봅니다. 세로줄과 가로줄이 같은 평면에서 위아래로 번갈아 지나가며 실제 접촉점이 선명합니다.",
    "스파게티 스트링의 얇은 헤드 단면을 아이소메트릭으로 절개합니다. 전면의 촘촘한 세로줄, 중앙의 매우 성긴 가로줄 쌍, 후면의 촘촘한 세로줄이 정확히 세 평면으로 배열됩니다.",
    "라켓 면과 나란한 측면 기술 시뮬레이션입니다. 공이 전면 세로줄에 닿기 직전이고, 그 세로줄 묶음이 중앙 가로줄 위에서 옆으로 이동할 실제 여유가 보입니다.",
    "중앙의 성긴 가로줄과 전면 세로줄이 만나는 한 접촉부를 초근접으로 봅니다. 짧은 중공 플라스틱 슬리브가 세로줄을 감싸며 주변 매듭과 고정줄 일부만 보입니다.",
    "비스듬히 들어온 공이 전면 세로줄 층을 누른 순간을 느린 물리 시뮬레이션으로 고정합니다. 공은 층 사이에 끼지 않고, 옆으로 밀린 세로줄만 공 표면과 접촉합니다.",
    "1977년 코트의 네트 근처에서 익명의 선수 두 명이 문제 라켓의 타구면을 가리키고 심판이 살펴봅니다. 불만의 대상인 다층 스트링이 세 사람 사이에서 분명히 보입니다.",
    "클레이 코트를 수직에 가깝게 내려다봅니다. 경기는 멈췄고 라켓은 서비스라인 근처에 놓여 있으며 선수와 관계자는 양쪽 코트 가장자리에서 대기합니다.",
    "테이블 위 테니스공 하나는 그대로 두고, 그 옆에 단일 평면 스트링 단면과 다층 스트링 단면을 실물 모형처럼 나란히 둡니다. 규제 대상이 공이 아니라 줄 배치임이 한눈에 보입니다.",
    "1977년 규정 검토 책상입니다. 익명의 관계자 손이 다층 스트링 헤드를 검사하고, 달력의 날짜 칸 위치에 후반 편집용 표시 여백만 남깁니다. 읽을 수 있는 문서는 생성하지 않습니다.",
    "1977년 기록 검토 책상을 탑다운으로 봅니다. 특허 단면 도면, 다층 스트링 실물 표본, 경기 보고서 사진을 서로 대응하는 구조 지점에 맞춰 정렬하며 별도의 측정·실험 장비는 두지 않습니다.",
    "합법적인 라켓 헤드를 정면과 얕은 측면이 함께 읽히는 직교 기술 모형으로 보여줍니다. 모든 스트링 교차가 하나의 평평한 단일 패턴 안에 머뭅니다.",
    "합법적인 교차점 두 개를 익스트림 매크로로 연결합니다. 세로줄과 가로줄이 이웃 교차점마다 위아래 순서를 번갈아 바꾸며 한 격자를 만듭니다.",
    "공의 회전 궤적은 배경에 작고 흐리게 두고, 앞쪽에는 단일 평면과 다층 단면을 선명하게 배치합니다. 빨간 강조는 회전 수치가 아니라 층의 개수와 배치만 가리킵니다.",
    "금지된 다층 비직조 구조의 3/4 단면만 크게 보여줍니다. 전면 세로줄–중앙 성긴 가로줄–후면 세로줄의 분리된 깊이를 실제 구조대로 유지합니다.",
    "현대 테니스 코트에서 한 선수가 라켓을 자연스럽게 들고 있습니다. 카메라는 비스듬한 3/4 위치이며 한 겹의 평평하고 균일한 스트링 면이 첫 질문의 답으로 선명합니다."
  ];
  const framesEn = [
    "A three-quarter view looks down on a players’ bench beside a modern tennis court. One ordinary racket leans beside a towel, and its uniform single-plane string bed remains readable within the real court context.",
    "On a wooden inspection table in a restrained 1977 equipment room, a multilayer-string racket lies sideways. A shallow side view reveals the separate string depths for the first time.",
    "A spatial exploded view uses one unchanged conventional frame. The legal single string bed and the multilayer construction separate step by step along the same frame axis, proving that the changed element is the stringing rather than the frame.",
    "Material macro of one legal modern string intersection. A main and a cross alternate over and under within the same plane, with the real contact point in crisp focus.",
    "An isometric cutaway slices through a shallow spaghetti-strung racket head. Dense front mains, extremely sparse paired central crosses and dense rear mains occupy exactly three distinct parallel planes.",
    "Side-orthographic mechanism view parallel to the racket face. A ball is about to contact the front main layer, and the mains have visible physical clearance to slide sideways over the central crosses.",
    "Extreme macro of one contact between a sparse central cross and a front main. A short hollow plastic sleeve surrounds the main; show only the nearby tie cord, knot and minimum required strings.",
    "Freeze an oblique impact as the ball compresses only the facing front-main layer. The ball is not trapped between layers; only the laterally displaced mains touch its surface.",
    "Near the net on a 1977 tennis court, two anonymous players point to the disputed hitting surface while an official inspects it. The multilayer stringing is clearly the cause of their complaint.",
    "Near-vertical overhead view of a clay court. Play has stopped, the disputed racket lies near the service line, and players and officials wait at opposite court edges.",
    "Keep one tennis ball unchanged on an inspection table beside two physical string-bed sections: one flat legal plane and one multilayer arrangement. Make it immediately clear that the regulated variable is string layout, not the ball.",
    "A restrained 1977 rules-review desk. An anonymous official’s hand inspects a multilayer racket head while clean space remains beside an unlabelled calendar cell for a later editorial date marker. Render no readable document text.",
    "Top-down evidence-comparison table with a patent section drawing, a physical multilayer string sample and a match-report photograph aligned by corresponding construction points. No measurement or test apparatus is present.",
    "Orthographic technical model of a legal racket head, readable simultaneously from the front and a shallow side section. Every string crossing stays within one flat, single pattern.",
    "Extreme macro links two legal intersections. The main and cross alternate their over-under order at neighboring crossings to form one continuous interlaced grid.",
    "Keep a ball-spin path small and subdued in the background while single-plane and multilayer sections remain crisp in the foreground. The red editorial emphasis identifies only the number and arrangement of planes, not an RPM value.",
    "Large three-quarter section of the prohibited multilayer non-interlaced construction. Preserve the exact separated depth order: front mains, sparse central crosses, rear mains.",
    "On a modern tennis court, a player holds one racket naturally. From an oblique three-quarter position, the single flat uniform string bed reads clearly as the direct answer to the opening question."
  ];
  const actionsKo = ["수건 가장자리에서 라켓 스트링 면으로 시선이 이어집니다.", "랙 포커스가 프레임에서 층 사이 간격으로 옮겨갑니다.", "분리된 스트링 구조가 같은 프레임 축을 따라 제자리에 정렬됩니다.", "한 교차점에서 다음 교차점까지 실제 직조 순서를 따라갑니다.", "세 층이 앞–중앙–뒤 순서로 짧게 벌어져 깊이가 드러납니다.", "공이 닿자 전면 세로줄 묶음만 가로줄 방향으로 옆으로 밀립니다.", "세로줄이 중공 슬리브 안에서 짧게 활주합니다.", "밀린 세로줄이 접촉 종료 전에 되돌아오며 공에 접선 방향 힘을 전달합니다.", "한 선수가 스트링 면을 가리키고 심판이 같은 지점을 확인합니다.", "멈춘 경기의 규모가 코트 전체로 드러납니다.", "강조가 공에서 두 스트링 단면으로 옮겨갑니다.", "검사하는 손이 다층 스트링 헤드에서 멈춥니다.", "도면의 세 층과 실물 표본의 세 층이 붉은 점 세 개로 대응됩니다.", "정면 스트링 면이 얕은 측면으로 돌아가도 한 평면을 유지합니다.", "교차 순서가 이웃 접점으로 이어집니다.", "회전 궤적의 강조가 사라지고 다층 단면의 분리 지점이 강조됩니다.", "붉은 브래킷이 세 개의 분리된 평면만 감쌉니다.", "선수가 라켓을 가볍게 돌려 평평한 스트링 면을 빛에 드러냅니다."];
  const actionsEn = [
    "Guide attention from the towel edge to the ordinary string bed.", "Rack focus once from the unchanged frame to the gap between string planes.",
    "Align the separated string constructions back onto the same frame axis.", "Follow the real over-under order from one legal crossing to the next.",
    "Separate the three planes slightly in front-center-rear order to reveal depth.", "As the ball contacts, slide only the front-main group laterally along the cross direction.",
    "Let the main string make one short passive slide inside the hollow sleeve.", "Before contact ends, let the displaced mains snap back and apply tangential force to the ball.",
    "One player points to the multilayer bed while the official inspects that exact area.", "Reveal the scale of the halted match across the full court.",
    "Move visual emphasis from the unchanged ball to the two string-bed sections.", "The inspecting hand stops over the multilayer racket head.",
    "Align three restrained red evidence points between the patent section and physical sample.", "Rotate from frontal to shallow side view while the bed remains one plane.",
    "Continue the alternating weave order to the neighboring crossing.", "Fade the spin-path emphasis and shift it to the separated string planes.",
    "A red editorial bracket identifies only the three separated planes.", "The player turns the racket slightly so light reveals the flat string bed."
  ];
  const movementsKo = ["벤치와 코트 맥락에서 스트링 면으로 짧게 달리 인합니다.", "프레임에서 스트링 깊이로 한 번 랙 포커스합니다.", "프레임 축을 중심으로 25도만 오비트합니다.", "실제 교차점을 따라 짧게 매크로 트래킹합니다.", "정면에서 단면으로 탑다운 전환합니다.", "세로줄의 실제 횡이동 경로를 따라갑니다.", "슬리브 길이만큼만 매크로 트래킹합니다.", "접촉부 둘레를 15도 오비트해 공이 갇히지 않았음을 보입니다.", "다층 스트링을 가리키는 손으로 짧게 달리 인합니다.", "라켓에서 코트 전체로 달리 아웃합니다.", "공에서 스트링 단면으로 짧게 틸트합니다.", "라켓과 날짜 표시 여백 사이를 랙 포커스합니다.", "기록 세 종류를 위에서 아래로 한 번 연결합니다.", "정면에서 측면으로 20도만 오비트합니다.", "두 교차점 사이를 매크로 트래킹합니다.", "작은 회전 궤적에서 층 단면으로 경로를 옮깁니다.", "아래에서 위로 틸트해 세 층을 차례로 드러냅니다.", "스트링 면에서 코트 맥락까지 천천히 달리 아웃합니다."];
  const movementsEn = [
    "Make one short dolly-in from the bench and court context to the string bed.", "Rack focus once from the frame to the string-layer depth.",
    "Orbit only 25 degrees around the shared frame axis.", "Macro-track briefly along the real intersections.",
    "Use one top-down drop from the face view into the section.", "Path-follow the mains’ real lateral displacement.",
    "Macro-track no farther than the sleeve length.", "Orbit only 15 degrees around the contact to prove that the ball is not trapped.",
    "Dolly in briefly toward the hand indicating the multilayer strings.", "Dolly out from the disputed racket to the entire stopped court.",
    "Tilt once from the unchanged ball to the string sections.", "Rack focus between the racket and the empty date-marker space.",
    "Make one top-down move linking the three evidence items.", "Orbit only 20 degrees from frontal to shallow side view.",
    "Macro-track between the two legal intersections.", "Path-follow from the subdued spin path to the layer section.",
    "Tilt upward to reveal the three separated planes in order.", "Dolly out slowly from the flat string bed to the modern court context."
  ];
  const factIds = (facts || []).map((fact) => String(fact.id));
  return lines.map((narration, offset) => {
    const ev = evidence[offset] || {};
    const factId = factIds[offset] || factIds[Math.min(offset, Math.max(0, factIds.length - 1))] || "F01";
    const graphic = String(ev.graphic || facts.find((fact) => fact.id === factId)?.graphic || "EVIDENCE").trim();
    const type = ["leader-line", "timeline-marker", "section-highlight", "leader-line", "section-highlight", "motion-path", "leader-line", "force-vector", "leader-line", "leader-line", "comparison-bracket", "ban-marker", "leader-line", "section-highlight", "motion-path", "comparison-bracket", "ban-marker", "section-highlight"][offset];
    const playfulBridge = offset === 4 ? {
      enabled: true, maxSeconds: 0.9,
      openingImageKo: "어두운 기술 작업대 위에 금빛의 삶지 않은 스파게티 면발 여러 가닥이 느슨하고 불규칙하게 놓여 있습니다. 아직 라켓이나 테니스공은 보이지 않습니다.",
      openingImageEn: "Several golden uncooked spaghetti strands lie loose and irregular on a dark technical workbench. No racket or tennis ball is visible yet.",
      transitionKo: "0.9초 안에 면발이 빠르게 곧게 펴지며 금빛 식품 질감이 흰 나일론 스트링 재질로 바뀝니다. 곧아진 줄은 전면 세로줄–중앙의 성긴 가로줄 쌍–후면 세로줄의 정확한 세 평면으로 갈라지고, 동일 축의 정상 라켓 프레임이 매치컷으로 드러납니다.",
      transitionEn: "Within 0.9 seconds, the pasta strands snap straight as their golden food texture changes into white nylon racket string. The straightened strings separate into the exact front-main, sparse paired central-cross and rear-main planes, while a conventional racket frame is revealed on the same axis by a clean match cut.",
      factualBoundaryKo: "스파게티 면발은 이름을 기억시키는 짧은 시각적 말장난일 뿐입니다. 0.9초 이후에는 음식이 완전히 사라지고 특허 구조와 일치하는 라켓만 남아야 합니다.",
      factualBoundaryEn: "The pasta is only a brief visual pun for the name. After 0.9 seconds all food must disappear, leaving only the patent-accurate racket construction."
    } : null;
    return {
      cut: offset + 1, narrativeFunction: `CUT ${offset + 1}의 내레이션 근거를 한 장면으로 설명`, presentationMode: modes[offset], cameraAngle: angles[offset], shotSize: sizes[offset], lens: lenses[offset], cameraMove: moves[offset],
      startFrameKo: framesKo[offset], startFrameEn: framesEn[offset], actionKo: actionsKo[offset], actionEn: actionsEn[offset], movementKo: movementsKo[offset], movementEn: movementsEn[offset],
      infographic: { type, labelEnglish: graphic, factKo: String(ev.proof || ev.claim || narration), factEn: "Use only the verified evidence attached to this cut.", placementKo: "실제 구조 또는 이동 지점 옆 후반 편집 레이어", placementEn: "later editorial layer physically anchored beside the real structure or motion" },
      mustShowKo: [framesKo[offset]], mustShowEn: [framesEn[offset]], mustAvoidKo: ["내용과 무관한 장비·문자·브랜드", "라켓·공·스트링 형태 왜곡"], mustAvoidEn: ["unsupported apparatus, text or branding", "warped racket, ball or string geometry"], evidenceFactIds: [factId], tedoriExtra: disabledTedoriExtra(),
      ...(playfulBridge ? { playfulBridge } : {})
    };
  });
}

function genericFallbackDesigns(lines, evidence, facts) {
  const slots = [
    ["wide-context", "isometric", "wide", "35mm", "dolly-in"], ["historical-diorama", "high-angle", "medium", "50mm", "rack-focus"],
    ["comparison", "top-down", "full", "35mm", "path-follow"], ["macro", "oblique-macro", "extreme-close-up", "100mm-macro", "macro-track"],
    ["cross-section", "side-orthographic", "section-detail", "orthographic", "top-down-drop"], ["mechanism-simulation", "low-angle", "close-up", "85mm", "path-follow"],
    ["macro", "oblique-macro", "extreme-close-up", "100mm-macro", "macro-track"], ["mechanism-simulation", "isometric", "close-up", "85mm", "orbit"],
    ["historical-diorama", "eye-level", "full", "35mm", "dolly-in"], ["wide-context", "top-down", "extreme-wide", "24mm", "dolly-out"],
    ["comparison", "isometric", "medium", "50mm", "tilt-reveal"], ["archive-review", "high-angle", "full", "35mm", "rack-focus"],
    ["comparison", "top-down", "wide", "24mm", "top-down-drop"], ["rule-diagram", "side-orthographic", "section-detail", "orthographic", "orbit"],
    ["macro", "oblique-macro", "extreme-close-up", "100mm-macro", "macro-track"], ["comparison", "isometric", "medium", "50mm", "path-follow"],
    ["cross-section", "low-angle", "close-up", "85mm", "tilt-reveal"], ["hero-object", "eye-level", "full", "35mm", "dolly-out"]
  ];
  const factIds = (facts || []).map((fact) => String(fact.id));
  return lines.map((narration, offset) => {
    const [presentationMode, cameraAngle, shotSize, lens, cameraMove] = slots[offset];
    const ev = evidence[offset] || {};
    const factId = factIds[offset] || factIds[0] || "F01";
    const baseKo = String(ev.visualKo || `${narration}의 핵심 물리 대상과 원인을 실제 맥락 안에서 한 순간으로 보여줍니다.`);
    const baseEn = String(ev.visualEn || `Show the physical subject and verified cause of this narration in one concrete contextual moment: ${narration}`);
    return { cut: offset + 1, narrativeFunction: `문장 ${offset + 1}의 근거 시각화`, presentationMode, cameraAngle, shotSize, lens, cameraMove, startFrameKo: baseKo, startFrameEn: baseEn, actionKo: String(ev.motionKo || "근거가 되는 실제 물리 동작 하나만 이어집니다."), actionEn: String(ev.motionEn || "Continue with one physically verified subject action."), movementKo: `${visualPlanLabelsKo[cameraMove]} 하나로 정보 관계를 드러냅니다.`, movementEn: `Use one motivated ${cameraMove} to reveal the evidence relationship.`, infographic: { type: "leader-line", labelEnglish: String(ev.graphic || "EVIDENCE"), factKo: String(ev.proof || ev.claim || narration), factEn: "Use only the verified evidence attached to this cut.", placementKo: "실제 원인 지점 옆 후반 편집 레이어", placementEn: "later editorial layer anchored beside the real causal point" }, mustShowKo: [baseKo], mustShowEn: [baseEn], mustAvoidKo: ["근거 없는 소품·숫자·장비", "같은 정면 제품 구도의 반복"], mustAvoidEn: ["unsupported props, numbers or apparatus", "repeated frontal product composition"], evidenceFactIds: [factId], tedoriExtra: disabledTedoriExtra() };
  });
}

function fallbackVisualPlan(episode, lines, evidence, officialResearch) {
  const isSpaghetti = /(스파게티|이중 스트링|금지된 라켓)/.test(`${episode.title || ""} ${episode.summary || ""}`);
  const designs = isSpaghetti ? spaghettiFallbackDesigns(lines, evidence, officialResearch?.facts || []) : genericFallbackDesigns(lines, evidence, officialResearch?.facts || []);
  return validateVisualPlan({ designs }, episode, lines, officialResearch, "verified-fallback");
}

async function loadEpisodeVisualPlan(episode, lines) {
  const cached = await readJson(episodeVisualPlanFile(episode.id), null);
  if (!cached || !Array.isArray(cached.designs) || cached.designs.length !== 18) return null;
  if (JSON.stringify(cached.scriptLines || []) !== JSON.stringify(lines || [])) return null;
  const needsTedoriUpgrade = Number(cached.version || 0) < 4 || cached.designs.some((design) => !design?.tedoriExtra);
  if (needsTedoriUpgrade) {
    cached.designs = ensureTedoriExtras(episode, cached.designs);
    cached.version = 4;
    cached.generatedAt = new Date().toISOString();
    cached.diversity = visualPlanDiversity(cached.designs);
    await writeJson(episodeVisualPlanFile(episode.id), cached);
  }
  return cached;
}

function designCameraText(design, language) {
  if (!design) return "";
  if (language === "ko") return `${visualPlanLabelsKo[design.cameraAngle] || design.cameraAngle} · ${visualPlanLabelsKo[design.shotSize] || design.shotSize} · ${design.lens}`;
  return `${design.cameraAngle} ${design.shotSize}, ${design.lens}`;
}

const genericVisualRoles = [
  { intentKo: "익숙한 대상을 아무 변화가 없는 기본 상태로 하나만 보여줍니다.", intentEn: "Show one familiar subject in its ordinary unchanged state.", cameraKo: "아이레벨 정면 미디엄 클로즈업", cameraEn: "eye-level frontal medium close-up", motionKo: "첫 1초는 정지하고 핵심 표면으로 아주 천천히 접근합니다.", motionEn: "Hold for one second, then make a very slow push toward the defining surface." },
  { intentKo: "기존 상태를 깨뜨린 이상 징후 하나를 같은 공간에 보여줍니다.", intentEn: "Show the single anomaly that disrupted the familiar state.", cameraKo: "하이앵글 미디엄샷", cameraEn: "high-angle medium shot", motionKo: "이상 지점 하나만 부드럽게 강조합니다.", motionEn: "Gently reveal only the anomalous feature." },
  { intentKo: "달라진 부품이나 조건 하나를 다른 요소보다 선명하게 보여줍니다.", intentEn: "Make the one changed component clearer than every secondary element.", cameraKo: "정면 비교 클로즈업", cameraEn: "frontal comparison close-up", motionKo: "변경된 부분으로 짧게 이동합니다.", motionEn: "Make one short move toward the changed component." },
  { intentKo: "정상 구조가 어떻게 생겼는지 교과서처럼 단순하게 보여줍니다.", intentEn: "Show the normal construction as a simple textbook-like physical scene.", cameraKo: "직교 정면 매크로", cameraEn: "orthographic frontal macro", motionKo: "정상 구조를 따라 한 방향으로만 천천히 이동합니다.", motionEn: "Track slowly in one direction along the normal construction." },
  { intentKo: "사건에서 바뀐 구조를 깨끗한 단면 또는 분해도로 보여줍니다.", intentEn: "Show the modified construction in one clean section or exploded arrangement.", cameraKo: "3/4 단면 클로즈업", cameraEn: "three-quarter sectional close-up", motionKo: "분리된 부품 사이를 한 번만 통과합니다.", motionEn: "Move once through the separated components." },
  { intentKo: "첫 물리적 움직임이 시작되기 직전 상태를 보여줍니다.", intentEn: "Show the instant immediately before the first physical movement begins.", cameraKo: "익스트림 매크로", cameraEn: "extreme macro", motionKo: "한 부품만 실제 작동 방향으로 움직입니다.", motionEn: "Move only one component in its real operating direction." },
  { intentKo: "원인을 만든 접촉부나 재료를 화면 중심에 크게 보여줍니다.", intentEn: "Fill the frame with the contact point or material that creates the mechanism.", cameraKo: "익스트림 클로즈업", cameraEn: "extreme close-up", motionKo: "접촉부를 따라 짧은 슬라이드 한 번만 보여줍니다.", motionEn: "Show one short slide along the contact point." },
  { intentKo: "원인이 눈에 보이는 결과로 바뀌는 결정적 순간을 보여줍니다.", intentEn: "Show the decisive instant when the mechanism becomes a visible result.", cameraKo: "로우앵글 클로즈업", cameraEn: "low-angle close-up", motionKo: "결과 동작 하나를 실시간 또는 절제된 슬로모션으로 보여줍니다.", motionEn: "Show one result action in real time or restrained slow motion." },
  { intentKo: "사람이나 경기 운영이 겪은 직접적인 반응 하나를 보여줍니다.", intentEn: "Show one direct human or tournament consequence.", cameraKo: "아이레벨 풀샷", cameraEn: "eye-level full shot", motionKo: "인물의 한 가지 반응과 카메라의 짧은 전진만 사용합니다.", motionEn: "Use one human reaction and one short camera push." },
  { intentKo: "문제가 경기 전체로 번진 상태를 넓은 한 장면으로 보여줍니다.", intentEn: "Show the problem spreading to the whole match in one wide scene.", cameraKo: "하이앵글 와이드샷", cameraEn: "high-angle wide shot", motionKo: "상황의 규모를 드러내는 짧은 달리아웃만 사용합니다.", motionEn: "Use one short dolly-out to reveal the scale of the disruption." },
  { intentKo: "해결 기준이 바뀐 대상을 단순한 물리 비교로 보여줍니다.", intentEn: "Show the changed solution criterion as a simple physical comparison.", cameraKo: "탑다운 비교샷", cameraEn: "top-down comparison shot", motionKo: "문제 대상에서 해결 대상으로 한 번만 이동합니다.", motionEn: "Move once from the rejected object to the accepted object." },
  { intentKo: "처음 취한 조치를 하나의 명확한 역사적 장면으로 보여줍니다.", intentEn: "Show the first intervention as one clear historical scene.", cameraKo: "아이레벨 미디엄샷", cameraEn: "eye-level medium shot", motionKo: "조치 대상에 한 번만 초점을 맞춥니다.", motionEn: "Rack focus once onto the object affected by the intervention." },
  { intentKo: "검토나 실험에 쓰인 장치와 대상만 보여줍니다.", intentEn: "Show only the apparatus and subject used for review or testing.", cameraKo: "하이앵글 실험대 미디엄샷", cameraEn: "high-angle test-bench medium shot", motionKo: "실험 준비에서 측정 시작까지 한 동작만 보여줍니다.", motionEn: "Show one action from test setup to measurement start." },
  { intentKo: "최종 규칙이나 설계를 대표하는 완성 구조 하나를 보여줍니다.", intentEn: "Show one finished construction that represents the final rule or design.", cameraKo: "정면 기술도 클로즈업", cameraEn: "frontal technical close-up", motionKo: "완성 구조의 핵심 경계를 따라 천천히 이동합니다.", motionEn: "Track slowly along the defining boundary of the finished construction." },
  { intentKo: "합법적인 결합 방식이 보이도록 접촉점을 크게 보여줍니다.", intentEn: "Magnify the contact point so the accepted joining method is unmistakable.", cameraKo: "익스트림 매크로", cameraEn: "extreme macro", motionKo: "결합 순서를 한 번만 또렷하게 보여줍니다.", motionEn: "Reveal the joining order once, clearly and without morphing." },
  { intentKo: "흔한 오해와 실제 제한 대상을 한 화면의 단순 비교로 구분합니다.", intentEn: "Separate the common misconception from the real restriction in one simple comparison.", cameraKo: "정면 균형 비교샷", cameraEn: "frontal balanced comparison shot", motionKo: "오해 쪽의 강조를 끄고 실제 제한 대상으로 옮깁니다.", motionEn: "Fade emphasis from the misconception and move it to the real restriction." },
  { intentKo: "첫 질문의 답이 되는 구조나 결과 하나만 힘 있게 보여줍니다.", intentEn: "Show only the structure or result that directly answers the opening question.", cameraKo: "로우앵글 히어로 클로즈업", cameraEn: "low-angle hero close-up", motionKo: "답이 되는 핵심 부분을 짧게 드러냅니다.", motionEn: "Make one concise reveal of the feature that answers the question." },
  { intentKo: "첫 컷의 익숙한 대상을 다시 보여주되 이제 핵심 구조가 잘 보이게 합니다.", intentEn: "Return to the familiar opening subject, now with its defining construction clearly readable.", cameraKo: "아이레벨 정면 미디엄샷", cameraEn: "eye-level frontal medium shot", motionKo: "첫 구도를 회수하며 아주 천천히 줌아웃하고 끝 프레임을 유지합니다.", motionEn: "Return to the opening composition, zoom out very slowly, and hold the end frame." }
];

const spaghettiReferenceIds = [
  ["racket"], ["racket"], ["racket"], ["racket"], ["racket"], ["racket", "ball"],
  ["racket"], ["racket", "ball"], ["racket", "court", "net"], ["racket", "court"],
  ["racket", "ball"], ["racket"], ["racket", "ball"], ["racket"], ["racket"],
  ["racket", "ball"], ["racket"], ["racket", "court"]
];

const spaghettiVisualPlans = [
  ["현대 테니스 라켓 한 자루가 조용한 중성 스튜디오 디오라마에 세워져 있습니다. 스트링 면은 카메라와 평행하며 세로줄과 가로줄이 하나의 평평한 면에서 정확히 엮여 있습니다. 공과 두 번째 라켓은 없습니다.", "One modern tennis racket stands alone in a quiet neutral studio diorama. Its string bed faces the camera squarely, with mains and crosses correctly interlaced in one flat plane. No ball and no second racket.", "아이레벨 정면 미디엄 클로즈업", "eye-level frontal medium close-up", "첫 1초는 완전히 정지한 뒤 평범한 스트링 격자로 천천히 접근합니다.", "Hold perfectly still for one second, then make a slow push toward the ordinary string grid."],
  ["1977년 분위기의 낡은 목재 장비 검사대 위에 다층 스트링 라켓 한 자루가 놓여 있습니다. 라켓 헤드의 앞뒤 스트링 층 사이에 얕은 간격이 보이지만 아직 움직이지 않습니다.", "One multilayer-string racket rests on a worn wooden equipment-inspection table with a restrained 1977 atmosphere. A shallow gap is visible between the front and rear string layers; nothing is moving yet.", "하이앵글 미디엄샷", "high-angle medium shot", "카메라가 라켓 헤드 위로 짧게 접근하며 두 층의 간격만 드러냅니다.", "Make one short push over the racket head to reveal only the gap between the layers."],
  ["프레임 모양이 같은 라켓 헤드 두 개를 나란히 놓은 깨끗한 비교 디오라마입니다. 왼쪽은 일반 단일 스트링 면, 오른쪽은 다층 스트링 면이며 차이는 스트링 구조에만 있습니다.", "A clean comparison diorama places two identically shaped racket heads side by side. The left has a normal single string plane; the right has a multilayer string bed. The only difference is the string construction.", "탑다운 정면 비교샷", "top-down frontal comparison shot", "왼쪽 프레임에서 오른쪽 스트링 구조로 한 번만 수평 이동합니다.", "Make one horizontal move from the identical left frame to the altered right string bed."],
  ["일반 라켓 스트링 면의 초근접 기술 이미지입니다. 세로줄과 가로줄이 같은 평면에서 위아래로 번갈아 정확히 엮이며 접점 하나가 중앙에 크게 보입니다.", "An ultra-close technical view of a normal racket string bed. Mains and crosses alternate over and under in the same plane, with one accurate intersection centered in frame.", "직교 정면 매크로", "orthographic frontal macro", "카메라가 한 교차점에서 다음 교차점까지 천천히 옆으로 이동합니다.", "Track slowly sideways from one intersection to the next."],
  ["스파게티 라켓 헤드의 깨끗한 분해 단면입니다. 중앙의 가로줄 한 층과 앞뒤의 세로줄 두 층이 평행하게 분리되어 총 세 층을 이룹니다. 다른 부품은 최소화합니다.", "A clean exploded section of a spaghetti-racket head. One central cross-string layer sits between two parallel main-string layers, forming exactly three separated layers. Minimize every other component.", "3/4 단면 클로즈업", "three-quarter sectional close-up", "세 층 사이를 한 번 통과하며 앞·중앙·뒤 순서를 보여줍니다.", "Move once through the layers to reveal front, center and rear order."],
  ["다층 스트링의 익스트림 매크로입니다. 공이 바깥 세로줄에 막 닿기 직전이며, 세로줄은 중앙 가로줄과 엮이지 않아 옆으로 움직일 빈 공간이 보입니다.", "Extreme macro of the multilayer string bed. A tennis ball is just about to touch the outer main strings, which are not woven into the central crosses and have visible room to slide sideways.", "익스트림 매크로", "extreme macro", "공이 닿으며 바깥 세로줄 한 묶음만 옆으로 미끄러집니다.", "As the ball makes contact, only one group of outer mains slides sideways."],
  ["스트링 교차부의 투명한 저마찰 플라스틱 관 하나를 크게 보여주는 재료 매크로입니다. 관은 줄을 감싸고 있으며 주변 스트링 수는 최소화합니다.", "A material macro centered on one translucent low-friction plastic sleeve at a string contact point. The sleeve wraps the string; keep surrounding strings to the minimum needed for clarity.", "익스트림 클로즈업", "extreme close-up", "줄이 플라스틱 관 위를 짧게 미끄러지는 동작만 보여줍니다.", "Show only one short string slide across the plastic sleeve."],
  ["테니스공이 스트링 면에 눌린 결정적 순간입니다. 바깥 세로줄은 한쪽으로 밀려 있고 아직 되돌아오기 직전입니다. 공, 줄, 접촉부만 화면에 있습니다.", "The decisive instant of a tennis ball compressed into the string bed. The outer mains are displaced to one side and have not snapped back yet. Show only the ball, strings and contact zone.", "로우앵글 익스트림 클로즈업", "low-angle extreme close-up", "밀린 세로줄이 제자리로 튕겨 돌아오며 공 표면을 스치고 공이 회전하기 시작합니다.", "The displaced mains snap back, brush across the ball surface, and begin the ball rotation."],
  ["1977년 테니스 코트 네트 근처에서 익명의 선수 두 명과 심판 한 명이 다층 스트링 라켓을 두고 항의하는 한 장면입니다. 실제 인물과 브랜드는 사용하지 않습니다.", "One scene near a 1977 tennis net shows two anonymous players and one official protesting over a multilayer-string racket. Use no real person, brand or tournament identity.", "아이레벨 풀샷", "eye-level full shot", "한 선수가 라켓을 가리키고 심판이 검사하는 짧은 반응만 보여줍니다.", "Show one short reaction: a player points to the racket while the official inspects it."],
  ["경기가 멈춘 빈 테니스 코트를 하이앵글로 보여줍니다. 서비스라인 위에 문제의 라켓 한 자루가 놓이고 선수들은 코트 가장자리에서 멈춰 있습니다.", "A high-angle view of a halted tennis match. The disputed racket lies on the service line while the players remain stopped at the edge of the court.", "하이앵글 와이드샷", "high-angle wide shot", "라켓에서 시작해 멈춘 코트 전체를 드러내는 짧은 달리아웃을 합니다.", "Dolly out briefly from the racket to reveal the entire halted court."],
  ["검사대 위에서 테니스공은 그대로 두고 두 종류의 스트링 구조만 비교합니다. 다층 구조는 흐리게 밀려나고 단일 평면 구조가 선명하게 남습니다.", "On an inspection table, keep the tennis ball unchanged and compare only two string constructions. The multilayer construction recedes while the single flat construction remains clear.", "탑다운 비교샷", "top-down comparison shot", "강조가 공에서 스트링 배치로 한 번 이동합니다.", "Move the emphasis once from the unchanged ball to the string arrangement."],
  ["1977년 규정 회의 분위기의 단정한 책상 위에 다층 스트링 라켓이 검사 대상으로 놓여 있습니다. 라켓 주위에 단순한 붉은 제한 링 하나만 있고 글자는 없습니다.", "A multilayer-string racket sits under inspection on a restrained 1977 rules-committee desk. Place one simple red restriction ring around the racket and render no lettering.", "아이레벨 미디엄샷", "eye-level medium shot", "붉은 제한 링이 한 번 나타나고 라켓은 그대로 유지됩니다.", "Let the single red restriction ring appear once while the racket remains unchanged."],
  ["통제된 실험대에 다층 스트링 라켓, 테니스공 발사 장치, 고속 카메라가 일렬로 배치되어 있습니다. 모든 장치는 시험 시작 직전 정지 상태입니다.", "A controlled test bench aligns a multilayer-string racket, a tennis-ball launcher and a high-speed camera. Every device is stationary immediately before the test begins.", "하이앵글 실험대 미디엄샷", "high-angle test-bench medium shot", "공 한 개가 발사되어 스트링에 닿고 카메라 표시등이 켜집니다.", "Launch one ball into the strings as the camera indicator turns on."],
  ["하나의 평평한 스트링 패턴을 보여주는 완성 라켓 헤드 기술도입니다. 스트링 면은 옆 단면에서도 한 평면이며 주변은 깨끗한 중성 배경입니다.", "A finished racket-head technical view showing one flat string pattern. Even in the shallow side section, the string bed remains a single plane against a clean neutral background.", "정면 기술도 클로즈업", "frontal technical close-up", "카메라가 정면에서 얕은 측면으로 이동해 한 평면임을 보여줍니다.", "Move from frontal view to a shallow side view to reveal the single plane."],
  ["정상 스트링 교차점 하나의 익스트림 매크로입니다. 세로줄과 가로줄이 위아래로 번갈아 엮여 하나의 안정된 격자를 만듭니다.", "Extreme macro of one legal string intersection. A main and a cross alternate over and under to create one stable grid.", "익스트림 매크로", "extreme macro", "교차 순서가 이웃 접점으로 이어지는 짧은 이동만 보여줍니다.", "Make one short move showing the alternating weave continue to the neighboring intersection."],
  ["깨끗한 규정 비교 디오라마에서 공의 회전 계기는 배경으로 낮게 두고, 스트링 층의 개수와 배치만 선명하게 강조합니다. 숫자나 문자는 생성하지 않습니다.", "In a clean rules-comparison diorama, keep a ball-spin gauge subdued in the background while only the number and arrangement of string layers receives clear visual emphasis. Render no numbers or letters.", "정면 균형 비교샷", "frontal balanced comparison shot", "회전 계기의 강조를 끄고 스트링 단면으로 붉은 강조를 옮깁니다.", "Fade emphasis from the spin gauge and move one red highlight to the string section."],
  ["다층 비직조 스트링 단면 하나를 화면 중앙에 두고, 층 사이를 감싸는 단순한 붉은 제한 브래킷 하나만 표시합니다. 라켓 프레임과 스트링은 정확한 형태를 유지합니다.", "Center one multilayer non-interlaced string section and surround the separated layers with one simple red restriction bracket. Keep the racket frame and strings geometrically accurate.", "로우앵글 히어로 클로즈업", "low-angle hero close-up", "붉은 브래킷이 층을 묶어 강조한 뒤 장면을 멈춥니다.", "Let the red bracket identify the separated layers, then hold the scene."],
  ["현대 테니스 코트의 조용한 배경 앞에 정상 라켓 한 자루가 세워져 있습니다. 스트링 면은 하나의 평평하고 균일한 교차 패턴으로 선명하게 보이며 첫 컷의 구도를 회수합니다.", "One normal modern racket stands against a quiet tennis-court background. Its string bed is clearly one flat, uniform interlaced pattern, returning to the opening composition.", "아이레벨 정면 미디엄샷", "eye-level frontal medium shot", "평평한 스트링 면에서 라켓 전체로 아주 천천히 줌아웃하고 마지막 프레임을 유지합니다.", "Zoom out very slowly from the flat string bed to the whole racket and hold the final frame."]
];

function inferVisualSubject(episode, narration, claim) {
  const text = `${episode?.title || ""} ${narration || ""} ${claim || ""}`;
  if (/(실험|검토|측정|카메라)/.test(text)) return { ko: "통제된 테니스 실험 장치", en: "a controlled tennis test apparatus" };
  if (/(선수|심판|항의|경기 거부)/.test(text)) return { ko: "익명의 테니스 선수와 경기 관계자", en: "anonymous tennis players and tournament officials" };
  if (/(규칙|규정|ITF|금지|허용)/i.test(text)) return { ko: "테니스 규정과 해당 장비의 구조", en: "a tennis rule diagram and the regulated equipment construction" };
  if (/(스트링|줄|라켓|그립|헤드)/.test(text)) return { ko: "형태가 정확한 테니스 라켓 또는 스트링 면", en: "a geometrically accurate tennis racket or string bed" };
  if (/(테니스공|공이|공의|회전|바운드)/.test(text)) return { ko: "형태가 정확한 테니스공", en: "a geometrically accurate tennis ball" };
  if (/(코트|라인|잔디|클레이|네트)/.test(text)) return { ko: "비율이 정확한 테니스 코트 또는 네트", en: "a proportionally accurate tennis court or net" };
  return { ko: episodeSubject(episode), en: "the single physical tennis subject described by this cut" };
}

function buildShotVisualPlan(episode, index, narration, evidence, visualDesign = null) {
  if (visualDesign) {
    return {
      sceneKo: visualDesign.startFrameKo, sceneEn: visualDesign.startFrameEn,
      cameraKo: designCameraText(visualDesign, "ko"), cameraEn: designCameraText(visualDesign, "en"),
      motionKo: visualDesign.actionKo, motionEn: visualDesign.actionEn,
      movementKo: visualDesign.movementKo, movementEn: visualDesign.movementEn,
      visualDesign
    };
  }
  if (/(스파게티|두 겹의 줄|이중 스트링|금지된 라켓)/.test(`${episode?.title || ""} ${episode?.summary || ""}`) && spaghettiVisualPlans[index - 1]) {
    const [sceneKo, sceneEn, cameraKo, cameraEn, motionKo, motionEn] = spaghettiVisualPlans[index - 1];
    return { sceneKo, sceneEn, cameraKo, cameraEn, motionKo, motionEn, movementKo: motionKo, movementEn: motionEn };
  }
  const role = genericVisualRoles[index - 1] || genericVisualRoles[0];
  const subject = inferVisualSubject(episode, narration, evidence?.claim);
  return {
    sceneKo: evidence?.visualKo || `${subject.ko}만 중심 피사체로 사용합니다. ${role.intentKo} 화면이 설명해야 할 사실은 “${evidence?.claim || narration}” 하나뿐입니다.`,
    sceneEn: evidence?.visualEn || `${subject.en} is the only primary subject. ${role.intentEn} Communicate one fact only; do not add unrelated symbols or secondary scenes.`,
    cameraKo: evidence?.cameraKo || role.cameraKo, cameraEn: evidence?.cameraEn || role.cameraEn,
    motionKo: evidence?.motionKo || role.motionKo, motionEn: evidence?.motionEn || role.motionEn,
    movementKo: evidence?.motionKo || role.motionKo, movementEn: evidence?.motionEn || role.motionEn
  };
}

function buildDynamicShots(episode, lines, evidenceItems = [], visualPlan = null) {
  const duration = Number(episode.targetSeconds || 90);
  const perCut = duration / lines.length;
  const fallbackLabels = ["SUBJECT", "ANOMALY", "CHANGED PART", "NORMAL", "STRUCTURE", "FIRST MOTION", "CONTACT", "RESULT", "REACTION", "IMPACT", "NEW CRITERION", "INTERVENTION", "REVIEW", "FINAL RULE", "JOINING", "NOT THIS", "ANSWER", "WHY IT IS NORMAL"];
  return lines.map((narration, offset) => {
    const index = offset + 1;
    const start = Number((offset * perCut).toFixed(1));
    const end = offset === lines.length - 1 ? duration : Number(((offset + 1) * perCut).toFixed(1));
    const evidence = evidenceItems.find((item) => Number(item?.cut) === index) || evidenceItems[offset] || {};
    const storedVisualDesign = visualPlan?.designs?.find((item) => Number(item.cut) === index) || null;
    const visualDesign = storedVisualDesign ? { ...storedVisualDesign, planGeneratedAt: visualPlan.generatedAt } : null;
    const visual = buildShotVisualPlan(episode, index, narration, evidence, visualDesign);
    const infographic = visualDesign?.infographic || null;
    const graphic = String(infographic?.labelEnglish || evidence.graphic || fallbackLabels[offset] || "EVIDENCE").trim();
    const modeKo = visualDesign ? visualPlanLabelsKo[visualDesign.presentationMode] || visualDesign.presentationMode : "단일 장면";
    const mustShowKo = visualDesign?.mustShowKo?.join(" / ") || visual.sceneKo;
    const mustShowEn = visualDesign?.mustShowEn?.join(" / ") || visual.sceneEn;
    const mustAvoidKo = visualDesign?.mustAvoidKo?.join(" / ") || "불필요한 소품과 형태 변형";
    const mustAvoidEn = visualDesign?.mustAvoidEn?.join(" / ") || "unrelated props and geometry distortion";
    const infographicKo = infographic ? `${infographic.type} · ${infographic.factKo} · ${infographic.placementKo}` : `후반 편집 라벨 ${graphic}`;
    const infographicEn = infographic ? `${infographic.type} · ${infographic.factEn} · ${infographic.placementEn}` : `later editorial label ${graphic}`;
    const bridge = visualDesign?.playfulBridge?.enabled === true ? visualDesign.playfulBridge : null;
    const tedori = visualDesign?.tedoriExtra?.enabled === true ? visualDesign.tedoriExtra : null;
    const tedoriStillKo = tedori ? `
테돌이 엑스트라: ${tedori.roleKo} 배치: ${tedori.placementKo}` : "";
    const tedoriStillEn = tedori ? `
Tedori extra: ${tedori.roleEn} Placement: ${tedori.placementEn}` : "";
    const tedoriMotionKo = tedori ? `
테돌이 동작: ${tedori.actionKo}` : "";
    const tedoriMotionEn = tedori ? `
Tedori action: ${tedori.actionEn}` : "";
    const firstFrameKo = bridge ? bridge.openingImageKo : visual.sceneKo;
    const firstFrameEn = bridge ? bridge.openingImageEn : visual.sceneEn;
    const stillStructureKo = bridge ? `첫 이미지에는 오프닝 대상만 보입니다. 변환 뒤 도착할 사실 화면: ${mustShowKo}` : mustShowKo;
    const stillStructureEn = bridge ? `Show only the opening subject in this still. Factual destination after the transition: ${mustShowEn}` : mustShowEn;
    const frameLockKo = bridge ? `승인된 첫 프레임을 프레임 0으로 사용합니다. ${bridge.maxSeconds}초 동안 지시된 대상만 변환하며, 그 뒤에는 정확한 최종 구조를 고정합니다.` : "승인된 첫 프레임의 공간 관계와 피사체 형태를 프레임 0에서 그대로 유지합니다.";
    const frameLockEn = bridge ? `Use the approved opening image as frame 0. Transform only the specified subject for ${bridge.maxSeconds} seconds, then lock the accurate factual construction.` : "Preserve the approved first-frame geometry and spatial relationships exactly from frame 0.";
    const physicalActionKo = bridge ? `시각적 브리지: ${bridge.transitionKo} 사실 경계: ${bridge.factualBoundaryKo} 전환 뒤 실제 동작: ${visual.motionKo}` : visual.motionKo;
    const physicalActionEn = bridge ? `Playful visual bridge: ${bridge.transitionEn} Factual boundary: ${bridge.factualBoundaryEn} Physical action after the transition: ${visual.motionEn}` : visual.motionEn;
    const motionAvoidKo = bridge ? "지정된 스파게티→나일론 스트링 매치 변환 외에는 형태를 바꾸지 않습니다." : "형태·크기 변화와 순간 이동을 금지합니다.";
    const motionAvoidEn = bridge ? "No morphing except the specified spaghetti-to-nylon-string match transition." : "No morphing, scale drift or teleportation.";
    const stillPromptKo = `[스토리보드 시작 이미지 · CUT ${String(index).padStart(2, "0")}]
형식: 세로 9:16 단일 이미지, 한 장소, 한 순간, 한 핵심 근거.
시각 역할: ${modeKo}. 내레이션 “${narration}”의 원인 또는 결과 하나만 설명합니다.
첫 프레임: ${firstFrameKo}
카메라: ${visual.cameraKo}. 피사체를 자동으로 정면 중앙에 세우지 말고, 이 컷의 공간 관계가 가장 잘 읽히는 위치에 둡니다.
반드시 보일 구조: ${stillStructureKo}${tedoriStillKo}
스타일: 시네마틱 포토리얼 3D 미니어처 디오라마, detail_level 2. 핵심 피사체 풀컬러, 배경 저채도, 정교하지만 통제된 미세 질감. 같은 톤은 유지하되 이전 컷의 장소와 구도를 복제하지 않습니다.
인포그래픽 편집 설계: ${infographicKo}. “${graphic}”은 후반 편집에서 정확히 입력합니다. 생성 이미지에는 글자·숫자·자막·UI·화살표·리더선·브래킷·다이어그램 선을 어떤 색으로도 절대 그리지 않습니다. 모든 인포그래픽은 후반 편집 오버레이로만 추가합니다.
금지: ${mustAvoidKo}. 여러 시간대, 콜라주, 분할 화면, 모션 블러, 임의 장비·숫자·브랜드, 라켓·공·코트·네트 왜곡.`;
    const stillPromptEn = `[STORYBOARD FIRST FRAME · CUT ${String(index).padStart(2, "0")}]
Format: one vertical 9:16 still, one location, one instant and one evidence point.
Visual role: ${visualDesign?.presentationMode || "single evidence scene"}. Explain only one cause or result from the narration: “${narration}”.
First frame: ${firstFrameEn}
Camera: ${visual.cameraEn}. Do not automatically center an upright product; compose for the physical relationship described by this cut.
Must show: ${stillStructureEn}${tedoriStillEn}
Look: cinematic photoreal 3D miniature diorama, detail_level 2. Full-color primary evidence, low-saturation context, crisp but controlled micro-texture. Keep the palette consistent while changing location and composition from adjacent cuts.
Editorial infographic plan: ${infographicEn}. Add “${graphic}” later in editing; generate absolutely no letters, numbers, captions, UI, arrows, leader lines, brackets or diagram strokes of any color. All infographics are added only as post-production overlays.
Avoid: ${mustAvoidEn}. No collage, split screen, multiple time phases, motion blur, unsupported apparatus, numbers or brands, and no warped racket, ball, court or net geometry.`;
    const motionPromptKo = `[영상 동작 · CUT ${String(index).padStart(2, "0")} · ${Number((end - start).toFixed(1))}초]
${frameLockKo}
실제 동작: ${physicalActionKo}${tedoriMotionKo}
카메라 이동: ${visual.movementKo || visual.motionKo} 카메라는 정보 관계를 설명하는 이 한 번의 이동만 사용합니다.
인포그래픽 기준: ${infographicKo}. “${graphic}” 글자는 후반 편집에서 넣고, 영상 모델은 문자·화살표·리더선·다이어그램 선을 생성하지 않습니다.
연속성: 한 장소의 한 연속 샷, 핵심 물리 동작 하나. 다음 컷으로 정보를 넘길 수 있는 명확한 종료 자세를 유지합니다.
금지: ${mustAvoidKo}. 피사체 추가·삭제, 장면 전환, 임의 로고, 생성 오디오. ${motionAvoidKo}`;
    const motionPromptEn = `[VIDEO MOTION · CUT ${String(index).padStart(2, "0")} · ${Number((end - start).toFixed(1))} seconds]
${frameLockEn}
Physical action: ${physicalActionEn}${tedoriMotionEn}
Camera move: ${visual.movementEn || visual.motionEn} Use only this one motivated move to explain the evidence relationship.
Infographic basis: ${infographicEn}. Add the “${graphic}” label later in editing; the video model must not render text, arrows, leader lines or diagram strokes.
Continuity: one continuous shot in one location, one physical action, ending on a clear pose that can hand information to the next cut.
Avoid: ${mustAvoidEn}. No added or removed subjects, scene changes, invented logos or generated audio. ${motionAvoidEn}`;
    return { index, time: `${formatTime(start)}–${formatTime(end)}`, duration: Number((end - start).toFixed(1)), narration, evidence, visualDesign, referenceIds: /(스파게티|두 겹의 줄|이중 스트링|금지된 라켓)/.test(`${episode?.title || ""} ${episode?.summary || ""}`) ? spaghettiReferenceIds[offset] : null, stillPromptKo, stillPromptEn, motionPromptKo, motionPromptEn, promptKo: motionPromptKo, promptEn: motionPromptEn };
  });
}

async function loadActiveProject(state, legacyShots) {
  const episode = allEpisodes.find((item) => item.id === state.planning.activeEpisodeId) || allEpisodes[0];
  const visualResearch = await loadVisualReferenceResearch(episode.id);
  let stored = await readJson(episodeScriptFile(episode.id), null);
  if (!stored && episode.id === legacyEpisodeId && Array.isArray(legacyShots) && legacyShots.length === 18) {
    stored = {
      episodeId: episode.id,
      title: episode.title,
      updatedAt: new Date().toISOString(),
      scriptSource: "migrated-master-package",
      generationProvider: "legacy-package-seed",
      scriptLines: legacyShots.map((shot) => String(shot.narration || "").trim()),
      evidence: [],
      sources: [],
      factWarnings: ["기존 마스터 대본을 에피소드 전용 작업 파일로 보존했습니다. 공식자료 조사는 별도로 실행할 수 있습니다."]
    };
    await writeJson(episodeScriptFile(episode.id), stored);
  }
  const officialResearch = await loadEpisodeResearch(episode.id, stored);
  const lines = Array.isArray(stored?.scriptLines) && stored.scriptLines.length === 18 ? stored.scriptLines.map(String) : scaffoldLines(episode);
  const hasPlaceholders = lines.some((line) => /\[[^\]]+\]/.test(line));
  const readyForProduction = lines.length === 18 && !hasPlaceholders;
  const visualPlan = readyForProduction ? await loadEpisodeVisualPlan(episode, lines) : null;
  const shots = await decorateGenerationShots(applyReferenceAnchors(buildDynamicShots(episode, lines, stored?.evidence || [], visualPlan), episode, visualResearch), state, episode.id);
  const narration = [lines.slice(0, 5), lines.slice(5, 10), lines.slice(10, 14), lines.slice(14)].map((part) => part.join(" ")).join("\n\n");
  return {
    episodeId: episode.id,
    series: "재미있는 테니스 노트",
    title: episode.title,
    targetDuration: Number(episode.targetSeconds || 90),
    aspectRatio: "9:16",
    shots,
    narration,
    scriptLines: lines,
    scriptStatus: readyForProduction ? "production_ready" : stored ? "draft" : "not_started",
    readyForProduction,
    source: stored?.scriptSource || "structure-scaffold",
    generationProvider: stored?.generationProvider || null,
    evidence: Array.isArray(stored?.evidence) ? stored.evidence : [],
    sources: Array.isArray(stored?.sources) ? stored.sources : [],
    factWarnings: Array.isArray(stored?.factWarnings) ? stored.factWarnings : [],
    research: researchSummary(officialResearch),
    visualResearch: visualReferenceClientData(visualResearch),
    visualPlan: visualPlan ? { status: "ready", provider: visualPlan.provider, generatedAt: visualPlan.generatedAt, diversity: visualPlan.diversity, sourceReferences: visualPlan.sourceReferences || [] } : { status: "missing", provider: null, diversity: null, sourceReferences: referenceShortsGrammar.sourceUrls },
    episode
  };
}

function generationPrompts(source, mode) {
  const stillKo = source.stillPromptKo || source.promptKo || "";
  const stillEn = source.stillPromptEn || source.promptEn || "";
  const motionKo = source.motionPromptKo || source.promptKo || "";
  const motionEn = source.motionPromptEn || source.promptEn || "";
  const videoPrefixKo = mode === "keyframe"
    ? "[이미지→영상] 승인된 이미지를 프레임 0으로 그대로 사용합니다. 이미지에 없는 새 피사체나 장면을 만들지 않습니다."
    : "[바로 영상] 한 장소, 한 핵심 피사체, 한 연속 샷으로 시작합니다. 첫 0.5초 안에 핵심 구조를 명확히 보여줍니다.";
  const videoPrefixEn = mode === "keyframe"
    ? "[IMAGE-TO-VIDEO] Use the approved image exactly as frame 0. Do not invent a new subject or scene that is absent from the image."
    : "[DIRECT VIDEO] Begin with one location, one primary visual idea and one continuous shot. Establish the defining construction within the first 0.5 seconds.";
  return {
    imagePromptKo: stillKo,
    imagePromptEn: stillEn,
    videoPromptKo: `${videoPrefixKo}\n\n${motionKo}`,
    videoPromptEn: `${videoPrefixEn}\n\n${motionEn}`
  };
}

function promptField(prompt, labels) {
  const lines = String(prompt || "").split(/\r?\n/).map((line) => line.trim());
  for (const label of labels) {
    const line = lines.find((item) => item.startsWith(`${label}:`));
    if (line) return line.slice(label.length + 1).trim();
  }
  return "";
}

function flowReferenceFiles(source) {
  const bundle = source.referenceBundle || {};
  const visualText = `${source.narration || ""} ${promptField(source.stillPromptKo, ["장면"])} ${promptField(source.stillPromptEn, ["Scene"])}`;
  const needsTopicReference = /(스파게티|이중\s*스트링|다층|비직조|세\s*층|플라스틱\s*관|슬리브|spaghetti|double[- ]string|multi[- ]layer|non[- ]interlaced|plastic sleeve)/i.test(visualText);
  const files = [
    ...(bundle.useTedori ? (bundle.characterReferences || []).slice(0, 1) : []),
    ...(needsTopicReference ? (bundle.topicReferences || []) : []),
    ...(bundle.priorityShapeReferences || []),
    ...(bundle.useTennisnoteBrand ? (bundle.brandReferences || []) : [])
  ];
  return [...new Set(files)].slice(0, 3);
}

function flowReferenceLabel(file, language) {
  const base = path.basename(String(file || ""));
  const labels = language === "ko"
    ? { "basicrefer_court.png": "테니스 코트 형태", "basicrefer_tennisball.png": "테니스공 형태", "basicrefer_net.png": "테니스 네트 형태", "basicrefer_racket.png": "테니스 라켓 형태", "tedori_character_sheet_final.png": "테돌이 캐릭터 시트", "tedori_original_reference.png": "테돌이 원본", "tennisnote_icon.png": "테니스노트 아이콘" }
    : { "basicrefer_court.png": "tennis court geometry", "basicrefer_tennisball.png": "tennis ball geometry", "basicrefer_net.png": "tennis net geometry", "basicrefer_racket.png": "tennis racket geometry", "tedori_character_sheet_final.png": "Tedori character sheet", "tedori_original_reference.png": "Tedori original", "tennisnote_icon.png": "Tennisnote icon" };
  if (labels[base]) return labels[base];
  if (/^vr\d+\./i.test(base)) return language === "ko" ? "주제 구조 도면" : "subject construction reference";
  if (/테니스노트|tennisnote/i.test(base)) return language === "ko" ? "테니스노트 브랜드 자산" : "Tennisnote brand asset";
  return base;
}

function buildFlowPrompts(source, mode) {
  const index = String(source.index).padStart(2, "0");
  const references = flowReferenceFiles(source);
  const labelsKo = references.map((file) => flowReferenceLabel(file, "ko"));
  const labelsEn = references.map((file) => flowReferenceLabel(file, "en"));
  const design = source.visualDesign || null;
  const bridge = design?.playfulBridge?.enabled === true ? design.playfulBridge : null;
  const tedori = design?.tedoriExtra?.enabled === true ? design.tedoriExtra : null;
  const factualSceneKo = design?.startFrameKo || promptField(source.stillPromptKo, ["첫 프레임", "장면"]);
  const factualSceneEn = design?.startFrameEn || promptField(source.stillPromptEn, ["First frame", "Scene"]);
  const sceneKo = bridge ? bridge.openingImageKo : factualSceneKo;
  const sceneEn = bridge ? bridge.openingImageEn : factualSceneEn;
  const cameraKo = design ? designCameraText(design, "ko") : promptField(source.stillPromptKo, ["카메라", "구도"]);
  const cameraEn = design ? designCameraText(design, "en") : promptField(source.stillPromptEn, ["Camera", "Composition"]);
  const baseActionKo = design?.actionKo || promptField(source.motionPromptKo, ["실제 동작", "동작"]);
  const baseActionEn = design?.actionEn || promptField(source.motionPromptEn, ["Physical action", "Action"]);
  const actionKo = bridge ? `0~${bridge.maxSeconds}초 시각적 말장난: ${bridge.transitionKo} 사실 경계: ${bridge.factualBoundaryKo} 전환 후 실제 동작: ${baseActionKo}` : baseActionKo;
  const actionEn = bridge ? `0–${bridge.maxSeconds}s playful visual bridge: ${bridge.transitionEn} Factual boundary: ${bridge.factualBoundaryEn} Physical action after the transition: ${baseActionEn}` : baseActionEn;
  const movementKo = design?.movementKo || promptField(source.motionPromptKo, ["카메라 이동", "카메라"]);
  const movementEn = design?.movementEn || promptField(source.motionPromptEn, ["Camera move", "Camera"]);
  const infographic = design?.infographic || null;
  const graphic = String(infographic?.labelEnglish || source.evidence?.graphic || "").trim();
  const flowDuration = source.duration <= 4 ? 4 : source.duration <= 6 ? 6 : 8;
  const referenceKo = labelsKo.length ? `Flow Ingredients에 ${labelsKo.join(", ")}를 첨부합니다. 레퍼런스는 형태·비율·구조에만 사용하고 장면·배경·브랜드는 복제하지 않습니다.` : "별도 Ingredients 없이 지시한 피사체만 생성합니다.";
  const referenceEn = labelsEn.length ? `Attach ${labelsEn.join(", ")} in Flow Ingredients. Use them only for geometry, proportion and construction; do not copy their scene, background or branding.` : "Generate only the specified subject without extra Ingredients.";
  const startKo = bridge ? `승인한 오프닝 이미지를 Flow Frames의 프레임 0으로 사용합니다. ${bridge.maxSeconds}초 동안 지정된 변환만 허용하고 이후에는 사실 화면 “${factualSceneKo}”을 고정합니다.` : mode === "keyframe" ? "승인 이미지를 Flow Frames의 시작 프레임으로 넣고 프레임 0을 정확히 유지합니다." : "텍스트에서 바로 만들며 첫 0.5초에 핵심 구조가 읽혀야 합니다.";
  const startEn = bridge ? `Use the approved opening image as Flow frame 0. Allow only the specified transition for ${bridge.maxSeconds} seconds, then lock the factual destination: “${factualSceneEn}”.` : mode === "keyframe" ? "Upload the approved storyboard image as the Flow start frame and preserve it exactly as frame 0." : "Generate directly from text and make the defining construction readable within the first 0.5 seconds.";
  const mustKo = design?.mustShowKo?.join(" / ") || "지시한 핵심 구조";
  const mustEn = design?.mustShowEn?.join(" / ") || "the specified defining construction";
  const avoidKo = design?.mustAvoidKo?.join(" / ") || "내용과 무관한 소품과 형태 변형";
  const avoidEn = design?.mustAvoidEn?.join(" / ") || "unrelated props and geometry distortion";
  const infoKo = infographic ? `${infographic.type}: ${infographic.factKo}. 위치: ${infographic.placementKo}.` : "후반 편집용 근거 레이어 하나만 사용합니다.";
  const infoEn = infographic ? `${infographic.type}: ${infographic.factEn}. Placement: ${infographic.placementEn}.` : "Use one evidence layer in post-production.";
  const tedoriImageKo = tedori ? `
테돌이 엑스트라: ${tedori.roleKo} ${tedori.placementKo}` : "";
  const tedoriImageEn = tedori ? `
Tedori background extra: ${tedori.roleEn} ${tedori.placementEn}` : "";
  const tedoriVideoKo = tedori ? `
테돌이의 보조 동작: ${tedori.actionKo}` : "";
  const tedoriVideoEn = tedori ? `
Tedori secondary action: ${tedori.actionEn}` : "";
  return {
    recommendedLanguage: "en", recommendedDurationSeconds: flowDuration, referenceFiles: references,
    visualDesign: design ? { narrativeFunction: design.narrativeFunction, presentationMode: design.presentationMode, presentationModeKo: visualPlanLabelsKo[design.presentationMode] || design.presentationMode, cameraAngle: design.cameraAngle, cameraAngleKo: visualPlanLabelsKo[design.cameraAngle] || design.cameraAngle, shotSize: design.shotSize, shotSizeKo: visualPlanLabelsKo[design.shotSize] || design.shotSize, lens: design.lens, cameraMove: design.cameraMove, cameraMoveKo: visualPlanLabelsKo[design.cameraMove] || design.cameraMove, infographic, evidenceFactIds: design.evidenceFactIds, playfulBridge: bridge, tedoriExtra: tedori } : null,
    image: {
      ko: `[GOOGLE FLOW · 이미지 · CUT ${index}]\n세로 9:16 시작 이미지 한 장. ${design ? `${visualPlanLabelsKo[design.presentationMode] || design.presentationMode} 방식` : "단일 장면"}으로 한 장소·한 순간·한 근거만 보여줍니다.\n\n내레이션: ${source.narration}\n첫 프레임: ${sceneKo}${bridge ? `\n변환 뒤 사실 화면: ${factualSceneKo}` : ""}\n카메라: ${cameraKo}\n반드시 보일 것: ${mustKo}${tedoriImageKo}\nIngredients: ${referenceKo}\n인포그래픽 후반 편집 계획: ${infoKo}${graphic ? ` 라벨 “${graphic}”은 이미지에 쓰지 않습니다.` : ""}\n\n시네마틱 포토리얼 3D 미니어처 디오라마, detail_level 2. 핵심 피사체는 풀컬러, 맥락 배경은 저채도. 같은 팔레트만 유지하고 정면 제품사진 구도를 반복하지 않습니다. 글자·숫자·자막·워터마크·UI·임의 로고를 생성하지 않습니다. 빨간 선은 실제 구조·이동 지점에 고정될 때만 하나 허용합니다. 금지: ${avoidKo}. 라켓·공·코트·네트의 비율과 구조를 잠급니다.`,
      en: `[GOOGLE FLOW · IMAGE · CUT ${index}]\nCreate one vertical 9:16 start frame as a ${design?.presentationMode || "single evidence"} scene: one location, one instant, one verified fact.\n\nNarration intent: ${source.narration}\nFirst frame: ${sceneEn}${bridge ? `\nFactual destination after transition: ${factualSceneEn}` : ""}\nCamera: ${cameraEn}\nMust show: ${mustEn}${tedoriImageEn}\nIngredients: ${referenceEn}\nPost-production infographic plan: ${infoEn}${graphic ? ` The label “${graphic}” is editorial only; do not render it.` : ""}\n\nCinematic photoreal 3D miniature diorama, detail_level 2. Full-color primary evidence, low-saturation contextual background. Keep the palette consistent but do not repeat a centered frontal product composition. Generate no letters, numbers, captions, watermarks, UI or invented logos. Allow one technical-red line only when anchored to a real structure or motion point. Avoid: ${avoidEn}. Lock racket, ball, court and net geometry.`
    },
    video: {
      ko: `[GOOGLE FLOW · 영상 · CUT ${index}]\n${flowDuration}초 세로 9:16 영상. 편집에서는 ${source.duration.toFixed(1)}초만 사용합니다. ${startKo}\n\n첫 프레임: ${sceneKo}\n실제 동작: ${actionKo}${tedoriVideoKo}\n카메라 이동: ${movementKo}\nIngredients: ${referenceKo}\n인포그래픽 후반 편집 계획: ${infoKo}${graphic ? ` “${graphic}” 글자는 생성하지 않습니다.` : ""}\n\n한 장소의 연속된 한 샷, 물리 동작 하나, 정보에 필요한 카메라 이동 하나만 사용합니다. 시작 프레임의 형태와 크기를 끝까지 고정합니다. 완전한 무음 시각 소스이며 대사·나레이션·음악·효과음·자막·워터마크·UI·임의 로고를 생성하지 않습니다. 금지: ${avoidKo}. 장면 전환·크기 변화·순간 이동 없음.${bridge ? " 지정된 스파게티→나일론 스트링 변환 외의 형태 변형도 금지합니다." : " 형태 변형을 금지합니다."}`,
      en: `[GOOGLE FLOW · VIDEO · CUT ${index}]\nCreate one ${flowDuration}-second vertical 9:16 clip; the editor will use ${source.duration.toFixed(1)} seconds. ${startEn}\n\nFirst frame: ${sceneEn}\nPhysical action: ${actionEn}${tedoriVideoEn}\nCamera move: ${movementEn}\nIngredients: ${referenceEn}\nPost-production infographic plan: ${infoEn}${graphic ? ` Never render the “${graphic}” label in the clip.` : ""}\n\nUse one continuous shot in one location, one physical action and one evidence-motivated camera move. Lock all geometry and scale from frame 0 through the end. This is a completely silent visual source: no dialogue, narration, music, sound effects, captions, watermarks, UI or invented logos. Avoid: ${avoidEn}. No cuts, scale drift or teleportation.${bridge ? " No morphing except the specified spaghetti-to-nylon-string match transition." : " No morphing."}`
    }
  };
}

async function decorateGenerationShots(shots, state, episodeId) {
  return Promise.all(shots.map(async (source) => {
    const saved = state.shots.find((item) => item.index === source.index) || {};
    const mode = saved.generationMode === "direct" ? "direct" : "keyframe";
    const expectedFile = `output/episodes/${episodeFolderName(episodeId)}/stills/c${String(source.index).padStart(2, "0")}.png`;
    const exists = await fs.access(path.join(projectRoot, expectedFile)).then(() => true).catch(() => false);
    const commonPrompts = generationPrompts(source, mode);
    const flowDefaults = buildFlowPrompts(source, mode);
    const savedOverrides = saved.flowPromptOverrides && typeof saved.flowPromptOverrides === "object" ? saved.flowPromptOverrides : {};
    const overrideVersionMatches = !source.visualDesign || String(savedOverrides.visualPlanGeneratedAt || "") === String(source.visualDesign.planGeneratedAt || "");
    const overrides = overrideVersionMatches ? savedOverrides : {};
    const flowPrompts = {
      ...flowDefaults,
      image: {
        ko: String(overrides.imageKo || flowDefaults.image.ko),
        en: String(overrides.imageEn || flowDefaults.image.en)
      },
      video: {
        ko: String(overrides.videoKo || flowDefaults.video.ko),
        en: String(overrides.videoEn || flowDefaults.video.en)
      }
    };
    return {
      ...source,
      ...commonPrompts,
      flowPrompts,
      generation: {
        mode,
        imageProvider: "higgsfield",
        imageModel: imageModels.flow.includes(saved.imageModel) ? saved.imageModel : "nano-banana-2-lite",
        keyframeStatus: allowedKeyframeStatuses.includes(saved.keyframeStatus) && saved.keyframeStatus !== "not_required" ? saved.keyframeStatus : "planned",
        approved: Boolean(saved.keyframeApproved) && exists,
        exists,
        expectedFile,
        mediaUrl: exists ? `/media?path=${encodeURIComponent(expectedFile)}&v=${encodeURIComponent(state.updatedAt || "1")}` : null
      }
    };
  }));
}


function sanitizeTypecast(settings) {
  const input = settings && typeof settings === "object" ? settings : {};
  return {
    voiceName: String(input.voiceName || "필재").slice(0, 80),
    voiceId: /^(tc|uc)_[A-Za-z0-9]+$/.test(String(input.voiceId || "")) ? String(input.voiceId) : "",
    model: input.model === "ssfm-v21" ? "ssfm-v21" : "ssfm-v30",
    language: "kor",
    tempo: Math.max(0.5, Math.min(2, Number(input.tempo || 1.12))),
    pitch: Math.max(-12, Math.min(12, Number(input.pitch || 0))),
    volume: Math.max(0, Math.min(200, Number(input.volume ?? 100))),
    sentenceGapMs: Math.max(0, Math.min(1000, Number(input.sentenceGapMs ?? 90))),
    withTimestamps: input.withTimestamps !== false
  };
}

function sanitizeState(input, sourceShots) {
  const source = input && typeof input === "object" ? input : {};
  const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
  const stages = stageIds.map((id) => {
    const current = Array.isArray(source.stages) ? source.stages.find((stage) => stage.id === id) : null;
    return {
      id,
      mode: allowedModes.includes(current?.mode) ? current.mode : (id === "video" || id === "keyframes" ? "review" : "auto"),
      status: allowedStatuses.includes(current?.status) ? current.status : "not_started",
      note: String(current?.note || "").slice(0, 300)
    };
  });
  const savedShots = Array.isArray(source.shots) ? source.shots : [];
  const planningSource = source.planning && typeof source.planning === "object" ? source.planning : {};
  const catalogIds = new Set(allEpisodes.map((episode) => episode.id));
  const requestedEpisodeId = planningSource.activeEpisodeId === "FTN-IDEA-170" ? "FTN-PILOT-02" : planningSource.activeEpisodeId;
  const activeEpisodeId = catalogIds.has(requestedEpisodeId) ? requestedEpisodeId : "FTN-PILOT-02";
  const savedShortlist = Array.isArray(planningSource.shortlist) ? planningSource.shortlist : [activeEpisodeId];
  const shortlist = [...new Set(savedShortlist.map((id) => id === "FTN-IDEA-170" ? "FTN-PILOT-02" : id))]
    .filter((id) => catalogIds.has(id)).slice(0, 100);
  const shots = sourceShots.map((shot) => {
    const saved = savedShots.find((entry) => Number(entry.index) === shot.index) || {};
    const provider = saved.provider === "higgsfield" ? "higgsfield" : "flow";
    const fallbackModel = provider === "flow" ? "veo-3.1-fast" : "cinema-studio-4";
    const generationMode = saved.generationMode === "direct" ? "direct" : saved.generationMode === "keyframe" ? "keyframe" : (defaultKeyframeCuts.has(shot.index) ? "keyframe" : "direct");
    return {
      index: shot.index,
      generationMode,
      imageProvider: "higgsfield",
      imageModel: imageModels.flow.includes(saved.imageModel) ? saved.imageModel : "nano-banana-2-lite",
      keyframeStatus: allowedKeyframeStatuses.includes(saved.keyframeStatus) && saved.keyframeStatus !== "not_required" ? saved.keyframeStatus : "planned",
      keyframeApproved: Boolean(saved.keyframeApproved),
      provider,
      model: providerModels[provider].includes(saved.model) ? saved.model : fallbackModel,
      status: allowedStatuses.includes(saved.status) ? saved.status : "planned",
      attempts: Math.max(0, Math.min(99, Number(saved.attempts || 0))),
      selected: Boolean(saved.selected),
      flowPromptOverrides: {
        imageKo: String(saved.flowPromptOverrides?.imageKo || "").slice(0, 12000),
        imageEn: String(saved.flowPromptOverrides?.imageEn || "").slice(0, 12000),
        videoKo: String(saved.flowPromptOverrides?.videoKo || "").slice(0, 12000),
        videoEn: String(saved.flowPromptOverrides?.videoEn || "").slice(0, 12000),
        visualPlanGeneratedAt: String(saved.flowPromptOverrides?.visualPlanGeneratedAt || "").slice(0, 80)
      }
    };
  });
  return {
    version: 3,
    updatedAt: new Date().toISOString(),
    planning: {
      activeEpisodeId,
      shortlist: shortlist.includes(activeEpisodeId) ? shortlist : [activeEpisodeId, ...shortlist]
    },
    settings: {
      defaultProvider: settings.defaultProvider === "higgsfield" ? "higgsfield" : "flow",
      variants: Math.max(1, Math.min(4, Number(settings.variants || 2))),
      flowPlan: String(settings.flowPlan || "Google AI Pro").slice(0, 80),
      flowCredits: Math.max(0, Math.min(100000, Number(settings.flowCredits ?? 1000))),
      higgsfieldCredits: Math.max(0, Math.min(100000, Number(settings.higgsfieldCredits || 0))),
      higgsfieldCostPerGeneration: Math.max(0, Math.min(10000, Number(settings.higgsfieldCostPerGeneration || 0))),
      language: settings.language === "ko" ? "ko" : "en",
      addTechnicalLabelsInPost: settings.addTechnicalLabelsInPost !== false,
      silentGeneration: settings.silentGeneration !== false,
      scriptRhythmProfile: allowedScriptRhythms.includes(settings.scriptRhythmProfile) ? settings.scriptRhythmProfile : "auto",
      typecast: sanitizeTypecast(settings.typecast)
    },
    stages,
    shots
  };
}

function typecastOutputPath(state) {
  const episodeId = state?.planning?.activeEpisodeId || legacyEpisodeId;
  return path.join(episodeProjectDir(episodeId), "audio", "typecast_piljae.wav");
}

async function typecastStatus(state) {
  const file = typecastOutputPath(state);
  const exists = await fs.access(file).then(() => true).catch(() => false);
  const apiKeyConfigured = Boolean(process.env.TYPECAST_API_KEY);
  let connectionOk = false;
  let connectionError = null;
  let subscription = null;
  if (apiKeyConfigured) {
    try {
      const response = await typecastRequest("/v1/users/me/subscription");
      const account = await response.json();
      const planCredits = Number(account?.credits?.plan_credits || 0);
      const usedCredits = Number(account?.credits?.used_credits || 0);
      subscription = {
        plan: String(account?.plan || "unknown"),
        planCredits,
        usedCredits,
        remainingCredits: Math.max(0, planCredits - usedCredits),
        concurrencyLimit: Number(account?.limits?.concurrency_limit || 0)
      };
      connectionOk = true;
    } catch (error) {
      connectionError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    apiKeyConfigured,
    connectionOk,
    connectionError,
    subscription,
    apiConsoleUrl: "https://typecast.ai/developers/api/",
    studioUrl: "https://studio.typecast.ai/text-to-speech",
    expectedFile: path.relative(projectRoot, file).replaceAll("\\", "/"),
    fileExists: exists,
    duration: exists ? await probeDuration(file) : null,
    config: state.settings.typecast
  };
}

async function typecastRequest(endpoint, options = {}) {
  const apiKey = process.env.TYPECAST_API_KEY;
  if (!apiKey) throw new Error("TYPECAST_API_KEY가 설정되지 않았습니다. 대시보드 서버 환경 변수로 연결하세요.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${typecastApiBase}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: { "X-API-KEY": apiKey, ...(options.headers || {}) }
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Typecast API ${response.status}: ${detail.slice(0, 300)}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function listTypecastVoices(model = "ssfm-v30") {
  const response = await typecastRequest(`/v2/voices?model=${encodeURIComponent(model)}`);
  const result = await response.json();
  const voices = Array.isArray(result) ? result : Array.isArray(result?.voices) ? result.voices : [];
  return voices.map((voice) => ({
    voiceId: String(voice.voice_id || ""),
    voiceName: String(voice.voice_name || ""),
    gender: voice.gender || null,
    age: voice.age || null,
    useCases: Array.isArray(voice.use_cases) ? voice.use_cases : [],
    models: Array.isArray(voice.models) ? voice.models : []
  })).filter((voice) => voice.voiceId && voice.voiceName);
}

async function generateTypecastNarration(state, project) {
  const config = state.settings.typecast;
  if (!config.voiceId) throw new Error("먼저 Typecast 목소리 목록에서 필재를 선택하거나 voice ID를 입력하세요.");
  const script = project.narration;
  if (!script || script.length > 2000) throw new Error(`내레이션은 1~2000자여야 합니다. 현재 ${script.length}자입니다.`);
  const endpoint = config.withTimestamps ? "/v1/text-to-speech/with-timestamps?granularity=word" : "/v1/text-to-speech";
  const payload = {
    voice_id: config.voiceId,
    text: script,
    model: config.model,
    language: config.language,
    output: {
      volume: config.volume,
      audio_pitch: config.pitch,
      audio_tempo: config.tempo,
      audio_format: "wav"
    }
  };
  const response = await typecastRequest(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const audioFile = typecastOutputPath(state);
  await fs.mkdir(path.dirname(audioFile), { recursive: true });
  let duration = null;
  if (config.withTimestamps) {
    const result = await response.json();
    if (!result.audio) throw new Error("Typecast 응답에 오디오가 없습니다.");
    await fs.writeFile(audioFile, Buffer.from(result.audio, "base64"));
    duration = Number(result.audio_duration || 0) || null;
    await writeJson(path.join(path.dirname(audioFile), "typecast_piljae_timestamps.json"), {
      generatedAt: new Date().toISOString(),
      voiceName: config.voiceName,
      voiceId: config.voiceId,
      model: config.model,
      tempo: config.tempo,
      sentenceGapTargetMs: config.sentenceGapMs,
      duration,
      words: result.words || []
    });
  } else {
    await fs.writeFile(audioFile, Buffer.from(await response.arrayBuffer()));
  }
  duration = duration || await probeDuration(audioFile);
  const voiceStage = state.stages.find((stage) => stage.id === "voice");
  if (voiceStage) {
    voiceStage.status = duration && duration >= 60 && duration <= 90 ? "ready_review" : "blocked";
    voiceStage.note = `Typecast ${config.voiceName} · ${duration ?? "?"}초 · 검토 필요`;
  }
  await writeJson(stateFile, state);
  return { state, duration, artifact: path.relative(projectRoot, audioFile).replaceAll("\\", "/") };
}

async function loadState() {
  const sourceShots = await parsePromptPackage();
  const raw = await readJson(stateFile, {});
  const state = sanitizeState(raw, sourceShots);
  if (!raw.version || raw.shots?.length !== sourceShots.length) await writeJson(stateFile, state);
  return { state, sourceShots };
}

async function listArtifacts() {
  const found = [];
  async function walk(dir) {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(mp4|wav|json|jpg|jpeg|png|webp|svg)$/i.test(entry.name)) {
        const stats = await fs.stat(full);
        found.push({
          name: entry.name,
          relativePath: path.relative(projectRoot, full).replaceAll("\\", "/"),
          bytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          kind: path.extname(entry.name).slice(1).toLowerCase()
        });
      }
    }
  }
  await walk(outputDir);
  return found.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 24);
}

function runCommand(command, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: projectRoot, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message, stdout, stderr });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function parseCliJson(value) {
  const source = String(value || "").trim();
  if (!source) return null;
  try { return JSON.parse(source); } catch { return extractLastJsonObject(source); }
}

function cliError(result) {
  return String(result?.stderr || result?.error || result?.stdout || "Higgsfield CLI 오류")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "").trim().split(/\r?\n/).slice(-4).join(" ").slice(0, 700);
}

async function withHiggsfieldJobLock(key, action) {
  if (activeHiggsfieldJobs.has(key)) throw new Error("같은 컷의 생성 작업이 이미 실행 중입니다. 완료될 때까지 기다려 주세요.");
  activeHiggsfieldJobs.add(key);
  try { return await action(); }
  finally { activeHiggsfieldJobs.delete(key); }
}

async function runHiggsfieldJson(args, timeoutMs = 1_260_000) {
  const result = await runCommand(higgsfieldExecutable, [...args, "--json"], timeoutMs);
  const value = parseCliJson(result.stdout);
  if (!result.ok || !value) throw new Error(cliError(result) || "Higgsfield 응답을 읽지 못했습니다.");
  return value;
}

async function higgsfieldStatus(force = false) {
  if (!force && higgsfieldStatusCache.value && Date.now() - higgsfieldStatusCache.checkedAt < 30_000) return higgsfieldStatusCache.value;
  const version = await runCommand(higgsfieldExecutable, ["version"], 8_000);
  if (!version.ok) {
    const value = { installed: false, authenticated: false, error: "Higgsfield CLI가 설치되지 않았습니다.", credits: 0, flowAutomation: false };
    higgsfieldStatusCache = { checkedAt: Date.now(), value };
    return value;
  }
  const account = await runCommand(higgsfieldExecutable, ["account", "status", "--json"], 15_000);
  const parsed = account.ok ? parseCliJson(account.stdout) : null;
  const value = {
    installed: true,
    authenticated: Boolean(parsed),
    version: String(version.stdout || "").trim().split(/\r?\n/)[0],
    plan: parsed ? String(parsed.subscription_plan_type || "unknown") : null,
    credits: parsed ? Number(parsed.credits || 0) : 0,
    error: parsed ? null : "Higgsfield 로그인이 필요합니다.",
    flowAutomation: false,
    imageCosts: Object.fromEntries(Object.entries(higgsfieldImageModelMap).map(([id, model]) => [id, model.credits])),
    videoCosts: Object.fromEntries(Object.entries(higgsfieldVideoModelMap).map(([id, model]) => [id, model.credits]))
  };
  higgsfieldStatusCache = { checkedAt: Date.now(), value };
  return value;
}

function collectGeneratedUrls(value, output = []) {
  if (typeof value === "string") {
    if (/^https:\/\//i.test(value)) output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectGeneratedUrls(item, output);
    return output;
  }
  if (value && typeof value === "object") for (const item of Object.values(value)) collectGeneratedUrls(item, output);
  return output;
}

function generatedMediaUrl(value, kind) {
  const urls = [...new Set(collectGeneratedUrls(value))];
  const pattern = kind === "image" ? /\.(?:png|jpe?g|webp)(?:\?|$)/i : /\.mp4(?:\?|$)/i;
  return urls.find((url) => pattern.test(url)) || urls.at(-1) || "";
}

function generatedJobId(value) {
  if (!value || typeof value !== "object") return null;
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:job_?id|generation_?id|id)$/i.test(key) && typeof item === "string") return item;
    const nested = generatedJobId(item);
    if (nested) return nested;
  }
  return null;
}

function safeGeneratedUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || /^(?:10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch { return false; }
}

async function downloadGeneratedMedia(sourceUrl, destination, kind) {
  if (!safeGeneratedUrl(sourceUrl)) throw new Error("Higgsfield가 안전한 결과 URL을 반환하지 않았습니다.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), kind === "video" ? 300_000 : 120_000);
  const temporary = `${destination}.download-${Date.now()}`;
  try {
    const response = await fetch(sourceUrl, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) throw new Error(`생성 결과 다운로드 HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    const declared = Number(response.headers.get("content-length") || 0);
    const limit = kind === "video" ? 600_000_000 : 50_000_000;
    if (declared > limit) throw new Error("생성 결과 파일이 허용 크기를 초과했습니다.");
    if (kind === "image" && !contentType.startsWith("image/") && !/\.(?:png|jpe?g|webp)(?:\?|$)/i.test(sourceUrl)) throw new Error(`이미지 결과 형식이 올바르지 않습니다: ${contentType || "unknown"}`);
    if (kind === "video" && !contentType.startsWith("video/") && !/\.mp4(?:\?|$)/i.test(sourceUrl)) throw new Error(`영상 결과 형식이 올바르지 않습니다: ${contentType || "unknown"}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100 || buffer.length > limit) throw new Error("생성 결과 크기가 허용 범위를 벗어났습니다.");
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(temporary, buffer);
    await fs.rm(destination, { force: true }).catch(() => {});
    if (kind === "image" && contentType !== "image/png") {
      const conversion = await runCommand("ffmpeg", ["-y", "-loglevel", "error", "-i", temporary, "-frames:v", "1", destination], 60_000);
      if (!conversion.ok) throw new Error(`PNG 변환 실패: ${cliError(conversion)}`);
      await fs.rm(temporary, { force: true }).catch(() => {});
    } else {
      await fs.rename(temporary, destination);
    }
  } finally {
    clearTimeout(timer);
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

async function existingGenerationReferences(source) {
  const bundle = source.referenceBundle || {};
  const relativeFiles = [...new Set([
    ...(bundle.priorityShapeReferences || []),
    ...(bundle.topicReferences || []),
    ...(bundle.useTedori ? bundle.characterReferences || [] : []),
    ...(bundle.useTennisnoteBrand ? bundle.brandReferences || [] : [])
  ])];
  const files = [];
  for (const relative of relativeFiles) {
    const file = within(projectRoot, relative);
    if (await fs.access(file).then(() => true).catch(() => false)) files.push(file);
  }
  return files.slice(0, 10);
}

async function saveHiggsfieldLog(episodeId, cut, kind, model, response, outputFile, variant = 1) {
  const directory = path.join(episodeProjectDir(episodeId), "generation");
  await fs.mkdir(directory, { recursive: true });
  const filename = `c${String(cut).padStart(2, "0")}_${kind}${variant > 1 ? `_v${variant}` : ""}.json`;
  await writeJson(path.join(directory, filename), {
    generatedAt: new Date().toISOString(), provider: "higgsfield-cli", cut, kind, model,
    jobId: generatedJobId(response), outputFile: path.relative(projectRoot, outputFile).replaceAll("\\", "/")
  });
}

async function generateHiggsfieldImageCut(state, project, cut, force = false) {
  const status = await higgsfieldStatus();
  if (!status.authenticated) throw new Error(status.error || "Higgsfield 로그인이 필요합니다.");
  const source = project.shots.find((item) => item.index === cut);
  const saved = state.shots.find((item) => item.index === cut);
  if (!source || !saved) throw new Error("존재하지 않는 컷입니다.");
  const destination = within(projectRoot, source.generation.expectedFile);
  const exists = await fs.access(destination).then(() => true).catch(() => false);
  if (exists && !force) return { cached: true, cut, outputFile: source.generation.expectedFile };
  const model = higgsfieldImageModelMap[saved.imageModel] || higgsfieldImageModelMap["nano-banana-2-lite"];
  if (model.credits > status.credits) throw new Error(`이미지 생성에 ${model.credits}cr가 필요하지만 잔여 크레딧은 ${status.credits.toFixed(1)}cr입니다.`);
  const prompt = state.settings.language === "ko" ? source.imagePromptKo : source.imagePromptEn;
  const args = ["generate", "create", model.jobType, "--prompt", prompt, "--aspect-ratio", "9:16", "--resolution", model.resolution];
  for (const reference of await existingGenerationReferences(source)) args.push("--image-references", reference);
  args.push("--wait", "--wait-timeout", "20m", "--wait-interval", "5s");
  const response = await runHiggsfieldJson(args);
  const mediaUrl = generatedMediaUrl(response, "image");
  if (!mediaUrl) throw new Error("Higgsfield 이미지 결과 URL을 찾지 못했습니다.");
  await downloadGeneratedMedia(mediaUrl, destination, "image");
  saved.keyframeStatus = "ready_review";
  saved.keyframeApproved = false;
  await saveHiggsfieldLog(project.episodeId, cut, "image", model.jobType, response, destination);
  const stage = state.stages.find((item) => item.id === "keyframes");
  if (stage) { stage.status = "running"; stage.note = `CUT ${String(cut).padStart(2, "0")} 실제 이미지 생성 완료`; }
  await writeJson(stateFile, state);
  higgsfieldStatusCache.checkedAt = 0;
  return { cached: false, cut, model: model.jobType, credits: model.credits, outputFile: source.generation.expectedFile };
}

async function generateHiggsfieldVideoCut(state, project, cut, variant = 1, force = false) {
  const status = await higgsfieldStatus();
  if (!status.authenticated) throw new Error(status.error || "Higgsfield 로그인이 필요합니다.");
  const source = project.shots.find((item) => item.index === cut);
  const saved = state.shots.find((item) => item.index === cut);
  if (!source || !saved) throw new Error("존재하지 않는 컷입니다.");
  if (saved.provider !== "higgsfield") throw new Error(`CUT ${String(cut).padStart(2, "0")}은 Flow 수동 실행으로 설정되어 있습니다.`);
  const model = higgsfieldVideoModelMap[saved.model];
  if (!model) throw new Error("선택한 Higgsfield 영상 모델을 실행할 수 없습니다.");
  if (model.credits > status.credits) throw new Error(`영상 생성에 최소 ${model.credits}cr가 필요하지만 잔여 크레딧은 ${status.credits.toFixed(1)}cr입니다.`);
  const outputName = variant > 1 ? `c${String(cut).padStart(2, "0")}_v${variant}_silent.mp4` : `c${String(cut).padStart(2, "0")}_silent.mp4`;
  const relativeOutput = `output/episodes/${episodeFolderName(project.episodeId)}/clips/${outputName}`;
  const destination = within(projectRoot, relativeOutput);
  const exists = await fs.access(destination).then(() => true).catch(() => false);
  if (exists && !force) return { cached: true, cut, variant, outputFile: relativeOutput };
  const prompt = state.settings.language === "ko" ? source.videoPromptKo : source.videoPromptEn;
  const duration = Math.max(5, Math.min(15, Math.ceil(Number(source.duration || 5))));
  const args = ["generate", "create", model.jobType, "--prompt", prompt, "--aspect-ratio", "9:16", "--duration", String(duration), "--resolution", model.resolution];
  if (model.supportsAudioToggle) args.push("--generate-audio", "false");
  const startImage = within(projectRoot, source.generation.expectedFile);
  const useStartImage = saved.generationMode === "keyframe";
  if (useStartImage) {
    const available = await fs.access(startImage).then(() => true).catch(() => false);
    if (!available || !saved.keyframeApproved) throw new Error(`CUT ${String(cut).padStart(2, "0")}의 시작 프레임을 먼저 승인하세요.`);
    args.push("--start-image", startImage);
  }
  if (model.cinemaMode) args.push("--mode", useStartImage ? "omni_reference" : "t2v");
  if (!useStartImage && model.supportsReferences) for (const reference of await existingGenerationReferences(source)) args.push("--image-references", reference);
  args.push("--wait", "--wait-timeout", "25m", "--wait-interval", "5s");
  const response = await runHiggsfieldJson(args, 1_560_000);
  const mediaUrl = generatedMediaUrl(response, "video");
  if (!mediaUrl) throw new Error("Higgsfield 영상 결과 URL을 찾지 못했습니다.");
  await downloadGeneratedMedia(mediaUrl, destination, "video");
  saved.status = "ready_review";
  await saveHiggsfieldLog(project.episodeId, cut, "video", model.jobType, response, destination, variant);
  const stage = state.stages.find((item) => item.id === "video");
  if (stage) { stage.status = "running"; stage.note = `CUT ${String(cut).padStart(2, "0")} 변형 ${variant} 실제 영상 생성 완료`; }
  await writeJson(stateFile, state);
  higgsfieldStatusCache.checkedAt = 0;
  return { cached: false, cut, variant, model: model.jobType, credits: model.credits, outputFile: relativeOutput };
}

function escapeStoryboardXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function storyboardCaptionLines(value, maxLength = 19) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength || !current) current = candidate;
    else { lines.push(current); current = word; }
    if (lines.length === 2) break;
  }
  if (current && lines.length < 2) lines.push(current);
  const consumed = lines.join(" ").length;
  if (consumed < String(value || "").trim().length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(1, maxLength - 1))}…`;
  return lines.slice(0, 2);
}

function storyboardDefinitions(episodeId) {
  return [
    { sheetNumber: 1, cutStart: 1, cutEnd: 9, fileBase: "storyboard_01_c01-c09" },
    { sheetNumber: 2, cutStart: 10, cutEnd: 18, fileBase: "storyboard_02_c10-c18" }
  ].map((item) => {
    const directory = path.join(episodeProjectDir(episodeId), "storyboard");
    return { ...item, directory, svgFile: path.join(directory, `${item.fileBase}.svg`), pngFile: path.join(directory, `${item.fileBase}.png`) };
  });
}

async function storyboardSheetStatus(project) {
  const results = [];
  for (const definition of storyboardDefinitions(project.episodeId)) {
    const shots = project.shots.filter((shot) => shot.index >= definition.cutStart && shot.index <= definition.cutEnd);
    const readyFlags = await Promise.all(shots.map((shot) => fs.access(path.join(projectRoot, shot.generation.expectedFile)).then(() => true).catch(() => false)));
    const svgExists = await fs.access(definition.svgFile).then(() => true).catch(() => false);
    const pngExists = await fs.access(definition.pngFile).then(() => true).catch(() => false);
    const preferredFile = pngExists ? definition.pngFile : svgExists ? definition.svgFile : null;
    const relativeFile = preferredFile ? path.relative(projectRoot, preferredFile).replaceAll("\\", "/") : null;
    results.push({
      id: `sheet-${definition.sheetNumber}`,
      sheetNumber: definition.sheetNumber,
      cutStart: definition.cutStart,
      cutEnd: definition.cutEnd,
      readyCount: readyFlags.filter(Boolean).length,
      total: shots.length,
      complete: readyFlags.length > 0 && readyFlags.every(Boolean),
      relativeFile,
      mediaUrl: relativeFile ? `/media?path=${encodeURIComponent(relativeFile)}&v=${Date.now()}` : null
    });
  }
  return results;
}

async function generateStoryboardSheets(project) {
  const generated = [];
  for (const definition of storyboardDefinitions(project.episodeId)) {
    const shots = project.shots.filter((shot) => shot.index >= definition.cutStart && shot.index <= definition.cutEnd);
    await fs.mkdir(definition.directory, { recursive: true });
    const panelWidth = 225;
    const panelHeight = 400;
    const gap = 28;
    const canvasWidth = 1800;
    const canvasHeight = 1080;
    const rowY = [126, 592];
    const rows = [shots.slice(0, 5), shots.slice(5)];
    const panels = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowWidth = row.length * panelWidth + Math.max(0, row.length - 1) * gap;
      const startX = Math.round((canvasWidth - rowWidth) / 2);
      for (let column = 0; column < row.length; column += 1) {
        const shot = row[column];
        const x = startX + column * (panelWidth + gap);
        const y = rowY[rowIndex];
        const absoluteImage = path.join(projectRoot, shot.generation.expectedFile);
        const imageBuffer = await fs.readFile(absoluteImage).catch(() => null);
        const imageLayer = imageBuffer
          ? `<image x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${imageBuffer.toString("base64")}"/>`
          : `<rect x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" fill="#edf0e9"/><circle cx="${x + panelWidth / 2}" cy="${y + 168}" r="42" fill="none" stroke="#a8b39f" stroke-width="3"/><path d="M${x + 82} ${y + 230} L${x + 143} ${y + 230}" stroke="#a8b39f" stroke-width="3"/><text x="${x + panelWidth / 2}" y="${y + 284}" text-anchor="middle" fill="#6d786e" font-size="18" font-family="Arial, sans-serif">FIRST FRAME WAITING</text>`;
        const captionLines = storyboardCaptionLines(shot.narration);
        const caption = captionLines.map((line, lineIndex) => `<text x="${x + 14}" y="${y + panelHeight - 48 + lineIndex * 23}" fill="#ffffff" font-size="17" font-weight="600" font-family="Arial, 'Malgun Gothic', sans-serif">${escapeStoryboardXml(line)}</text>`).join("");
        panels.push(`<g><rect x="${x - 2}" y="${y - 2}" width="${panelWidth + 4}" height="${panelHeight + 4}" rx="3" fill="#ffffff" stroke="#d9ded5" stroke-width="2"/>${imageLayer}<rect x="${x}" y="${y}" width="76" height="36" fill="#141a16" fill-opacity="0.9"/><text x="${x + 13}" y="${y + 25}" fill="#c8f218" font-size="18" font-weight="700" font-family="Arial, sans-serif">CUT ${String(shot.index).padStart(2, "0")}</text><rect x="${x}" y="${y + panelHeight - 86}" width="${panelWidth}" height="86" fill="#111713" fill-opacity="0.88"/>${caption}</g>`);
      }
    }
    const title = `재미있는 테니스 노트 · ${project.title}`;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <rect width="100%" height="100%" fill="#f7f8f4"/>
  <text x="70" y="57" fill="#182019" font-size="30" font-weight="700" font-family="Arial, 'Malgun Gothic', sans-serif">${escapeStoryboardXml(title)}</text>
  <text x="70" y="91" fill="#687269" font-size="18" font-family="Arial, 'Malgun Gothic', sans-serif">STORYBOARD ${String(definition.sheetNumber).padStart(2, "0")} · CUT ${String(definition.cutStart).padStart(2, "0")}–${String(definition.cutEnd).padStart(2, "0")} · 각 컷의 첫 장면</text>
  <line x1="70" y1="108" x2="1730" y2="108" stroke="#d9ded5" stroke-width="2"/>
  ${panels.join("\n  ")}
  <text x="1730" y="1042" text-anchor="end" fill="#8a938b" font-size="15" font-family="Arial, 'Malgun Gothic', sans-serif">9:16 FIRST-FRAME CONTACT SHEET</text>
</svg>`;
    await fs.writeFile(definition.svgFile, svg, "utf8");
    const conversion = await runCommand("ffmpeg", ["-y", "-loglevel", "error", "-i", definition.svgFile, "-frames:v", "1", definition.pngFile], 20000);
    if (!conversion.ok) await fs.rm(definition.pngFile, { force: true }).catch(() => {});
    generated.push({ sheetNumber: definition.sheetNumber, svgFile: path.relative(projectRoot, definition.svgFile).replaceAll("\\", "/"), pngCreated: conversion.ok });
  }
  return generated;
}
function extractLastJsonObject(text) {
  const source = String(text || "");
  const parsed = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") quoted = false;
      continue;
    }
    if (character === "\"") { quoted = true; continue; }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try { parsed.push(JSON.parse(source.slice(start, index + 1))); } catch {}
        start = -1;
      }
    }
  }
  return parsed.at(-1) || null;
}

function scriptGenerationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["scriptLines", "evidence", "sources", "factWarnings"],
    properties: {
      scriptLines: { type: "array", minItems: 18, maxItems: 18, items: { type: "string" } },
      evidence: {
        type: "array", minItems: 18, maxItems: 18,
        items: {
          type: "object", additionalProperties: false,
          required: ["cut", "claim", "proof", "graphic", "visualKo", "visualEn", "motionKo", "motionEn", "cameraKo", "cameraEn"],
          properties: {
            cut: { type: "integer", minimum: 1, maximum: 18 },
            claim: { type: "string" },
            proof: { type: "string" },
            graphic: { type: "string" },
            visualKo: { type: "string" },
            visualEn: { type: "string" },
            motionKo: { type: "string" },
            motionEn: { type: "string" },
            cameraKo: { type: "string" },
            cameraEn: { type: "string" }
          }
        }
      },
      sources: {
        type: "array", minItems: 2,
        items: {
          type: "object", additionalProperties: false,
          required: ["title", "url", "supports"],
          properties: { title: { type: "string" }, url: { type: "string" }, supports: { type: "string" } }
        }
      },
      factWarnings: { type: "array", items: { type: "string" } }
    }
  };
}

function narrationWarmWitRules(episode) {
  const subject = `${episode?.title || ""} ${episode?.summary || ""} ${episode?.hook || ""}`;
  const serious = /(사망|죽음|숨졌|참사|비극|중상|부상|사고|재난|질병|학대|폭력|실종|추모)/.test(subject);
  if (serious) {
    return `이번 편의 감정 안전 규칙:
- 죽음·부상·사고·재난처럼 무거운 소재입니다. 웃음 장치, 말장난, 가벼운 의인화는 사용하지 않습니다.
- 친숙함은 쉬운 동사, 매끄러운 인과, 차분한 공감으로만 만듭니다. 감정 비트도 상황의 무게를 낮추지 않는 한 문장으로 제한합니다.`;
  }
  return `이번 편의 편안한 재미 문법:
- 농담을 따로 쓰지 않습니다. 정확한 설명 속에 3~5개의 가벼운 말맛 비트를 띄엄띄엄 넣되, 서로 붙이지 않습니다.
- 2~4곳에서는 소재에 맞는 생활 동사나 짧은 상태어를 사용해 움직임이 바로 보이게 합니다. 줄이라면 밀리고 튕겨 돌아오며, 공이라면 눌리고 감기고 튀어나옵니다. 예시 단어를 복사하지 말고 이번 사실에 맞는 동사를 고릅니다.
- 시청자가 떠올릴 뻔한 해결책이나 반박을 중반에 한 번 짧게 묻고, 같은 문장 또는 바로 다음 문장에서 구체적인 이유로 답합니다. 질문만 던져 정보를 미루지 않습니다.
- 위기가 가장 커진 자리에는 사실을 압축한 건조한 한마디를 한 번 둡니다. 억지 감탄이나 개그가 아니라 작은 원인과 큰 결과의 어긋남에서 옅은 웃음이 나야 합니다.
- 해결은 문제의 말을 되받아 표현합니다. 회전 자체가 아니라 회전을 만든 줄 배치를 막는 식으로, 문제와 해법의 핵심 명사를 맞물리게 합니다.
- 사물은 물리적으로 가능한 범위에서만 움직이는 주어가 될 수 있습니다. 사람의 항의·판단·감정까지 사물에게 시키지 않습니다.
- 마지막은 정답을 되풀이하는 보고서 문장이 아니라, 익숙한 공·줄·코트가 이제는 의도된 결과로 보이게 따뜻하게 닫습니다.
- “여기 XX가 있습니다”, “환장할 노릇”, “그래서 발상을 뒤집습니다”, “이렇게 탄생한 겁니다”처럼 참고 채널의 고정 문구는 쓰지 않습니다. 기능만 가져오고 문장은 테니스 소재마다 새로 만듭니다.`;
}

function scriptGenerationPrompt(episode, selectedRhythm = "auto") {
  const metadata = JSON.stringify({
    id: episode.id,
    title: episode.title,
    hook: episode.hook,
    summary: episode.summary,
    category: episode.categoryLabel,
    visual: episode.visual,
    targetSeconds: episode.targetSeconds || 90
  }, null, 2);
  const rhythm = resolveScriptRhythmProfile(episode, selectedRhythm);
  return `당신은 한국어 테니스 지식 쇼츠의 팩트체커이자, 어려운 원리를 친절하게 풀어주는 다큐멘터리 작가입니다. 아래 에피소드를 웹에서 먼저 조사한 뒤, 처음 듣는 사람도 한 번에 따라갈 수 있는 완성 대본을 작성하십시오.

에피소드:
${metadata}

가장 중요한 목표:
- 정보의 양보다 이해의 순서를 우선합니다. 사실을 많이 넣는 대본이 아니라 원인과 결과가 자연스럽게 이어지는 대본을 만듭니다.
- 화자는 지식을 과시하는 전문가가 아니라, 테니스를 잘 아는 다정한 선배처럼 설명합니다.
- 첫 문장은 시청을 멈추게 하는 강한 훅입니다. 익숙한 대상의 뜻밖의 정체를 단정하는 반전 선언이 기본이지만(“이 노란 공, 사실 쉰 살을 갓 넘긴 신입입니다”), 소재에 따라 충격적 장면·믿기 힘든 기록·이상한 현상이 더 강하면 그쪽을 택합니다. 어느 쪽이든 제목 낭독과 밋밋한 일반론은 금지입니다.
- 마지막 문장은 첫 훅의 대상을 다시 불러 완결감 있는 종결 어미로 확실하게 끝맺습니다. “알고 보면 ~였던 것이었습니다”는 검증된 선택지이지만 의무는 아니며, 무겁거나 감동적인 소재는 그 온도에 맞는 어미로 닫습니다.
- 기술용어를 쓰면 같은 문장이나 바로 다음 문장에서 일상어로 풉니다. 추상 명사를 연달아 쌓지 않습니다.
- 낯선 장비명·구조명·통칭이 처음 나오면 이름만 던지지 않습니다. 눈에 보이는 구조나 역할을 먼저 짧게 설명한 뒤 “이런 장비를 {명칭}이라고 불렀습니다”처럼 명칭을 연결합니다.
- 기관 약어는 첫 등장에만 한국어 전체 명칭과 약어를 함께 씁니다. “국제테니스연맹인 ITF”처럼 조사로 자연스럽게 이어 설명하고, “국제테니스연맹, ITF”처럼 번역투 쉼표로 끊지 않습니다. 이후에는 약어만 사용합니다.
- 선수 항의·규정 변경·고장·사고 같은 반응은 갑자기 제시하지 않습니다. 바로 앞 문장이나 같은 문장에 무엇이 그 반응을 일으켰는지 원인을 분명히 둡니다.

검증된 낭독 리듬:
- 조회수 상위 설명형 쇼츠 표본은 약 84~94초 구간에서 대체로 초당 10~11자였습니다. 이 대본은 Typecast 속도를 고려해 공백 제외 650~850자를 목표로 합니다.
- 친근함은 구어체 어미를 많이 붙이는 데서 나오지 않습니다. 사물과 사람이 주어가 되어 직접 움직이고, 앞 문장이 다음 문장을 자연스럽게 끌고 갈 때 생깁니다.
- 18문장을 18개의 독립된 백과사전 문장처럼 쓰지 않습니다. 4~8번, 9~11번, 12~15번은 각각 2~3문장짜리 작은 이야기처럼 이어집니다.
- 한 사실은 대본에서 한 번만 설명합니다. 같은 결론을 표현만 바꿔 6번·8번·9번·17번에서 반복하지 않습니다. 이미 설명한 사실을 다시 써야 한다면 새 원인·예외·결과 중 하나가 반드시 추가돼야 합니다.
- 셀프 문답의 질문은 짧은 독립 문장으로 끝내고, 답은 반드시 다음 문장으로 넘깁니다. 물음표 뒤에 설명을 이어 붙이지 않습니다.
- “해결할 대상은”, “답은 분명합니다”, “결론은”, “이제 이유가 보입니다” 같은 발표문·정리문을 쓰지 않습니다. 공·선수·규칙·기관이 직접 행동하게 합니다.
- “규제의 초점”, “검토 과정”, “경기 영향”, “연구 결과 수집”처럼 추상 명사를 연달아 쓰지 않습니다. 누가 무엇을 보고, 막고, 바꾸고, 확인했는지 눈에 보이는 동사로 바꿉니다.
- “그런데”, “문제는”, “그렇다고”, “그래서”, “덕분에”, “결국” 같은 연결어는 전체 2~5번만 필요한 자리에 씁니다. 접속사 없이 문장을 억지로 끊지 않습니다.

${narrationWarmWitRules(episode)}

중간 감정 비트:
- 9번에서 실제 위기를 보여준 뒤, 10번에는 해설자가 그 상황을 짧게 느끼는 감정 반응 한 문장을 둡니다. 사실 설명을 대신하지 않고 해결 직전의 리듬 신호로만 씁니다.
- 난감함·답답함·아찔함·골치 아픔처럼 앞 상황에서 자연스럽게 생기는 감정을 고릅니다. 주체와 이유가 느껴져야 하며, 억지 감탄이나 과장은 피합니다.
- 표현은 에피소드마다 새로 만듭니다. 특정 채널의 고정 문구와 “환장할 노릇” 같은 시그니처 문장을 그대로 복제하지 않습니다. 감정 비트는 10번 한 문장에만 둡니다.

이번 편 슬롯 리듬 — ${rhythm.label} / ${rhythm.selection}:
- 질문을 여는 방식: ${rhythm.intro}
- 위기를 정리하는 방식: ${rhythm.crisis}
- 해결로 넘어가는 방식: ${rhythm.reversal}
- 첫 질문을 회수하는 방식: ${rhythm.close}
- 위 문구는 기능 지시일 뿐입니다. 고정 유행어나 예문을 복사하지 말고 이번 소재의 고유 명사와 동작으로 새로 씁니다.

스토리텔링 4원칙 (구조보다 우선하는 필수 조건):
- ① 1번 문장은 시청을 멈추게 하는 강한 훅입니다. 반전 선언이 기본이지만, 소재에 따라 충격적인 장면 묘사·믿기 힘든 기록 제시·이상한 현상 목격 등 더 어울리는 훅이 있으면 그것을 씁니다.
- ② 대본 어딘가에 최소 한 번의 진짜 반전(예상이 뒤집히는 순간)이 있어야 합니다. 반전이 두 번이면 더 좋지만 억지로 만들지 않습니다.
- ③ 의문문은 많아야 한두 번, 궁금증이 가장 고조된 자리에만 둡니다.
- ④ 마지막 문장은 첫 훅의 대상을 다시 불러 완결감 있는 어미로 확실하게 닫습니다. “~였던 것이었습니다”는 좋은 선택지일 뿐 의무가 아니며, 소재의 온도에 맞는 종결 어미를 고릅니다.

아래 18문장 반전 다큐 아크는 검증된 기본 템플릿입니다. 이번 소재에 자연스럽게 맞으면 그대로 쓰고, 어색한 슬롯이 있으면 4원칙을 지키는 범위에서 순서와 역할을 재배치합니다. 기록 중심·인물 중심·사건 중심 소재는 특히 자유롭게 변형합니다:
1. 익숙한 대상의 뜻밖의 정체를 단정하는 반전 훅. 질문이 아니라 선언입니다.
2. 그 반전을 뒷받침하는 의외의 과거나 배경을 보여줍니다.
3. 그 시절의 구체적인 모습을 눈에 보이게 그립니다.
4. 변화의 계기가 등장하며 “묘한 문제가 하나 생깁니다”처럼 미스터리를 예고합니다.
5. 문제의 순간을 감각적인 현상으로 보여줍니다. 공이 사라지고, 줄이 밀리고, 판정이 뒤집히는 식입니다.
6. 그 문제가 만든 난감하거나 우스운 상황을 사람의 시점에서 압축합니다.
7. 해답의 발견을 보여줍니다. 누가 무엇을 찾아 나섰고 답이 무엇이었는지 말합니다.
8. 그 해답이 통하는 이유를 일상어로 짧게 잇습니다.
9. 두 번째 반전. “그런데 문제가 하나 더 있었습니다”처럼 뜻밖의 장애물을 세웁니다.
10. 그 장애물의 아이러니를 짧고 건조하게 짚습니다. 답을 찾았는데 규칙이 막는 식의 어긋남입니다.
11. 이 에피소드의 유일한 의문문을 여기 둡니다. “왜 바로 ~하지 않았을까요?”
12. 신중한 해소 과정을 구체적인 행동으로 보여줍니다.
13. 결정적 전환점을 연도·결정과 함께 못 박습니다.
14. 오해를 바로잡는 의외의 잔여 사실을 하나 줍니다. “흰 공은 지금도 합법입니다” 같은 문장입니다.
15. 본질은 달라지지 않았음을 처음 듣는 사람의 말로 쉽게 풉니다.
16. 마지막까지 버틴 저항과 항복 같은 극적인 사례로 변화를 완성합니다.
17. 첫 훅을 회수하는 진짜 이유를 한 문장으로 선언합니다.
18. 첫 문장의 대상을 다시 부르고 “알고 보면 ~였던 것이었습니다”로 완결감 있게 닫습니다.

연결성 검사:
- 4~15번 문장의 순서를 섞어도 말이 된다면 실패입니다. 앞 문장이 다음 문장의 원인·반전·결과 중 하나가 되도록 다시 씁니다.
- '이 구조', '이 조치', '이 방식'을 쓸 때는 바로 앞 문장에 가리키는 대상이 분명해야 합니다.
- 서로 관계없는 연도·실험·규칙을 병렬로 나열하지 않습니다. 핵심 서사에 필요하지 않은 정보는 evidence.graphic으로 넘깁니다.
- “실험했다/시험했다/연구했다/조사했다”는 과정만 말하고 끝내지 않습니다. 같은 문장 또는 바로 다음 1~2문장 안에 공식자료로 확인되는 관찰 결과나 그 결과로 내려진 허용·금지·채택·변경 결정을 반드시 이어 씁니다.
- 공식자료에 실험의 수치·표본·측정법이 없으면 만들지 않습니다. 대신 “세부 수치는 공개 자료에 없지만, 시험 뒤 무엇이 허용되거나 바뀌었는지”까지 정확히 말합니다.
- 접속사는 필요한 전환 지점에만 쓰되, 문장 연결을 피하려고 무조건 삭제하지 않습니다.

말투와 호흡:
- 전체적으로 편안한 존댓말입니다. 정확한 사실은 담담하게 말하고, 궁금증·전환·쉬운 풀이에서만 말맛을 조금 부드럽게 합니다.
- 전체 18문장 중 7~12문장은 '-습니다/-입니다'로 중심을 잡습니다. '-죠/-까요?/-나요?/-는데요'는 합쳐 2~6문장만 사용합니다.
- '-거든요'는 꼭 자연스러울 때 한 편에 최대 한 번만 허용합니다. '-네요'는 마무리용으로 강제하지 않습니다.
- '-습니다/-입니다'가 다섯 문장 연속 이어지지 않게 하되, 어미를 바꾸기 위해 어색한 구어체를 억지로 넣지 않습니다.
- '-셈입니다', '그렇죠', 청자 호명, 물결표, 과장된 감탄은 금지합니다.
- '-아요/-어요/-해요'는 최대 세 문장에만 쓰고 연속 배치하지 않습니다.
- 한 문장은 대체로 18~55자입니다. 18문장 중 2~4문장은 35자 이하의 짧은 숨표로 두고, 바로 다음 문장에서 이유나 결과를 이어 갑니다.
- 문장마다 새로운 주제를 꺼내지 않습니다. 앞 문장의 공·줄·선수·규칙 중 하나를 다음 문장의 주어로 이어받습니다.
- 추상적인 보고서 문장보다 구체적인 동작을 우선합니다. “규제의 초점이 이동했습니다”보다 “ITF가 막은 대상을 공에서 줄로 바꿨습니다”처럼 씁니다.
- 한 명사 앞에 ‘추가된 과장된’처럼 수식어를 두 겹으로 쌓지 않습니다. 두 정보가 모두 필요하면 앞뒤 문장으로 나눠 입으로 읽기 쉽게 만듭니다.
- 친근하게 들리려고 뜻이 흐린 비유를 새로 만들지 않습니다. 조사 기간이라면 누가 무엇을 확인했는지 직접 말합니다.
- 사람의 반응은 사물이 대신하지 않습니다. 회전이 파업을 부른다고 쓰지 말고, 회전 때문에 불만을 품은 선수들이 무엇을 했는지 씁니다.
- 낯선 장비·기술은 보이는 구조와 함께 처음 소개하고, 기관 약어는 첫 등장에만 한국어 전체 명칭을 붙입니다.
- 16번은 오해를 바로잡고, 17~18번은 첫 질문에 직접 답합니다. 결말 어미는 문맥에 맞게 고르며 특정 문구를 반복하지 않습니다.
- 전문용어와 수치를 한 문장에 여러 개 겹치지 않습니다. 꼭 필요한 숫자는 이야기 속 원인이나 반전으로 사용합니다.

조사 원칙:
- ITF, ATP, WTA, 대회·제조사 공식 문서, 특허, 논문처럼 1차·공식 자료를 우선합니다.
- 검증되지 않은 정밀 수치, 인과관계, 일화는 쓰지 않습니다.
- 대본에서 읽는 핵심 숫자는 전체 2개 안팎으로 절제하고, 나머지는 evidence.graphic에 넣습니다.
- 자료가 충돌하거나 확정할 수 없는 내용은 factWarnings에 적고 대본에서는 단정하지 않습니다.

출력 규칙:
- 정확히 18개의 한국어 나레이션 문장입니다. 한 배열 항목이 한 문장이자 한 컷입니다.
- 특정 채널의 시그니처 문구를 복제하지 않습니다.
- 영상 지시, 효과음, 괄호형 빈칸, 마크다운은 scriptLines에 넣지 않습니다.
- 1차로 팩트와 18개 역할을 배치한 뒤, 2차로 소리 내어 읽는 한국어 흐름만 다시 편집합니다. 2차 편집에서는 사실과 수치를 바꾸지 않습니다.

근거 규칙:
- evidence는 1번부터 18번 컷까지 정확히 대응합니다.
- proof는 해당 문장을 뒷받침하는 원리·공식 규격·비교 근거를 한국어 한 줄로 씁니다.
- graphic은 후반 편집에서 넣을 짧은 영어 전문용어 또는 수치 1~2개만 씁니다. 이미지·영상 모델이 직접 글자를 그리게 하지 않습니다.
- visualKo와 visualEn은 해당 문장을 설명하는 시작 프레임 한 장을 각각 한국어와 영어로 구체화합니다. 정확한 피사체 수, 상태, 장소를 쓰고 추상어·카메라 이동·시간 변화·멀티컷은 넣지 않습니다.
- motionKo와 motionEn은 그 시작 프레임에서 이어지는 물리적 동작 하나와 카메라 이동 하나만 각각 한국어와 영어로 씁니다. 다른 장소나 시대로 전환하지 않습니다.
- cameraKo와 cameraEn은 카메라 앵글과 샷 사이즈만 씁니다.
- 18개의 visual은 에피소드 전체 요약을 반복하지 않고 현재 컷의 문장과 claim만 시각화합니다. CUT 01에는 뒤에서 설명할 단면·결과·해결책을 미리 넣지 않습니다.
- sources에는 실제로 확인한 URL과 그 자료가 뒷받침하는 내용을 기록합니다.

지정된 JSON 스키마만 출력하십시오.`;
}
async function runCodexScriptGeneration(episode, selectedRhythm = "auto") {
  const schemaFile = path.join(dataDir, "script-generation.schema.json");
  await writeJson(schemaFile, scriptGenerationSchema());
  const codexExecutable = process.platform === "win32"
    ? path.join(process.env.APPDATA || "", "npm", "codex.cmd")
    : "codex";
  const args = [
    "--search", "exec", "--ephemeral", "--sandbox", "read-only",
    "--skip-git-repo-check", "--color", "never",
    "-c", 'model_reasoning_effort="medium"',
    "--output-schema", schemaFile, "-"
  ];
  const prompt = scriptGenerationPrompt(episode, selectedRhythm);
  return await new Promise((resolve) => {
    const child = spawn(codexExecutable, args, {
      cwd: projectRoot,
      windowsHide: true,
      shell: process.platform === "win32"
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, error: "AI 대본 생성 시간이 4분을 초과했습니다.", stdout, stderr });
    }, 240000);
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    child.on("error", (error) => finish({ ok: false, error: error.message, stdout, stderr }));
    child.on("close", (code) => {
      const value = extractLastJsonObject(stdout);
      finish({ ok: code === 0 && Boolean(value), code, value, stdout, stderr, error: value ? "" : "구조화된 대본 응답을 읽지 못했습니다." });
    });
    child.stdin.end(prompt, "utf8");
  });
}

function visualReferenceResearchSchema() {
  const stringArray = { type: "array", minItems: 2, maxItems: 12, items: { type: "string" } };
  return {
    type: "object",
    additionalProperties: false,
    required: ["geometry", "references", "searchQueries", "promptAnchorKo", "promptAnchorEn", "warnings"],
    properties: {
      geometry: {
        type: "object", additionalProperties: false,
        required: ["subjectKo", "subjectEn", "invariantsKo", "invariantsEn", "constructionKo", "constructionEn", "materialsKo", "materialsEn", "mechanismKo", "mechanismEn", "commonErrorsKo", "commonErrorsEn"],
        properties: {
          subjectKo: { type: "string" }, subjectEn: { type: "string" },
          invariantsKo: stringArray, invariantsEn: stringArray,
          constructionKo: stringArray, constructionEn: stringArray,
          materialsKo: stringArray, materialsEn: stringArray,
          mechanismKo: stringArray, mechanismEn: stringArray,
          commonErrorsKo: stringArray, commonErrorsEn: stringArray
        }
      },
      references: {
        type: "array", minItems: 3, maxItems: 8,
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "title", "sourceType", "sourceUrl", "imageUrl", "license", "authorityScore", "whyUsefulKo", "visualFactsKo", "visualFactsEn"],
          properties: {
            id: { type: "string" }, title: { type: "string" },
            sourceType: { type: "string", enum: ["patent", "official", "research", "museum", "archive", "manufacturer"] },
            sourceUrl: { type: "string" }, imageUrl: { type: "string" },
            license: { type: "string", enum: ["public-domain", "open-license", "source-link-only", "unknown"] },
            authorityScore: { type: "integer", minimum: 1, maximum: 5 },
            whyUsefulKo: { type: "string" },
            visualFactsKo: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
            visualFactsEn: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } }
          }
        }
      },
      searchQueries: { type: "array", minItems: 2, maxItems: 12, items: { type: "string" } },
      promptAnchorKo: { type: "string" }, promptAnchorEn: { type: "string" },
      warnings: { type: "array", items: { type: "string" } }
    }
  };
}

function visualReferenceResearchPrompt(episode, officialResearch) {
  const metadata = JSON.stringify({ id: episode.id, title: episode.title, hook: episode.hook, summary: episode.summary, category: episode.categoryLabel, visual: episode.visual }, null, 2);
  const facts = JSON.stringify({ facts: officialResearch?.facts || [], sources: officialResearch?.sources || [], factWarnings: officialResearch?.factWarnings || [] }, null, 2);
  return `당신은 테니스 장비·건축·역사 영상의 시각 레퍼런스 조사자입니다. 아래 주제를 웹에서 조사해 이미지 생성 모델이 형태를 틀리지 않도록 주제 전용 형태 팩을 만드십시오.

에피소드:
${metadata}

저장된 공식자료:
${facts}

조사 우선순위:
1. 특허 원문과 도면, 공식 규격, 원 논문 그림처럼 구조를 직접 보여주는 1차 자료.
2. 박물관·공식 기록 보관소·제조사 자료의 실물 사진.
3. 신뢰할 수 있는 보도 사진은 외형 보조로만 사용하며 구조 근거보다 우선하지 않습니다.

반드시 수행:
- 대상이 특정 제품인지, 구조 방식의 통칭인지 먼저 구분합니다.
- 정면 외형만 보지 말고 단면, 앞뒤 관계, 부품 수, 결합 방식, 재질, 움직이는 부분을 조사합니다.
- 이미지 모델이 흔히 만드는 잘못된 형태를 최소 3개 적습니다.
- references에는 실제로 열어 확인한 페이지 URL만 씁니다.
- imageUrl은 브라우저가 직접 열 수 있는 원본 PNG/JPG/WEBP 주소를 실제로 확인했을 때만 씁니다. 확인하지 못하면 빈 문자열입니다.
- 특허 도면처럼 공개 도메인임이 분명할 때만 public-domain으로 표시합니다. 기사·경매·박물관 사진은 명시적 허가가 없으면 source-link-only입니다.
- AI 생성 이미지, Pinterest 재게시물, 출처를 추적할 수 없는 이미지는 제외합니다.
- 한국어와 영어 형태 지시가 같은 구조를 가리키게 합니다.
- 장면을 복제하는 프롬프트가 아니라 대상의 구조를 잠그는 promptAnchorKo/En을 작성합니다.

지정된 JSON 스키마만 출력하십시오.`;
}

async function runCodexVisualReferenceResearch(episode, officialResearch) {
  return runCodexStructured(visualReferenceResearchPrompt(episode, officialResearch), visualReferenceResearchSchema(), "visual-reference-research.schema.json", true, 240000, "시각 레퍼런스 조사 시간이 4분을 초과했습니다.");
}

function validateVisualReferenceResearch(value, episodeId) {
  const geometry = value?.geometry;
  const references = Array.isArray(value?.references) ? value.references.filter((item) => /^https?:\/\//.test(String(item?.sourceUrl || ""))) : [];
  if (!geometry || !Array.isArray(geometry.invariantsKo) || geometry.invariantsKo.length < 2) throw new Error("형태 불변 요소가 충분하지 않습니다.");
  if (!Array.isArray(geometry.commonErrorsKo) || geometry.commonErrorsKo.length < 2) throw new Error("오형태 금지 규칙이 충분하지 않습니다.");
  if (references.length < 3) throw new Error("검증 가능한 시각 레퍼런스가 3개 미만입니다.");
  if (!references.some((item) => ["patent", "official", "research"].includes(item.sourceType))) throw new Error("특허·공식·원 연구 레퍼런스가 하나 이상 필요합니다.");
  return {
    episodeId,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: null,
    provider: "codex-search",
    geometry,
    references: references.map((item, index) => ({
      ...item,
      id: String(item.id || `VR${String(index + 1).padStart(2, "0")}`).slice(0, 40),
      imageUrl: /^https?:\/\//.test(String(item.imageUrl || "")) ? String(item.imageUrl) : "",
      selected: Number(item.authorityScore || 0) >= 3,
      localFile: null,
      downloadError: null
    })),
    searchQueries: Array.isArray(value.searchQueries) ? value.searchQueries.map(String) : [],
    promptAnchorKo: String(value.promptAnchorKo || ""),
    promptAnchorEn: String(value.promptAnchorEn || ""),
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : []
  };
}

function isSafeExternalReferenceUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "::1" || host.endsWith(".local")) return false;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    return true;
  } catch {
    return false;
  }
}

async function discoverVisualReferenceImage(item) {
  if (item.imageUrl) return isSafeExternalReferenceUrl(item.imageUrl) ? item.imageUrl : "";
  if (item.license !== "public-domain" || item.sourceType !== "patent" || !/^https:\/\/patents\.google\.com\//i.test(item.sourceUrl || "")) return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(item.sourceUrl, { signal: controller.signal, redirect: "follow", headers: { "User-Agent": "FunTennisNoteVisualResearch/1.0" } });
    if (!response.ok) return "";
    const html = await response.text();
    const matches = [...html.matchAll(/https:\/\/patentimages\.storage\.googleapis\.com\/[^"'<>\s]+?\.(?:png|jpe?g)/gi)];
    return [...new Set(matches.map((match) => match[0]))].at(-1) || "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function downloadVisualReferenceAssets(research) {
  const directory = path.join(episodeProjectDir(research.episodeId), "visual-references", "assets");
  await fs.mkdir(directory, { recursive: true });
  const allowedLicenses = new Set(["public-domain", "open-license"]);
  for (let index = 0; index < research.references.length; index += 1) {
    const item = research.references[index];
    if (!allowedLicenses.has(item.license)) continue;
    if (item.localFile) {
      const existingFile = within(projectRoot, item.localFile);
      const existingSize = await fs.stat(existingFile).then((value) => value.size).catch(() => 0);
      if (!(item.sourceType === "patent" && existingSize < 20_000)) continue;
      item.localFile = null;
      item.imageUrl = "";
    }
    item.imageUrl = await discoverVisualReferenceImage(item);
    if (!item.imageUrl || !isSafeExternalReferenceUrl(item.imageUrl)) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(item.imageUrl, { signal: controller.signal, redirect: "follow", headers: { "User-Agent": "FunTennisNoteVisualResearch/1.0" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > 12_000_000) throw new Error("이미지 크기가 12MB 제한을 초과했습니다.");
      const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
      const extension = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" }[contentType];
      if (!extension) throw new Error(`지원하지 않는 이미지 형식: ${contentType || "unknown"}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 100 || buffer.length > 12_000_000) throw new Error("이미지 크기가 허용 범위를 벗어났습니다.");
      const filename = `vr${String(index + 1).padStart(2, "0")}${extension}`;
      const file = path.join(directory, filename);
      await fs.writeFile(file, buffer);
      item.localFile = path.relative(projectRoot, file).replaceAll("\\", "/");
      item.downloadError = null;
    } catch (error) {
      item.downloadError = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
    } finally {
      clearTimeout(timer);
    }
  }
  research.updatedAt = new Date().toISOString();
  return research;
}
function officialResearchSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["facts", "sources", "factWarnings"],
    properties: {
      facts: {
        type: "array", minItems: 8, maxItems: 30,
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "fact", "proof", "graphic", "sourceUrls"],
          properties: {
            id: { type: "string" },
            fact: { type: "string" },
            proof: { type: "string" },
            graphic: { type: "string" },
            sourceUrls: { type: "array", minItems: 1, items: { type: "string" } }
          }
        }
      },
      sources: {
        type: "array", minItems: 2,
        items: {
          type: "object", additionalProperties: false,
          required: ["title", "url", "supports"],
          properties: { title: { type: "string" }, url: { type: "string" }, supports: { type: "string" } }
        }
      },
      factWarnings: { type: "array", items: { type: "string" } }
    }
  };
}

function officialResearchPrompt(episode) {
  const metadata = JSON.stringify({
    id: episode.id,
    title: episode.title,
    hook: episode.hook,
    summary: episode.summary,
    category: episode.categoryLabel
  }, null, 2);
  return `당신은 테니스 역사·규정·장비의 공식자료 조사자입니다. 아래 에피소드에 대해 이번 한 번만 웹 조사를 수행하고 재사용 가능한 팩트 팩을 만드십시오.

에피소드:
${metadata}

조사 목표:
- ITF, ATP, WTA, 대회·제조사 공식 문서, 판결문, 특허, 원 논문 등 1차·공식 자료를 최우선으로 확인합니다.
- 쇼츠의 도입, 정상 구조, 달라진 조건, 작동 원리, 실제 위기, 조치, 최종 규칙, 흔한 오해와 결론을 뒷받침할 핵심 사실 8~14개만 수집합니다.
- 공식·1차 출처 3~6개로 핵심 인과가 충분히 검증되면 검색을 종료합니다. 같은 검색어를 반복하거나 주변 일화까지 넓히지 않습니다.
- 소셜미디어·영상·재인용 블로그는 찾지 않습니다. 공식 문서가 없는 세부 일화는 factWarnings로 넘깁니다.
- 같은 사실을 표현만 바꿔 반복하지 않습니다.
- 검증되지 않은 정밀 수치, 과장된 인과관계, 출처를 찾지 못한 일화는 사실로 넣지 않습니다.
- 자료가 충돌하거나 확정할 수 없는 내용은 factWarnings에 씁니다.

출력 규칙:
- fact는 대본 문장이 아니라 재사용 가능한 객관 사실입니다.
- proof는 해당 사실이 왜 맞는지 공식 문서·실험·규격의 근거를 한국어로 설명합니다.
- graphic은 후반 편집에 쓸 짧은 영어 용어 또는 숫자이며 불필요하면 NONE입니다.
- sourceUrls에는 실제 확인한 URL만 넣습니다.
- sources에는 실제 URL, 자료 제목, 뒷받침하는 내용을 기록합니다.
- 대본, 말투, 18문장, 이미지 프롬프트는 만들지 않습니다.

지정된 JSON 스키마만 출력하십시오.`;
}

function scriptRewriteSchema() {
  const full = scriptGenerationSchema();
  return {
    type: "object",
    additionalProperties: false,
    required: ["scriptLines", "evidence"],
    properties: { scriptLines: full.properties.scriptLines, evidence: full.properties.evidence }
  };
}

function scriptRewritePrompt(episode, research, draftLines, selectedRhythm = "auto", correctionMessage = "") {
  const rhythm = resolveScriptRhythmProfile(episode, selectedRhythm);
  const metadata = JSON.stringify({ id: episode.id, title: episode.title, hook: episode.hook, summary: episode.summary, targetSeconds: episode.targetSeconds || 90 }, null, 2);
  const researchPack = JSON.stringify({ facts: research.facts, sources: research.sources, factWarnings: research.factWarnings || [] }, null, 2);
  const draft = Array.isArray(draftLines) && draftLines.length === 18 ? JSON.stringify(draftLines, null, 2) : "없음";
  const correction = correctionMessage ? `

이전 결과의 검수 오류:\n${correctionMessage}\n이번에는 이 오류를 반드시 바로잡으십시오.` : "";
  return `당신은 한국어 테니스 지식 쇼츠의 문장 편집자입니다. 웹 검색을 하지 말고 아래 저장된 공식자료 팩만 사용해 자연스러운 18문장 대본과 컷별 시각 설계를 작성하십시오.

에피소드:
${metadata}

저장된 공식자료 팩:
${researchPack}

현재 편집 중인 18문장:
${draft}${correction}

절대 규칙:
- 공식자료 팩에 없는 사실·수치·인과관계를 새로 만들지 않습니다.
- 현재 문장은 참고 초안일 뿐입니다. 정보 순서는 유지하되 보고서 문장처럼 굳은 표현은 과감히 풀어 씁니다.
- 정확히 18문장이지만 18개의 독립 항목처럼 들리면 실패입니다. 4~8번은 작동 과정, 9~11번은 위기와 전환, 12~15번은 해결 과정이 각각 한 호흡으로 이어져야 합니다.
- 각 문장은 새로운 역할 하나만 맡습니다. 앞에서 말한 ‘잘 보인다/빠르다/회전한다/금지됐다’ 같은 핵심 결론을 말만 바꿔 반복하지 말고, 다음 문장은 원인·예외·행동·결과 중 하나로 전진합니다.
- 중간 질문은 한 문장으로 짧게 끝내고 답은 바로 다음 문장에 씁니다. 질문과 답을 한 줄에 붙이지 않습니다.
- “해결할 대상은”, “답은 분명합니다”, “결론은”, “이제 이유가 보입니다” 같은 발표문을 구체적인 주어와 행동으로 바꿉니다.
- 화자는 테니스를 잘 아는 다정한 선배입니다. 잘난 척하지 않고 눈앞의 라켓을 함께 들여다보듯 설명합니다.
- 첫 문장은 강한 훅(반전 선언이 기본, 소재에 따라 장면·기록·현상형 훅 허용), 의문문은 전체 한두 번만 궁금증이 고조된 자리에 둡니다. 17번은 훅을 회수하는 진짜 이유, 18번은 첫 대상을 다시 불러 완결감 있는 어미로 닫습니다(“~였던 것이었습니다”는 선택지). 초안의 아크가 소재와 어긋나면 훅·반전·완결의 원칙만 지키고 슬롯 배치는 자유롭게 조정합니다.
- 공백 제외 전체 650~850자를 목표로 하고, 한 문장은 대체로 18~55자로 씁니다. 그중 2~4문장은 35자 이하의 짧은 숨표로 둡니다.
- 전체 18문장 중 7~12문장은 '-습니다/-입니다'로 중심을 잡습니다. '-죠/-까요?/-나요?/-는데요'는 합쳐 2~6문장, '-거든요'는 최대 한 번입니다.
- '-아요/-어요/-해요'는 최대 세 문장이며 붙여 쓰지 않습니다. '-셈입니다', '그렇죠', 청자 호명, 물결표, 과장된 감탄은 금지합니다.
- 친근함을 어미로 만들지 않습니다. 공·줄·라켓·선수·규칙이 주어가 되어 밀리고, 돌아오고, 막고, 바꾸는 구체적인 동사로 만듭니다.
- “규제의 초점”, “검토 과정”, “영향 조사”, “결과 수집”, “배치의 차이” 같은 추상 명사 묶음은 가능한 한 쓰지 않습니다. 누가 무엇을 했는지 다시 씁니다.
- 한 명사 앞에 관형어를 연달아 겹치지 않습니다. “추가된 과장된 회전”처럼 걸리는 표현은 “회전이 더 커졌습니다”처럼 주어와 동사로 풉니다.
- 친근함을 위해 의미가 흐린 비유를 만들지 않습니다. 기관의 검토·조사는 기관이 실제로 한 행동으로 직접 씁니다.
- 앞 문장의 핵심 대상을 다음 문장이 이어받고, 필요한 자리에는 “그런데/문제는/그렇다고/그래서/덕분에/결국”을 자연스럽게 사용합니다. 전체 2~5번이면 충분합니다.

${narrationWarmWitRules(episode)}

- 사람의 항의·거부·보이콧은 원인과 주체를 함께 씁니다. 사물이나 회전이 사람의 행동을 대신한 것처럼 의인화하지 않습니다.
- 실험·시험·연구·조사를 언급하면 과정 이름만 던지지 않습니다. 같은 문장 또는 다음 1~2문장에서 확인된 결과나 그 뒤의 허용·금지·채택·규칙 변경을 말합니다. 세부 수치가 공식자료에 없으면 없다고 밝히고 검증된 결정만 연결합니다.
- 10번은 앞의 위기를 받아 짧은 감정 비트로 씁니다. 난감함·답답함·아찔함·골치 아픔 중 상황에 맞는 정서를 고르되, 문구는 매 편 새로 만들고 다른 문장에 감탄을 퍼뜨리지 않습니다.
- 낯선 장비·기술은 보이는 구조와 함께 처음 소개하고, 기관 약어는 첫 등장에만 한국어 전체 명칭을 붙입니다.
- 특정 채널의 고정 도입·위기·마무리 문구는 복제하지 않습니다. 기능만 살리고 테니스 고유의 어휘로 새로 씁니다.

18문장 기본 템플릿 (반전 다큐 아크 — 소재에 맞으면 사용, 어색하면 훅·반전·완결 원칙만 지키고 재배치):
1 강한 훅(반전 선언 기본), 2 뜻밖의 과거, 3 그 시절의 구체적 모습, 4 변화의 계기와 미스터리 예고, 5 문제의 감각적 현상, 6 사람 시점의 난감한 상황, 7 해답의 발견, 8 해답이 통하는 이유, 9 두 번째 반전(뜻밖의 장애물), 10 장애물의 아이러니 한마디, 11 의문문(최대 한두 번), 12 신중한 해소 행동, 13 연도와 함께 못 박는 전환점, 14 오해를 바로잡는 잔여 사실, 15 본질은 그대로라는 쉬운 풀이, 16 마지막 저항과 항복, 17 첫 훅을 회수하는 진짜 이유, 18 대상 재호명 + 완결감 있는 종결.

이번 슬롯 리듬 — ${rhythm.label}:
- 질문: ${rhythm.intro}
- 위기: ${rhythm.crisis}
- 전환: ${rhythm.reversal}
- 회수: ${rhythm.close}
- 위 표현은 기능만 참고하며 고정 문구를 복사하지 않습니다.

컷별 evidence:
- claim과 proof는 저장된 공식자료 팩에 대응해야 합니다.
- graphic은 후반 편집용 짧은 영어 용어 또는 숫자입니다.
- visualKo/visualEn은 해당 컷의 시작 이미지 한 장입니다. 한 장소·한 순간·한 핵심 시각 개념만 쓰고 뒤 컷 내용을 미리 넣지 않습니다.
- motionKo/motionEn은 시작 이미지에서 이어지는 물리 동작 하나와 카메라 이동 하나만 씁니다.
- cameraKo/cameraEn은 앵글과 샷 사이즈만 씁니다.
- 이미지 안의 글자는 생성하지 않고 graphic은 편집 메모로만 사용합니다.

지정된 JSON 스키마만 출력하십시오.`;
}

function narrationPolishSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["scriptLines"],
    properties: { scriptLines: { type: "array", minItems: 18, maxItems: 18, items: { type: "string" } } }
  };
}

function narrationPolishPrompt(episode, research, lines, correctionMessage = "") {
  const correction = correctionMessage ? `\n이전 낭독 편집의 검수 오류:\n${correctionMessage}\n이 오류만 정확히 고치고 사실과 순서는 유지하십시오.\n` : "";
  return `당신은 한국어 다큐멘터리 내레이션의 최종 낭독 편집자입니다. 웹 검색을 하지 않습니다. 아래 18문장을 사실·숫자·고유명사·인과 순서 그대로 유지하면서, 사람이 편안하게 설명하는 자연스러운 한국어로 마지막 한 번만 다듬으십시오.

주제: ${episode.title}

공식자료 팩:
${JSON.stringify({ facts: research.facts, factWarnings: research.factWarnings || [] }, null, 2)}

편집할 18문장:
${JSON.stringify(lines, null, 2)}
${correction}
목표 음색:
- 차분하고 신뢰감 있는 남성 다큐 해설자가 비전문가에게 친절하게 설명합니다. 전문가는 맞지만 말은 어렵게 하지 않습니다.
- 이 단계의 핵심은 어미 교체가 아니라 문장 사이의 온도와 흐름입니다. 2~3문장을 한 덩어리로 소리 내어 읽었을 때 한 사람이 계속 설명하는 것처럼 들려야 합니다.

${narrationWarmWitRules(episode)}

- 1차 대본에 들어 있는 생활 동사, 예상 반박, 건조한 감정 비트, 문제와 해법의 말맞춤을 지우지 않습니다. 추상적인 보고서 표현으로 되돌리지 않습니다.
- 사실 설명이 2~3문장 이어졌다면 짧은 숨표 한 문장으로 리듬을 환기합니다. 짧은 문장은 새 사실을 던지지 않고 앞의 결과를 인간적인 크기로 압축합니다.
- 전체 18문장 중 7~12문장은 '-습니다/-입니다'로 중심을 잡고, '-죠/-까요?/-나요?/-는데요'는 합쳐 2~6번만 씁니다. '-거든요'는 자연스러울 때 최대 한 번, '-네요'는 강제하지 않습니다.
- '-아요/-어요/-해요'는 최대 세 문장이며 서로 붙이지 않습니다. 같은 어미가 반복돼도 자연스러우면 억지로 바꾸지 않습니다.
- 각 문장의 첫머리를 공·줄·라켓·선수·ITF 같은 구체적인 주어 또는 꼭 필요한 연결어로 시작합니다. “초점/과정/영향/결과/배치” 같은 추상 명사로 문장을 열지 않습니다.
- 앞 문장의 핵심 단어를 다음 문장에서 한 번 받아 주되, 같은 사실을 다시 설명하지 않습니다. 다음 문장은 반드시 원인·예외·행동·결과 중 하나를 앞으로 보냅니다.
- 셀프 문답은 질문 한 문장, 답 한 문장으로 분리합니다. 물음표 뒤에 기관명이나 설명을 이어 붙이지 않습니다.
- “해결할 대상은”, “답은 분명합니다”, “결론은”, “이제 이유가 보입니다” 같은 편집자용 표지 문구를 모두 걷어내고 대상이 직접 움직이게 합니다.
- 원리는 눈에 보이는 동사로 풉니다. 줄은 옆으로 밀리고 돌아오며, 공은 회전하고, 선수는 불만을 말하며, 규칙은 허용할 모양을 정합니다.
- 항의·거부·보이콧에는 반드시 불만의 원인과 행동한 사람을 둡니다. “회전이 파업을 불렀다” 같은 과한 의인화는 피합니다.
- 10번은 9번의 구체적인 위기를 받아 해설자의 짧은 감정 반응으로 만듭니다. 사실은 바꾸지 말고, 해결 직전의 숨표처럼 한 번만 사용합니다. 특정 채널의 시그니처 문구는 복제하지 않습니다.
- 실험·시험·연구·조사 문장은 바로 뒤의 결과 또는 결정 문장과 한 쌍으로 유지합니다. 결과가 빠진 과정 문장을 그대로 두지 않으며, 공식자료에 없는 수치나 측정법은 보충하지 않습니다.
- 전문용어는 남기되 바로 옆에서 일상어로 풀고, 연도와 기관명은 이야기의 흐름을 멈추지 않는 위치에 둡니다. 기관 약어는 “국제테니스연맹인 ITF”처럼 자연스럽게 연결합니다.
- 한 명사 앞에 관형어를 두 겹 이상 쌓지 않습니다. 겹친 수식은 주어와 동사가 있는 쉬운 문장으로 풀어 씁니다.
- 친근하게 만들기 위한 모호한 비유는 쓰지 않습니다. 실제 행동과 의미가 바로 떠오르는 표현을 고릅니다.
- 첫 질문은 유지하고 마지막 두 문장은 그 질문에 직접 답합니다. 18번은 “처음 본 모습”처럼 화면에 기대지 말고 대상 이름과 이유를 직접 씁니다. 특정 채널의 고정 시그니처 문구는 사용하지 않습니다.
- 공백 제외 전체 길이는 650~850자입니다. 사실을 줄여 길이를 맞추지 말고, 이해에 필요한 짧은 연결과 쉬운 풀이를 보충합니다.

금지:
- 새로운 사실 추가, 사실 삭제, 수치 변경, 전문용어 의미 변경.
- '이 구조', '이 조치', '그렇게 된 것'처럼 앞 대상을 모호하게 받는 표현.
- 보고서식 나열, 지나친 감탄, 청자 호명, '-셈입니다', '그렇죠', 물결표. '-거든요'는 최대 한 번만 허용합니다.
- 16~18번에 새로운 정보를 넣는 것.

정확히 18개 문장만 JSON 스키마로 출력하십시오.`;
}

async function runCodexNarrationPolish(episode, research, lines, correctionMessage = "") {
  return runCodexStructured(narrationPolishPrompt(episode, research, lines, correctionMessage), narrationPolishSchema(), "narration-polish.schema.json", false, 150000, "낭독 문장 편집 시간이 2분 30초를 초과했습니다.");
}
async function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform !== "win32") {
    child.kill("SIGKILL");
    return;
  }
  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, shell: false });
    let done = false;
    const finishKill = () => { if (!done) { done = true; resolve(); } };
    killer.on("error", () => { try { child.kill(); } catch {} finishKill(); });
    killer.on("close", finishKill);
    setTimeout(finishKill, 5000);
  });
}

async function runCodexStructured(prompt, schema, schemaName, withSearch, timeoutMs, timeoutMessage) {
  const schemaFile = path.join(dataDir, schemaName);
  await writeJson(schemaFile, schema);
  const codexExecutable = process.platform === "win32" ? path.join(process.env.APPDATA || "", "npm", "codex.cmd") : "codex";
  const args = [
    ...(withSearch ? ["--search"] : []),
    "exec", "--ephemeral", "--sandbox", "read-only",
    "--skip-git-repo-check", "--color", "never",
    "-c", 'model_reasoning_effort="medium"',
    "--output-schema", schemaFile, "-"
  ];
  return await new Promise((resolve) => {
    const child = spawn(codexExecutable, args, { cwd: projectRoot, windowsHide: true, shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(async () => {
      await terminateProcessTree(child);
      finish({ ok: false, error: timeoutMessage, stdout, stderr });
    }, timeoutMs);
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    child.on("error", (error) => finish({ ok: false, error: error.message, stdout, stderr }));
    child.on("close", (code) => {
      const value = extractLastJsonObject(stdout);
      finish({ ok: code === 0 && Boolean(value), code, value, stdout, stderr, error: value ? "" : "구조화된 응답을 읽지 못했습니다." });
    });
    child.stdin.end(prompt, "utf8");
  });
}

async function runCodexOfficialResearch(episode) {
  return runCodexStructured(officialResearchPrompt(episode), officialResearchSchema(), "official-research.schema.json", true, 480000, "공식자료 조사 시간이 8분을 초과했습니다. 남은 검색 프로세스는 모두 정리했습니다.");
}

async function runCodexScriptRewrite(episode, research, draftLines, selectedRhythm = "auto", correctionMessage = "") {
  return runCodexStructured(scriptRewritePrompt(episode, research, draftLines, selectedRhythm, correctionMessage), scriptRewriteSchema(), "script-rewrite.schema.json", false, 180000, "문장 다듬기 시간이 3분을 초과했습니다.");
}

async function runCodexVisualPlan(episode, officialResearch, visualResearch, lines, evidence) {
  return runCodexStructured(visualPlanPrompt(episode, officialResearch, visualResearch, lines, evidence), visualPlanSchema(), "visual-plan.schema.json", false, 210000, "18컷 시각 설계 시간이 3분 30초를 초과했습니다.");
}

function validateOfficialResearch(value, episodeId) {
  const sources = Array.isArray(value?.sources) ? value.sources.filter((source) => /^https?:\/\//.test(String(source?.url || ""))) : [];
  const facts = Array.isArray(value?.facts) ? value.facts.filter((fact) => String(fact?.fact || "").trim() && String(fact?.proof || "").trim()) : [];
  if (sources.length < 2) throw new Error("검증 가능한 공식·1차 출처가 2개 미만입니다.");
  if (facts.length < 8) throw new Error("재사용 가능한 핵심 사실이 8개 미만입니다.");
  return {
    episodeId,
    completedAt: new Date().toISOString(),
    provider: "codex-search",
    facts,
    sources,
    factWarnings: Array.isArray(value.factWarnings) ? value.factWarnings.map(String) : [],
    migratedFromScript: false
  };
}
function repairGeneratedScriptContinuity(value) {
  const lines = Array.isArray(value?.scriptLines) ? value.scriptLines.map((line) => String(line).trim()) : [];
  const evidence = Array.isArray(value?.evidence) ? value.evidence.map((item) => ({ ...item })) : [];
  const reaction = lines[8] || "";
  const hasReaction = /(항의|반발|경기 거부|보이콧|파업|퇴장)/.test(reaction);
  const hasCausalBridge = /(이 때문에|그 결과|이에|때문|탓|늘자|커지자|생기자|불만|문제가 되자|이어져)/.test(reaction);
  if (lines.length === 18 && hasReaction && !hasCausalBridge) {
    lines[8] = `그 결과, ${reaction.replace(/^(그러나|하지만|그런데)\s*,?\s*/, "")}`;
    if (evidence[8]) evidence[8].claim = lines[8];
  }
  return { ...value, scriptLines: lines, evidence };
}

function validateGeneratedScript(value, episode = null) {
  const lines = Array.isArray(value?.scriptLines) ? value.scriptLines.map((line) => String(line).trim()) : [];
  if (lines.length !== 18 || lines.some((line) => !line)) throw new Error("AI가 정확히 18문장을 반환하지 않았습니다.");
  if (lines.some((line) => /\[[^\]]+\]/.test(line))) throw new Error("AI 대본에 미완성 괄호형 문구가 남았습니다.");
  if (lines.some((line) => /(셈입니다|그렇죠|여러분|구독자|~)/.test(line))) throw new Error("AI 대본이 금지된 말투 규칙을 통과하지 못했습니다.");
  const fullText = lines.join(" ");
  if (/(여기 .+가 있습니다|환장할 노릇|그래서 발상을 뒤집습니다|이렇게 탄생한 겁니다)/.test(fullText)) throw new Error("참고 채널의 고정 시그니처 문구를 복제했습니다. 같은 기능을 이번 테니스 소재의 말로 새로 쓰세요.");
  if (/\bITF\b/.test(fullText) && !/국제\s*테니스\s*연맹(?:인|,)?\s*(?:\(\s*)?ITF(?:\s*\))?/.test(fullText)) throw new Error("ITF가 처음 등장할 때 ‘국제테니스연맹’이라는 전체 명칭을 함께 설명해야 합니다.");
  if (/국제\s*테니스\s*연맹\s*,\s*ITF/.test(fullText)) throw new Error("‘국제테니스연맹, ITF’는 번역투로 들립니다. ‘국제테니스연맹인 ITF’처럼 조사로 자연스럽게 연결하세요.");
  if (lines.some((line) => /\S+(?:된|한|로운|적인)\s+\S+(?:된|한|로운|적인)\s+\S+/.test(line))) throw new Error("한 명사 앞에 수식어가 겹쳐 낭독이 걸립니다. 두 정보를 주어와 동사로 풀어 자연스럽게 다시 쓰세요.");
  const reactionLine = lines[8] || "";
  if (/(항의|반발|경기 거부|보이콧|파업|퇴장)/.test(reactionLine) && !/(이 때문에|그 결과|이에|때문|탓|늘자|커지자|생기자|불만|문제가 되자|이어져)/.test(reactionLine)) throw new Error("9번 반응 문장에 항의·거부가 발생한 직접 원인을 함께 연결해야 합니다.");
  const emotionLine = lines[9] || "";
  const seriousSubject = /(사망|죽음|숨졌|참사|비극|중상|부상|사고|재난|질병|학대|폭력|실종|추모)/.test(`${episode?.title || ""} ${episode?.summary || ""} ${episode?.hook || ""}`);
  const emotionIsTechnicalOnly = /(?:규칙|규정|수치|연도|실험|연구|조사|정의|제한)(?:은|는|이|가)/.test(emotionLine) && !/(꽤|제법|생각보다|이쯤|일이|난처|골치|답답|아찔|버겁|쉽지 않|말썽|커졌|시끄럽|감당|곤란|황당|막막|웃을|기막|어이|만만)/.test(emotionLine);
  if (!seriousSubject && (emotionIsTechnicalOnly || emotionLine.length > 55)) throw new Error("10번은 기술 설명이 아니라 앞의 위기를 인간적인 크기로 압축한 짧고 건조한 반응이어야 합니다. 정해진 감정 단어를 억지로 넣지는 마세요.");
  if (!/[?？]$/.test(lines[0])) throw new Error("첫 문장은 핵심 궁금증을 담은 의문문이어야 합니다.");
  if (lines.some((line) => /[?？]\s+\S/.test(line))) throw new Error("셀프 문답의 질문과 답이 한 문장에 붙어 있습니다. 질문은 물음표로 끝내고 답은 다음 문장으로 분리하세요.");
  if (lines.some((line) => /^(해결할 대상은|답은 분명합니다|결론은|이제 .*이유)/.test(line))) throw new Error("보고서식 정리 문구가 흐름을 끊습니다. 공·라켓·선수·규칙 같은 구체적인 주어가 직접 행동하도록 바꾸세요.");
  if (/[?？]$/.test(lines[17])) throw new Error("마지막 문장은 질문이 아니라 첫 질문에 대한 정리여야 합니다.");
  if (!/[.!]$/.test(lines[17])) throw new Error("마지막 문장은 질문이 아닌 완결된 평서문으로 첫 질문에 답해야 합니다.");
  const extraQuestions = lines.slice(1).filter((line) => /[?？]$/.test(line)).length;
  if (extraQuestions > 2) throw new Error("중간 셀프 문답이 반복됩니다. 첫 질문 이후의 추가 질문은 최대 두 번이며 서로 다른 의문만 다뤄야 합니다.");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const mentionsStudy = /(실험|시험|연구|조사)(?:을|를|가|는|에서|부터|했다|했습니다|했어요|거쳤|진행|실시|살폈|확인)/.test(line);
    if (!mentionsStudy) continue;
    const resultWindow = lines.slice(index, Math.min(lines.length, index + 3)).join(" ");
    if (!/(결과|확인됐|확인했|드러났|나타났|허용|금지|채택|도입|변경|바뀌|통과|판정|결정|더 잘|높아졌|낮아졌|빨라졌|느려졌|늘었|줄었)/.test(resultWindow)) {
      throw new Error(`${index + 1}번에서 실험·시험·연구 과정을 언급했지만 확인된 결과나 그 뒤의 결정이 없습니다. 다음 1~2문장 안에 공식자료로 검증된 결과를 연결하세요.`);
    }
  }
  const conversationalCount = lines.filter((line) => /(까요|나요|죠|네요|는데요)[.!?？]?$/.test(line)).length;
  if (conversationalCount < 2 || conversationalCount > 6) throw new Error("친근한 어미는 질문·전환·쉬운 풀이에 2~6번만 자연스럽게 사용해야 합니다.");
  const geodeunyoCount = lines.filter((line) => /거든요[.!?？]?$/.test(line)).length;
  if (geodeunyoCount > 1) throw new Error("'-거든요'가 반복됩니다. 꼭 필요한 한 문장에만 사용하세요.");
  const formalCount = lines.filter((line) => /(습니다|입니다)[.]?$/.test(line)).length;
  if (formalCount < 7 || formalCount > 12) throw new Error("차분함과 친근함의 균형을 위해 '-습니다/-입니다' 문장은 7~12개여야 합니다.");
  const plainHaeyoCount = lines.filter((line) => /(아요|어요|해요|돼요|이에요|예요)[.!?？]?$/.test(line)).length;
  if (plainHaeyoCount > 3) throw new Error("'-아요/-어요'가 반복되어 설명이 가벼워집니다. 최대 세 문장에만 사용하세요.");
  if (/(그렇게|이렇게) (만들어진|정해진|된) (거네요|것이네요|겁니다)[.!]?$/.test(lines[17])) throw new Error("마지막 문장이 모호합니다. 첫 질문의 구체적인 대상을 다시 써서 직접 답하세요.");
  if (/(처음(?:에)?\s*(?:본|바라본)|앞에서 본|바로 그|그런 모습|그 모습)/.test(lines[17])) throw new Error("마지막 문장이 화면 지시나 모호한 대명사에 기대고 있습니다. 대상 이름과 결론을 직접 쓰세요.");
  for (let index = 1; index < lines.length; index += 1) {
    const previousProper = lines[index - 1].match(/^([A-Z]{2,})(?:은|는|이|가)?\s/);
    const currentProper = lines[index].match(/^([A-Z]{2,})(?:은|는|이|가)?\s/);
    if (previousProper && currentProper && previousProper[1] === currentProper[1]) throw new Error("같은 기관명으로 두 문장이 연속 시작됩니다. 두 번째 문장을 자연스러운 연결어로 이어 주세요.");
  }
  let formalStreak = 0;
  for (const line of lines) {
    formalStreak = /(습니다|입니다)[.]?$/.test(line) ? formalStreak + 1 : 0;
    if (formalStreak >= 5) throw new Error("'-습니다/-입니다'가 다섯 문장 연속 이어집니다. 말투 리듬을 부드럽게 조정하세요.");
  }
  if (lines.some((line) => line.length < 10 || line.length > 70)) throw new Error("한 호흡에 맞지 않는 지나치게 짧거나 긴 문장이 있습니다.");
  const shortBeatCount = lines.filter((line) => line.length <= 35).length;
  if (shortBeatCount < 2) throw new Error("모든 문장이 비슷하게 길어 낭독 리듬이 평평합니다. 사실은 유지하고 2~4문장을 35자 이하의 짧은 숨표로 정리하세요.");
  const abstractOpeningCount = lines.filter((line) => /^(문제|해법|조치|과정|영향|결과|기준|배치|구조|상황)(?:은|는|이|가|을|를)/.test(line)).length;
  if (abstractOpeningCount > 3) throw new Error("추상 명사로 시작하는 문장이 반복됩니다. 공·줄·라켓·선수처럼 보이는 주어와 구체적인 동사로 바꾸세요.");
  const narrationLength = lines.join("").length;
  if (narrationLength < 650 || narrationLength > 850) throw new Error(`자연스러운 80~90초 호흡을 위해 대본은 공백 제외 650~850자가 필요합니다. 현재 ${narrationLength}자입니다.`);
  const evidence = Array.isArray(value?.evidence) ? value.evidence : [];
  if (evidence.length !== 18) throw new Error("컷별 근거가 18개가 아닙니다.");
  if (evidence.some((item) => ["visualKo", "visualEn", "motionKo", "motionEn", "cameraKo", "cameraEn"].some((key) => !String(item?.[key] || "").trim()))) throw new Error("컷별 이미지·영상 장면 설계가 비어 있습니다.");
  const sources = Array.isArray(value?.sources) ? value.sources.filter((source) => /^https?:\/\//.test(String(source?.url || ""))) : [];
  if (sources.length < 2) throw new Error("검증 가능한 출처가 2개 미만입니다.");
  return { lines, evidence, sources, factWarnings: Array.isArray(value.factWarnings) ? value.factWarnings.map(String) : [] };
}
async function probeDuration(file) {
  const result = await runCommand("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file
  ]);
  return result.ok ? Number(Number(result.stdout.trim()).toFixed(2)) : null;
}

async function validationReport(sourceShots, state, project) {
  const required = [
    ["마스터 프롬프트 패키지", promptPackage],
    ["출력 폴더", outputDir]
  ];
  const checks = [];
  for (const [label, file] of required) {
    checks.push({ label, ok: await fs.access(file).then(() => true).catch(() => false), detail: path.relative(projectRoot, file) });
  }
  const referenceStatus = await referenceLibraryStatus();
  const referenceLabels = { shape: "형태 레퍼런스", character: "테돌이 레퍼런스", brand: "테니스노트 브랜드" };
  referenceStatus.groups.forEach((group) => checks.push({ label: referenceLabels[group.group], ok: group.ready, detail: group.available + "/" + group.total + "개 준비" }));
  checks.push({ label: "18컷 프로젝트", ok: project.shots.length === 18, detail: `${project.shots.length}개 감지 · ${project.title}` });
  checks.push({ label: "대본 준비 상태", ok: project.readyForProduction, detail: project.readyForProduction ? "18문장 제작 가능" : "구조 초안의 빈칸을 완성하세요." });
  const ffprobe = await runCommand("ffprobe", ["-version"]);
  checks.push({ label: "FFprobe", ok: ffprobe.ok, detail: ffprobe.ok ? "사용 가능" : "설치 필요" });
  const preferredVoice = typecastOutputPath(state);
  const legacyVoice = state.planning.activeEpisodeId === legacyEpisodeId
    ? path.join(outputDir, "audio", "typecast", "piljae_narration_fast_1.15x_tight.wav")
    : null;
  const voice = await fs.access(preferredVoice).then(() => preferredVoice).catch(async () =>
    legacyVoice ? await fs.access(legacyVoice).then(() => legacyVoice).catch(() => null) : null);
  const voiceDuration = voice ? await probeDuration(voice) : null;
  checks.push({
    label: `${project.targetDuration}초 내레이션`,
    ok: voiceDuration !== null && Math.abs(voiceDuration - project.targetDuration) <= 3,
    detail: voiceDuration === null ? "새 내레이션 필요" : `${voiceDuration}초 · ${Math.abs(voiceDuration - project.targetDuration) <= 3 ? "사용 가능" : "길이 재검토"}`
  });
  return checks;
}

function generationCost(shot, settings) {
  const duration = Number(shot.duration || 5);
  if (shot.provider === "higgsfield") {
    if (Number(settings.higgsfieldCostPerGeneration) > 0) return Number(settings.higgsfieldCostPerGeneration);
    const base = Number(creditSamples.higgsfield.models[shot.model]?.credits || 0);
    return base * Math.max(1, Math.ceil(duration / 5));
  }
  const sample = creditSamples.flow.models[shot.model] || creditSamples.flow.models["veo-3.1-fast"];
  if (sample.creditsByDuration) {
    if (duration <= 4) return sample.creditsByDuration["4"];
    if (duration <= 6) return sample.creditsByDuration["6"];
    if (duration <= 8) return sample.creditsByDuration["8"];
    return sample.creditsByDuration["10"];
  }
  return Number(sample.credits || 0);
}

async function buildJobPlan(state, sourceShots, project) {
  const jobs = sourceShots.map((source) => {
    const shot = state.shots.find((item) => item.index === source.index);
    const usesKeyframe = shot.generationMode === "keyframe";
    const keyframeReady = !usesKeyframe || (source.generation.exists && source.generation.approved);
    return {
      id: `${project.episodeId}-C${String(source.index).padStart(2, "0")}`,
      cut: source.index,
      time: source.time,
      durationSeconds: source.duration,
      provider: shot.provider,
      model: shot.model,
      generationMode: usesKeyframe ? "keyframe-to-video" : "direct-video",
      variants: state.settings.variants,
      inputFrame: usesKeyframe ? source.generation.expectedFile : null,
      inputFrameRequired: usesKeyframe,
      inputFrameApproved: usesKeyframe ? keyframeReady : null,
      outputFile: `output/episodes/${episodeFolderName(project.episodeId)}/clips/c${String(source.index).padStart(2, "0")}_silent.mp4`,
      silent: state.settings.silentGeneration,
      promptLanguage: state.settings.language,
      prompt: shot.provider === "flow"
        ? (state.settings.language === "ko" ? source.flowPrompts.video.ko : source.flowPrompts.video.en)
        : (state.settings.language === "ko" ? source.videoPromptKo : source.videoPromptEn),
      promptKo: shot.provider === "flow" ? source.flowPrompts.video.ko : source.videoPromptKo,
      promptEn: shot.provider === "flow" ? source.flowPrompts.video.en : source.videoPromptEn,
      flowPrompt: source.flowPrompts,
      referenceImages: [...new Set([...source.referenceBundle.requiredShapeReferences, ...(source.referenceBundle.topicReferences || [])])],
      priorityReferenceImages: [...new Set([...source.referenceBundle.priorityShapeReferences, ...(source.referenceBundle.topicReferences || [])])],
      topicReferenceImages: source.referenceBundle.topicReferences || [],
      conditionalCharacterReferences: source.referenceBundle.characterReferences,
      conditionalBrandReferences: source.referenceBundle.brandReferences,
      useTedori: source.referenceBundle.useTedori,
      useTennisnoteBrand: source.referenceBundle.useTennisnoteBrand,
      referencePolicy: source.referenceBundle.policy,
      referenceUploadGuide: shot.provider === "flow"
        ? "키프레임과 우선 형태 레퍼런스를 Flow ingredients/reference inputs에 첨부합니다."
        : "키프레임과 우선 형태 레퍼런스를 Higgsfield reference inputs에 첨부합니다.",
      estimatedCredits: generationCost({ ...shot, duration: source.duration }, state.settings) * state.settings.variants,
      creditEstimateBasis: shot.provider === "flow" ? creditSamples.flow.basis : creditSamples.higgsfield.basis,
      readyForExternalGeneration: keyframeReady,
      blockedReason: keyframeReady ? null : "승인된 키프레임 이미지가 필요합니다.",
      requiresExternalGeneration: true
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    episodeId: project.episodeId,
    title: project.title,
    targetDurationSeconds: project.targetDuration,
    aspectRatio: "9:16",
    note: "자격증명은 포함되지 않습니다. 바로 영상 컷은 즉시 실행할 수 있고, 키프레임→영상 컷은 승인된 시작 이미지가 있어야 실행할 수 있습니다.",
    jobs
  };
}

function buildFlowPromptPackage(project, state) {
  const shots = project.shots.map((source) => {
    const shot = state.shots.find((item) => item.index === source.index);
    return {
      cut: source.index,
      time: source.time,
      narration: source.narration,
      selectedForFlow: shot?.provider === "flow",
      model: shot?.provider === "flow" ? shot.model : "veo-3.1-fast",
      generationMode: shot?.generationMode || "keyframe",
      recommendedDurationSeconds: source.flowPrompts.recommendedDurationSeconds,
      recommendedPromptLanguage: source.flowPrompts.recommendedLanguage,
      referenceFiles: source.flowPrompts.referenceFiles,
      visualDesign: source.flowPrompts.visualDesign,
      imagePromptKo: source.flowPrompts.image.ko,
      imagePromptEn: source.flowPrompts.image.en,
      videoPromptKo: source.flowPrompts.video.ko,
      videoPromptEn: source.flowPrompts.video.en
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    episodeId: project.episodeId,
    title: project.title,
    targetDurationSeconds: project.targetDuration,
    aspectRatio: "9:16",
    destination: "Google Flow web studio",
    note: "Flow 웹 입력용 프롬프트 패키지입니다. API 키와 로그인 정보는 포함하지 않습니다.",
    workflow: ["IMAGE: Ingredients 첨부 후 이미지 프롬프트 입력", "VIDEO: 승인 이미지를 시작 프레임에 첨부", "MOTION: 영상 프롬프트 입력 후 무음으로 사용"],
    shots
  };
}

function flowPromptMarkdown(promptPack) {
  const sections = promptPack.shots.map((shot) => `## CUT ${String(shot.cut).padStart(2, "0")} · ${shot.time}\n\n**Narration**\n\n${shot.narration}\n\n**Flow reference inputs**\n\n${shot.referenceFiles.length ? shot.referenceFiles.map((file) => `- ${file}`).join("\n") : "- None"}\n\n### Image prompt · English recommended\n\n\`\`\`text\n${shot.imagePromptEn}\n\`\`\`\n\n### Video prompt · English recommended\n\n\`\`\`text\n${shot.videoPromptEn}\n\`\`\`\n\n### 한국어 참고 프롬프트\n\n\`\`\`text\n${shot.imagePromptKo}\n\n--- VIDEO ---\n\n${shot.videoPromptKo}\n\`\`\``);
  return `# ${promptPack.title} · Google Flow prompt package\n\n- Aspect ratio: ${promptPack.aspectRatio}\n- Target duration: ${promptPack.targetDurationSeconds}s\n- Generated: ${promptPack.generatedAt}\n\n${sections.join("\n\n---\n\n")}\n`;
}

async function updateStage(state, id, patch) {
  const stage = state.stages.find((item) => item.id === id);
  if (stage) Object.assign(stage, patch);
  state.updatedAt = new Date().toISOString();
  await writeJson(stateFile, state);
}

async function runStage(id) {
  const { state, sourceShots: legacyShots } = await loadState();
  const project = await loadActiveProject(state, legacyShots);
  const sourceShots = project.shots;
  if (!stageIds.includes(id)) throw new Error("알 수 없는 단계입니다.");
  const projectDir = episodeProjectDir(project.episodeId);
  await fs.mkdir(projectDir, { recursive: true });
  if (id === "brief") {
    const artifactFile = path.join(projectDir, "research_brief.json");
    await writeJson(artifactFile, {
      generatedAt: new Date().toISOString(), episode: project.episode,
      researchStatus: project.episode.verification,
      sourcePlan: project.episode.sourceHint,
      scriptDNA: "SCRIPT DNA V3.2 · QUESTION → CAUSE → ANSWER · one evidence per cut",
      nextAction: project.episode.verification === "verified" ? "대본 작성" : "공식·1차 자료 팩트 검증"
    });
    const needsReview = project.episode.verification !== "verified";
    await updateStage(state, id, { status: needsReview ? "ready_review" : "complete", note: needsReview ? "리서치 브리프 생성 · 팩트 승인 필요" : "검증 자료 브리프 완료" });
    return { state, message: "현재 주제의 리서치 브리프를 만들었습니다.", artifact: path.relative(projectRoot, artifactFile).replaceAll("\\", "/") };
  }
  if (id === "shots") {
    if (!project.readyForProduction) {
      await updateStage(state, id, { status: "blocked", note: "18문장 대본의 빈칸을 먼저 완성하세요." });
      return { state, message: "대본 작성 패널에서 18문장을 완성해야 컷 프롬프트를 확정할 수 있습니다." };
    }
    const artifactFile = path.join(projectDir, "shot_plan.json");
    await writeJson(artifactFile, { generatedAt: new Date().toISOString(), episodeId: project.episodeId, title: project.title, shots: project.shots });
    await updateStage(state, id, { status: "ready_review", note: "18컷 프롬프트 생성 · 승인 필요" });
    return { state, message: "18컷 프롬프트를 만들었습니다.", artifact: path.relative(projectRoot, artifactFile).replaceAll("\\", "/") };
  }
  if (!project.readyForProduction && ["keyframes", "video", "voice", "edit", "qa"].includes(id)) {
    await updateStage(state, id, { status: "blocked", note: "대본과 컷 설계를 먼저 완료하세요." });
    return { state, message: "대본과 컷 설계가 완료되지 않아 이 단계를 실행할 수 없습니다." };
  }
  if (id === "keyframes") {
    const voiceFile = typecastOutputPath(state);
    const voiceDuration = await fs.access(voiceFile).then(() => probeDuration(voiceFile)).catch(() => null);
    const voicePending = voiceDuration === null;
    const queue = sourceShots.map((shot) => ({
      cut: shot.index, time: shot.time, narration: shot.narration,
      provider: shot.generation.imageProvider,
      model: shot.generation.imageModel,
      status: shot.generation.keyframeStatus,
      approved: shot.generation.approved,
      outputFile: shot.generation.expectedFile,
      referenceImages: [...new Set([...shot.referenceBundle.requiredShapeReferences, ...(shot.referenceBundle.topicReferences || [])])],
      priorityReferenceImages: [...new Set([...shot.referenceBundle.priorityShapeReferences, ...(shot.referenceBundle.topicReferences || [])])],
      topicReferenceImages: shot.referenceBundle.topicReferences || [],
      conditionalCharacterReferences: shot.referenceBundle.characterReferences,
      conditionalBrandReferences: shot.referenceBundle.brandReferences,
      useTedori: shot.referenceBundle.useTedori,
      useTennisnoteBrand: shot.referenceBundle.useTennisnoteBrand,
      characterPolicy: "Tedori only when narratively required; otherwise no mascot character",
      brandPolicy: "Tennisnote logo/icon only when signage or branding is required; no invented brands",
      referencePolicy: shot.referenceBundle.policy,
      promptLanguage: state.settings.language,
      prompt: state.settings.language === "ko" ? shot.imagePromptKo : shot.imagePromptEn,
      promptKo: shot.imagePromptKo,
      promptEn: shot.imagePromptEn
    }));
    const artifactFile = path.join(projectDir, "storyboard_queue.json");
    const approved = queue.filter((item) => item.approved).length;
    await writeJson(artifactFile, { generatedAt: new Date().toISOString(), episodeId: project.episodeId, imageCreditBasis: imageCreditSamples.basis, purpose: "all-cut first-frame storyboard", queue });
    const sheets = await generateStoryboardSheets(project);
    const generated = project.shots.filter((shot) => shot.generation.exists).length;
    const status = approved === queue.length ? "complete" : generated > 0 ? "ready_review" : "waiting_external";
    const note = `${voicePending ? "더빙 미확정 · " : ""}${generated}/${queue.length}개 실제 이미지 · ${approved}개 승인 · 검토 시트 2장`;
    await updateStage(state, id, { status, note });
    const message = voicePending
      ? `${queue.length}개 시작 이미지 프롬프트와 스토리보드 시트 2장을 만들었습니다. 실제 생성 전 Typecast 더빙을 확정하세요.`
      : `${queue.length}개 시작 이미지 프롬프트와 스토리보드 시트 2장을 만들었습니다.`;
    return { state, sheets, message, artifact: path.relative(projectRoot, artifactFile).replaceAll("\\", "/") };
  }
  if (id === "video") {
    const plan = await buildJobPlan(state, sourceShots, project);
    const artifactFile = path.join(projectDir, "video_generation_queue.json");
    await writeJson(artifactFile, plan);
    const ready = plan.jobs.filter((job) => job.readyForExternalGeneration).length;
    const generatedFlags = await Promise.all(plan.jobs.map((job) => fs.access(within(projectRoot, job.outputFile)).then(() => true).catch(() => false)));
    const generated = generatedFlags.filter(Boolean).length;
    const externalFlow = plan.jobs.filter((job) => job.provider === "flow").length;
    await updateStage(state, id, {
      status: generated > 0 ? "ready_review" : "waiting_external",
      note: `${generated}/${plan.jobs.length}개 실제 영상 · Flow 수동 ${externalFlow}개 · 실행 가능 ${ready}개`
    });
    return { state, message: generated > 0 ? `Higgsfield 실제 영상 ${generated}개와 전체 영상 대기열을 확인했습니다.` : `영상 프롬프트 ${plan.jobs.length}개를 만들었습니다. Flow 컷은 웹에서 수동 실행해야 합니다.`, artifact: path.relative(projectRoot, artifactFile).replaceAll("\\", "/") };
  }
  if (id === "voice") {
    const voice = typecastOutputPath(state);
    const duration = await fs.access(voice).then(() => probeDuration(voice)).catch(() => null);
    const ok = duration !== null && Math.abs(duration - project.targetDuration) <= 3;
    await updateStage(state, id, { status: ok ? "complete" : "blocked", note: duration === null ? "현재 주제의 Typecast 더빙 파일이 없습니다." : `현재 파일 ${duration}초 · 목표 ${project.targetDuration}초` });
    return { state, message: ok ? "내레이션 길이를 확인했습니다." : "현재 주제의 새 내레이션이 필요합니다." };
  }
  if (id === "edit") {
    const clipsDir = path.join(projectDir, "clips");
    const files = await fs.readdir(clipsDir).catch(() => []);
    const clips = files.filter((name) => /^c\d{2}.*\.mp4$/i.test(name));
    const ok = clips.length >= project.shots.length;
    await updateStage(state, id, { status: ok ? "ready_review" : "blocked", note: ok ? `${clips.length}개 클립 확인 · 편집 승인 대기` : `${clips.length}/${project.shots.length} 클립만 확인` });
    return { state, message: ok ? "편집 입력을 확인했습니다." : "생성 클립이 모두 필요합니다." };
  }
  const finalFile = path.join(projectDir, "final", "master.mp4");
  const duration = await fs.access(finalFile).then(() => probeDuration(finalFile)).catch(() => null);
  const ok = duration !== null && Math.abs(duration - project.targetDuration) <= 2;
  await updateStage(state, id, { status: ok ? "complete" : "blocked", note: duration === null ? "최종본이 없습니다." : `최종본 ${duration}초` });
  return { state, message: ok ? "최종본 기본 검사를 통과했습니다." : "검수할 최종본이 준비되지 않았습니다." };
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 18_000_000) throw new Error("요청이 너무 큽니다.");
  }
  return raw ? JSON.parse(raw) : {};
}

function isLoopbackHostname(value) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(String(value || "").toLowerCase());
}

function allowedLocalMutation(req) {
  try {
    const hostUrl = new URL(`http://${req.headers.host || ""}`);
    if (!isLoopbackHostname(hostUrl.hostname) || Number(hostUrl.port || 80) !== requestedPort) return false;
    const origin = String(req.headers.origin || "");
    if (origin) {
      const originUrl = new URL(origin);
      if (!isLoopbackHostname(originUrl.hostname) || Number(originUrl.port || 80) !== requestedPort) return false;
    }
    if (String(req.headers["sec-fetch-site"] || "").toLowerCase() === "cross-site") return false;
    return true;
  } catch { return false; }
}

// ---- Local ComfyUI generation (z-image FullHD stills + MiniMax H3 HD clips) ----
const comfyBase = "http://127.0.0.1:8188";
const comfyInputDir = "C:/Users/joker/AppData/Local/Comfy-Desktop/ComfyUI-Shared/input";
const comfyOutputDir = "C:/Users/joker/AppData/Local/Comfy-Desktop/ComfyUI-Shared/output";
const comfyJobs = { queue: [], running: null, results: {} };

function comfyResult(cut) {
  if (!comfyJobs.results[cut]) comfyJobs.results[cut] = { image: { status: "idle" }, video: { status: "idle" } };
  return comfyJobs.results[cut];
}

async function comfyHttp(pathname, payload, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(comfyBase + pathname, {
      method: payload === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`ComfyUI ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function comfyH3Length(durationSec) {
  const frames = Math.ceil(Number(durationSec || 5) * 24);
  const k = Math.max(0, Math.ceil((frames - 5) / 17));
  return 5 + 17 * k;
}

async function comfyLoadDesignCut(episodeId, cut) {
  const design = await readJson(path.join(episodeProjectDir(episodeId), "scene_design.json"), null);
  const item = design?.cuts?.find((entry) => Number(entry.cut) === Number(cut));
  if (!item) throw new Error(`씬 설계표에 CUT ${cut}가 없습니다.`);
  return item;
}

async function comfyStageReferences(item, context) {
  const nodes = {};
  const links = [];
  const topicFiles = (context && context.imageFiles ? context.imageFiles : []).map((file) => path.isAbsolute(file) ? file : within(projectRoot, file));
  const designFiles = (item.references || []).map((file) => within(projectRoot, path.join("reference", path.basename(file))));
  const files = [...designFiles, ...topicFiles].slice(0, 3);
  for (let i = 0; i < files.length; i += 1) {
    const source = files[i];
    const staged = `ftn_ref_${path.basename(files[i])}`;
    try {
      await fs.copyFile(source, path.join(comfyInputDir, staged));
      const id = `ref${i + 1}`;
      nodes[id] = { class_type: "LoadImage", inputs: { image: staged } };
      links.push([`image${i + 1}`, id]);
    } catch { /* missing reference file: skip */ }
  }
  return { nodes, links };
}

async function sdResearchContext(episodeId) {
  const research = await loadVisualReferenceResearch(episodeId);
  if (!visualReferenceSummary(research).complete) return { anchorKo: "", avoidKo: "", imageFiles: [] };
  const inv = (research.geometry?.invariantsKo || []).slice(0, 4).join(" ");
  const anchorKo = [research.promptAnchorKo || "", inv].filter(Boolean).join(" ");
  const avoidKo = (research.geometry?.commonErrorsKo || []).slice(0, 4).join(" ");
  const imageFiles = selectedVisualReferenceFiles(research);
  return { anchorKo, avoidKo, imageFiles };
}

function comfyImagePromptText(item, context) {
  const parts = [
    item.staging,
    `카메라: ${item.cameraAngle}, ${item.shotSize}, ${item.lens}.`,
    `조명과 톤: ${item.tone}.`,
    item.inSceneText
      ? `장면 안 텍스트: ${item.inSceneText} — 이 글자만 정확한 철자로 장면의 사물에 새겨지듯 선명하게 렌더링하고, 그 외 어떤 글자·숫자도 만들지 않습니다.`
      : "글자·숫자·자막·로고를 일절 생성하지 않습니다.",
    "첨부된 레퍼런스 이미지의 테니스공 솔기 형태, 코트 라인 규격, 네트 구조를 정확히 따릅니다.",
    context && context.anchorKo ? `주제 조사 형태 기준: ${context.anchorKo}` : "",
    context && context.avoidKo ? `조사로 확인된 금지 형태: ${context.avoidKo}` : "",
    "포토리얼 아키텍처 시각화 3D 렌더, 신비한 건축사전 스타일의 설명형 장면, 세로 9:16, 사람 없음, 워터마크 없음."
  ];
  return parts.filter(Boolean).join(" ");
}

function comfyVideoPromptText(item, context) {
  return [
    `피사체 움직임: ${item.subjectMotion}.`,
    `카메라 모션: ${item.cameraMove}. 카메라는 마지막 프레임까지 멈추지 않습니다.`,
    item.inSceneText ? `장면 속 글자(${item.inSceneText})는 형태를 유지하며 뭉개지지 않습니다.` : "글자를 새로 만들지 않습니다.",
    context && context.avoidKo ? `형태 유지 — 조사로 확인된 금지 형태: ${context.avoidKo}` : "",
    "한 장소의 연속 숏, 컷 없음, 무음, 모핑 금지, 스케일 드리프트 금지."
  ].filter(Boolean).join(" ");
}

async function comfyRunAndWait(workflow, timeoutMs) {
  const submitted = await comfyHttp("/prompt", { prompt: workflow }, 120000);
  const promptId = submitted.prompt_id;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    let history = null;
    try { history = await comfyHttp(`/history/${promptId}`, undefined, 30000); } catch { continue; }
    const entry = history?.[promptId];
    if (!entry) continue;
    if (entry.status?.status_str === "error") throw new Error("ComfyUI 워크플로 오류");
    if (entry.outputs && Object.keys(entry.outputs).length) return entry;
  }
  throw new Error("ComfyUI 생성 시간 초과");
}

async function comfyNewestOutput(prefix, extensions) {
  const entries = await fs.readdir(comfyOutputDir, { recursive: true }).catch(() => []);
  const matches = entries.filter((name) => {
    const base = path.basename(String(name));
    return base.startsWith(prefix) && extensions.includes(path.extname(base).slice(1).toLowerCase());
  }).map((name) => path.join(comfyOutputDir, String(name)));
  if (!matches.length) return null;
  const stats = await Promise.all(matches.map(async (file) => ({ file, mtime: (await fs.stat(file)).mtimeMs })));
  stats.sort((a, b) => b.mtime - a.mtime);
  return stats[0].file;
}

function comfyStillPath(episodeId, cut) {
  return path.join(episodeProjectDir(episodeId), "mg", "stills", `c${String(cut).padStart(2, "0")}.png`);
}
function comfyClipPath(episodeId, cut) {
  return path.join(episodeProjectDir(episodeId), "mg", "clips", `c${String(cut).padStart(2, "0")}_silent.mp4`);
}

async function comfyGenerateImage(episodeId, cut) {
  const item = await comfyLoadDesignCut(episodeId, cut);
  const context = await sdResearchContext(episodeId);
  const refs = await comfyStageReferences(item, context);
  const workflow = {
    u: { class_type: "UNETLoader", inputs: { unet_name: "z-image-turbo_fp8_scaled_e4m3fn_KJ.safetensors", weight_dtype: "default" } },
    c: { class_type: "CLIPLoader", inputs: { clip_name: "qwen_3_4b.safetensors", type: "lumina2" } },
    v: { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    ...refs.nodes,
    t: { class_type: "TextEncodeZImageOmni", inputs: { clip: ["c", 0], prompt: comfyImagePromptText(item, context), auto_resize_images: true, vae: ["v", 0], ...Object.fromEntries(refs.links.map(([slot, id]) => [slot, [id, 0]])) } },
    n: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["t", 0] } },
    l: { class_type: "EmptySD3LatentImage", inputs: { width: 1088, height: 1920, batch_size: 1 } },
    k: { class_type: "KSampler", inputs: { model: ["u", 0], positive: ["t", 0], negative: ["n", 0], latent_image: ["l", 0], seed: Date.now() % 1000000, steps: 9, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1 } },
    d: { class_type: "VAEDecode", inputs: { samples: ["k", 0], vae: ["v", 0] } },
    s: { class_type: "SaveImage", inputs: { images: ["d", 0], filename_prefix: `ftn_sd_img_c${String(cut).padStart(2, "0")}` } }
  };
  await comfyRunAndWait(workflow, 600000);
  const produced = await comfyNewestOutput(`ftn_sd_img_c${String(cut).padStart(2, "0")}`, ["png", "jpg", "webp"]);
  if (!produced) throw new Error("이미지 출력 파일을 찾지 못했습니다.");
  const destination = comfyStillPath(episodeId, cut);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(produced, destination);
  return destination;
}

async function comfyGenerateVideo(episodeId, cut) {
  const item = await comfyLoadDesignCut(episodeId, cut);
  const context = await sdResearchContext(episodeId);
  const still = comfyStillPath(episodeId, cut);
  await fs.access(still).catch(() => { throw new Error(`CUT ${cut}의 시작 이미지가 없습니다. 먼저 이미지를 생성하세요.`); });
  const staged = `ftn_sd_first_c${String(cut).padStart(2, "0")}.png`;
  await fs.copyFile(still, path.join(comfyInputDir, staged));
  const workflow = {
    u: { class_type: "UNETLoader", inputs: { unet_name: "minimax_h3_fl2va_pruned_int8_convrot.safetensors", weight_dtype: "default" } },
    m: { class_type: "MiniMaxH3SigmaShift", inputs: { model: ["u", 0], shift_video: 12, shift_audio: 3 } },
    c: { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", type: "minimax" } },
    v: { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_video_vae_fp16.safetensors" } },
    i: { class_type: "LoadImage", inputs: { image: staged } },
    t: { class_type: "MiniMaxH3ImageToVideo", inputs: { clip: ["c", 0], vae: ["v", 0], prompt: comfyVideoPromptText(item, context), width: 704, height: 1280, length: comfyH3Length(item.durationSec), first_frame: ["i", 0] } },
    n: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["t", 0] } },
    k: { class_type: "KSampler", inputs: { model: ["m", 0], positive: ["t", 0], negative: ["n", 0], latent_image: ["t", 1], seed: 7, steps: 20, cfg: 4.5, sampler_name: "euler", scheduler: "simple", denoise: 1 } },
    x: { class_type: "LTXVSeparateAVLatent", inputs: { av_latent: ["k", 0] } },
    d: { class_type: "VAEDecode", inputs: { samples: ["x", 0], vae: ["v", 0] } },
    cv: { class_type: "CreateVideo", inputs: { images: ["d", 0], fps: 24 } },
    s: { class_type: "SaveVideo", inputs: { video: ["cv", 0], filename_prefix: `ftn_sd_vid_c${String(cut).padStart(2, "0")}`, format: "mp4", codec: "h264" } }
  };
  await comfyRunAndWait(workflow, 3600000);
  const produced = await comfyNewestOutput(`ftn_sd_vid_c${String(cut).padStart(2, "0")}`, ["mp4"]);
  if (!produced) throw new Error("영상 출력 파일을 찾지 못했습니다.");
  const destination = comfyClipPath(episodeId, cut);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(produced, destination);
  return destination;
}

async function sdHiggsfieldImage(episodeId, cut) {
  const item = await comfyLoadDesignCut(episodeId, cut);
  const context = await sdResearchContext(episodeId);
  const args = ["generate", "create", "nano_banana_2_lite", "--prompt", comfyImagePromptText(item, context), "--aspect-ratio", "9:16", "--resolution", "1k"];
  for (const ref of (item.references || []).slice(0, 3)) {
    const abs = within(projectRoot, path.join("reference", path.basename(ref)));
    const ok = await fs.access(abs).then(() => true).catch(() => false);
    if (ok) args.push("--image-references", abs);
  }
  args.push("--wait", "--wait-timeout", "20m", "--wait-interval", "5s");
  const response = await runHiggsfieldJson(args);
  const mediaUrl = generatedMediaUrl(response, "image");
  if (!mediaUrl) throw new Error("Higgsfield 이미지 URL을 찾지 못했습니다.");
  const destination = comfyStillPath(episodeId, cut);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await downloadGeneratedMedia(mediaUrl, destination, "image");
  return destination;
}

async function sdHiggsfieldVideo(episodeId, cut, model) {
  const item = await comfyLoadDesignCut(episodeId, cut);
  const context = await sdResearchContext(episodeId);
  const still = comfyStillPath(episodeId, cut);
  await fs.access(still).catch(() => { throw new Error(`CUT ${cut}의 시작 이미지가 없습니다.`); });
  const config = higgsfieldVideoModelMap[model];
  if (!config) throw new Error(`지원하지 않는 영상 모델: ${model}`);
  const duration = Math.max(5, Math.min(15, Math.ceil(Number(item.durationSec || 5))));
  const args = ["generate", "create", config.jobType, "--prompt", comfyVideoPromptText(item, context), "--aspect-ratio", "9:16", "--duration", String(duration), "--resolution", config.resolution, "--start-image", still];
  if (config.supportsAudioToggle) args.push("--generate-audio", "false");
  if (config.cinemaMode) args.push("--mode", "omni_reference");
  args.push("--wait", "--wait-timeout", "25m", "--wait-interval", "5s");
  const response = await runHiggsfieldJson(args, 1_560_000);
  const mediaUrl = generatedMediaUrl(response, "video");
  if (!mediaUrl) throw new Error("Higgsfield 영상 URL을 찾지 못했습니다.");
  const destination = comfyClipPath(episodeId, cut);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await downloadGeneratedMedia(mediaUrl, destination, "video");
  return destination;
}

async function comfyRunnerLoop() {
  if (comfyJobs.running) return;
  comfyJobs.running = true;
  try {
    while (comfyJobs.queue.length) {
      const job = comfyJobs.queue.shift();
      const slot = comfyResult(job.cut)[job.kind];
      slot.status = "running"; slot.message = ""; slot.model = job.model;
      try {
        if (job.kind === "image") {
          if (job.model === "nano-banana-2-lite") await sdHiggsfieldImage(job.episodeId, job.cut);
          else await comfyGenerateImage(job.episodeId, job.cut);
        } else {
          if (job.model === "kling-3-motion" || job.model === "seedance-2" || job.model === "cinema-studio-4") await sdHiggsfieldVideo(job.episodeId, job.cut, job.model);
          else await comfyGenerateVideo(job.episodeId, job.cut);
        }
        slot.status = "done";
      } catch (error) {
        slot.status = "error";
        slot.message = String(error.message || error).slice(0, 200);
      }
    }
  } finally {
    comfyJobs.running = false;
  }
}

function comfyEnqueue(episodeId, kind, cuts, model) {
  for (const cut of cuts) {
    const already = comfyJobs.queue.some((job) => job.cut === cut && job.kind === kind);
    const slot = comfyResult(cut)[kind];
    if (already || slot.status === "running") continue;
    slot.status = "queued"; slot.message = "";
    comfyJobs.queue.push({ episodeId, kind, cut, model });
  }
  comfyRunnerLoop();
}

async function comfySceneStatus(episodeId) {
  const cuts = {};
  for (let cut = 1; cut <= 18; cut += 1) {
    const still = comfyStillPath(episodeId, cut);
    const clip = comfyClipPath(episodeId, cut);
    const hasStill = await fs.access(still).then(() => true).catch(() => false);
    const hasClip = await fs.access(clip).then(() => true).catch(() => false);
    const jobs = comfyResult(cut);
    cuts[cut] = {
      image: { ...jobs.image, exists: hasStill, mediaUrl: hasStill ? `/media?path=${encodeURIComponent(path.relative(projectRoot, still).replaceAll("\\", "/"))}&v=${Date.now()}` : null },
      video: { ...jobs.video, exists: hasClip, mediaUrl: hasClip ? `/media?path=${encodeURIComponent(path.relative(projectRoot, clip).replaceAll("\\", "/"))}` : null }
    };
  }
  let serverOk = false;
  try { await comfyHttp("/queue", undefined, 4000); serverOk = true; } catch { serverOk = false; }
  return { serverOk, busy: comfyJobs.running, pending: comfyJobs.queue.length, cuts };
}

async function ensureOfficialResearchComplete(project, state) {
  const stored = await readJson(episodeScriptFile(project.episodeId), null);
  const existing = await loadEpisodeResearch(project.episodeId, stored);
  if (researchSummary(existing).complete) return existing;
  const generated = await runCodexOfficialResearch(project.episode);
  if (!generated.ok) {
    const detail = String(generated.error || generated.stderr || "알 수 없는 조사 오류").trim().split(/\r?\n/).slice(-2).join(" ");
    throw new Error(`공식자료 조사 실패: ${detail}`);
  }
  const research = validateOfficialResearch(generated.value, project.episodeId);
  await writeJson(episodeResearchFile(project.episodeId), research);
  const briefStage = state.stages.find((stage) => stage.id === "brief");
  if (briefStage) { briefStage.status = "complete"; briefStage.note = `공식자료 조사 완료 · 출처 ${research.sources.length}개 · 사실 ${research.facts.length}개`; }
  await writeJson(stateFile, state);
  return research;
}

async function api(req, res, url) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method || "")) {
    if (!allowedLocalMutation(req)) return json(res, 403, { error: "로컬 대시보드에서 시작한 요청만 허용됩니다." });
    if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return json(res, 415, { error: "JSON 요청만 허용됩니다." });
  }
  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    project.storyboardSheets = await storyboardSheetStatus(project);
    const narrationScript = project.narration;
    return json(res, 200, {
      state,
      project,
      catalog: { episodes: unifiedEpisodeCatalog, categories: catalogCategories, sourceCount: episodeCatalog.length },
      narration: { script: narrationScript, characters: narrationScript.length },
      typecast: await typecastStatus(state),
      higgsfield: await higgsfieldStatus(),
      artifacts: await listArtifacts(),
      referenceLibrary: await referenceLibraryStatus(),
      scriptGenerator: {
        activeProvider: "codex-search",
        label: "Codex · 공식자료 1회 조사 + 캐시 문장 다듬기",
        researchOnce: true,
        rewriteUsesCachedResearch: true,
        gemini: { available: false, reason: "설치된 Gemini CLI가 개인 계정 지원 종료 오류를 반환합니다." }
      },
      creditSamples,
      providerModels,
      imageModels,
      imageCreditSamples
    });
  }
  if (req.method === "PUT" && url.pathname === "/api/state") {
    const body = await readBody(req);
    const sourceShots = await parsePromptPackage();
    const state = sanitizeState(body, sourceShots);
    await writeJson(stateFile, state);
    return json(res, 200, { ok: true, state });
  }
  if (req.method === "POST" && url.pathname === "/api/actions/validate") {
    const sourceShots = await parsePromptPackage();
    const { state } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    return json(res, 200, { checks: await validationReport(sourceShots, state, project) });
  }
  if (req.method === "POST" && url.pathname === "/api/actions/export") {
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    if (!project.readyForProduction) return json(res, 409, { error: "18문장 대본을 먼저 완성하세요." });
    const plan = await buildJobPlan(state, project.shots, project);
    const file = path.join(episodeProjectDir(project.episodeId), "dashboard_job_plan.json");
    await writeJson(file, plan);
    return json(res, 200, { ok: true, artifact: path.relative(projectRoot, file).replaceAll("\\", "/"), jobs: plan.jobs.length });
  }
  if (req.method === "POST" && url.pathname === "/api/actions/run-stage") {
    const body = await readBody(req);
    return json(res, 200, await runStage(String(body.stageId || "")));
  }
  if (req.method === "POST" && url.pathname === "/api/keyframes/upload") {
    const body = await readBody(req);
    const cut = Number(body.cut);
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    const source = project.shots.find((shot) => shot.index === cut);
    const shot = state.shots.find((item) => item.index === cut);
    if (!source || !shot) return json(res, 404, { error: "컷을 찾을 수 없습니다." });
    const match = String(body.dataUrl || "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return json(res, 400, { error: "PNG 이미지만 등록할 수 있습니다." });
    const buffer = Buffer.from(match[1], "base64");
    if (buffer.length < 100 || buffer.length > 12_000_000 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      return json(res, 400, { error: "유효한 12MB 이하 PNG 파일이 필요합니다." });
    }
    const file = path.join(projectRoot, source.generation.expectedFile);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buffer);
    shot.keyframeStatus = "ready_review";
    shot.keyframeApproved = false;
    state.updatedAt = new Date().toISOString();
    const stage = state.stages.find((item) => item.id === "keyframes");
    if (stage) { stage.status = "ready_review"; stage.note = `CUT ${String(cut).padStart(2, "0")} 시작 프레임 검토 필요`; }
    await generateStoryboardSheets(project);
    await writeJson(stateFile, state);
    return json(res, 200, { ok: true, state, message: `CUT ${String(cut).padStart(2, "0")} 스토리보드 시작 프레임을 등록했습니다.` });
  }
  if (req.method === "POST" && url.pathname === "/api/keyframes/approve") {
    const body = await readBody(req);
    const cut = Number(body.cut);
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    const source = project.shots.find((item) => item.index === cut);
    const shot = state.shots.find((item) => item.index === cut);
    if (!source || !shot) return json(res, 404, { error: "컷을 찾을 수 없습니다." });
    const exists = await fs.access(path.join(projectRoot, source.generation.expectedFile)).then(() => true).catch(() => false);
    if (!exists) return json(res, 409, { error: "먼저 생성된 PNG 시작 프레임을 등록하세요." });
    shot.keyframeApproved = body.approved !== false;
    shot.keyframeStatus = shot.keyframeApproved ? "approved" : "ready_review";
    const required = state.shots;
    const approved = required.filter((item) => item.keyframeApproved).length;
    const stage = state.stages.find((item) => item.id === "keyframes");
    if (stage) { stage.status = approved === required.length ? "complete" : "ready_review"; stage.note = `${required.length}컷 시작 프레임 · ${approved}개 승인 · 검토 시트 2장`; }
    state.updatedAt = new Date().toISOString();
    await writeJson(stateFile, state);
    return json(res, 200, { ok: true, state, message: `CUT ${String(cut).padStart(2, "0")} 시작 프레임을 ${shot.keyframeApproved ? "승인" : "승인 해제"}했습니다.` });
  }
  if (req.method === "POST" && url.pathname === "/api/actions/select-episode") {
    const body = await readBody(req);
    const episode = allEpisodes.find((item) => item.id === String(body.episodeId || ""));
    if (!episode) return json(res, 404, { error: "에피소드를 찾을 수 없습니다." });
    const { state } = await loadState();
    const changed = state.planning.activeEpisodeId !== episode.id;
    state.planning.activeEpisodeId = episode.id;
    state.planning.shortlist = [episode.id, ...state.planning.shortlist.filter((id) => id !== episode.id)].slice(0, 100);
    if (changed) {
      state.settings.defaultProvider = episode.recommendedProvider === "higgsfield" ? "higgsfield" : "flow";
      state.shots.forEach((shot) => {
        shot.provider = state.settings.defaultProvider;
        shot.model = shot.provider === "flow" ? "veo-3.1-fast" : "cinema-studio-4";
        shot.generationMode = defaultKeyframeCuts.has(shot.index) ? "keyframe" : "direct";
        shot.imageProvider = "flow";
        shot.imageModel = "nano-banana-2-lite";
        shot.keyframeStatus = "planned";
        shot.keyframeApproved = false;
        shot.status = "planned"; shot.attempts = 0; shot.selected = false;
        shot.flowPromptOverrides = { imageKo: "", imageEn: "", videoKo: "", videoEn: "" };
      });
      state.stages.forEach((stage) => { stage.status = stage.id === "brief" ? "planned" : "not_started"; stage.note = ""; });
    }
    await writeJson(stateFile, state);
    const artifact = "output/planning/selected_episode.json";
    await writeJson(path.join(projectRoot, artifact), {
      selectedAt: new Date().toISOString(),
      episode,
      productionStatus: episode.verification === "verified" ? "ready_for_script" : "research_required",
      nextSteps: ["공식·1차 자료 팩트 검증", "60~90초 내레이션 설계", "멀티컷 영상 프롬프트 설계"]
    });
    const project = await loadActiveProject(state, await parsePromptPackage());
    return json(res, 200, { state, episode, project, artifact });
  }
  if (req.method === "POST" && url.pathname === "/api/actions/research-script") {
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    const stored = await readJson(episodeScriptFile(project.episodeId), null);
    const existing = await loadEpisodeResearch(project.episodeId, stored);
    if (researchSummary(existing).complete) {
      if (existing.migratedFromScript) await writeJson(episodeResearchFile(project.episodeId), { ...existing, migratedFromScript: false });
      return json(res, 200, { ok: true, cached: true, research: researchSummary(existing), message: `공식자료 조사가 이미 완료되었습니다. 저장된 출처 ${existing.sources.length}개를 재사용합니다.` });
    }
    const generated = await runCodexOfficialResearch(project.episode);
    if (!generated.ok) {
      const detail = String(generated.error || generated.stderr || "알 수 없는 조사 오류").trim().split(/\r?\n/).slice(-3).join(" ");
      return json(res, 502, { error: `공식자료 조사에 실패했습니다. ${detail}` });
    }
    let research;
    try { research = validateOfficialResearch(generated.value, project.episodeId); }
    catch (error) { return json(res, 422, { error: error.message }); }
    await writeJson(episodeResearchFile(project.episodeId), research);
    const briefStage = state.stages.find((stage) => stage.id === "brief");
    if (briefStage) { briefStage.status = "complete"; briefStage.note = `공식자료 조사 완료 · 출처 ${research.sources.length}개 · 사실 ${research.facts.length}개`; }
    await writeJson(stateFile, state);
    return json(res, 200, { ok: true, cached: false, research: researchSummary(research), message: `공식자료 조사를 완료했습니다. 출처 ${research.sources.length}개와 핵심 사실 ${research.facts.length}개를 저장했습니다.` });
  }
  if (req.method === "POST" && url.pathname === "/api/actions/research-visual-references") {
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    const existing = await loadVisualReferenceResearch(project.episodeId);
    if (visualReferenceSummary(existing).complete) {
      const hydrated = await downloadVisualReferenceAssets(existing);
      await writeJson(episodeVisualReferenceFile(project.episodeId), hydrated);
      return json(res, 200, { ok: true, cached: true, visualResearch: visualReferenceClientData(hydrated), message: `시각 레퍼런스 조사가 이미 완료되었습니다. 저장된 자료 ${hydrated.references.length}개와 공개 이미지 ${hydrated.references.filter((item) => item.localFile).length}개를 재사용합니다.` });
    }
    let officialResearch;
    try { officialResearch = await ensureOfficialResearchComplete(project, state); }
    catch (error) { return json(res, 502, { error: error.message }); }
    let generated = await runCodexVisualReferenceResearch(project.episode, officialResearch);
    if (!generated.ok) generated = await runCodexVisualReferenceResearch(project.episode, officialResearch); // 구조화 응답 파싱 실패 시 1회 자동 재시도
    if (!generated.ok) {
      const detail = String(generated.error || generated.stderr || "알 수 없는 시각 조사 오류").trim().split(/\r?\n/).slice(-3).join(" ");
      return json(res, 502, { error: `시각 레퍼런스 조사에 실패했습니다. ${detail}` });
    }
    let research;
    try { research = validateVisualReferenceResearch(generated.value, project.episodeId); }
    catch (error) { return json(res, 422, { error: error.message }); }
    research = await downloadVisualReferenceAssets(research);
    await writeJson(episodeVisualReferenceFile(project.episodeId), research);
    return json(res, 200, {
      ok: true, cached: false, visualResearch: visualReferenceClientData(research),
      message: `시각 레퍼런스 ${research.references.length}개와 형태 기준을 저장했습니다. 공개 이미지 ${research.references.filter((item) => item.localFile).length}개를 내려받았습니다.`
    });
  }
  if (req.method === "POST" && url.pathname === "/api/actions/visual-reference-selection") {
    const body = await readBody(req);
    const { state } = await loadState();
    const research = await loadVisualReferenceResearch(state.planning.activeEpisodeId);
    if (!visualReferenceSummary(research).complete) return json(res, 409, { error: "먼저 시각 레퍼런스 조사를 완료하세요." });
    const item = research.references.find((reference) => reference.id === String(body.referenceId || ""));
    if (!item) return json(res, 404, { error: "레퍼런스를 찾을 수 없습니다." });
    item.selected = body.selected !== false;
    research.approvedAt = null;
    research.updatedAt = new Date().toISOString();
    await writeJson(episodeVisualReferenceFile(research.episodeId), research);
    return json(res, 200, { ok: true, visualResearch: visualReferenceClientData(research), message: `${item.title}을(를) ${item.selected ? "사용" : "제외"}하도록 설정했습니다.` });
  }
  if (req.method === "POST" && url.pathname === "/api/actions/approve-visual-references") {
    const { state } = await loadState();
    const research = await loadVisualReferenceResearch(state.planning.activeEpisodeId);
    if (!visualReferenceSummary(research).complete) return json(res, 409, { error: "먼저 시각 레퍼런스 조사를 완료하세요." });
    const selected = research.references.filter((item) => item.selected !== false);
    if (!selected.length) return json(res, 409, { error: "사용할 레퍼런스를 하나 이상 선택하세요." });
    research.approvedAt = new Date().toISOString();
    research.updatedAt = research.approvedAt;
    await writeJson(episodeVisualReferenceFile(research.episodeId), research);
    const keyframeStage = state.stages.find((stage) => stage.id === "keyframes");
    if (keyframeStage && keyframeStage.status === "not_started") { keyframeStage.status = "planned"; keyframeStage.note = `주제별 형태 레퍼런스 ${selected.length}개 승인`; }
    await writeJson(stateFile, state);
    return json(res, 200, { ok: true, state, visualResearch: visualReferenceClientData(research), message: `주제별 형태 레퍼런스 ${selected.length}개를 승인했습니다. 이미지·영상 프롬프트에 자동 적용됩니다.` });
  }
  if (req.method === "POST" && ["/api/actions/rewrite-script", "/api/actions/create-script-draft", "/api/actions/generate-script"].includes(url.pathname)) {
    const body = await readBody(req);
    const { state, sourceShots } = await loadState();
    if (allowedScriptRhythms.includes(body.scriptRhythmProfile)) state.settings.scriptRhythmProfile = body.scriptRhythmProfile;
    const project = await loadActiveProject(state, sourceShots);
    const stored = await readJson(episodeScriptFile(project.episodeId), null);
    const research = await loadEpisodeResearch(project.episodeId, stored);
    if (!researchSummary(research).complete) return json(res, 409, { error: "먼저 공식자료 조사를 완료하세요. 조사는 에피소드마다 한 번만 실행됩니다." });
    if (research.migratedFromScript) await writeJson(episodeResearchFile(project.episodeId), { ...research, migratedFromScript: false });
    let draftLines = typeof body.script === "string" ? normalizeScriptLines(body.script) : project.scriptLines;
    if (draftLines.length !== 18) draftLines = project.scriptLines;
    let checked = null;
    let correctionMessage = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const generated = await runCodexScriptRewrite(project.episode, research, draftLines, state.settings.scriptRhythmProfile, correctionMessage);
      if (!generated.ok) {
        const detail = String(generated.error || generated.stderr || "알 수 없는 문장 수정 오류").trim().split(/\r?\n/).slice(-3).join(" ");
        return json(res, 502, { error: `문장 다듬기에 실패했습니다. ${detail}` });
      }
      try {
        checked = validateGeneratedScript(repairGeneratedScriptContinuity({
          ...generated.value,
          sources: research.sources,
          factWarnings: research.factWarnings || []
        }), project.episode);
        break;
      } catch (error) {
        correctionMessage = error instanceof Error ? error.message : String(error);
        const retryLines = Array.isArray(generated.value?.scriptLines) ? generated.value.scriptLines.map(String) : [];
        if (retryLines.length === 18) draftLines = retryLines;
        if (attempt === 1) return json(res, 422, { error: `문장 자동 교정을 두 번 시도했지만 검수를 통과하지 못했습니다. ${correctionMessage}` });
      }
    }
    let polishApplied = false;
    let polishCorrection = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const polished = await runCodexNarrationPolish(project.episode, research, checked.lines, polishCorrection);
      if (!polished.ok) break;
      try {
        const finalCheck = validateGeneratedScript(repairGeneratedScriptContinuity({
          scriptLines: polished.value?.scriptLines,
          evidence: checked.evidence,
          sources: research.sources,
          factWarnings: research.factWarnings || []
        }), project.episode);
        checked.lines = finalCheck.lines;
        polishApplied = true;
        break;
      } catch (error) {
        polishCorrection = error instanceof Error ? error.message : String(error);
      }
    }    const file = episodeScriptFile(project.episodeId);
    await writeJson(file, {
      episodeId: project.episodeId,
      title: project.title,
      updatedAt: new Date().toISOString(),
      researchCompletedAt: research.completedAt,
      scriptSource: "ai-codex-rewrite",
      generationProvider: "codex-cached-research",
      scriptLines: checked.lines,
      evidence: checked.evidence,
      sources: research.sources,
      factWarnings: research.factWarnings || []
    });
    const shotsStage = state.stages.find((stage) => stage.id === "shots");
    if (shotsStage) { shotsStage.status = "planned"; shotsStage.note = `저장된 조사자료로 문장 다듬기 완료 · 출처 ${research.sources.length}개 재사용`; }
    await writeJson(stateFile, state);
    const next = await loadActiveProject(state, sourceShots);
    return json(res, 200, { ok: true, project: next, polishApplied, message: `공식자료를 다시 검색하지 않고 18문장을 다듬었습니다. ${polishApplied ? "낭독 전용 2차 편집까지 적용했습니다." : "검수된 1차 편집본을 적용했습니다."} 출처 ${research.sources.length}개를 재사용했습니다.` });
  }
  if (req.method === "PUT" && url.pathname === "/api/project/script") {
    const body = await readBody(req);
    const { state, sourceShots } = await loadState();
    const current = await loadActiveProject(state, sourceShots);
    const scriptLines = normalizeScriptLines(body.script);
    if (scriptLines.length !== 18) return json(res, 400, { error: `대본은 한 줄에 한 문장씩 정확히 18문장이어야 합니다. 현재 ${scriptLines.length}문장입니다.` });
    const file = episodeScriptFile(current.episodeId);
    const previous = await readJson(file, {});
    const evidence = Array.isArray(previous.evidence)
      ? previous.evidence.map((item, index) => ({ ...item, cut: index + 1, claim: scriptLines[index] || item.claim }))
      : [];
    await writeJson(file, {
      ...previous,
      episodeId: current.episodeId,
      title: current.title,
      updatedAt: new Date().toISOString(),
      scriptSource: "dashboard-editor",
      scriptLines,
      evidence
    });
    const project = await loadActiveProject(state, sourceShots);
    const shotsStage = state.stages.find((stage) => stage.id === "shots");
    if (shotsStage) { shotsStage.status = project.readyForProduction ? "planned" : "blocked"; shotsStage.note = project.readyForProduction ? "18문장 저장 · 컷 프롬프트 실행 가능" : "대본 빈칸을 완성하세요."; }
    await writeJson(stateFile, state);
    return json(res, 200, { ok: true, state, project, message: project.readyForProduction ? "18문장 대본을 저장했습니다." : "구조 초안을 저장했습니다." });
  }
  if (req.method === "POST" && url.pathname === "/api/flow/prompts") {
    const body = await readBody(req);
    const force = Boolean(body.force);
    const preferVerifiedFallback = body.preferVerifiedFallback === true;
    const { state, sourceShots } = await loadState();
    let project = await loadActiveProject(state, sourceShots);
    if (!project.readyForProduction) return json(res, 409, { error: "18문장 대본과 컷 설계를 먼저 완료하세요." });
    const episode = project.episode;
    const stored = await readJson(episodeScriptFile(episode.id), null);
    const officialResearch = await loadEpisodeResearch(episode.id, stored);
    const visualResearch = await loadVisualReferenceResearch(episode.id);
    let visualPlan = force ? null : await loadEpisodeVisualPlan(episode, project.scriptLines);
    let cached = Boolean(visualPlan);
    let warning = "";
    if (!visualPlan) {
      if (preferVerifiedFallback) {
        visualPlan = fallbackVisualPlan(episode, project.scriptLines, project.evidence || [], officialResearch);
        warning = "저장된 공식자료와 구조 레퍼런스로 검증된 주제별 설계를 즉시 적용했습니다.";
      } else {
        const generated = await runCodexVisualPlan(episode, officialResearch, visualResearch, project.scriptLines, project.evidence || []);
        if (generated.ok) {
          try {
            visualPlan = validateVisualPlan(generated.value, episode, project.scriptLines, officialResearch, "codex-visual-director");
          } catch (error) {
            warning = `${error.message} 검증된 주제별 설계로 안전하게 대체했습니다.`;
          }
        } else {
          warning = `${generated.error || "AI 시각 설계를 읽지 못했습니다."} 검증된 주제별 설계로 안전하게 대체했습니다.`;
        }
        if (!visualPlan) visualPlan = fallbackVisualPlan(episode, project.scriptLines, project.evidence || [], officialResearch);
      }
      await writeJson(episodeVisualPlanFile(episode.id), visualPlan);
      cached = false;
      project = await loadActiveProject(state, sourceShots);
    }
    const promptPack = buildFlowPromptPackage(project, state);
    const projectDir = episodeProjectDir(project.episodeId);
    await fs.mkdir(projectDir, { recursive: true });
    const jsonFile = path.join(projectDir, "flow_prompt_package.json");
    const markdownFile = path.join(projectDir, "flow_prompt_package.md");
    await writeJson(jsonFile, promptPack);
    await fs.writeFile(markdownFile, flowPromptMarkdown(promptPack), "utf8");
    return json(res, 200, {
      ok: true, cuts: promptPack.shots.length, flowCuts: promptPack.shots.filter((shot) => shot.selectedForFlow).length,
      cached, provider: visualPlan.provider, diversity: visualPlan.diversity, warning,
      artifact: path.relative(projectRoot, jsonFile).replaceAll("\\", "/"), markdownArtifact: path.relative(projectRoot, markdownFile).replaceAll("\\", "/"),
      message: `${promptPack.shots.length}컷의 증거 기반 시각 설계와 Flow 이미지·영상 프롬프트를 만들었습니다.`
    });
  }
  if (req.method === "PUT" && url.pathname === "/api/flow/prompt") {
    const body = await readBody(req);
    const cut = Number(body.cut);
    const kind = body.kind === "video" ? "video" : body.kind === "image" ? "image" : "";
    const language = body.language === "ko" ? "ko" : body.language === "en" ? "en" : "";
    const prompt = String(body.prompt || "").trim();
    if (!Number.isInteger(cut) || cut < 1 || cut > 18) return json(res, 400, { error: "컷 번호는 1부터 18까지의 정수여야 합니다." });
    if (!kind || !language) return json(res, 400, { error: "이미지/영상 종류와 프롬프트 언어를 확인하세요." });
    if (prompt.length < 20 || prompt.length > 12000) return json(res, 400, { error: "프롬프트는 20자 이상 12,000자 이하로 입력하세요." });
    const { state, sourceShots } = await loadState();
    const currentProject = await loadActiveProject(state, sourceShots);
    const sourceShot = currentProject.shots.find((item) => item.index === cut);
    const shot = state.shots.find((item) => item.index === cut);
    if (!shot || !sourceShot) return json(res, 404, { error: "컷을 찾을 수 없습니다." });
    shot.flowPromptOverrides ||= { imageKo: "", imageEn: "", videoKo: "", videoEn: "", visualPlanGeneratedAt: "" };
    const key = `${kind}${language === "ko" ? "Ko" : "En"}`;
    shot.flowPromptOverrides[key] = prompt;
    shot.flowPromptOverrides.visualPlanGeneratedAt = String(sourceShot.visualDesign?.planGeneratedAt || "");
    state.updatedAt = new Date().toISOString();
    await writeJson(stateFile, state);
    const project = await loadActiveProject(state, sourceShots);
    return json(res, 200, { ok: true, state, project, message: `CUT ${String(cut).padStart(2, "0")} Flow ${kind === "image" ? "이미지" : "영상"} 프롬프트를 저장했습니다.` });
  }
  if (req.method === "GET" && url.pathname === "/api/higgsfield/status") {
    return json(res, 200, await higgsfieldStatus(true));
  }
  if (req.method === "POST" && url.pathname === "/api/higgsfield/generate-image") {
    const body = await readBody(req);
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    if (!project.readyForProduction) return json(res, 409, { error: "18문장 대본과 컷 설계를 먼저 완료하세요." });
    const cut = Number(body.cut);
    if (!Number.isInteger(cut) || cut < 1 || cut > 18) return json(res, 400, { error: "컷 번호는 1부터 18까지의 정수여야 합니다." });
    const result = await withHiggsfieldJobLock(`image:${project.episodeId}:${cut}`, () => generateHiggsfieldImageCut(state, project, cut, body.force === true));
    return json(res, 200, { ok: true, ...result, message: `CUT ${String(cut).padStart(2, "0")} 스토리보드 이미지를 실제 생성했습니다.` });
  }
  if (req.method === "POST" && url.pathname === "/api/higgsfield/generate-video") {
    const body = await readBody(req);
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    if (!project.readyForProduction) return json(res, 409, { error: "18문장 대본과 컷 설계를 먼저 완료하세요." });
    const cut = Number(body.cut);
    const variant = Number(body.variant || 1);
    if (!Number.isInteger(cut) || cut < 1 || cut > 18) return json(res, 400, { error: "컷 번호는 1부터 18까지의 정수여야 합니다." });
    if (!Number.isInteger(variant) || variant < 1 || variant > 4) return json(res, 400, { error: "영상 변형 번호는 1부터 4까지의 정수여야 합니다." });
    const result = await withHiggsfieldJobLock(`video:${project.episodeId}:${cut}:${variant}`, () => generateHiggsfieldVideoCut(state, project, cut, variant, body.force === true));
    return json(res, 200, { ok: true, ...result, message: `CUT ${String(cut).padStart(2, "0")} 변형 ${variant} 영상을 실제 생성했습니다.` });
  }
  if (req.method === "GET" && url.pathname === "/api/typecast/status") {
    const { state } = await loadState();
    return json(res, 200, await typecastStatus(state));
  }
  if (req.method === "POST" && url.pathname === "/api/typecast/voices") {
    const body = await readBody(req);
    const model = body.model === "ssfm-v21" ? "ssfm-v21" : "ssfm-v30";
    const voices = await listTypecastVoices(model);
    return json(res, 200, { voices, recommended: voices.find((voice) => voice.voiceName.includes("필재") || voice.voiceName.toLowerCase().includes("piljae")) || null });
  }
  if (req.method === "POST" && url.pathname === "/api/typecast/generate") {
    const { state, sourceShots } = await loadState();
    const project = await loadActiveProject(state, sourceShots);
    if (!project.readyForProduction) return json(res, 409, { error: "18문장 대본을 먼저 완성하세요." });
    const result = await generateTypecastNarration(state, project);
    return json(res, 200, { ok: true, ...result, message: `Typecast 더빙을 생성했습니다. ${result.duration ?? "?"}초` });
  }
  if (req.method === "POST" && url.pathname === "/api/typecast/check-file") {
    const { state } = await loadState();
    return json(res, 200, await typecastStatus(state));
  }
  if (req.method === "GET" && url.pathname === "/api/scene-design") {
    const { state } = await loadState();
    const episodeId = state.planning.activeEpisodeId;
    const file = path.join(episodeProjectDir(episodeId), "scene_design.json");
    const design = await readJson(file, null);
    const stored = await readJson(episodeScriptFile(episodeId), null);
    const scriptLines = Array.isArray(stored?.scriptLines) ? stored.scriptLines : [];
    const researchContext = await sdResearchContext(episodeId);
    return json(res, 200, { episodeId, design, scriptLines, researchContext: { anchorKo: researchContext.anchorKo, avoidKo: researchContext.avoidKo, imageCount: researchContext.imageFiles.length } });
  }
  if (req.method === "PUT" && url.pathname === "/api/scene-design") {
    const body = await readBody(req);
    const { state } = await loadState();
    const episodeId = state.planning.activeEpisodeId;
    if (!body || !Array.isArray(body.cuts) || body.cuts.length < 1 || body.cuts.length > 60) {
      return json(res, 400, { error: "cuts 배열이 필요합니다." });
    }
    const design = {
      version: Number(body.version || 1),
      episodeId,
      name: String(body.name || "씬 설계표").slice(0, 120),
      updatedAt: new Date().toISOString(),
      specs: body.specs && typeof body.specs === "object" ? body.specs : {},
      cuts: body.cuts.map((cutItem, offset) => ({
        cut: offset + 1,
        title: String(cutItem.title || "").slice(0, 200),
        durationSec: Number(cutItem.durationSec || 0),
        actionType: String(cutItem.actionType || "").slice(0, 40),
        staging: String(cutItem.staging || "").slice(0, 2000),
        cameraAngle: String(cutItem.cameraAngle || "").slice(0, 200),
        shotSize: String(cutItem.shotSize || "").slice(0, 200),
        lens: String(cutItem.lens || "").slice(0, 100),
        cameraMove: String(cutItem.cameraMove || "").slice(0, 400),
        subjectMotion: String(cutItem.subjectMotion || "").slice(0, 2000),
        tone: String(cutItem.tone || "").slice(0, 400),
        inSceneText: String(cutItem.inSceneText || "").slice(0, 400),
        references: Array.isArray(cutItem.references) ? cutItem.references.map((r) => String(r).slice(0, 200)).slice(0, 8) : [],
        tedori: cutItem.tedori === true,
        logo: cutItem.logo === true,
        verify: Array.isArray(cutItem.verify) ? cutItem.verify.map((v) => String(v).slice(0, 300)).slice(0, 10) : []
      }))
    };
    const file = path.join(episodeProjectDir(episodeId), "scene_design.json");
    await writeJson(file, design);
    return json(res, 200, { ok: true, episodeId, cuts: design.cuts.length });
  }
  if (req.method === "GET" && url.pathname === "/api/comfy/status") {
    const { state } = await loadState();
    return json(res, 200, await comfySceneStatus(state.planning.activeEpisodeId));
  }
  if (req.method === "POST" && url.pathname === "/api/comfy/generate") {
    const body = await readBody(req);
    const { state } = await loadState();
    const episodeId = state.planning.activeEpisodeId;
    const kind = body.kind === "video" ? "video" : "image";
    let cuts = [];
    if (body.all === true) {
      for (let cut = 1; cut <= 18; cut += 1) {
        const file = kind === "image" ? comfyStillPath(episodeId, cut) : comfyClipPath(episodeId, cut);
        const exists = await fs.access(file).then(() => true).catch(() => false);
        if (!exists || body.force === true) cuts.push(cut);
      }
    } else {
      const cut = Number(body.cut);
      if (!Number.isInteger(cut) || cut < 1 || cut > 18) return json(res, 400, { error: "컷 번호는 1~18 정수여야 합니다." });
      cuts = [cut];
    }
    const imageModels = ["z-image-turbo", "nano-banana-2-lite", "flow-image"];
    const videoModels = ["minimax-h3", "kling-3-motion", "seedance-2", "cinema-studio-4", "flow-video"];
    const model = kind === "image"
      ? (imageModels.includes(body.model) ? body.model : "z-image-turbo")
      : (videoModels.includes(body.model) ? body.model : "minimax-h3");
    if (model.startsWith("flow-")) {
      const flowDir = path.join(episodeProjectDir(episodeId), "mg", "flow");
      await fs.mkdir(flowDir, { recursive: true });
      const prompts = [];
      const flowContext = await sdResearchContext(episodeId);
      for (const cut of cuts) {
        const item = await comfyLoadDesignCut(episodeId, cut);
        const promptText = kind === "image" ? comfyImagePromptText(item, flowContext) : comfyVideoPromptText(item, flowContext);
        const refNote = (item.references || []).length ? `\nFlow Ingredients/Frames 첨부: ${item.references.join(", ")}` : "";
        const saveNote = kind === "image"
          ? `\n생성 후 저장 위치: output/episodes/${episodeFolderName(episodeId)}/mg/stills/c${String(cut).padStart(2, "0")}.png`
          : `\n생성 후 저장 위치: output/episodes/${episodeFolderName(episodeId)}/mg/clips/c${String(cut).padStart(2, "0")}_silent.mp4`;
        const block = `[CUT ${String(cut).padStart(2, "0")} · ${kind === "image" ? "이미지" : "영상"} · Omni Flash 권장 · 9:16 · 무음]\n${promptText}${refNote}${saveNote}`;
        prompts.push({ cut, prompt: block });
        await fs.writeFile(path.join(flowDir, `c${String(cut).padStart(2, "0")}_${kind}.txt`), block, "utf8");
      }
      await fs.writeFile(path.join(flowDir, `flow_${kind}_package.md`), prompts.map((entry) => entry.prompt).join("\n\n---\n\n"), "utf8");
      return json(res, 200, { ok: true, manual: true, kind, model, queued: [], prompts, packageFile: `output/episodes/${episodeFolderName(episodeId)}/mg/flow/flow_${kind}_package.md` });
    }
    const isLocal = model === "z-image-turbo" || model === "minimax-h3";
    if (isLocal) {
      try { await comfyHttp("/queue", undefined, 4000); } catch { return json(res, 503, { error: "ComfyUI 서버(127.0.0.1:8188)가 꺼져 있습니다. ComfyUI Desktop을 실행하세요." }); }
    } else {
      const hf = await higgsfieldStatus();
      if (!hf.authenticated) return json(res, 503, { error: "Higgsfield CLI 인증이 필요합니다." });
    }
    comfyEnqueue(episodeId, kind, cuts, model);
    return json(res, 200, { ok: true, queued: cuts, kind, model });
  }
  if (req.method === "POST" && url.pathname === "/api/reference/upload") {
    const body = await readBody(req);
    const files = Array.isArray(body.files) ? body.files.slice(0, 10) : [];
    if (!files.length) return json(res, 400, { error: "업로드할 파일이 없습니다." });
    const saved = [];
    for (const file of files) {
      const base = path.basename(String(file.name || "")).replace(/[^\w.\-가-힣 ]/g, "_");
      const ext = path.extname(base).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return json(res, 400, { error: `허용되지 않는 형식: ${base}` });
      const buffer = Buffer.from(String(file.dataBase64 || ""), "base64");
      if (!buffer.length || buffer.length > 20 * 1024 * 1024) return json(res, 400, { error: `파일 크기 오류: ${base}` });
      const destination = within(projectRoot, path.join("reference", base));
      await fs.writeFile(destination, buffer);
      saved.push(base);
    }
    return json(res, 200, { ok: true, saved });
  }
  return json(res, 404, { error: "API를 찾을 수 없습니다." });
}

async function serveMedia(res, url) {
  const requested = url.searchParams.get("path") || "";
  if (!/^(assets|output|reference)\//.test(requested) || !/\.(mp4|wav|jpg|jpeg|png|webp|svg|json)$/i.test(requested)) {
    return json(res, 403, { error: "허용되지 않은 파일입니다." });
  }
  const file = within(projectRoot, requested);
  try {
    const stat = await fs.stat(file);
    const ext = path.extname(file).toLowerCase();
    const types = { ".mp4": "video/mp4", ".wav": "audio/wav", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml; charset=utf-8", ".json": "application/json" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Content-Length": stat.size, "Accept-Ranges": "bytes" });
    res.end(await fs.readFile(file));
  } catch {
    json(res, 404, { error: "파일을 찾을 수 없습니다." });
  }
}

async function serveStatic(res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = within(publicDir, requested);
  const ext = path.extname(file).toLowerCase();
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": [".html", ".js", ".css"].includes(ext) ? "no-store" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self';"
    });
    res.end(body);
  } catch {
    json(res, 404, { error: "페이지를 찾을 수 없습니다." });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${requestedPort}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (url.pathname === "/media") return await serveMedia(res, url);
    return await serveStatic(res, url.pathname);
  } catch (error) {
    json(res, 500, { error: error.message || "서버 오류" });
  }
});

server.listen(requestedPort, "127.0.0.1", () => {
  console.log(`Fun Tennis Note Studio: http://127.0.0.1:${requestedPort}`);
  console.log("종료하려면 Ctrl+C를 누르세요.");
});
















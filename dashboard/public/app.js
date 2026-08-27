const stageMeta = {
  brief: { title: "자료 조사", short: "자료조사", icon: "i-file", description: "공식 자료 팩트 + 시각 자료 수집 (주제 선정은 에피소드 기획 탭)" },
  shots: { title: "대본 생성", short: "대본", icon: "i-grid", description: "V4 반전 다큐 아크 18문장 대본" },
  voice: { title: "더빙 생성", short: "더빙", icon: "i-audio", description: "문장별 TTS로 컷 길이 확정 (씬 설계 전 필수)" },
  keyframes: { title: "씬 설계표 · 이미지", short: "씬설계표", icon: "i-layers", description: "컷별 설계 확정 후 이미지 생성·검수 (솔기·라인·텍스트 QC)" },
  video: { title: "영상 제작", short: "영상", icon: "i-film", description: "승인된 이미지 기반 컷별 영상 생성" },
  edit: { title: "편집 · 자막 · BGM", short: "편집", icon: "i-film", description: "리타이밍 조립 + 요약 자막(한/영) + 내레이션 + BGM 믹스" },
  qa: { title: "최종 검수", short: "검수", icon: "i-shield", description: "기하·텍스트·로고·길이 전체 프레임 검사" }
};
const statusText = {
  not_started: "시작 전",
  planned: "계획됨",
  running: "실행 중",
  ready_review: "승인 필요",
  waiting_external: "외부 실행",
  blocked: "대기",
  complete: "완료",
  error: "오류"
};
const modeText = { auto: "자동", review: "검토 후", manual: "수동" };
const modelLabels = {
  "veo-3.1-lite": "Veo 3.1 Lite",
  "veo-3.1-fast": "Veo 3.1 Fast",
  "veo-3.1-quality": "Veo 3.1 Quality",
  "gemini-omni-flash": "Gemini Omni Flash",
  "cinema-studio-4": "Cinema Studio 4.0",
  "seedance-2": "Seedance 2.0",
  "kling-3-motion": "Kling 3.0 Motion"
};
const imageModelLabels = {
  "nano-banana-2-lite": "Nano Banana 2 Lite",
  "nano-banana-2": "Nano Banana 2",
  "nano-banana-pro": "Nano Banana Pro"
};
const generationModeLabels = { keyframe: "키프레임 → 영상", direct: "바로 영상" };
const keyframeStatusText = {
  not_required: "스토리보드 예정", planned: "시작 프레임 예정", waiting_external: "외부 생성",
  ready_review: "프레임 검토", approved: "프레임 승인", error: "이미지 오류"
};

let data = null;
let state = null;
let activeStage = "brief";
let saveTimer = null;
let activeView = "planning";
let activeCategory = "all";
let catalogLimit = 36;
let typecastVoices = [];
let scriptEditorDirty = false;
let scriptEditorEpisodeId = null;
const progressTimers = new Map();

function updateOperationProgress(kind, { percent = 0, label = "진행 중", detail = "", status = "running", visible = true } = {}) {
  const root = $(`#${kind}Progress`);
  if (!root) return;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  root.hidden = !visible;
  root.dataset.status = status;
  $(`#${kind}ProgressLabel`).textContent = label;
  $(`#${kind}ProgressPercent`).textContent = `${value}%`;
  $(`#${kind}ProgressDetail`).textContent = detail;
  const bar = $(`#${kind}ProgressBar`);
  bar.setAttribute("aria-valuenow", String(value));
  bar.setAttribute("aria-valuetext", `${label}, ${value}퍼센트. ${detail}`);
  bar.querySelector("span").style.transform = `scaleX(${value / 100})`;
}

function startOperationProgress(kind, phases) {
  const previous = progressTimers.get(kind);
  if (previous) clearInterval(previous);
  const startedAt = Date.now();
  const paint = () => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const phase = [...phases].reverse().find((item) => elapsed >= item.at) || phases[0];
    updateOperationProgress(kind, {
      percent: phase.percent,
      label: phase.label,
      detail: `경과 ${elapsed}초 · ${phase.detail}`,
      status: "running"
    });
  };
  paint();
  const timer = setInterval(paint, 500);
  progressTimers.set(kind, timer);
  const stop = () => {
    clearInterval(progressTimers.get(kind));
    progressTimers.delete(kind);
  };
  return {
    stop,
    complete(label, detail) {
      stop();
      updateOperationProgress(kind, { percent: 100, label, detail, status: "complete" });
    },
    fail(detail) {
      stop();
      updateOperationProgress(kind, { percent: 100, label: "작업을 완료하지 못했습니다", detail, status: "error" });
    }
  };
}

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const icon = (name) => `<svg aria-hidden="true"><use href="#${name}"></use></svg>`;
const bytes = (value) => value > 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.round(value / 1000)} KB`;

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "요청에 실패했습니다.");
  return body;
}

function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type === "error" ? "error" : ""}`;
  node.textContent = message;
  $("#toastRegion").append(node);
  setTimeout(() => node.remove(), 3800);
}

function setSaveState(label, busy = false) {
  $("#saveState").textContent = label;
  document.querySelector(".live-dot").style.background = busy ? "var(--amber)" : "var(--green)";
}

function shotDuration(shot) {
  return data.project.shots.find((item) => item.index === shot.index)?.duration || 5;
}

function modelCreditValue(provider, model, duration = 5) {
  if (provider === "higgsfield" && Number(state.settings.higgsfieldCostPerGeneration) > 0) return Number(state.settings.higgsfieldCostPerGeneration);
  const sample = data.creditSamples?.[provider]?.models?.[model];
  if (!sample) return 0;
  if (sample.creditsByDuration) {
    if (duration <= 4) return sample.creditsByDuration["4"];
    if (duration <= 6) return sample.creditsByDuration["6"];
    if (duration <= 8) return sample.creditsByDuration["8"];
    return sample.creditsByDuration["10"];
  }
  const base = Number(sample.credits || 0);
  return provider === "higgsfield" ? base * Math.max(1, Math.ceil(duration / 5)) : base;
}

function modelCreditLabel(provider, model, duration = 5) {
  const sample = data.creditSamples?.[provider]?.models?.[model];
  if (!sample) return "단가 확인";
  if (provider === "higgsfield" && Number(state.settings.higgsfieldCostPerGeneration) > 0) return `${state.settings.higgsfieldCostPerGeneration}cr · 직접 입력`;
  return `${modelCreditValue(provider, model, duration)}cr · ${sample.level}`;
}

function budget() {
  const variants = state.settings.variants;
  const flowShots = state.shots.filter((shot) => shot.provider === "flow");
  const higgsShots = state.shots.filter((shot) => shot.provider === "higgsfield");
  const flow = flowShots.reduce((sum, shot) => sum + modelCreditValue("flow", shot.model, shotDuration(shot)) * variants, 0);
  const higgsfield = higgsShots.reduce((sum, shot) => sum + modelCreditValue("higgsfield", shot.model, shotDuration(shot)) * variants, 0);
  const storyboardShots = state.shots;
  const directShots = state.shots.filter((shot) => shot.generationMode === "direct");
  const imageKnownCredits = storyboardShots.reduce((sum, shot) => {
    const value = data.imageCreditSamples?.models?.[shot.imageModel]?.credits;
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const imageUnknown = storyboardShots.filter((shot) => !Number.isFinite(data.imageCreditSamples?.models?.[shot.imageModel]?.credits)).length;
  return { flow, higgsfield, flowShots: flowShots.length, higgsShots: higgsShots.length, storyboardShots: storyboardShots.length, directShots: directShots.length, imageKnownCredits, imageUnknown };
}



async function refreshData() {
  data = await request("/api/bootstrap");
  state = data.state;
  renderAll();
}

function renderProjectHeader() {
  const project = data.project;
  $("#pipelineTitle").textContent = project.title;
  $("#pipelineSubtitle").textContent = `#${String(project.episode?.number || "—").padStart(3, "0")} · ${project.episode?.categoryLabel || "에피소드"} · 목표 ${project.targetDuration}초 · ${project.readyForProduction ? "제작 가능" : "대본 작성 필요"}`;
  $("#pipelineVersion").textContent = project.source === "master-package" ? "MASTER PACKAGE" : "ACTIVE PROJECT";
  const epNumber = project.episode?.number ? String(project.episode.number).padStart(3, "0") : "—";
  $("#sidebarProjectCode").textContent = `FTN-EP-${epNumber}`;
  $("#sidebarProjectMeta").textContent = `9:16 · ${Math.round(project.targetDuration)} sec · ${project.shots.length} cuts`;
}

function renderScriptEditor() {
  const project = data.project;
  const editor = $("#scriptEditor");
  const episodeChanged = scriptEditorEpisodeId !== project.episodeId;
  if (episodeChanged || !scriptEditorDirty) {
    editor.value = project.scriptLines.join("\n");
    editor.scrollTop = 0;
    scriptEditorDirty = false;
    scriptEditorEpisodeId = project.episodeId;
  }
  const ready = project.readyForProduction;
  $("#projectReadiness").textContent = ready ? "18문장 준비됨" : project.scriptStatus === "not_started" ? "AI 대본 필요" : "대본 검토 필요";
  $("#projectReadiness").classList.toggle("ready", ready);
  const rhythmSelect = $("#scriptRhythmProfile");
  rhythmSelect.value = state.settings.scriptRhythmProfile || "auto";
  const rhythmNotes = { auto: "편마다 다른 계열을 자동 배정합니다.", time: "짧은 시간과 반응 한계로 엽니다.", object: "무심히 지나친 대상을 지목합니다.", rule: "규정 문구와 숫자에서 시작합니다.", result: "놀라운 결과를 먼저 보여줍니다.", physics: "힘·회전·마찰의 한계로 엽니다.", history: "인물의 이상한 선택에서 시작합니다." };
  $("#slotRhythmNote").textContent = rhythmNotes[rhythmSelect.value] || rhythmNotes.auto;
  const master = project.source === "master-package";
  const research = project.research || { complete: Array.isArray(project.sources) && project.sources.length >= 2, sourceCount: project.sources?.length || 0, factCount: 0, reusable: false };
  editor.readOnly = master;
  $("#researchActionStep").hidden = master;
  $("#rewriteActionStep").hidden = master;
  $("#saveScriptButton").hidden = master;
  const researchButton = $("#researchScriptButton");
  const rewriteButton = $("#rewriteScriptButton");
  researchButton.disabled = master || research.complete;
  researchButton.textContent = research.complete ? "조사 완료" : "공식자료 조사";
  $("#researchActionStep").dataset.state = research.complete ? "complete" : "pending";
  $("#researchScriptStatus").textContent = research.complete
    ? `출처 ${research.sourceCount}개 · 다시 조사하지 않음`
    : "에피소드마다 한 번";
  rewriteButton.disabled = master || !research.complete;
  rewriteButton.textContent = "문장 다듬기";
  $("#rewriteActionStep").dataset.state = research.complete ? "ready" : "locked";
  $("#rewriteScriptStatus").textContent = research.complete ? "저장된 근거로 반복 가능" : "조사 완료 후 사용";
  $("#scriptEditorHelp").textContent = master
    ? "완성된 EP.01 마스터 대본입니다. 수정은 제작 패키지 문서에서 관리합니다."
    : research.complete
      ? `공식자료 조사 완료 · 출처 ${research.sourceCount}개 · 문장 다듬기는 저장된 근거만 사용합니다.`
      : "1단계에서 공식자료를 한 번 저장한 뒤, 2단계에서 문장만 반복해서 다듬습니다.";
}

function renderStageNav() {
  const complete = state.stages.filter((stage) => stage.status === "complete").length;
  $("#pipelinePercent").textContent = `${Math.round(complete / state.stages.length * 100)}%`;
  $("#stageNav").innerHTML = state.stages.map((stage, index) => {
    const meta = stageMeta[stage.id];
    const finished = stage.status === "complete";
    const actionLabel = stage.status === "ready_review" ? "승인" : "실행";
    return `<div class="stage-nav-item">
      <button class="stage-nav-button ${stage.status} ${activeStage === stage.id ? "active" : ""}" data-stage-nav="${stage.id}" type="button" title="${escapeHtml(stage.note || meta.description)}">
        <span class="stage-index">${finished ? icon("i-check") : String(index + 1).padStart(2, "0")}</span>
        <span class="stage-nav-copy"><strong>${meta.short}</strong><small>${statusText[stage.status]}</small></span>
        ${icon("i-chevron")}
      </button>
      <div class="stage-nav-controls">
        <label><span class="sr-only">${meta.title} 실행 방식</span><select class="mode-select" data-stage-mode="${stage.id}">
          ${Object.entries(modeText).map(([value, label]) => `<option value="${value}" ${stage.mode === value ? "selected" : ""}>${label}</option>`).join("")}
        </select></label>
        <button class="run-stage" data-run-stage="${stage.id}" type="button" aria-label="${meta.title} ${actionLabel}" title="${meta.title} ${actionLabel}">${stage.status === "ready_review" ? icon("i-check") : icon("i-play")}</button>
      </div>
    </div>`;
  }).join("");
}

function renderMetrics() {
  const counts = budget();
  const done = state.shots.filter((shot) => shot.status === "complete").length;
  const flowRemain = state.settings.flowCredits - counts.flow;
  const metrics = [
    { label: "전체 러닝타임", value: `${data.project.targetDuration.toFixed(1)}s`, meta: "세로 9:16 · 30fps", accent: true },
    { label: "제작 컷", value: String(data.project.shots.length), meta: data.project.readyForProduction ? "18문장 · 18컷" : "구조 초안 작성 중" },
    { label: "완료된 컷", value: `${done}/${data.project.shots.length}`, meta: done ? "승인된 생성 결과" : "생성 전" },
    { label: "Flow 예상 잔여", value: flowRemain >= 0 ? `${flowRemain}` : `-${Math.abs(flowRemain)}`, meta: `${counts.flow} / ${state.settings.flowCredits} credits`, accent: flowRemain >= 0 }
  ];
  $("#metricGrid").innerHTML = metrics.map((item) => `<article class="metric-card ${item.accent ? "accent" : ""}">
    <span class="metric-label">${item.label}</span>
    <div class="metric-value">${item.value}</div>
    <div class="metric-meta">${item.meta}</div>
  </article>`).join("");
}

function renderProductionLaunch() {
  const storyboardStage = state.stages.find((stage) => stage.id === "keyframes") || { status: "not_started", note: "" };
  const videoStage = state.stages.find((stage) => stage.id === "video") || { status: "not_started", note: "" };
  const ready = Boolean(data.project.readyForProduction);
  const frameShots = state.shots.filter((shot) => shot.generationMode === "keyframe");
  const approvedFrames = frameShots.filter((shot) => shot.keyframeApproved).length;
  const directShots = state.shots.filter((shot) => shot.generationMode === "direct").length;
  const videoReady = directShots + approvedFrames;
  const statusLabel = (stage) => statusText[stage.status] || "상태 확인";
  const cardState = (stage) => ["complete", "ready_review", "waiting_external"].includes(stage.status) ? stage.status : "pending";

  const storyboardCard = $("#storyboardLaunchCard");
  const storyboardButton = $("#buildStoryboardButton");
  storyboardCard.dataset.state = cardState(storyboardStage);
  $("#storyboardLaunchStatus").textContent = statusLabel(storyboardStage);
  $("#storyboardLaunchNote").textContent = !ready
    ? "18문장 대본을 먼저 확정해야 합니다."
    : data.higgsfield?.authenticated
      ? `${storyboardStage.note ? `${storyboardStage.note} · ` : ""}Higgsfield 실제 생성 연결 · 잔여 ${Number(data.higgsfield.credits || 0).toFixed(1)}cr`
      : "Higgsfield 로그인이 필요합니다.";
  storyboardButton.disabled = !ready;
  storyboardButton.textContent = ["waiting_external", "ready_review", "complete"].includes(storyboardStage.status) ? "스토리보드 실제 재생성" : "스토리보드 실제 생성";

  const videoCard = $("#videoLaunchCard");
  const videoButton = $("#buildVideoButton");
  videoCard.dataset.state = cardState(videoStage);
  $("#videoLaunchStatus").textContent = statusLabel(videoStage);
  $("#videoLaunchNote").textContent = videoStage.note || (!ready
    ? "18문장 대본을 먼저 확정해야 합니다."
    : videoReady === 0
      ? `시작 프레임 승인 0/${frameShots.length}개 · 승인 후 영상 제작이 활성화됩니다.`
      : `Higgsfield 자동 ${state.shots.filter((shot) => shot.provider === "higgsfield").length}컷 · Flow 수동 ${state.shots.filter((shot) => shot.provider === "flow").length}컷 · 프레임 승인 ${approvedFrames}/${frameShots.length}`);
  videoButton.disabled = !ready || videoReady === 0;
  videoButton.textContent = videoStage.status === "not_started" ? "영상 실제 생성" : "영상 실제 생성 계속";
}

function renderProviders() {
  const selected = state.settings.defaultProvider;
  const counts = budget();
  $("#providerCards").innerHTML = [
    { id: "flow", name: "Google Flow", plan: `${state.settings.flowPlan} · 웹 수동`, mark: "GF", color: "flow", credits: `${state.settings.flowCredits} cr`, use: `${counts.flowShots} cuts` },
    { id: "higgsfield", name: "Higgsfield", plan: data.higgsfield?.authenticated ? `${data.higgsfield.plan || "계정"} · CLI 연결` : "로그인 필요", mark: "HF", color: "higgsfield", credits: data.higgsfield?.authenticated ? `${Number(data.higgsfield.credits || 0).toFixed(1)} cr` : "미연결", use: `${counts.higgsShots} cuts` }
  ].map((provider) => `<article class="provider-card ${provider.color} ${selected === provider.id ? "selected" : ""}">
    <div class="provider-card-top">
      <div class="provider-name"><span class="provider-symbol">${provider.mark}</span><span><strong>${provider.name}</strong><small>${provider.plan}</small></span></div>
      <span class="radio-dot" aria-hidden="true"></span>
    </div>
    <div class="provider-stats">
      <div class="provider-stat"><span>Available</span><strong>${provider.credits}</strong></div>
      <div class="provider-stat"><span>Assigned</span><strong>${provider.use}</strong></div>
    </div>
    <button class="provider-select" data-provider-default="${provider.id}" type="button" aria-label="${provider.name}를 기본 생성 엔진으로 선택">선택</button>
  </article>`).join("");
  $("#variantSelect").value = String(state.settings.variants);
  $("#languageSelect").value = state.settings.language;
  $("#silentToggle").checked = state.settings.silentGeneration;
  $("#labelsToggle").checked = state.settings.addTechnicalLabelsInPost;
}

function renderAutomation() {
  $("#automationList").innerHTML = state.stages.map((stage) => {
    const meta = stageMeta[stage.id];
    const actionLabel = stage.status === "ready_review" ? "승인" : "실행";
    return `<div class="automation-item" id="stage-${stage.id}">
      <span class="automation-icon">${icon(meta.icon)}</span>
      <span class="automation-copy"><strong>${meta.title}</strong><small>${escapeHtml(stage.note || meta.description)}</small></span>
      <label><span class="sr-only">${meta.title} 실행 방식</span><select class="mode-select" data-stage-mode="${stage.id}">
        ${Object.entries(modeText).map(([value, label]) => `<option value="${value}" ${stage.mode === value ? "selected" : ""}>${label}</option>`).join("")}
      </select></label>
      <button class="run-stage" data-run-stage="${stage.id}" type="button" aria-label="${meta.title} ${actionLabel}">${stage.status === "ready_review" ? icon("i-check") : icon("i-play")}</button>
    </div>`;
  }).join("");
}

function providerOptions(selected) {
  return `<option value="flow" ${selected === "flow" ? "selected" : ""}>Flow · 웹 수동</option>
    <option value="higgsfield" ${selected === "higgsfield" ? "selected" : ""}>Higgsfield · 자동 연결</option>`;
}

function modelOptions(provider, selected, duration = 5) {
  return data.providerModels[provider].map((model) =>
    `<option value="${model}" ${model === selected ? "selected" : ""}>${modelLabels[model] || model} · ${modelCreditLabel(provider, model, duration)}</option>`
  ).join("");
}

function generationModeOptions(selected) {
  return Object.entries(generationModeLabels).map(([value, label]) =>
    `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`
  ).join("");
}

function imageModelOptions(selected) {
  return data.imageModels.flow.map((model) => {
    const sample = data.imageCreditSamples.models[model];
    return `<option value="${model}" ${selected === model ? "selected" : ""}>${imageModelLabels[model] || model} · ${sample.display}</option>`;
  }).join("");
}

function renderBulkModelSelect(preferredModel = "") {
  const provider = $("#bulkProvider").value;
  const models = data.providerModels[provider];
  const current = models.includes(preferredModel) ? preferredModel : models.includes($("#bulkModel").value) ? $("#bulkModel").value : models[0];
  $("#bulkModel").innerHTML = modelOptions(provider, current, 5);
  $("#bulkModel").value = current;
}

function renderCreditSamples() {
  const providers = ["flow", "higgsfield"];
  $("#modelCreditSamples").innerHTML = providers.map((provider) => {
    const group = data.creditSamples[provider];
    const cards = data.providerModels[provider].map((model) => {
      const sample = group.models[model];
      return `<article class="credit-sample-card ${sample.level.replaceAll(" ", "-")}"><span>${group.label}</span><strong>${modelLabels[model] || model}</strong><b>${sample.display}</b><small>${sample.level} · ${sample.condition}</small></article>`;
    }).join("");
    return `<div class="credit-sample-group"><div class="credit-sample-heading"><strong>${group.label}</strong><span>${group.basis}</span><a href="${group.source}" target="_blank" rel="noreferrer">공식 기준</a></div><div class="credit-sample-cards">${cards}</div></div>`;
  }).join("");
  const imageCards = data.imageModels.flow.map((model) => {
    const sample = data.imageCreditSamples.models[model];
    return `<article class="credit-sample-card ${sample.level}"><span>${data.imageCreditSamples.label}</span><strong>${imageModelLabels[model] || model}</strong><b>${sample.display}</b><small>${sample.level} · ${sample.condition}</small></article>`;
  }).join("");
  $("#modelCreditSamples").insertAdjacentHTML("afterbegin", `<div class="credit-sample-group"><div class="credit-sample-heading"><strong>${data.imageCreditSamples.label}</strong><span>${data.imageCreditSamples.basis}</span><a href="${data.imageCreditSamples.source}" target="_blank" rel="noreferrer">공식 기능표</a></div><div class="credit-sample-cards">${imageCards}</div></div>`);
  $("#creditSampleUpdated").textContent = `기준일 ${data.creditSamples.updatedAt}`;
}

function filteredShots() {
  const query = $("#shotSearch")?.value?.trim().toLowerCase() || "";
  const provider = $("#providerFilter")?.value || "all";
  return data.project.shots.filter((source) => {
    const shot = state.shots.find((item) => item.index === source.index);
    return (provider === "all" || shot.provider === provider) &&
      (!query || source.narration.toLowerCase().includes(query) || String(source.index).includes(query));
  });
}

function renderShots() {
  const visible = filteredShots();
  $("#shotTableBody").innerHTML = visible.map((source) => {
    const shot = state.shots.find((item) => item.index === source.index);
    return `<tr>
      <td class="check-cell"><label><span class="sr-only">CUT ${source.index} 선택</span><input type="checkbox" data-shot-selected="${source.index}" ${shot.selected ? "checked" : ""}></label></td>
      <td><span class="cut-number">C${String(source.index).padStart(2, "0")}</span></td>
      <td class="narration-cell"><strong title="${escapeHtml(source.narration)}">${escapeHtml(source.narration)}</strong><small>${escapeHtml(source.time)} · ${source.duration.toFixed(1)}s</small></td>
      <td><label><span class="sr-only">CUT ${source.index} 생성 방식</span><select class="table-select mode-table-select" data-shot-generation-mode="${source.index}">${generationModeOptions(shot.generationMode)}</select></label></td>
      <td><label><span class="sr-only">CUT ${source.index} 이미지 모델</span><select class="table-select" data-shot-image-model="${source.index}">${imageModelOptions(shot.imageModel)}</select></label></td>
      <td><label><span class="sr-only">CUT ${source.index} 영상 엔진</span><select class="table-select" data-shot-provider="${source.index}">${providerOptions(shot.provider)}</select></label></td>
      <td><label><span class="sr-only">CUT ${source.index} 영상 모델</span><select class="table-select" data-shot-model="${source.index}">${modelOptions(shot.provider, shot.model, source.duration)}</select></label></td>
      <td class="keyframe-cell">${source.generation.exists
        ? `<button class="keyframe-thumbnail" data-shot-detail="${source.index}" type="button" aria-label="CUT ${source.index} 스토리보드 시작 이미지 보기"><img src="${source.generation.mediaUrl}" alt="" loading="lazy"><span class="${source.generation.approved ? "approved" : "review"}">${source.generation.approved ? "승인" : "검토"}</span></button>`
        : `<span class="status-badge waiting_external">${keyframeStatusText[source.generation.keyframeStatus] || statusText[shot.status]}</span>`}</td>
      <td><button class="row-detail" data-shot-detail="${source.index}" type="button" aria-label="CUT ${source.index} 상세 보기">${icon("i-chevron")}</button></td>
    </tr>`;
  }).join("");
  $("#shotEmpty").hidden = visible.length > 0;
  const selectedCount = state.shots.filter((shot) => shot.selected).length;
  $("#selectedCount").textContent = String(selectedCount);
  $("#selectAllShots").checked = selectedCount === state.shots.length;
  $("#selectAllShots").indeterminate = selectedCount > 0 && selectedCount < state.shots.length;
  renderBulkModelSelect();
}

function renderImageProgress() {
  const keyframeSources = data.project.shots;
  const total = keyframeSources.length;
  if (!total) {
    updateOperationProgress("image", { visible: false });
    return;
  }
  const stage = state.stages.find((item) => item.id === "keyframes");
  const queued = ["waiting_external", "ready_review", "complete"].includes(stage?.status);
  const registered = keyframeSources.filter((source) => source.generation.exists).length;
  const approved = keyframeSources.filter((source) => source.generation.approved).length;
  const percent = Math.round(((queued ? total : 0) + registered + approved) / (total * 3) * 100);
  const complete = approved === total;
  const blocked = stage?.status === "blocked";
  const label = complete
    ? "스토리보드 승인 완료"
    : registered
      ? "시작 프레임 검토·승인 중"
      : queued
        ? "18컷 이미지 생성 대기"
        : blocked
          ? "스토리보드 제작 대기"
          : "스토리보드 준비 전";
  const detail = blocked
    ? stage.note
    : `대기열 ${queued ? "완료" : "준비 전"} · 파일 등록 ${registered}/${total} · 승인 ${approved}/${total}`;
  updateOperationProgress("image", {
    percent,
    label,
    detail,
    status: complete ? "complete" : blocked ? "error" : queued || registered ? "running" : "idle"
  });
}

function renderStoryboardSheets() {
  const sheets = Array.isArray(data.project.storyboardSheets) ? data.project.storyboardSheets : [];
  const grid = $("#storyboardSheetGrid");
  if (!grid) return;
  grid.innerHTML = sheets.length ? sheets.map((sheet) => `<article class="storyboard-sheet-card ${sheet.complete ? "complete" : ""}">
    ${sheet.mediaUrl
      ? `<a class="storyboard-sheet-preview" href="${sheet.mediaUrl}" target="_blank" rel="noreferrer" aria-label="스토리보드 ${sheet.sheetNumber}장 크게 보기"><img src="${sheet.mediaUrl}" alt="CUT ${String(sheet.cutStart).padStart(2, "0")}부터 CUT ${String(sheet.cutEnd).padStart(2, "0")}까지의 첫 장면 스토리보드" loading="lazy"></a>`
      : `<div class="storyboard-sheet-placeholder"><span>${icon("i-grid")}</span><strong>스토리보드 시트 대기</strong><small>단계를 실행하면 검토 시트가 생성됩니다.</small></div>`}
    <div class="storyboard-sheet-meta"><span>STORYBOARD ${String(sheet.sheetNumber).padStart(2, "0")}</span><strong>CUT ${String(sheet.cutStart).padStart(2, "0")}–${String(sheet.cutEnd).padStart(2, "0")}</strong><small>첫 프레임 ${sheet.readyCount}/${sheet.total} 준비</small></div>
  </article>`).join("") : `<div class="storyboard-empty">스토리보드 제작 단계를 실행하면 1–9컷, 10–18컷 검토 시트가 만들어집니다.</div>`;
  const ready = sheets.reduce((sum, sheet) => sum + sheet.readyCount, 0);
  $("#storyboardOverviewStatus").textContent = sheets.length ? `${ready}/18 프레임 · ${sheets.length}장` : "2장 예정";
  $("#storyboardOverviewStatus").classList.toggle("ready", ready === 18);
}
function renderBudget() {
  const totals = budget();
  const available = state.settings.flowCredits;
  const percent = available ? Math.min(100, Math.round(totals.flow / available * 100)) : 100;
  const over = totals.flow > available;
  $("#budgetContent").innerHTML = `<div class="budget-body">
    <div class="budget-total"><div><span>FLOW ESTIMATE</span><strong>${totals.flow} cr</strong></div><span>${over ? "예산 초과" : `${available - totals.flow} cr 남음`}</span></div>
    <div class="budget-bar ${over ? "over" : ""}" role="progressbar" aria-label="Flow 예상 크레딧 사용량" aria-valuemin="0" aria-valuemax="${available}" aria-valuenow="${totals.flow}"><span style="width:${percent}%"></span></div>
    <div class="budget-breakdown">
      <div class="budget-item"><span>STORYBOARD</span><strong>${totals.storyboardShots} cuts · ${totals.imageUnknown ? "단가 확인" : `${totals.imageKnownCredits} cr`}</strong></div>
      <div class="budget-item"><span>DIRECT VIDEO</span><strong>${totals.directShots} cuts</strong></div>
      <div class="budget-item"><span>FLOW</span><strong>${totals.flowShots} cuts · ${totals.flow} cr</strong></div>
      <div class="budget-item"><span>HIGGSFIELD</span><strong>${totals.higgsShots} cuts · ${totals.higgsfield || "—"} cr</strong></div>
    </div>
    <label class="field credit-input"><span>Higgsfield 실제 단가 재정의 · 0이면 모델별 공식 샘플 사용</span><input id="higgsfieldCostInput" type="number" min="0" step="1" value="${state.settings.higgsfieldCostPerGeneration}"></label>
    <p class="budget-note">예상치는 컷별 모델 단가 × 후보 수입니다. Flow는 Google 공식값, Higgsfield는 5초·720p 공식 샘플의 대략값이며 실패 생성·업스케일은 제외합니다.</p>
  </div>`;
}

function renderArtifacts() {
  const artifacts = data.artifacts.slice(0, 7);
  $("#artifactList").innerHTML = artifacts.length ? artifacts.map((item) => `<a class="artifact-item" href="/media?path=${encodeURIComponent(item.relativePath)}" target="_blank" rel="noreferrer">
    <span class="artifact-icon">${icon("i-file")}</span>
    <span><strong class="artifact-name">${escapeHtml(item.name)}</strong><small class="artifact-meta">${bytes(item.bytes)} · ${new Date(item.modifiedAt).toLocaleString("ko-KR")}</small></span>
    <span class="artifact-kind">${item.kind}</span>
  </a>`).join("") : `<div class="empty-state">아직 산출물이 없습니다.</div>`;
}

function allPlanningEpisodes() {
  return data.catalog.episodes;
}

function activeEpisode() {
  return data.catalog.episodes.find((episode) => episode.id === state.planning.activeEpisodeId) || data.catalog.episodes[0];
}

function switchView(view) {
  activeView = view === "pipeline" ? "pipeline" : "planning";
  const planning = activeView === "planning";
  $("#planningView").hidden = !planning;
  $("#pipelineView").hidden = planning;
  $("#pipelineSidebar").hidden = planning;
  document.body.classList.toggle("planning-mode", planning);
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === activeView));
  if (window.location.hash !== `#${activeView}`) history.replaceState(null, "", `#${activeView}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function filteredEpisodes() {
  const query = $("#episodeSearch")?.value?.trim().toLowerCase() || "";
  const verification = $("#verificationFilter")?.value || "all";
  const sort = $("#episodeSort")?.value || "number";
  const episodes = data.catalog.episodes.filter((episode) => {
    const searchable = `${episode.title} ${episode.categoryLabel} ${episode.tone} ${episode.tags.join(" ")}`.toLowerCase();
    return (activeCategory === "all" || episode.category === activeCategory) &&
      (verification === "all" || episode.verification === verification) &&
      (!query || searchable.includes(query));
  });
  episodes.sort((a, b) => sort === "number" ? a.number - b.number : sort === "title" ? a.title.localeCompare(b.title, "ko") : b.score - a.score);
  return episodes;
}

function renderPlanning() {
  const selected = activeEpisode();
  $("#catalogCount").textContent = String(data.catalog.episodes.length);
  $("#shortlistCount").textContent = String(state.planning.shortlist.length);
  $("#activeEpisodeTitle").textContent = selected.title;
  $("#activeEpisodeStatus").textContent = selected.verification === "verified" ? "검증 완료 · 제작 가능" : "선택됨 · 팩트 리서치 필요";
  $("#categoryChips").innerHTML = [{ id: "all", label: "전체" }, ...data.catalog.categories].map((category) => {
    const count = category.id === "all" ? data.catalog.episodes.length : data.catalog.episodes.filter((item) => item.category === category.id).length;
    return `<button class="category-chip ${activeCategory === category.id ? "active" : ""}" data-category="${category.id}" type="button">${escapeHtml(category.label)} <span>${count}</span></button>`;
  }).join("");
  const episodes = filteredEpisodes();
  const visible = episodes.slice(0, catalogLimit);
  $("#episodeGrid").innerHTML = visible.map((episode) => {
    const shortlisted = state.planning.shortlist.includes(episode.id);
    const isActive = episode.id === state.planning.activeEpisodeId;
    const curationLabel = episode.curation === "pilot" ? "파일럿" : episode.curation === "strong_pick" ? "강력 추천" : episode.verification === "verified" ? "검증 완료" : "리서치 필요";
    return `<article class="episode-card ${isActive ? "selected" : ""}">
      <div class="episode-card-top"><span class="episode-number">#${String(episode.number).padStart(3, "0")}</span><span class="verification ${episode.curation} ${episode.verification}">${curationLabel}</span></div>
      <span class="episode-category">${escapeHtml(episode.categoryLabel)} · ${escapeHtml(episode.tone)}</span>
      <h3>${escapeHtml(episode.title)}</h3>
      <p>${escapeHtml(episode.hook)}</p>
      <div class="episode-meta"><span>${episode.targetSeconds}초</span><span>${episode.recommendedProvider === "flow" ? "Flow" : "Higgsfield"}</span><strong>${episode.score}</strong></div>
      <div class="episode-actions"><button class="text-button" data-episode-detail="${episode.id}" type="button">자세히</button><button class="shortlist-button ${shortlisted ? "active" : ""}" data-shortlist="${episode.id}" type="button" aria-label="${escapeHtml(episode.title)} 찜하기">${shortlisted ? "찜됨" : "+ 찜"}</button></div>
    </article>`;
  }).join("");
  $("#episodeEmpty").hidden = episodes.length > 0;
  $("#catalogResultCount").textContent = `전체 ${episodes.length}개 중 ${visible.length}개 표시`;
  $("#loadMoreEpisodes").hidden = visible.length >= episodes.length;
}

function openEpisode(id) {
  const episode = allPlanningEpisodes().find((item) => item.id === id);
  if (!episode) return;
  const active = episode.id === state.planning.activeEpisodeId;
  $("#episodeDialogEyebrow").textContent = `${episode.id} · ${episode.categoryLabel}`;
  $("#episodeDialogTitle").textContent = episode.title;
  $("#episodeDialogBody").innerHTML = `<div class="detail-grid">
    <div class="detail-stat"><span>추천 점수</span><strong>${episode.score}</strong></div>
    <div class="detail-stat"><span>목표 길이</span><strong>${episode.targetSeconds}초</strong></div>
    <div class="detail-stat"><span>권장 엔진</span><strong>${episode.recommendedProvider === "flow" ? "Google Flow" : "Higgsfield"}</strong></div>
  </div>
  <div class="detail-block"><h3>오프닝 훅</h3><p>${escapeHtml(episode.hook)}</p></div>\n  ${episode.core ? `<div class="detail-block"><h3>핵심 내용</h3><p>${escapeHtml(episode.core)}</p></div>` : ""}
  <div class="detail-block"><h3>시각 설계</h3><p>${escapeHtml(episode.visual)}</p></div>
  <div class="detail-block"><h3>우선 확인할 자료</h3><p>${escapeHtml(episode.sourceHint)}</p></div>
  <div class="dialog-actions"><button class="button button-primary" data-select-episode="${episode.id}" type="button" ${active ? "disabled" : ""}>${active ? "현재 선택된 기획" : "이 기획 선택"}</button></div>`;
  $("#episodeDialog").showModal();
}

async function selectEpisode(id) {
  try {
    const result = await request("/api/actions/select-episode", { method: "POST", body: JSON.stringify({ episodeId: id }) });
    state = result.state;
    scriptEditorDirty = false;
    await refreshData();
    if ($("#episodeDialog").open) $("#episodeDialog").close();
    toast(`“${result.episode.title}”을 다음 기획으로 선택했습니다. · ${result.artifact}`);
  } catch (error) { toast(error.message, "error"); }
}

function renderTypecast() {
  const config = state.settings.typecast;
  const status = data.typecast;
  const subscription = status.subscription;
  const number = (value) => new Intl.NumberFormat("ko-KR").format(Number(value || 0));
  $("#typecastConnection").textContent = status.connectionOk ? "API 연결됨" : status.apiKeyConfigured ? "연결 오류" : "API 키 미연결";
  $("#typecastConnection").classList.toggle("connected", status.connectionOk);
  $("#typecastCallout").innerHTML = status.connectionOk
    ? `<strong>Typecast ${escapeHtml(subscription?.plan || "API")} 연결 완료</strong><span>잔여 ${number(subscription?.remainingCredits)}자 / 월 ${number(subscription?.planCredits)}자 · 동시 생성 ${number(subscription?.concurrencyLimit)}개. 목소리 목록에서 필재 제공 여부를 확인하세요.</span>`
    : status.apiKeyConfigured
      ? `<strong>API 키를 확인할 수 없습니다.</strong><span>${escapeHtml(status.connectionError || "Typecast API 연결에 실패했습니다.")} 서버 환경변수를 수정한 뒤 다시 시작하세요.</span>`
      : `<strong>Studio 로그인과 API 연결은 별개입니다.</strong><span><code>TYPECAST_API_KEY</code>를 서버 환경변수로 설정하면 무료 API 플랜부터 연결할 수 있습니다. 키는 브라우저나 프로젝트 파일에 저장하지 않습니다.</span>`;
  $("#openTypecastApiConsole").href = status.apiConsoleUrl;
  $("#openTypecastStudio").href = status.studioUrl;
  $("#typecastVoiceId").value = config.voiceId;
  $("#typecastModel").value = config.model;
  $("#typecastTempo").value = config.tempo;
  $("#sentenceGapMs").value = config.sentenceGapMs;
  $("#narrationScript").textContent = data.narration.script;
  $("#scriptCharacters").textContent = `${data.narration.characters}자 · 목표 ${data.project.targetDuration}초`;
  $("#refreshVoicesButton").disabled = !status.connectionOk;
  $("#generateVoiceButton").disabled = !data.project.readyForProduction || (status.connectionOk && !config.voiceId);
  $("#generateVoiceButton").textContent = status.connectionOk ? "더빙 생성" : "Typecast Studio에서 생성";
  if (typecastVoices.length) {
    $("#typecastVoiceSelect").innerHTML = `<option value="">목소리를 선택하세요</option>` + typecastVoices.map((voice) => `<option value="${voice.voiceId}" ${voice.voiceId === config.voiceId ? "selected" : ""}>${escapeHtml(voice.voiceName)} · ${voice.gender === "male" ? "남성" : voice.gender === "female" ? "여성" : "미지정"}</option>`).join("");
  }
  $("#voiceResult").innerHTML = status.fileExists
    ? `<div class="voice-file-ready"><strong>WAV 준비됨</strong><span>${status.duration ?? "?"}초 · ${escapeHtml(status.expectedFile)}</span><audio controls preload="metadata" src="/media?path=${encodeURIComponent(status.expectedFile)}"></audio></div>`
    : `<span>아직 확인된 ${data.project.targetDuration}초용 Typecast WAV가 없습니다.</span>`;
}

function renderReferenceLibrary() {
  const library = data.referenceLibrary;
  if (!library) return;
  const groupLabels = { shape: "형태 고정", character: "조건부 캐릭터", brand: "조건부 브랜드" };
  $("#referenceLibraryStatus").textContent = library.ready ? "9/9 준비됨" : `${library.assets.filter((asset) => asset.exists).length}/9 준비`;
  $("#referenceLibraryStatus").classList.toggle("ready", library.ready);
  $("#referenceLibraryCards").innerHTML = library.assets.map((asset) => `<article class="reference-asset-card ${asset.exists ? "ready" : "missing"}">
    <div class="reference-thumb">${asset.exists ? `<img src="${asset.mediaUrl}" alt="${escapeHtml(asset.label)} 레퍼런스">` : `<span>파일 없음</span>`}</div>
    <div><span>${groupLabels[asset.group]}</span><strong>${escapeHtml(asset.label)}</strong><small>${escapeHtml(asset.file)}</small></div>
  </article>`).join("");
}
function renderVisualResearch() {
  const research = data.project.visualResearch || { complete: false, approved: false, references: [], warnings: [] };
  const officialComplete = Boolean(data.project.research?.complete);
  const status = $("#visualResearchStatus");
  const researchButton = $("#researchVisualReferencesButton");
  const approveButton = $("#approveVisualReferencesButton");
  status.textContent = research.approved ? `승인 완료 · ${research.selectedCount}개` : research.complete ? `검토 필요 · ${research.referenceCount}개` : "조사 전";
  status.classList.toggle("ready", research.approved);
  researchButton.disabled = research.complete || !officialComplete;
  researchButton.textContent = research.complete ? "조사 완료" : "시각 레퍼런스 조사";
  researchButton.title = officialComplete ? "" : "공식자료 조사를 먼저 완료하세요.";
  approveButton.disabled = !research.complete || research.approved || research.selectedCount < 1;
  approveButton.textContent = research.approved ? "승인 완료" : "선택 레퍼런스 승인";

  $("#visualResearchEmpty").hidden = research.complete;
  $("#visualGeometrySummary").hidden = !research.complete;
  $("#visualReferenceCards").hidden = !research.complete;
  if (!research.complete) {
    $("#visualResearchWarnings").hidden = true;
    return;
  }

  const geometry = research.geometry || {};
  const chips = (values) => (Array.isArray(values) ? values : []).map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  $("#visualGeometrySummary").innerHTML = `<div class="visual-geometry-heading"><span>GEOMETRY LOCK</span><strong>${escapeHtml(geometry.subjectKo || "형태 조사 완료")}</strong><small>승인 후 모든 컷의 이미지·영상 프롬프트에 자동으로 결합됩니다.</small></div>
    <div class="visual-geometry-groups">
      <section><h3>반드시 유지</h3><ul>${chips(geometry.invariantsKo)}</ul></section>
      <section><h3>단면·조립</h3><ul>${chips(geometry.constructionKo)}</ul></section>
      <section class="visual-geometry-errors"><h3>만들면 안 되는 형태</h3><ul>${chips(geometry.commonErrorsKo)}</ul></section>
    </div>`;

  const typeLabels = { patent: "특허 도면", official: "공식 자료", research: "원 논문", museum: "박물관", archive: "기록 보관소", manufacturer: "제조사" };
  const licenseLabels = { "public-domain": "공개 도메인", "open-license": "오픈 라이선스", "source-link-only": "링크 검토만", unknown: "권리 미확인" };
  $("#visualReferenceCards").innerHTML = research.references.map((item) => `<article class="visual-source-card ${item.selected !== false ? "selected" : ""}">
    <label class="visual-source-select"><input type="checkbox" data-visual-reference-selection="${escapeHtml(item.id)}" ${item.selected !== false ? "checked" : ""}><span>프롬프트에 사용</span></label>
    ${item.mediaUrl ? `<div class="visual-source-thumb"><img src="${item.mediaUrl}" alt="${escapeHtml(item.title)} 레퍼런스 미리보기" loading="lazy"></div>` : ""}
    <div class="visual-source-body">
      <div class="visual-source-meta"><span>${escapeHtml(typeLabels[item.sourceType] || item.sourceType)}</span><b>신뢰도 ${escapeHtml(item.authorityScore)}/5</b></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.whyUsefulKo)}</p>
      <div class="visual-source-footer"><span>${escapeHtml(licenseLabels[item.license] || item.license)}</span><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">원문 보기 ${icon("i-chevron")}</a></div>
      ${item.downloadError ? `<small class="visual-source-error">이미지 저장 제외 · ${escapeHtml(item.downloadError)}</small>` : ""}
    </div>
  </article>`).join("");

  const warnings = Array.isArray(research.warnings) ? research.warnings.filter(Boolean) : [];
  $("#visualResearchWarnings").hidden = warnings.length === 0;
  $("#visualResearchWarnings").innerHTML = warnings.length ? `<strong>검토 메모</strong><ul>${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
}

function renderFlowPromptWorkbench() {
  const flowCuts = state.shots.filter((shot) => shot.provider === "flow").length;
  const button = $("#buildFlowPromptsButton");
  const redesign = $("#flowVisualDesignButton");
  if (!button || !redesign) return;
  button.disabled = !data.project.readyForProduction;
  redesign.disabled = !data.project.readyForProduction;
  const plan = data.project.visualPlan;
  const diversity = plan?.diversity;
  $("#flowPromptStatus").textContent = !data.project.readyForProduction
    ? "18문장 대본을 완성하면 시각 설계와 Flow 프롬프트를 만들 수 있습니다."
    : plan?.status === "ready"
      ? `시각 설계 준비됨 · 모드 ${diversity?.presentationModes || 0}종 · 앵글 ${diversity?.cameraAngles || 0}종 · 샷 ${diversity?.shotSizes || 0}종 · 카메라 이동 ${diversity?.cameraMoves || 0}종 · 테돌이 엑스트라 ${diversity?.tedoriExtras || 0}컷 · Flow 선택 ${flowCuts}컷`
      : `18컷 증거 기반 시각 설계 필요 · 현재 Flow 선택 ${flowCuts}컷 · 영어 입력 권장`;
}

function renderAll() {
  renderProjectHeader();
  renderScriptEditor();
  renderReferenceLibrary();
  renderVisualResearch();
  renderPlanning();
  renderStageNav();
  renderMetrics();
  renderProductionLaunch();
  renderFlowPromptWorkbench();
  renderProviders();
  renderAutomation();
  renderShots();
  renderImageProgress();
  renderStoryboardSheets();
  renderCreditSamples();
  renderBudget();
  renderArtifacts();
  renderTypecast();
}

function scheduleSave() {
  setSaveState("변경사항 저장 중", true);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 450);
}

async function saveState(showToast = false) {
  clearTimeout(saveTimer);
  try {
    const result = await request("/api/state", { method: "PUT", body: JSON.stringify(state) });
    state = result.state;
    setSaveState("모든 변경사항 저장됨");
    if (showToast) toast("설정을 저장했습니다.");
  } catch (error) {
    setSaveState("저장 실패", true);
    toast(error.message, "error");
  }
}

async function generateStoryboardMedia() {
  if (!data.higgsfield?.authenticated) throw new Error("Higgsfield 로그인을 먼저 완료하세요.");
  await saveState();
  const selected = state.shots.filter((shot) => shot.selected !== false);
  const pending = selected.filter((shot) => {
    const source = data.project.shots.find((item) => item.index === shot.index);
    return !source?.generation?.exists;
  });
  const targets = pending.length ? pending : selected;
  if (!targets.length) throw new Error("생성할 컷을 하나 이상 선택하세요.");
  const estimated = targets.reduce((sum, shot) => sum + Number(data.higgsfield.imageCosts?.[shot.imageModel] || 0), 0);
  if (estimated > Number(data.higgsfield.credits || 0)) throw new Error(`예상 ${estimated}cr가 잔여 ${Number(data.higgsfield.credits || 0).toFixed(1)}cr를 초과합니다.`);
  if (!window.confirm(`${targets.length}컷의 스토리보드 이미지를 Higgsfield에서 실제 생성합니다.\n예상 ${estimated}cr · 현재 잔여 ${Number(data.higgsfield.credits || 0).toFixed(1)}cr\n계속할까요?`)) return;
  const buttons = [...document.querySelectorAll('[data-run-stage="keyframes"]')];
  buttons.forEach((button) => button.setAttribute("disabled", ""));
  try {
    for (let index = 0; index < targets.length; index += 1) {
      const shot = targets[index];
      updateOperationProgress("image", { percent: Math.round(index / targets.length * 94), label: `CUT ${String(shot.index).padStart(2, "0")} 실제 이미지 생성`, detail: `${index}/${targets.length} 완료 · Higgsfield ${imageModelLabels[shot.imageModel] || shot.imageModel}`, status: "running" });
      await request("/api/higgsfield/generate-image", { method: "POST", body: JSON.stringify({ cut: shot.index, force: pending.length === 0 }) });
    }
    const stageResult = await request("/api/actions/run-stage", { method: "POST", body: JSON.stringify({ stageId: "keyframes" }) });
    await refreshData();
    updateOperationProgress("image", { percent: 100, label: "스토리보드 실제 생성 완료", detail: `${targets.length}컷 저장 · 검토 시트 2장 갱신`, status: "complete" });
    toast(stageResult.message);
  } catch (error) {
    updateOperationProgress("image", { percent: 100, label: "스토리보드 생성을 멈췄습니다", detail: error.message, status: "error" });
    throw error;
  } finally {
    buttons.forEach((button) => button.removeAttribute("disabled"));
  }
}

async function generateVideoMedia() {
  if (!data.higgsfield?.authenticated) throw new Error("Higgsfield 로그인을 먼저 완료하세요.");
  await saveState();
  const variants = Number(state.settings.variants || 1);
  const targets = state.shots.filter((shot) => shot.selected !== false && shot.provider === "higgsfield").filter((shot) => {
    if (shot.generationMode === "direct") return true;
    return shot.keyframeApproved === true;
  });
  if (!targets.length) throw new Error("자동 생성할 Higgsfield 컷이 없습니다. 영상 엔진을 Higgsfield로 바꾸고, 키프레임 방식이면 이미지를 승인하세요.");
  const estimated = targets.reduce((sum, shot) => sum + Number(data.higgsfield.videoCosts?.[shot.model] || 0) * variants, 0);
  if (estimated > Number(data.higgsfield.credits || 0)) throw new Error(`예상 ${estimated}cr가 잔여 ${Number(data.higgsfield.credits || 0).toFixed(1)}cr를 초과합니다. 변형 수나 모델을 낮추세요.`);
  if (!window.confirm(`${targets.length}컷 × ${variants}개 변형을 Higgsfield에서 실제 생성합니다.\n예상 ${estimated}cr · 현재 잔여 ${Number(data.higgsfield.credits || 0).toFixed(1)}cr\nFlow로 설정된 컷은 생성하지 않습니다. 계속할까요?`)) return;
  const buttons = [...document.querySelectorAll('[data-run-stage="video"]')];
  buttons.forEach((button) => button.setAttribute("disabled", ""));
  const total = targets.length * variants;
  let completed = 0;
  try {
    for (const shot of targets) {
      for (let variant = 1; variant <= variants; variant += 1) {
        updateOperationProgress("video", { percent: Math.round(completed / total * 94), label: `CUT ${String(shot.index).padStart(2, "0")} 영상 생성`, detail: `${completed}/${total} 완료 · 변형 ${variant}/${variants} · ${modelLabels[shot.model] || shot.model}`, status: "running", visible: true });
        await request("/api/higgsfield/generate-video", { method: "POST", body: JSON.stringify({ cut: shot.index, variant }) });
        completed += 1;
      }
    }
    const stageResult = await request("/api/actions/run-stage", { method: "POST", body: JSON.stringify({ stageId: "video" }) });
    await refreshData();
    updateOperationProgress("video", { percent: 100, label: "영상 실제 생성 완료", detail: `${completed}개 클립을 저장했습니다.`, status: "complete", visible: true });
    toast(stageResult.message);
  } catch (error) {
    updateOperationProgress("video", { percent: 100, label: "영상 생성을 멈췄습니다", detail: error.message, status: "error", visible: true });
    throw error;
  } finally {
    buttons.forEach((button) => button.removeAttribute("disabled"));
  }
}

async function buildFlowPromptPackage(force = false) {
  const button = $("#buildFlowPromptsButton");
  const redesign = $("#flowVisualDesignButton");
  const buttonLabel = button.querySelector("span");
  const redesignLabel = redesign.querySelector("span");
  button.disabled = true;
  redesign.disabled = true;
  (force ? redesignLabel : buttonLabel).textContent = force ? "시각 설계 생성 중…" : "Flow 프롬프트 정리 중…";
  $("#flowPromptStatus").textContent = force ? "공식자료·구조 레퍼런스로 18컷의 장면 역할과 카메라를 다시 설계하고 있습니다." : "저장된 시각 설계를 확인하고 컷별 Flow 이미지·영상 지시문을 정리합니다.";
  const progress = startOperationProgress("flowPrompt", [
    { at: 0, percent: 7, label: "18문장과 근거 정렬", detail: "각 문장을 공식 사실 ID와 연결합니다." },
    { at: 8, percent: 22, label: "구조 오류 잠금", detail: "레퍼런스의 형태·부품·금지 오류를 적용합니다." },
    { at: 30, percent: 48, label: "컷별 증거 모드 배치", detail: "전경·단면·매크로·규칙 도해를 교차합니다." },
    { at: 65, percent: 70, label: "카메라와 동작 검수", detail: "반복 구도와 장식용 화살표를 제거합니다." },
    { at: 110, percent: 87, label: "Flow 프롬프트 압축", detail: "이미지 첫 프레임과 영상 동작을 분리합니다." }
  ]);
  try {
    await saveState();
    const result = await request("/api/flow/prompts", { method: "POST", body: JSON.stringify({ force }) });
    await refreshData();
    const d = result.diversity || {};
    const suffix = result.warning ? ` · 안전 대체: ${result.warning}` : "";
    $("#flowPromptStatus").textContent = `${result.cuts}컷 완료 · 모드 ${d.presentationModes || 0}종 · 앵글 ${d.cameraAngles || 0}종 · 샷 ${d.shotSizes || 0}종 · 이동 ${d.cameraMoves || 0}종 · ${result.cached ? "저장 설계 재사용" : "새 설계 저장"}${suffix}`;
    progress.complete("Flow 프롬프트 준비 완료", `${result.cuts}컷 · ${result.provider} · ${result.markdownArtifact}`);
    toast(`${result.message} 컷 상세에서 설계 근거와 프롬프트를 확인할 수 있습니다.`);
  } catch (error) {
    $("#flowPromptStatus").textContent = error.message;
    progress.fail(error.message);
    toast(error.message, "error");
  } finally {
    button.disabled = !data.project.readyForProduction;
    redesign.disabled = !data.project.readyForProduction;
    buttonLabel.textContent = "Flow 프롬프트 패키지 만들기";
    redesignLabel.textContent = "시각 설계 다시 만들기";
  }
}

async function runStage(stageId) {
  if (stageId === "keyframes") {
    try { await generateStoryboardMedia(); } catch (error) { toast(error.message, "error"); }
    return;
  }
  if (stageId === "video") {
    try { await generateVideoMedia(); } catch (error) { toast(error.message, "error"); }
    return;
  }
  if (stageId === "edit") {
    document.querySelector(".edit-bgm-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast("편집 패널에서 자막·BGM을 선택하고 '최종 영상 조립'을 누르세요.");
    return;
  }
  const stage = state.stages.find((item) => item.id === stageId);
  if (stage.status === "ready_review" && stageId !== "keyframes") {
    stage.status = "complete";
    stage.note = "사용자 승인 완료";
    renderAll();
    scheduleSave();
    toast(`${stageMeta[stageId].title} 단계를 승인했습니다.`);
    return;
  }
  if (stage.mode === "manual") {
    activeStage = stageId;
    renderStageNav();
    document.querySelector(`[data-stage-nav="${stageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    toast("수동 단계입니다. 필요한 파일을 준비한 뒤 다시 실행하세요.");
    return;
  }
  const buttons = [...document.querySelectorAll(`[data-run-stage="${stageId}"]`)];
  buttons.forEach((button) => button.setAttribute("disabled", ""));
  const imageProgress = stageId === "keyframes" ? startOperationProgress("image", [
    { at: 0, percent: 8, label: "18컷 시작 프레임 정리", detail: "모든 컷의 첫 장면 이미지 지시문을 확인합니다." },
    { at: 1, percent: 22, label: "레퍼런스 연결", detail: "코트·공·네트·라켓 기준 이미지를 묶습니다." },
    { at: 2, percent: 30, label: "스토리보드 시트 조립", detail: "CUT 01–09와 CUT 10–18을 두 장으로 묶습니다." }
  ]) : null;
  try {
    const result = await request("/api/actions/run-stage", { method: "POST", body: JSON.stringify({ stageId }) });
    state = result.state;
    imageProgress?.stop();
    await refreshData();
    toast(result.artifact ? `${result.message} · ${result.artifact}` : result.message);
  } catch (error) {
    imageProgress?.fail(error.message);
    toast(error.message, "error");
  } finally {
    buttons.forEach((button) => button.removeAttribute("disabled"));
  }
}

function openShot(index) {
  const source = data.project.shots.find((item) => item.index === index);
  const shot = state.shots.find((item) => item.index === index);
  $("#dialogEyebrow").textContent = `CUT ${String(index).padStart(2, "0")} · ${source.time}`;
  $("#dialogTitle").textContent = source.narration;
  const language = state.settings.language === "ko" ? "ko" : "en";
  const isFlow = shot.provider === "flow";
  const imagePrompt = isFlow ? source.flowPrompts.image[language] : (language === "ko" ? source.imagePromptKo : source.imagePromptEn);
  const videoPrompt = isFlow ? source.flowPrompts.video[language] : (language === "ko" ? source.videoPromptKo : source.videoPromptEn);
  const generation = source.generation;
  const flowReferences = source.flowPrompts.referenceFiles || [];
  const promptEditor = (kind, value) => isFlow
    ? `<textarea class="prompt-box flow-prompt-editor" id="flowPrompt-${kind}-${index}" data-flow-prompt-editor="${kind}" data-flow-cut="${index}" spellcheck="false">${escapeHtml(value)}</textarea>`
    : `<div class="prompt-box">${escapeHtml(value)}</div>`;
  const promptActions = (kind) => `<div class="prompt-actions">${isFlow ? `<button class="text-button" data-save-flow-prompt="${kind}" data-flow-cut="${index}" type="button">수정 저장</button>` : ""}<button class="text-button" data-copy-prompt="${kind}" data-copy-cut="${index}" type="button">복사</button></div>`;
  $("#shotDialogBody").innerHTML = `<div class="detail-grid detail-grid-four">
    <div class="detail-stat"><span>길이</span><strong>${source.duration.toFixed(1)}초</strong></div>
    <div class="detail-stat"><span>생성 방식</span><strong>${generationModeLabels[shot.generationMode]}</strong></div>
    <div class="detail-stat"><span>생성 엔진</span><strong>${shot.provider === "flow" ? "Google Flow" : "Higgsfield"}</strong></div>
    <div class="detail-stat"><span>모델</span><strong>${modelLabels[shot.model] || shot.model}</strong></div>
  </div>
  <div class="detail-block"><h3>내레이션</h3><p>${escapeHtml(source.narration)}</p></div>
  ${isFlow ? `<div class="flow-dialog-guide"><strong>Flow 적용</strong><span>영어 프롬프트 권장 · 이미지 생성 시 Ingredients를 첨부하고, 영상 생성 시 승인 이미지를 시작 프레임으로 사용합니다.</span><div>${flowReferences.length ? flowReferences.map((file) => `<code>${escapeHtml(file)}</code>`).join("") : "<code>추가 레퍼런스 없음</code>"}</div></div>` : ""}
  ${source.visualDesign ? `<div class="detail-block visual-design-summary"><h3>증거 기반 시각 설계</h3><div class="visual-design-chips"><span>${escapeHtml(source.flowPrompts.visualDesign?.presentationModeKo || source.visualDesign.presentationMode)}</span><span>${escapeHtml(source.flowPrompts.visualDesign?.cameraAngleKo || source.visualDesign.cameraAngle)}</span><span>${escapeHtml(source.flowPrompts.visualDesign?.shotSizeKo || source.visualDesign.shotSize)}</span><span>${escapeHtml(source.visualDesign.lens)}</span><span>${escapeHtml(source.flowPrompts.visualDesign?.cameraMoveKo || source.visualDesign.cameraMove)}</span></div><p><b>첫 프레임</b> ${escapeHtml(source.visualDesign.startFrameKo)}</p><p><b>실제 동작</b> ${escapeHtml(source.visualDesign.actionKo)}</p>${source.visualDesign.playfulBridge?.enabled ? `<p><b>재미 브리지 · ${escapeHtml(source.visualDesign.playfulBridge.maxSeconds)}초</b> ${escapeHtml(source.visualDesign.playfulBridge.openingImageKo)} → ${escapeHtml(source.visualDesign.playfulBridge.transitionKo)}</p><p><b>사실 경계</b> ${escapeHtml(source.visualDesign.playfulBridge.factualBoundaryKo)}</p>` : ""}${source.visualDesign.tedoriExtra?.enabled ? `<p><b>테돌이 엑스트라</b> ${escapeHtml(source.visualDesign.tedoriExtra.roleKo)} ${escapeHtml(source.visualDesign.tedoriExtra.placementKo)}</p><p><b>작은 동작</b> ${escapeHtml(source.visualDesign.tedoriExtra.actionKo)}</p>` : ""}<p><b>인포그래픽 근거</b> ${escapeHtml(source.visualDesign.infographic?.factKo || "없음")} · <code>${escapeHtml(source.visualDesign.infographic?.labelEnglish || "NONE")}</code></p><p><b>공식 사실 ID</b> ${(source.visualDesign.evidenceFactIds || []).map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}</p></div>` : ""}
  <div class="detail-block prompt-section"><div class="detail-block-heading"><h3>01 · ${isFlow ? "Flow 시작 이미지" : "스토리보드 시작 이미지"} 프롬프트</h3>${promptActions("image")}</div>${promptEditor("image", imagePrompt)}</div>
  <div class="keyframe-result ${generation.exists ? "has-image" : ""}">
    <div class="keyframe-preview">${generation.exists ? `<img src="${generation.mediaUrl}" alt="CUT ${index} 스토리보드 시작 프레임 미리보기">` : `<span>${icon("i-layers")}<b>첫 장면 이미지를 등록하세요</b><small>PNG · 최대 12MB</small></span>`}</div>
    <div class="keyframe-actions"><strong>${imageModelLabels[shot.imageModel]}</strong><small>${escapeHtml(generation.expectedFile)}</small><label class="button button-small button-outline file-button">PNG 선택<input id="keyframeFile-${index}" type="file" accept="image/png"></label><button class="button button-small button-outline" data-upload-keyframe="${index}" type="button">시작 프레임 등록</button>${generation.exists ? `<button class="button button-small ${generation.approved ? "button-outline" : "button-primary"}" data-approve-keyframe="${index}" data-approved="${generation.approved}" type="button">${generation.approved ? "승인 해제" : "이 프레임 승인"}</button>` : ""}</div>
  </div>
  ${shot.generationMode === "direct" ? `<div class="direct-video-callout"><strong>이 이미지는 스토리보드 검토용입니다.</strong><span>영상은 선택한 ‘바로 영상’ 방식으로 별도 생성됩니다.</span></div>` : ""}
  <div class="detail-block prompt-section"><div class="detail-block-heading"><h3>02 · ${isFlow ? "Flow " : ""}${shot.generationMode === "keyframe" ? "이미지→영상" : "바로 영상"} 프롬프트</h3>${promptActions("video")}</div>${promptEditor("video", videoPrompt)}</div>
  <div class="detail-block"><h3>레퍼런스 잠금</h3><p>코트·공·네트·라켓 형태 레퍼런스 4종 필수 · 왜곡과 프레임 간 형태 변이 금지</p></div>
  <div class="detail-block"><h3>캐릭터·브랜드 정책</h3><p>캐릭터가 필요하면 테돌이만 사용 · 간판이나 브랜드가 필요하면 테니스노트 로고·아이콘만 사용</p></div>`;
  if (!$("#shotDialog").open) $("#shotDialog").showModal();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function uploadKeyframe(index, button) {
  const input = document.getElementById(`keyframeFile-${index}`);
  const file = input?.files?.[0];
  if (!file) return toast("등록할 PNG 이미지를 선택하세요.", "error");
  if (file.type !== "image/png" || file.size > 12_000_000) return toast("12MB 이하 PNG 파일만 등록할 수 있습니다.", "error");
  button.disabled = true;
  button.textContent = "등록 중…";
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await request("/api/keyframes/upload", { method: "POST", body: JSON.stringify({ cut: index, dataUrl }) });
    state = result.state;
    await refreshData();
    openShot(index);
    toast(result.message);
  } catch (error) { toast(error.message, "error"); }
  finally { button.disabled = false; }
}

async function validateEnvironment() {
  $("#validationBody").innerHTML = `<div class="empty-state">프로젝트 파일을 검사하고 있습니다.</div>`;
  $("#validationDialog").showModal();
  try {
    const result = await request("/api/actions/validate", { method: "POST", body: "{}" });
    $("#validationBody").innerHTML = `<div class="validation-list">${result.checks.map((check) => `<div class="validation-item ${check.ok ? "ok" : ""}">
      <span class="validation-mark">${check.ok ? icon("i-check") : icon("i-close")}</span>
      <span><strong>${escapeHtml(check.label)}</strong><small>${escapeHtml(check.detail)}</small></span>
    </div>`).join("")}</div>`;
  } catch (error) {
    $("#validationBody").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) switchView(viewButton.dataset.view);
    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      activeCategory = categoryButton.dataset.category;
      catalogLimit = 36;
      renderPlanning();
    }
    const episodeDetail = event.target.closest("[data-episode-detail]");
    if (episodeDetail) openEpisode(episodeDetail.dataset.episodeDetail);
    const episodeSelect = event.target.closest("[data-select-episode]");
    if (episodeSelect) await selectEpisode(episodeSelect.dataset.selectEpisode);
    const shortlistButton = event.target.closest("[data-shortlist]");
    if (shortlistButton) {
      const id = shortlistButton.dataset.shortlist;
      state.planning.shortlist = state.planning.shortlist.includes(id)
        ? state.planning.shortlist.filter((item) => item !== id)
        : [id, ...state.planning.shortlist];
      renderPlanning();
      scheduleSave();
    }
    const defaultButton = event.target.closest("[data-provider-default]");
    if (defaultButton) {
      state.settings.defaultProvider = defaultButton.dataset.providerDefault;
      renderProviders(); renderBudget();
      scheduleSave();
    }
    const nav = event.target.closest("[data-stage-nav]");
    if (nav) {
      activeStage = nav.dataset.stageNav;
      renderStageNav();
      document.querySelector(`#stage-${activeStage}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const stageButton = event.target.closest("[data-run-stage]");
    if (stageButton) await runStage(stageButton.dataset.runStage);
    const detail = event.target.closest("[data-shot-detail]");
    if (detail) openShot(Number(detail.dataset.shotDetail));
    const copyPrompt = event.target.closest("[data-copy-prompt]");
    if (copyPrompt) {
      const cut = Number(copyPrompt.dataset.copyCut);
      const kind = copyPrompt.dataset.copyPrompt;
      const source = data.project.shots.find((item) => item.index === cut);
      const shot = state.shots.find((item) => item.index === cut);
      const editor = document.getElementById(`flowPrompt-${kind}-${cut}`);
      const prompt = editor?.value || (shot.provider === "flow"
        ? source.flowPrompts[kind][state.settings.language === "ko" ? "ko" : "en"]
        : kind === "image"
          ? (state.settings.language === "ko" ? source.imagePromptKo : source.imagePromptEn)
          : (state.settings.language === "ko" ? source.videoPromptKo : source.videoPromptEn));
      try { await navigator.clipboard.writeText(prompt); toast(`${shot.provider === "flow" ? "Flow " : ""}프롬프트를 복사했습니다.`); }
      catch { toast("클립보드 복사 권한을 확인하세요.", "error"); }
    }
    const saveFlowPrompt = event.target.closest("[data-save-flow-prompt]");
    if (saveFlowPrompt) {
      const cut = Number(saveFlowPrompt.dataset.flowCut);
      const kind = saveFlowPrompt.dataset.saveFlowPrompt;
      const editor = document.getElementById(`flowPrompt-${kind}-${cut}`);
      saveFlowPrompt.disabled = true;
      try {
        const result = await request("/api/flow/prompt", { method: "PUT", body: JSON.stringify({ cut, kind, language: state.settings.language, prompt: editor.value }) });
        state = result.state;
        data.project = result.project;
        openShot(cut);
        toast(result.message);
      } catch (error) { toast(error.message, "error"); }
      finally { saveFlowPrompt.disabled = false; }
    }
    const uploadButton = event.target.closest("[data-upload-keyframe]");
    if (uploadButton) await uploadKeyframe(Number(uploadButton.dataset.uploadKeyframe), uploadButton);
    const approveButton = event.target.closest("[data-approve-keyframe]");
    if (approveButton) {
      try {
        const index = Number(approveButton.dataset.approveKeyframe);
        const result = await request("/api/keyframes/approve", { method: "POST", body: JSON.stringify({ cut: index, approved: approveButton.dataset.approved !== "true" }) });
        state = result.state; await refreshData(); openShot(index); toast(result.message);
      } catch (error) { toast(error.message, "error"); }
    }
    const close = event.target.closest("[data-close-dialog]");
    if (close) document.getElementById(close.dataset.closeDialog)?.close();
  });

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.matches("[data-stage-mode]")) {
      state.stages.find((stage) => stage.id === target.dataset.stageMode).mode = target.value;
      scheduleSave();
    }
    if (target.matches("[data-shot-provider]")) {
      const shot = state.shots.find((item) => item.index === Number(target.dataset.shotProvider));
      shot.provider = target.value;
      shot.model = target.value === "flow" ? "veo-3.1-fast" : "cinema-studio-4";
      renderAll(); scheduleSave();
    }
    if (target.matches("[data-shot-generation-mode]")) {
      const shot = state.shots.find((item) => item.index === Number(target.dataset.shotGenerationMode));
      shot.generationMode = target.value;
      if (shot.flowPromptOverrides) { shot.flowPromptOverrides.videoKo = ""; shot.flowPromptOverrides.videoEn = ""; }
      renderAll();
      await saveState();
      await refreshData();
      toast(`${generationModeLabels[target.value]} 방식으로 변경했습니다.`);
    }
    if (target.matches("[data-shot-image-model]")) {
      const shot = state.shots.find((item) => item.index === Number(target.dataset.shotImageModel));
      shot.imageModel = target.value;
      renderCreditSamples(); renderBudget(); scheduleSave();
    }
    if (target.matches("[data-shot-model]")) {
      state.shots.find((item) => item.index === Number(target.dataset.shotModel)).model = target.value;
      renderMetrics(); renderBudget(); scheduleSave();
    }
    if (target.matches("[data-shot-selected]")) {
      state.shots.find((item) => item.index === Number(target.dataset.shotSelected)).selected = target.checked;
      renderShots(); scheduleSave();
    }
  });

  $("#variantSelect").addEventListener("change", (event) => {
    state.settings.variants = Number(event.target.value); renderMetrics(); renderBudget(); scheduleSave();
  });
  $("#languageSelect").addEventListener("change", (event) => {
    state.settings.language = event.target.value; scheduleSave();
  });
  $("#silentToggle").addEventListener("change", (event) => {
    state.settings.silentGeneration = event.target.checked; scheduleSave();
  });
  $("#labelsToggle").addEventListener("change", (event) => {
    state.settings.addTechnicalLabelsInPost = event.target.checked; scheduleSave();
  });
  $("#applyProviderAll").addEventListener("click", () => {
    const provider = state.settings.defaultProvider;
    state.shots.forEach((shot) => {
      shot.provider = provider;
      shot.model = provider === "flow" ? "veo-3.1-fast" : "cinema-studio-4";
    });
    renderAll(); scheduleSave(); toast(`${provider === "flow" ? "Flow" : "Higgsfield"}를 전체 컷에 적용했습니다.`);
  });
  $("#shotSearch").addEventListener("input", renderShots);
  $("#providerFilter").addEventListener("change", renderShots);
  $("#selectAllShots").addEventListener("change", (event) => {
    state.shots.forEach((shot) => { shot.selected = event.target.checked; });
    renderShots(); scheduleSave();
  });
  $("#bulkProvider").addEventListener("change", () => renderBulkModelSelect());
  $("#applyBulkMode").addEventListener("click", async () => {
    const mode = $("#bulkGenerationMode").value;
    const selected = state.shots.filter((shot) => shot.selected);
    if (!selected.length) return toast("먼저 변경할 컷을 선택하세요.", "error");
    selected.forEach((shot) => {
      shot.generationMode = mode;
      if (shot.flowPromptOverrides) { shot.flowPromptOverrides.videoKo = ""; shot.flowPromptOverrides.videoEn = ""; }
    });
    renderAll(); await saveState(); await refreshData();
    toast(`${selected.length}개 컷을 ${generationModeLabels[mode]} 방식으로 변경했습니다.`);
  });
  $("#applyBulkImageModel").addEventListener("click", () => {
    const model = $("#bulkImageModel").value;
    const selected = state.shots.filter((shot) => shot.selected);
    if (!selected.length) return toast("먼저 변경할 컷을 선택하세요.", "error");
    selected.forEach((shot) => { shot.imageModel = model; });
    renderAll(); scheduleSave(); toast(`${selected.length}개 스토리보드 프레임에 ${imageModelLabels[model]}를 적용했습니다.`);
  });
  $("#applyBulkProvider").addEventListener("click", () => {
    const provider = $("#bulkProvider").value;
    const model = $("#bulkModel").value;
    const selected = state.shots.filter((shot) => shot.selected);
    if (!selected.length) return toast("먼저 변경할 컷을 선택하세요.", "error");
    selected.forEach((shot) => { shot.provider = provider; shot.model = model; });
    renderAll(); scheduleSave();
    toast(`${selected.length}개 컷을 ${modelLabels[model] || model} 모델로 변경했습니다.`);
  });
  $("#buildFlowPromptsButton").addEventListener("click", () => buildFlowPromptPackage(false));
  $("#flowVisualDesignButton").addEventListener("click", () => buildFlowPromptPackage(true));
  $("#saveButton").addEventListener("click", () => saveState(true));
  $("#validateButton").addEventListener("click", validateEnvironment);
  $("#exportButton").addEventListener("click", async () => {
    await saveState();
    try {
      const result = await request("/api/actions/export", { method: "POST", body: "{}" });
      toast(`${result.jobs}개 작업을 ${result.artifact}에 저장했습니다.`);
    } catch (error) { toast(error.message, "error"); }
  });
  $("#runNextButton").addEventListener("click", () => {
    const next = state.stages.find((stage) => stage.status !== "complete");
    if (next) runStage(next.id);
    else toast("모든 단계가 완료되었습니다.");
  });
  $("#budgetContent").addEventListener("change", (event) => {
    if (event.target.id === "higgsfieldCostInput") {
      state.settings.higgsfieldCostPerGeneration = Math.max(0, Number(event.target.value || 0));
      renderMetrics(); renderBudget(); scheduleSave();
    }
  });
  $("#episodeSearch").addEventListener("input", () => { catalogLimit = 36; renderPlanning(); });
  $("#episodeSort").addEventListener("change", () => { catalogLimit = 36; renderPlanning(); });
  $("#verificationFilter").addEventListener("change", () => { catalogLimit = 36; renderPlanning(); });
  $("#loadMoreEpisodes").addEventListener("click", () => { catalogLimit += 36; renderPlanning(); });
  $("#continueSelectedButton").addEventListener("click", () => {
    switchView("pipeline");
    renderProjectHeader();
    renderScriptEditor();
  });

  $("#scriptEditor").addEventListener("input", () => {
    scriptEditorDirty = true;
    const progress = $("#scriptProgress");
    if (progress?.dataset.status === "error") progress.hidden = true;
  });
  $("#scriptRhythmProfile").addEventListener("change", (event) => {
    state.settings.scriptRhythmProfile = event.target.value;
    renderScriptEditor();
    scheduleSave();
    toast("다음 문장 다듬기부터 선택한 슬롯 리듬을 적용합니다.");
  });
  $("#researchScriptButton").addEventListener("click", async () => {
    const button = $("#researchScriptButton");
    const rewriteButton = $("#rewriteScriptButton");
    button.disabled = true;
    rewriteButton.disabled = true;
    button.textContent = "공식자료 조사 중…";
    const progress = startOperationProgress("script", [
      { at: 0, percent: 6, label: "조사 요청 준비", detail: "주제와 조사 범위를 정리합니다." },
      { at: 3, percent: 24, label: "공식·1차 자료 검색", detail: "공식 문서, 특허, 논문과 규정을 찾고 있습니다." },
      { at: 18, percent: 48, label: "출처 교차 검증", detail: "핵심 사실과 수치가 출처와 일치하는지 확인합니다." },
      { at: 42, percent: 72, label: "재사용 팩트 정리", detail: "문장 수정에 반복 사용할 근거를 구조화합니다." },
      { at: 75, percent: 90, label: "조사자료 저장", detail: "에피소드 전용 조사 캐시에 저장합니다." }
    ]);
    toast("공식자료를 한 번 조사해 에피소드 전용 근거로 저장합니다.");
    try {
      const result = await request("/api/actions/research-script", { method: "POST", body: "{}" });
      await refreshData();
      progress.complete(result.cached ? "저장된 조사자료 확인" : "공식자료 조사 완료", result.cached ? "기존 출처를 그대로 재사용합니다." : "이후 문장 다듬기에서는 검색하지 않습니다.");
      toast(result.message);
    } catch (error) {
      progress.fail(error.message);
      toast(error.message, "error");
      renderScriptEditor();
    }
  });
  $("#researchVisualReferencesButton").addEventListener("click", async () => {
    const button = $("#researchVisualReferencesButton");
    const approveButton = $("#approveVisualReferencesButton");
    button.disabled = true;
    approveButton.disabled = true;
    button.textContent = "시각 레퍼런스 조사 중…";
    const progress = startOperationProgress("visualResearch", [
      { at: 0, percent: 6, label: "대상 구조 분해", detail: "특정 제품인지 구조 방식의 통칭인지 구분합니다." },
      { at: 4, percent: 24, label: "특허·공식 자료 검색", detail: "구조를 직접 보여주는 1차 자료를 찾습니다." },
      { at: 18, percent: 46, label: "단면·조립 관계 확인", detail: "부품 수, 앞뒤 관계와 결합 방식을 정리합니다." },
      { at: 38, percent: 68, label: "실물 기록 교차 확인", detail: "도면과 실제 외형이 일치하는지 비교합니다." },
      { at: 62, percent: 84, label: "사용 권리 분류", detail: "공개 사용 가능한 이미지만 로컬 저장 대상으로 고릅니다." },
      { at: 88, percent: 94, label: "형태 잠금 팩 저장", detail: "잘못된 형태 방지 규칙과 출처를 저장합니다." }
    ]);
    toast("특허·논문·실물 기록을 교차 확인합니다. 에피소드마다 한 번만 실행됩니다.");
    try {
      const result = await request("/api/actions/research-visual-references", { method: "POST", body: "{}" });
      await refreshData();
      progress.complete(result.cached ? "저장된 레퍼런스 확인" : "시각 레퍼런스 조사 완료", result.cached ? "기존 형태 자료를 그대로 재사용합니다." : "자료를 선택한 뒤 승인하면 프롬프트에 적용됩니다.");
      toast(result.message);
    } catch (error) {
      progress.fail(error.message);
      toast(error.message, "error");
      renderVisualResearch();
    }
  });
  $("#approveVisualReferencesButton").addEventListener("click", async () => {
    const button = $("#approveVisualReferencesButton");
    button.disabled = true;
    button.textContent = "승인 저장 중…";
    try {
      const result = await request("/api/actions/approve-visual-references", { method: "POST", body: "{}" });
      await refreshData();
      toast(result.message);
    } catch (error) {
      toast(error.message, "error");
      renderVisualResearch();
    }
  });
  $("#visualReferenceCards").addEventListener("change", async (event) => {
    const input = event.target.closest("[data-visual-reference-selection]");
    if (!input) return;
    input.disabled = true;
    try {
      const result = await request("/api/actions/visual-reference-selection", { method: "POST", body: JSON.stringify({ referenceId: input.dataset.visualReferenceSelection, selected: input.checked }) });
      data.project.visualResearch = result.visualResearch;
      renderVisualResearch();
      toast(result.message);
    } catch (error) {
      input.checked = !input.checked;
      input.disabled = false;
      toast(error.message, "error");
    }
  });
  $("#rewriteScriptButton").addEventListener("click", async () => {
    const button = $("#rewriteScriptButton");
    const researchButton = $("#researchScriptButton");
    button.disabled = true;
    researchButton.disabled = true;
    button.textContent = "문장 다듬는 중…";
    const progress = startOperationProgress("script", [
      { at: 0, percent: 8, label: "저장된 근거 불러오기", detail: "공식자료를 다시 검색하지 않습니다." },
      { at: 2, percent: 28, label: "18문장 인과 구조", detail: "질문에서 답까지 이해 순서를 다시 잡습니다." },
      { at: 12, percent: 52, label: "문장 연결 다듬기", detail: "앞 문장이 다음 문장의 원인이 되도록 편집합니다." },
      { at: 26, percent: 72, label: "친근한 낭독 리듬", detail: "딱딱한 종결 반복과 긴 호흡을 줄입니다." },
      { at: 48, percent: 88, label: "컷별 시각 설계", detail: "이미지 시작 장면과 영상 동작을 분리합니다." },
      { at: 75, percent: 94, label: "낭독 전용 2차 편집", detail: "사실은 유지하고 어미·호흡·문장 연결만 다시 다듬습니다." }
    ]);
    toast("저장된 공식자료만 사용해 문장을 다듬습니다.");
    try {
      const result = await request("/api/actions/rewrite-script", {
        method: "POST",
        body: JSON.stringify({
          script: $("#scriptEditor").value,
          scriptRhythmProfile: state.settings.scriptRhythmProfile || "auto"
        })
      });
      scriptEditorDirty = false;
      await refreshData();
      progress.complete("문장 다듬기 완료", "공식자료를 다시 검색하지 않고 18문장과 컷별 장면을 저장했습니다.");
      toast(result.message);
    } catch (error) {
      progress.fail(error.message);
      toast(error.message, "error");
      renderScriptEditor();
    }
  });
  $("#saveScriptButton").addEventListener("click", async () => {
    const button = $("#saveScriptButton");
    button.disabled = true;
    try {
      const result = await request("/api/project/script", { method: "PUT", body: JSON.stringify({ script: $("#scriptEditor").value }) });
      scriptEditorDirty = false;
      await refreshData();
      toast(result.message);
    } catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; }
  });

  ["typecastVoiceId", "typecastModel", "typecastTempo", "sentenceGapMs"].forEach((id) => {
    $(`#${id}`).addEventListener("change", (event) => {
      const config = state.settings.typecast;
      if (id === "typecastVoiceId") config.voiceId = event.target.value.trim();
      if (id === "typecastModel") config.model = event.target.value;
      if (id === "typecastTempo") config.tempo = Number(event.target.value || 1.12);
      if (id === "sentenceGapMs") config.sentenceGapMs = Number(event.target.value || 90);
      renderTypecast();
      scheduleSave();
    });
  });
  $("#typecastVoiceSelect").addEventListener("change", (event) => {
    const voice = typecastVoices.find((item) => item.voiceId === event.target.value);
    state.settings.typecast.voiceId = event.target.value;
    if (voice) state.settings.typecast.voiceName = voice.voiceName;
    renderTypecast();
    scheduleSave();
  });
  $("#refreshVoicesButton").addEventListener("click", async () => {
    const button = $("#refreshVoicesButton");
    button.disabled = true;
    try {
      const result = await request("/api/typecast/voices", { method: "POST", body: JSON.stringify({ model: state.settings.typecast.model }) });
      typecastVoices = result.voices;
      if (result.recommended) {
        state.settings.typecast.voiceId = result.recommended.voiceId;
        state.settings.typecast.voiceName = result.recommended.voiceName;
        scheduleSave();
      }
      renderTypecast();
      toast(result.recommended ? `필재 목소리를 찾았습니다. ${result.recommended.voiceId}` : `${result.voices.length}개 목소리를 불러왔습니다. 필재를 선택하세요.`);
    } catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; }
  });
  $("#checkVoiceFileButton").addEventListener("click", async () => {
    try {
      data.typecast = await request("/api/typecast/check-file", { method: "POST", body: "{}" });
      renderTypecast();
      toast(data.typecast.fileExists ? `WAV를 확인했습니다. ${data.typecast.duration ?? "?"}초` : `파일이 없습니다. ${data.typecast.expectedFile}`, data.typecast.fileExists ? "success" : "error");
    } catch (error) { toast(error.message, "error"); }
  });
  $("#generateVoiceButton").addEventListener("click", async () => {
    if (!data.typecast.connectionOk) {
      window.open(data.typecast.studioUrl, "_blank", "noopener,noreferrer");
      toast(`Typecast Studio에서 생성한 WAV를 ${data.typecast.expectedFile}에 저장하세요.`);
      return;
    }
    const button = $("#generateVoiceButton");
    button.disabled = true;
    button.textContent = "더빙 생성 중…";
    const progress = startOperationProgress("voice", [
      { at: 0, percent: 10, label: "대본 전송", detail: "확정 대본과 필재 설정을 Typecast에 보냅니다." },
      { at: 1, percent: 38, label: "필재 음성 합성", detail: "SSFM v3.0 한국어 음성을 생성합니다." },
      { at: 4, percent: 67, label: "발화 타이밍 정렬", detail: "단어별 타임스탬프를 계산합니다." },
      { at: 8, percent: 86, label: "WAV 저장", detail: "음성 파일을 내려받고 있습니다." },
      { at: 14, percent: 92, label: "길이 검사", detail: "완성 음성과 목표 러닝타임을 비교합니다." }
    ]);
    try {
      await saveState();
      const result = await request("/api/typecast/generate", { method: "POST", body: "{}" });
      state = result.state;
      data.typecast = await request("/api/typecast/status");
      renderAll();
      progress.complete("더빙 생성 완료", `${result.duration ?? "?"}초 WAV와 단어 타임스탬프를 저장했습니다.`);
      toast(`${result.message} · ${result.artifact}`);
    } catch (error) {
      progress.fail(error.message);
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "더빙 생성";
      renderTypecast();
    }
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

async function init() {
  try {
    data = await request("/api/bootstrap");
    state = data.state;
    renderAll();
    bindEvents();
    switchView(window.location.hash === "#pipeline" ? "pipeline" : "planning");
    window.addEventListener("hashchange", () => switchView(window.location.hash === "#pipeline" ? "pipeline" : "planning"));
    setSaveState("모든 변경사항 저장됨");
  } catch (error) {
    document.body.innerHTML = `<main class="empty-state"><h1>대시보드를 불러오지 못했습니다.</h1><p>${escapeHtml(error.message)}</p></main>`;
  }
}

init();




















// ===== Scene Design board (씬 설계표) — storyboard stage, local ComfyUI generation =====
(() => {
  const grid = document.getElementById("sceneDesignGrid");
  if (!grid) return;
  let sdDesign = null;
  let sdStatus = null;
  let sdPollTimer = null;
  let sdLines = [];
  let sdResearchCtx = { anchorKo: "", avoidKo: "" };

  // 서버(comfyImagePromptText/comfyVideoPromptText)와 동일한 조합식 — 서버 수정 시 함께 갱신할 것
  // 서버 comfyImagePromptText/comfyVideoPromptText와 동일하게 유지할 것 — 영문 프롬프트, en 번역 우선
  function sdImagePrompt(cut) {
    const f = (key) => (cut.en && cut.en[key]) || cut[key];
    const anchor = sdResearchCtx.anchorEn || sdResearchCtx.anchorKo;
    const avoid = sdResearchCtx.avoidEn || sdResearchCtx.avoidKo;
    return [
      f("staging"),
      `Camera: ${f("cameraAngle")}, ${f("shotSize")}, ${f("lens")}.`,
      `Lighting and tone: ${f("tone")}.`,
      cut.inSceneText
        ? `In-scene text: ${cut.inSceneText} — render only this text, spelled exactly, as if engraved or printed on objects in the scene; do not create any other letters or numbers.`
        : "Do not generate any letters, numbers, captions, or logos.",
      "Follow the attached reference images exactly for tennis-ball seam shape, court line layout, and net structure.",
      anchor ? `Subject geometry from research: ${anchor}` : "",
      avoid ? `Forbidden shapes confirmed by research: ${avoid}` : "",
      "Photoreal archviz-style 3D render, explanatory documentary motion-graphic scene, vertical 9:16, no people, no watermark."
    ].filter(Boolean).join(" ");
  }
  function sdVideoPrompt(cut) {
    const f = (key) => (cut.en && cut.en[key]) || cut[key];
    const avoid = sdResearchCtx.avoidEn || sdResearchCtx.avoidKo;
    return [
      `Subject motion: ${f("subjectMotion")}.`,
      `Camera motion: ${f("cameraMove")}. The camera keeps moving until the final frame.`,
      cut.inSceneText ? `Existing in-scene text (${cut.inSceneText}) keeps its exact shape and never smears.` : "Do not create any new text.",
      avoid ? `Preserve geometry — forbidden shapes confirmed by research: ${avoid}` : "",
      "One continuous shot in a single location, no cuts, silent, no morphing, no scale drift."
    ].filter(Boolean).join(" ");
  }

  const SD_FIELDS = [
    ["staging", "장면 스테이징", "textarea"],
    ["subjectMotion", "피사체 움직임", "textarea"],
    ["cameraAngle", "카메라 앵글", "input"],
    ["shotSize", "샷 사이즈", "input"],
    ["lens", "렌즈감", "input"],
    ["cameraMove", "카메라 모션", "input"],
    ["tone", "조명·톤", "input"],
    ["inSceneText", "인-신 텍스트", "input"]
  ];

  const sdBadge = (slot) => {
    if (!slot) return "";
    if (slot.status === "running") return '<span class="sd-state running">생성 중</span>';
    if (slot.status === "queued") return '<span class="sd-state queued">대기열</span>';
    if (slot.status === "error") return `<span class="sd-state error" title="${slot.message || ""}">오류</span>`;
    if (slot.exists) return '<span class="sd-state done">완료</span>';
    return '<span class="sd-state idle">미생성</span>';
  };

  function sdRender() {
    if (!sdDesign) { grid.innerHTML = '<div class="storyboard-empty">저장된 씬 설계표가 없습니다.</div>'; return; }
    grid.innerHTML = sdDesign.cuts.map((cut, index) => {
      const status = (sdStatus && sdStatus.cuts && sdStatus.cuts[cut.cut]) || {};
      const still = status.image && status.image.exists ? `<img src="${status.image.mediaUrl}" alt="" loading="lazy" />` : '<div class="sd-thumb-empty">이미지 미생성</div>';
      const clipLink = status.video && status.video.exists ? `<a href="${status.video.mediaUrl}" target="_blank" rel="noreferrer">영상 열기</a>` : "";
      const fields = SD_FIELDS.map(([key, label, kind]) => kind === "textarea"
        ? `<label class="sd-cell"><span>${label}</span><textarea data-sd-cut="${index}" data-sd-key="${key}" rows="2">${cut[key] || ""}</textarea></label>`
        : `<label class="sd-cell"><span>${label}</span><input data-sd-cut="${index}" data-sd-key="${key}" value="${String(cut[key] || "").replaceAll('"', "&quot;")}" /></label>`).join("");
      const line = sdLines[cut.cut - 1] || "";
      return `<article class="sd-cut-card sd-row" data-sd-row="${index}">
        <div class="sd-left">
          <strong class="sd-cut-no">CUT ${String(cut.cut).padStart(2, "0")}</strong>
          <div class="sd-thumb">${still}</div>
          <div class="sd-states">
            <div class="sd-state-line">이미지 ${sdBadge(status.image)}</div>
            <div class="sd-state-line">영상 ${sdBadge(status.video)}</div>
            ${clipLink ? `<div class="sd-state-line">${clipLink}</div>` : ""}
          </div>
        </div>
        <div class="sd-right">
          <header>
            <p class="sd-cut-line">${line || cut.title || ""}</p>
            <span class="sd-cut-dur">${cut.title || ""} · ${cut.durationSec}s · ${cut.actionType || ""}</span>
          </header>
          <div class="sd-fields">${fields}</div>
          <div class="sd-gen-row">
            <button class="button button-small button-outline" data-sd-gen="image" data-sd-cutno="${cut.cut}" type="button">이미지 생성</button>
            <textarea class="sd-prompt sd-prompt-image" readonly rows="2">${sdImagePrompt(cut)}</textarea>
          </div>
          <div class="sd-gen-row">
            <button class="button button-small button-dark" data-sd-gen="video" data-sd-cutno="${cut.cut}" type="button" ${status.image && status.image.exists ? "" : "disabled"}>영상 생성</button>
            <textarea class="sd-prompt sd-prompt-video" readonly rows="2">${sdVideoPrompt(cut)}</textarea>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function sdModel(kind) {
    const select = document.getElementById(kind === "image" ? "sdImageModel" : "sdVideoModel");
    return select ? select.value : (kind === "image" ? "z-image-turbo" : "minimax-h3");
  }

  async function sdLoadDesign() {
    const response = await fetch("/api/scene-design");
    const data = await response.json();
    sdDesign = data.design;
    sdLines = Array.isArray(data.scriptLines) ? data.scriptLines : [];
    if (data.researchContext) sdResearchCtx = data.researchContext;
    const specs = (sdDesign && sdDesign.specs) || {};
    const imageSelect = document.getElementById("sdImageModel");
    const videoSelect = document.getElementById("sdVideoModel");
    if (imageSelect && specs.imageModel) imageSelect.value = specs.imageModel;
    if (videoSelect && specs.videoModel) videoSelect.value = specs.videoModel;
    const remember = () => {
      if (!sdDesign) return;
      sdDesign.specs = sdDesign.specs || {};
      sdDesign.specs.imageModel = imageSelect ? imageSelect.value : "z-image-turbo";
      sdDesign.specs.videoModel = videoSelect ? videoSelect.value : "minimax-h3";
    };
    if (imageSelect) imageSelect.addEventListener("change", remember);
    if (videoSelect) videoSelect.addEventListener("change", remember);
  }

  async function sdRefreshStatus() {
    try {
      const response = await fetch("/api/comfy/status");
      sdStatus = await response.json();
    } catch (error) { sdStatus = null; }
    const state = document.getElementById("sdComfyState");
    if (state) {
      if (!sdStatus) state.textContent = "상태 확인 실패";
      else if (!sdStatus.serverOk) state.textContent = "ComfyUI 꺼짐";
      else if (sdStatus.busy || sdStatus.pending) state.textContent = `생성 중 · 대기 ${sdStatus.pending}`;
      else state.textContent = "ComfyUI 준비됨";
      state.dataset.ok = sdStatus && sdStatus.serverOk ? "1" : "0";
    }
    const higgsBadge = document.getElementById("sdHiggsState");
    if (higgsBadge) {
      const hf = data && data.higgsfield;
      higgsBadge.textContent = hf && hf.authenticated ? `Higgsfield ${Number(hf.credits || 0).toFixed(1)}cr` : "Higgsfield 미연결";
      higgsBadge.dataset.ok = hf && hf.authenticated ? "1" : "0";
    }
    sdRender();
    const active = sdStatus && (sdStatus.busy || sdStatus.pending > 0);
    clearTimeout(sdPollTimer);
    sdPollTimer = setTimeout(sdRefreshStatus, active ? 5000 : 20000);
  }

  grid.addEventListener("input", (event) => {
    const target = event.target;
    if (!target.dataset || !target.dataset.sdKey) return;
    const index = Number(target.dataset.sdCut);
    sdDesign.cuts[index][target.dataset.sdKey] = target.value;
    if (sdDesign.cuts[index].en && sdDesign.cuts[index].en[target.dataset.sdKey]) delete sdDesign.cuts[index].en[target.dataset.sdKey];
    const row = target.closest("[data-sd-row]");
    if (row) {
      const imageBox = row.querySelector(".sd-prompt-image");
      const videoBox = row.querySelector(".sd-prompt-video");
      if (imageBox) imageBox.value = sdImagePrompt(sdDesign.cuts[index]);
      if (videoBox) videoBox.value = sdVideoPrompt(sdDesign.cuts[index]);
    }
  });

  grid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-sd-gen]");
    if (!button) return;
    button.disabled = true;
    try {
      const response = await fetch("/api/comfy/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: button.dataset.sdGen, cut: Number(button.dataset.sdCutno), model: sdModel(button.dataset.sdGen) })
      });
      const data = await response.json();
      if (!data.ok) window.alert(data.error || "생성 요청 실패");
      else if (data.manual && data.prompts && data.prompts.length) {
        const site = data.engine === "chatgpt" ? "ChatGPT 웹 (reference/ 폴더 이미지를 함께 첨부)" : "Flow 웹";
        try { await navigator.clipboard.writeText(data.prompts[0].prompt); } catch (error) {}
        window.alert(`${site}에서 쓸 프롬프트를 클립보드에 복사했습니다.\n생성한 뒤 안내된 경로에 저장하면 보드에 자동 반영됩니다.\n패키지 파일: ` + data.packageFile);
      }
    } finally { sdRefreshStatus(); }
  });

  const saveButton = document.getElementById("sdSaveDesign");
  if (saveButton) saveButton.addEventListener("click", async () => {
    if (!sdDesign) return;
    const response = await fetch("/api/scene-design", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sdDesign)
    });
    const data = await response.json();
    window.alert(data.ok ? `씬 설계 저장 완료 (${data.cuts}컷)` : `저장 실패: ${data.error || ""}`);
  });

  const sdGenAll = (kind) => async () => {
    const label = kind === "image" ? "이미지" : "영상";
    const model = sdModel(kind);
    const select = document.getElementById(kind === "image" ? "sdImageModel" : "sdVideoModel");
    const modelLabel = select && select.selectedOptions[0] ? select.selectedOptions[0].textContent.trim() : model;
    if (!window.confirm(`미생성 컷의 ${label}를 "${modelLabel}"로 전체 생성합니다. 계속할까요?`)) return;
    const response = await fetch("/api/comfy/generate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, all: true, model })
    });
    const data = await response.json();
    if (!data.ok) window.alert(data.error || "생성 요청 실패");
    else if (data.manual) {
      const site = data.engine === "chatgpt" ? "ChatGPT 웹 (reference/ 폴더 이미지를 함께 첨부)" : "Flow 웹";
      window.alert(`${site}용 프롬프트 패키지를 만들었습니다.\n` + data.packageFile + "\n생성 후 안내된 경로에 저장하면 보드에 자동 반영됩니다.");
    }
    else if (!data.queued.length) window.alert("모든 컷이 이미 생성되어 있습니다.");
    sdRefreshStatus();
  };
  const genAllImagesButton = document.getElementById("sdGenAllImages");
  if (genAllImagesButton) genAllImagesButton.addEventListener("click", sdGenAll("image"));
  const genAllVideosButton = document.getElementById("sdGenAllVideos");
  if (genAllVideosButton) genAllVideosButton.addEventListener("click", sdGenAll("video"));

  sdLoadDesign().then(sdRefreshStatus);
})();


// ===== Edit · Subtitle · BGM: final assembly =====
(() => {
  const bgmSelect = document.getElementById("bgmSelect");
  if (!bgmSelect) return;
  const volumeInput = document.getElementById("bgmVolume");
  const uploadInput = document.getElementById("bgmUploadInput");
  const subtitleMode = document.getElementById("subtitleMode");
  const assembleButton = document.getElementById("assembleButton");
  const stateBadge = document.getElementById("assembleState");
  const resultBox = document.getElementById("assembleResult");
  const subtitleRowsBox = document.getElementById("subtitleRows");
  const subtitleSaveButton = document.getElementById("subtitleSave");
  let subtitleData = [];
  let pollTimer = null;

  async function loadBgmList() {
    try {
      const data = await (await fetch("/api/bgm/list")).json();
      const current = bgmSelect.value;
      bgmSelect.innerHTML = '<option value="">BGM 없음 (내레이션만)</option>' +
        (data.files || []).map((file) => `<option value="${file.replaceAll('"', "&quot;")}">${file}</option>`).join("");
      if ([...bgmSelect.options].some((option) => option.value === current)) bgmSelect.value = current;
    } catch (error) {}
  }

  if (uploadInput) uploadInput.addEventListener("change", async () => {
    const files = [...uploadInput.files].slice(0, 5);
    if (!files.length) return;
    const payload = [];
    for (const file of files) {
      const dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      payload.push({ name: file.name, dataBase64 });
    }
    const response = await fetch("/api/bgm/upload", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: payload })
    });
    const data = await response.json();
    if (!data.ok) { window.alert(data.error || "BGM 업로드 실패"); return; }
    await loadBgmList();
    if (data.saved && data.saved.length) bgmSelect.value = data.saved[0];
    uploadInput.value = "";
  });

  async function loadSubtitles() {
    try {
      const data = await (await fetch("/api/subtitles")).json();
      const byCut = new Map((data.rows || []).map((row) => [row.cut, row]));
      const lines = data.scriptLines || [];
      subtitleData = Array.from({ length: Math.max(lines.length, 18) }, (_, index) => {
        const cut = index + 1;
        const row = byCut.get(cut) || {};
        return { cut, ko: row.ko || "", en: row.en || "", line: lines[index] || "" };
      });
      subtitleRowsBox.innerHTML = subtitleData.map((row, index) => `<div class="subtitle-row">
        <strong>C${String(row.cut).padStart(2, "0")}</strong>
        <div class="subtitle-row-fields">
          <small>${row.line.replaceAll("<", "&lt;")}</small>
          <input data-sub-index="${index}" data-sub-lang="ko" value="${row.ko.replaceAll('"', "&quot;")}" placeholder="비우면 대본 문장 그대로" maxlength="240">
          <input data-sub-index="${index}" data-sub-lang="en" value="${row.en.replaceAll('"', "&quot;")}" placeholder="English translation" maxlength="320">
        </div>
      </div>`).join("");
    } catch (error) { subtitleRowsBox.textContent = "자막을 불러오지 못했습니다."; }
  }

  subtitleRowsBox.addEventListener("input", (event) => {
    const target = event.target;
    if (!target.dataset || target.dataset.subIndex === undefined) return;
    subtitleData[Number(target.dataset.subIndex)][target.dataset.subLang] = target.value;
  });

  if (subtitleSaveButton) subtitleSaveButton.addEventListener("click", async () => {
    const response = await fetch("/api/subtitles", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: subtitleData.map(({ cut, ko, en }) => ({ cut, ko, en })) })
    });
    const data = await response.json();
    window.alert(data.ok ? `자막 ${data.rows}컷 저장 완료` : (data.error || "자막 저장 실패"));
  });

  function renderAssembleStatus(job) {
    if (!job) { stateBadge.textContent = "상태 확인 실패"; return; }
    if (job.status === "running") { stateBadge.textContent = `${job.step} · ${job.progress}%`; stateBadge.dataset.ok = "0"; }
    else if (job.status === "done") { stateBadge.textContent = `완료 · ${job.message}`; stateBadge.dataset.ok = "1"; }
    else if (job.status === "error") { stateBadge.textContent = "오류"; stateBadge.dataset.ok = "0"; }
    else { stateBadge.textContent = "대기"; stateBadge.dataset.ok = "0"; }
    const files = job.outputFiles || [];
    if (job.status === "done" && files.length) {
      resultBox.hidden = false;
      resultBox.innerHTML = files.map((file) => {
        const name = file.split("/").pop();
        return `<a href="/media?path=${encodeURIComponent(file)}&v=${Date.now()}" target="_blank" rel="noreferrer">${name}</a>`;
      }).join(" · ");
    } else if (job.status === "error") {
      resultBox.hidden = false;
      resultBox.textContent = job.message || "조립 실패";
    }
  }

  async function pollAssemble() {
    clearTimeout(pollTimer);
    let job = null;
    try { job = await (await fetch("/api/assemble/status")).json(); } catch (error) {}
    renderAssembleStatus(job);
    if (job && job.status === "running") pollTimer = setTimeout(pollAssemble, 3000);
  }

  if (assembleButton) assembleButton.addEventListener("click", async () => {
    const modeMap = { none: ["none"], ko: ["ko"], en: ["en"], koen: ["ko", "en"], all: ["none", "ko", "en"] };
    const subtitles = modeMap[subtitleMode ? subtitleMode.value : "none"] || ["none"];
    const bgm = bgmSelect.value || null;
    const summary = `자막: ${subtitles.map((lang) => lang === "none" ? "무자막" : lang === "ko" ? "한글" : "영어").join("+")} · BGM: ${bgm || "없음"}`;
    if (!window.confirm(`18컷을 리타이밍 조립하고 마스터를 렌더링합니다.\n${summary}\n계속할까요?`)) return;
    const response = await fetch("/api/assemble", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bgm, bgmDb: Number(volumeInput ? volumeInput.value : -20), subtitles })
    });
    const data = await response.json();
    if (!data.ok) { window.alert(data.error || "조립 시작 실패"); return; }
    resultBox.hidden = true;
    pollAssemble();
  });

  loadBgmList();
  loadSubtitles();
  pollAssemble();
})();

// ===== Reference library: add new reference files =====
(() => {
  const input = document.getElementById("referenceUploadInput");
  if (!input) return;
  input.addEventListener("change", async () => {
    const files = [...input.files].slice(0, 10);
    if (!files.length) return;
    const payload = [];
    for (const file of files) {
      const dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      payload.push({ name: file.name, dataBase64 });
    }
    const response = await fetch("/api/reference/upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payload })
    });
    const data = await response.json();
    if (!data.ok) { window.alert(data.error || "업로드 실패"); return; }
    window.alert(`레퍼런스 ${data.saved.length}개 추가: ${data.saved.join(", ")}`);
    location.reload();
  });
})();

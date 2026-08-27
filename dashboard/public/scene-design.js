let design = null;

const FIELDS = [
  ["staging", "장면 스테이징 (첫 프레임)", "textarea"],
  ["subjectMotion", "피사체 움직임", "textarea"],
  ["cameraAngle", "카메라 앵글", "input"],
  ["shotSize", "샷 사이즈", "input"],
  ["lens", "렌즈감", "input"],
  ["cameraMove", "카메라 모션", "input"],
  ["tone", "조명 · 톤", "input"],
  ["inSceneText", "인-신 텍스트 (장면 안에 생성될 글자)", "input"]
];

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showStatus(message) {
  const status = document.getElementById("sd-status");
  status.textContent = message;
  status.classList.add("show");
  setTimeout(() => status.classList.remove("show"), 2600);
}

function renderCard(cut, index) {
  const card = el("article", "sd-card");
  const head = el("h2");
  head.appendChild(el("span", "num", `CUT ${String(cut.cut).padStart(2, "0")}`));
  head.appendChild(el("span", "", cut.title));
  head.appendChild(el("span", "dur", `${cut.durationSec}s`));
  card.appendChild(head);

  const badges = el("div", "sd-badges");
  badges.appendChild(el("span", "badge type", cut.actionType || "유형 없음"));
  if (cut.inSceneText) badges.appendChild(el("span", "badge text", "인-신 텍스트"));
  if (cut.tedori) badges.appendChild(el("span", "badge tedori", "테돌이"));
  if (cut.logo) badges.appendChild(el("span", "badge logo", "로고"));
  card.appendChild(badges);

  FIELDS.forEach(([key, label, kind]) => {
    const field = el("div", "sd-field");
    field.appendChild(el("label", "", label));
    const input = document.createElement(kind === "textarea" ? "textarea" : "input");
    if (kind === "textarea") input.rows = key === "staging" ? 3 : 2;
    input.value = cut[key] || "";
    input.addEventListener("input", () => { design.cuts[index][key] = input.value; });
    field.appendChild(input);
    card.appendChild(field);
  });

  const refs = el("p", "sd-refs");
  refs.innerHTML = `<em>레퍼런스</em> · ${(cut.references || []).join(", ") || "없음"}<br /><em>검증</em> · ${(cut.verify || []).join(" / ") || "없음"}`;
  card.appendChild(refs);
  return card;
}

function render() {
  document.getElementById("sd-title").textContent = design.name || "씬 설계표";
  document.getElementById("sd-meta").textContent = `${design.episodeId} · ${design.cuts.length}컷 · 갱신 ${String(design.updatedAt || "").slice(0, 16).replace("T", " ")}`;
  const specs = design.specs || {};
  document.getElementById("sd-specs").innerHTML =
    `<strong>이미지</strong> ${specs.imageResolution || "-"} · <strong>영상</strong> ${specs.videoResolution || "-"} · <strong>${specs.fps || "-"}fps</strong><br />` +
    `<strong>색 아크</strong> ${specs.colorArc || "-"}`;
  const wrap = document.getElementById("sd-cuts");
  wrap.textContent = "";
  design.cuts.forEach((cut, index) => wrap.appendChild(renderCard(cut, index)));
}

async function load() {
  const res = await fetch("/api/scene-design");
  const data = await res.json();
  if (!data.design) {
    document.getElementById("sd-meta").textContent = `${data.episodeId} — 저장된 씬 설계표가 없습니다.`;
    return;
  }
  design = data.design;
  render();
}

document.getElementById("sd-save").addEventListener("click", async () => {
  if (!design) return;
  const res = await fetch("/api/scene-design", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(design)
  });
  const data = await res.json();
  showStatus(data.ok ? `저장 완료 (${data.cuts}컷)` : `저장 실패: ${data.error || "알 수 없는 오류"}`);
});

load();

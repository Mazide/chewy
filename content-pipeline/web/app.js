"use strict";

const $ = (id) => document.getElementById(id);
const state = {
  data: null, jobId: null, requestId: null, attemptId: null, referenceId: null,
  background: "checker", actualSize: false, busy: false,
  promptDrafts: new Map(), noteDrafts: new Map(), motionImportJobId: null,
};
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ANIMATION_BYTES = 100 * 1024 * 1024;
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const player = new ChewyMotion.FramePlayer({
  canvas: $("animation-canvas"), play: $("animation-play"), restart: $("animation-restart"),
  timeline: $("animation-timeline"), fps: $("animation-fps"), mode: $("animation-mode"),
  metadata: $("animation-metadata"), previewNote: $("animation-preview-note"),
  status: $("animation-status"), frameLabel: $("animation-frame"), error: $("animation-error"),
});
const runway = new ChewyRunway.RunwayPanel({ api, run, announce, formatDate });

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Дата неизвестна" : dateFormatter.format(date);
}

function currentJob() { return state.data?.jobs.find((job) => job.id === state.jobId); }
function currentRequest() { return currentJob()?.requests.find((request) => request.id === state.requestId); }
function requestAttempts() { return (currentJob()?.attempts || []).filter((attempt) => attempt.packetId === state.requestId); }
function currentAttempt() { return requestAttempts().find((attempt) => attempt.id === state.attemptId); }
function isAnimationJob() { return currentJob()?.kind === "animation"; }
function currentReferences() {
  const snapshots = currentRequest()?.references;
  if (Array.isArray(snapshots)) return snapshots;
  return (currentJob()?.referenceIds || []).map((id) => state.data.references.find((ref) => ref.id === id)).filter(Boolean);
}

function syncRunway() {
  const request = currentRequest();
  runway.sync({
    animation: isAnimationJob(), jobId: state.jobId, packetId: request?.id || null,
    references: request?.references || [], busy: state.busy,
    promptChanged: Boolean(request && $("prompt-editor").value !== request.prompt),
  });
}

function announce(message, isError = false) {
  $("notice").hidden = false;
  $("notice").textContent = message;
  $("notice").className = isError ? "notice error" : "notice";
  $("notice").setAttribute("role", isError ? "alert" : "status");
}

async function api(url, body) {
  const options = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const response = await fetch(url, options);
  let result;
  try { result = await response.json(); } catch { throw new Error("Сервер вернул непонятный ответ. Проверьте, что локальная мастерская запущена."); }
  if (!response.ok) {
    const error = new Error(result.error || `Запрос не выполнен (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function option(value, label) {
  const result = node("option", "", label);
  result.value = value;
  return result;
}

function syncSelection() {
  const jobs = state.data.jobs || [];
  if (!jobs.some((job) => job.id === state.jobId)) state.jobId = jobs[0]?.id || null;
  const job = currentJob();
  if (!job) return;
  if (!job.requests.some((request) => request.id === state.requestId)) state.requestId = job.requests.at(-1)?.id || null;
  const attempts = requestAttempts();
  if (!attempts.some((attempt) => attempt.id === state.attemptId)) state.attemptId = attempts.at(-1)?.id || null;
  const refs = currentReferences();
  if (!refs.some((ref) => ref.id === state.referenceId)) state.referenceId = refs[0]?.id || null;
  if (!state.promptDrafts.has(job.id)) state.promptDrafts.set(job.id, currentRequest()?.prompt || job.prompt || "");
}

async function refresh() {
  state.data = await api("/api/state");
  syncSelection();
  render();
}

async function load() {
  $("loading").hidden = false;
  $("load-error").hidden = true;
  try {
    await refresh();
    $("workspace").hidden = !currentJob();
    if (!currentJob()) throw new Error("В каталоге пока нет заданий для пробной партии.");
  } catch (error) {
    $("load-error").hidden = false;
    $("load-error-text").textContent = error.message;
  } finally { $("loading").hidden = true; }
}

function jobStatus(job) {
  const attempts = job.attempts || [];
  if (attempts.some((attempt) => attempt.review?.status === "approved")) return { label: "Есть принятый вариант", kind: "approved" };
  if (attempts.length) return { label: "Есть варианты", kind: "" };
  if (job.requests?.length) return { label: "Запрос подготовлен", kind: "" };
  return { label: "К первой пробе", kind: "" };
}

function renderJobs() {
  $("job-count").textContent = `${state.data.jobs.length} задания`;
  const items = state.data.jobs.map((job, index) => {
    const button = node("button", "job-button");
    button.type = "button";
    button.setAttribute("aria-current", String(job.id === state.jobId));
    const number = node("span", "job-number", String(index + 1).padStart(2, "0"));
    number.setAttribute("aria-hidden", "true");
    const body = node("span", "job-button-body");
    const status = jobStatus(job);
    body.append(node("span", "job-name", job.title), node("span", `job-state ${status.kind}`, `${job.kind === "animation" ? "Анимация" : "Изображение"} · ${status.label}`));
    button.append(number, body);
    button.disabled = state.busy;
    button.addEventListener("click", () => {
      if (state.jobId === job.id) return;
      state.jobId = job.id;
      state.requestId = null;
      state.attemptId = null;
      state.referenceId = null;
      syncSelection();
      $("image-file").value = "";
      render();
    });
    return button;
  });
  $("job-list").replaceChildren(...items);
}

function renderWorkflow() {
  const request = currentRequest();
  const attempt = currentAttempt();
  const reviewed = attempt && ["approved", "rejected"].includes(attempt.review?.status);
  const completed = [true, Boolean(request), Boolean(attempt), Boolean(reviewed), Boolean(attempt?.export)];
  let active = completed.findIndex((value) => !value);
  if (active < 0) active = completed.length - 1;
  if (attempt?.review?.status === "rejected") active = 1;
  const names = ["Задание", "Запрос", "Вариант", "Решение", "Пакет"];
  $("workflow").replaceChildren(...names.map((name, index) => {
    const item = node("li", `${completed[index] ? "complete" : ""} ${index === active ? "current" : ""}`);
    if (index === active) item.setAttribute("aria-current", "step");
    const marker = node("span", "step-dot", completed[index] ? "✓" : String(index + 1));
    marker.setAttribute("aria-hidden", "true");
    item.append(marker, node("span", "", name));
    item.setAttribute("aria-label", `${name}: ${completed[index] ? "завершено" : index === active ? "текущий этап" : "впереди"}`);
    return item;
  }));
}

function renderComparison() {
  const job = currentJob();
  const refs = currentReferences();
  const ref = refs.find((item) => item.id === state.referenceId);
  $("reference-heading").textContent = Array.isArray(currentRequest()?.references) ? "Референс запроса" : "Референс";
  $("reference-select").replaceChildren(...(refs.length ? refs.map((item) => option(item.id, item.title)) : [option("", "Нет референса")]));
  $("reference-select").value = state.referenceId || "";
  $("reference-select").disabled = refs.length < 2 || state.busy;
  $("reference-image").hidden = !ref;
  $("reference-empty").hidden = Boolean(ref);
  if (ref) {
    $("reference-image").src = ref.url;
    $("reference-image").alt = `${ref.title}. ${ref.role || "Референс образа"}`;
  } else $("reference-image").removeAttribute("src");
  $("reference-caption").textContent = ref ? `${ref.role || "Исходный образ"}${ref.width && ref.height ? ` · ${ref.width} × ${ref.height}` : ""}` : "Добавляется в каталоге задания";
  const attempts = requestAttempts();
  const attempt = currentAttempt();
  const animation = attempt?.kind === "animation" && attempt.animation?.frames?.length;
  $("attempt-select").replaceChildren(...(attempts.length ? attempts.map((item, index) => option(item.id, `Проба ${index + 1} · ${formatDate(item.createdAt)}`)) : [option("", "Пока нет вариантов")]));
  $("attempt-select").value = state.attemptId || "";
  $("attempt-select").disabled = attempts.length < 2 || state.busy;
  $("candidate-heading").textContent = isAnimationJob() ? "Анимация" : "Вариант";
  $("candidate-image").hidden = !attempt || Boolean(animation);
  $("animation-canvas").hidden = !animation;
  $("animation-player").hidden = !animation;
  player.configure(animation ? attempt : null);
  $("candidate-empty").hidden = Boolean(attempt);
  if (attempt && !animation) {
    $("candidate-image").src = attempt.url;
    $("candidate-image").alt = `${job.title}, выбранный вариант. Решение: ${reviewLabel(attempt.review?.status)}.`;
  } else $("candidate-image").removeAttribute("src");
  $("candidate-empty-text").textContent = isAnimationJob()
    ? "Сгенерируйте видеопробу через Runway ниже. Для покадрового просмотра загрузите подготовленный ZIP с прозрачными PNG-кадрами."
    : currentRequest() ? "Запрос готов. Сгенерируйте изображение в Codex и загрузите PNG ниже." : "Подготовьте запрос, сгенерируйте изображение в Codex и загрузите PNG сюда.";
  $("candidate-caption").textContent = attempt ? `${attempt.tool || "Внешний файл"}${attempt.qa?.width ? ` · ${attempt.qa.width} × ${attempt.qa.height}` : ""}` : "Здесь появится загруженный исходник";
  $("comparison").className = `comparison background-${state.background}`;
  document.querySelectorAll("[data-background]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.background === state.background)));
  $("scale-button").setAttribute("aria-pressed", String(state.actualSize));
  const size = job.target?.maxDisplay;
  for (const id of ["reference-image", "candidate-image", "animation-canvas"]) {
    $(id).style.width = state.actualSize && size?.width ? `${size.width}px` : "";
    $(id).style.height = state.actualSize && size?.height ? `${size.height}px` : "";
  }
  $("scale-caption").textContent = state.actualSize && size ? `Область показа ${size.width} × ${size.height} CSS-пикселей; на узком экране уменьшается до доступного места.` : "Смена фона помогает увидеть края и прозрачность. Изображения вписаны в окно просмотра.";
}

function reviewLabel(status) {
  return status === "approved" ? "принят владельцем" : status === "rejected" ? "на доработку" : "ожидает решения";
}

function renderRequest() {
  const job = currentJob();
  const request = currentRequest();
  const animation = isAnimationJob();
  $("request-count").textContent = job.requests.length ? `Сохранено: ${job.requests.length}` : "Первая проба";
  $("request-select").replaceChildren(...(job.requests.length ? job.requests.map((item, index) => option(item.id, `Запрос ${index + 1} · ${formatDate(item.createdAt)}`)) : [option("", "Запрос ещё не подготовлен")]));
  $("request-select").value = state.requestId || "";
  $("request-select").disabled = !job.requests.length || state.busy;
  $("prompt-editor").value = state.promptDrafts.get(job.id) ?? request?.prompt ?? job.prompt ?? "";
  $("prompt-editor").disabled = state.busy;
  renderPromptState();
  $("prepare-button").disabled = state.busy || !$("prompt-editor").value.trim();
  $("copy-button").disabled = state.busy || !request;
  $("request-download").setAttribute("aria-disabled", String(!request || state.busy));
  $("request-download").tabIndex = request && !state.busy ? 0 : -1;
  if (request) $("request-download").href = request.url;
  else $("request-download").removeAttribute("href");
  const requestIndex = job.requests.findIndex((item) => item.id === state.requestId);
  $("import-context").textContent = request ? `${animation ? "ZIP кадров" : "PNG"} будет связан с запросом ${requestIndex + 1} от ${formatDate(request.createdAt)}. Перед загрузкой проверьте выбранный запрос.` : "Сначала подготовьте запрос: к нему привяжется новый вариант.";
  $("generation-note").textContent = animation
    ? "Сохраните промпт, выберите модель и запустите Runway в блоке ниже. Готовый MP4 появится здесь как видеочерновик. Прозрачные PNG-кадры и стык цикла готовятся следующим шагом, затем загружаются отдельным ZIP."
    : "Генерация проходит в чате Codex. Эта мастерская сохраняет запрос, принимает готовый PNG и проверяет файл.";
  $("import-format").textContent = animation ? "ZIP с PNG-кадрами" : "PNG с прозрачностью";
  $("file-label").textContent = animation ? "Последовательность кадров в ZIP" : "Сгенерированное изображение";
  $("image-file").accept = animation ? ".zip,application/zip" : "image/png,.png";
  $("file-limit").textContent = animation
    ? "До 100 МБ. От 2 до 240 PNG без вложенных папок, одного размера. Порядок по именам: frame_001.png, frame_002.png… Кадры сохраняются без изменений."
    : "До 20 МБ. Исходный файл сохраняется без изменений.";
  $("motion-import-fields").hidden = !animation;
  if (state.motionImportJobId !== job.id) {
    state.motionImportJobId = job.id;
    $("import-fps").value = job.motion?.fps || 24;
    $("import-playback").value = job.motion?.playback || "loop";
  }
  for (const id of ["image-file", "tool-input", "model-input", "import-button", "import-fps", "import-playback"]) $(id).disabled = !request || state.busy;
  syncRunway();
}

function renderPromptState() {
  const request = currentRequest();
  const changed = request && $("prompt-editor").value !== request.prompt;
  $("prompt-state").textContent = changed ? "Есть несохранённые правки" : request ? "Точный текст выбранного запроса" : "Черновик задания";
  $("copy-button").textContent = changed ? "Скопировать сохранённый запрос" : isAnimationJob() ? "Скопировать задание анимации" : "Скопировать для Codex";
}

function renderContext() {
  const job = currentJob();
  const attempt = currentAttempt();
  $("job-brief").textContent = job.brief;
  $("target-format").textContent = `${isAnimationJob() ? "PNG-последовательность в ZIP" : (job.target?.format || "png").toUpperCase()}${job.target?.transparent ? ", прозрачный фон" : ", без требования прозрачности"}`;
  $("package-description").textContent = isAnimationJob()
    ? "Исходные PNG-кадры, их порядок, сохранённые FPS и режим повтора, точный запрос и паспорт проверки."
    : "Изображение, точный запрос и паспорт проверки для следующего шага.";
  const size = job.target?.maxDisplay;
  $("target-size").textContent = size ? `${size.width} × ${size.height}` : "Уточняется при примерке";
  $("criteria-list").replaceChildren(...(job.criteria || []).map((criterion) => node("li", "", criterion)));
  $("qa-empty").hidden = Boolean(attempt);
  $("qa-summary").textContent = attempt ? attempt.qa?.pass ? "Пройдена" : "Есть ошибки" : "";
  $("qa-summary").className = `tiny-status ${attempt ? attempt.qa?.pass ? "pass" : "fail" : ""}`;
  $("qa-list").replaceChildren(...(attempt?.qa?.checks || []).map((check) => {
    const item = node("li", check.status);
    const mark = node("span", "check-mark", check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "×");
    mark.setAttribute("aria-label", check.status === "pass" ? "Пройдено" : check.status === "warn" ? "Внимание" : "Ошибка");
    const text = node("span");
    text.append(node("span", "check-label", check.label), node("span", "check-detail", check.detail));
    item.append(mark, text);
    return item;
  }));
  $("review-status").textContent = attempt ? `${reviewLabel(attempt.review?.status)}.`.replace(/^./, (letter) => letter.toUpperCase()) : "Сначала нужен вариант.";
  $("review-status").className = `review-status ${attempt?.review?.status || ""}`;
  $("review-note").value = attempt ? state.noteDrafts.get(attempt.id) ?? attempt.review?.note ?? "" : "";
  $("review-note").disabled = !attempt || state.busy;
  $("approve-button").disabled = !attempt?.qa?.pass || state.busy;
  $("approve-button").title = attempt && !attempt.qa?.pass ? "Сначала исправьте ошибки проверки файла" : "";
  $("reject-button").disabled = !attempt || state.busy;
  $("reset-review-button").hidden = !attempt || !["approved", "rejected"].includes(attempt.review?.status);
  $("reset-review-button").disabled = state.busy;
  $("export-button").disabled = !attempt?.qa?.pass || attempt?.review?.status !== "approved" || state.busy;
  $("export-reason").textContent = !attempt ? "Доступен после проверки и принятия варианта." : !attempt.qa?.pass ? "Исправьте ошибки проверки файла." : attempt.review?.status !== "approved" ? "Для пакета нужно решение владельца: «Принять вариант»." : attempt.export ? "Пакет уже собран. Можно скачать повторно." : "Файл проверен, вариант принят. Можно собрать пакет.";
}

function render() {
  const job = currentJob();
  if (!job) return;
  renderJobs();
  renderWorkflow();
  $("job-title").textContent = job.title;
  $("job-location").textContent = job.screen;
  $("job-purpose").textContent = job.purpose;
  const attempt = currentAttempt();
  const label = attempt ? reviewLabel(attempt.review?.status) : currentRequest() ? "Запрос готов" : "Черновик задания";
  $("job-status").textContent = label.replace(/^./, (letter) => letter.toUpperCase());
  $("job-status").className = `status-pill ${attempt?.review?.status || ""}`;
  renderComparison();
  renderRequest();
  renderContext();
  $("workspace").setAttribute("aria-busy", String(state.busy));
}

async function run(action) {
  if (state.busy) return;
  state.busy = true;
  render();
  try { await action(); } catch (error) { announce(error.message || "Не удалось выполнить действие.", true); }
  finally { state.busy = false; render(); }
}

async function prepareRequest() {
  const job = currentJob();
  const prompt = $("prompt-editor").value.trim();
  if (!prompt) return;
  await run(async () => {
    const result = await api("/api/prepare", { jobId: job.id, prompt });
    state.requestId = result.request.id;
    state.attemptId = null;
    state.promptDrafts.set(job.id, result.request.prompt);
    $("image-file").value = "";
    await refresh();
    announce(isAnimationJob() ? "Задание сохранено. Можно запустить видеопробу через Runway ниже или загрузить готовую последовательность PNG." : "Запрос сохранён. Скопируйте его в чат Codex, сгенерируйте изображение и верните PNG в мастерскую.");
  });
}

async function copyRequest() {
  const request = currentRequest();
  if (!request) return;
  await run(async () => {
    const packet = await api(request.url);
    const copy = (isAnimationJob() ? [
      "Подготовь покадровую анимацию для Chewy по сохранённому заданию ниже.",
      "Используй перечисленные референсы, сохрани внешний вид героя и заданное движение.",
      "Нужны 2–240 прозрачных PNG одинакового размера, в правильном порядке, с именами frame_001.png, frame_002.png и далее, без вложенных папок в ZIP.",
      "Укажи частоту кадров и режим повтора. Сохрани готовый ZIP для импорта в локальную мастерскую.",
      "Видеочерновик можно сгенерировать через Runway в локальной мастерской. Прозрачные PNG-кадры и бесшовный цикл требуют отдельной подготовки; не выдавай одиночную картинку за анимацию.",
      "Не принимай вариант за меня и не заменяй файлы приложения.", "", JSON.stringify(packet, null, 2),
    ] : [
      "Сгенерируй один вариант изображения для Chewy по сохранённому запросу ниже.",
      "Используй перечисленные локальные референсы и сохрани готовый PNG с настоящей прозрачностью.",
      "После генерации сообщи путь к PNG: я загружу его в локальную мастерскую для проверки и выбора.",
      "Не принимай вариант за меня и не заменяй файлы приложения.", "", JSON.stringify(packet, null, 2),
    ]).join("\n");
    try {
      await navigator.clipboard.writeText(copy);
      announce(isAnimationJob() ? "Задание анимации скопировано. После подготовки движения загрузите сюда ZIP с PNG-кадрами." : "Запрос скопирован. Вставьте его в чат Codex этого проекта. Генерация выполняется в чате, затем загрузите PNG сюда.");
    } catch {
      $("copy-fallback").value = copy;
      $("copy-dialog").showModal();
      $("copy-fallback").select();
    }
  });
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл. Выберите его ещё раз."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(file);
  });
}

async function importImage(event) {
  event.preventDefault();
  const file = $("image-file").files[0];
  const job = currentJob();
  const request = currentRequest();
  const tool = $("tool-input").value.trim();
  const model = $("model-input").value.trim();
  const animation = isAnimationJob();
  if (!request) { announce("Подготовьте запрос перед загрузкой варианта.", true); return; }
  if (!file) { announce(animation ? "Выберите ZIP с PNG-кадрами." : "Выберите сгенерированный PNG.", true); return; }
  if (!(animation ? /\.zip$/i : /\.png$/i).test(file.name)) { announce(animation ? "Для анимации нужен ZIP с последовательностью PNG-кадров." : "Для этой пробы нужен PNG. Экспортируйте изображение в PNG и повторите загрузку.", true); return; }
  if (file.size > (animation ? MAX_ANIMATION_BYTES : MAX_FILE_BYTES)) { announce(animation ? "ZIP больше 100 МБ. Подготовьте меньшую последовательность." : "Файл больше 20 МБ. Подготовьте PNG меньшего размера и повторите загрузку.", true); return; }
  if (!tool) { announce("Укажите инструмент, которым получен файл.", true); return; }
  const fps = Number($("import-fps").value);
  const playback = $("import-playback").value;
  if (animation && (!Number.isFinite(fps) || fps < 1 || fps > 60)) { announce("Укажите частоту кадров от 1 до 60 FPS.", true); return; }
  await run(async () => {
    const dataBase64 = await fileBase64(file);
    const result = await api(animation ? "/api/import-animation" : "/api/import", { jobId: job.id, packetId: request.id, filename: file.name, dataBase64, tool, model, ...(animation ? { fps, playback } : {}) });
    state.attemptId = result.attempt.id;
    $("image-file").value = "";
    await refresh();
    announce(result.attempt.qa?.pass ? animation ? "Кадры загружены, техническая проверка пройдена. Воспроизведите движение, проверьте стык и примите решение." : "Вариант загружен, проверка файла пройдена. Сверьте образ и примите решение справа." : "Вариант сохранён. Проверка обнаружила ошибки — подробности справа.", !result.attempt.qa?.pass);
  });
}

async function reviewAttempt(status) {
  const job = currentJob();
  const attempt = currentAttempt();
  if (!attempt) return;
  const note = $("review-note").value.trim();
  await run(async () => {
    await api("/api/review", { jobId: job.id, attemptId: attempt.id, status, note });
    state.noteDrafts.delete(attempt.id);
    await refresh();
    announce(status === "approved" ? "Вариант принят. Теперь можно скачать исходный пакет." : status === "rejected" ? "Решение сохранено: на доработку. Измените запрос и подготовьте следующую пробу." : "Решение снято. Вариант снова ожидает проверки владельцем.");
  });
}

async function exportAttempt() {
  const job = currentJob();
  const attempt = currentAttempt();
  if (!attempt) return;
  await run(async () => {
    const result = await api("/api/export", { jobId: job.id, attemptId: attempt.id });
    await refresh();
    const link = node("a");
    link.href = result.url;
    link.download = "";
    document.body.append(link);
    link.click();
    link.remove();
    announce("Исходный пакет собран, скачивание начато. В нём исходник и паспорт; примерка в Storybook и подготовка для iOS идут отдельно.");
  });
}

$("retry-load").addEventListener("click", load);
$("prepare-button").addEventListener("click", prepareRequest);
$("copy-button").addEventListener("click", copyRequest);
$("import-form").addEventListener("submit", importImage);
$("approve-button").addEventListener("click", () => reviewAttempt("approved"));
$("reject-button").addEventListener("click", () => reviewAttempt("rejected"));
$("reset-review-button").addEventListener("click", () => reviewAttempt("pending"));
$("export-button").addEventListener("click", exportAttempt);
$("prompt-editor").addEventListener("input", () => {
  state.promptDrafts.set(state.jobId, $("prompt-editor").value);
  renderPromptState();
  $("prepare-button").disabled = state.busy || !$("prompt-editor").value.trim();
  syncRunway();
});
$("review-note").addEventListener("input", () => { if (state.attemptId) state.noteDrafts.set(state.attemptId, $("review-note").value); });
$("request-select").addEventListener("change", (event) => {
  state.requestId = event.target.value;
  state.attemptId = null;
  state.promptDrafts.set(state.jobId, currentRequest()?.prompt || "");
  syncSelection();
  $("image-file").value = "";
  render();
});
$("attempt-select").addEventListener("change", (event) => { state.attemptId = event.target.value; render(); });
$("reference-select").addEventListener("change", (event) => { state.referenceId = event.target.value; renderComparison(); });
$("scale-button").addEventListener("click", () => { state.actualSize = !state.actualSize; renderComparison(); });
document.querySelectorAll("[data-background]").forEach((button) => button.addEventListener("click", () => { state.background = button.dataset.background; renderComparison(); }));
for (const id of ["reference-image", "candidate-image"]) $(id).addEventListener("error", () => {
  $(id).hidden = true;
  if (id === "reference-image") { $("reference-empty").hidden = false; $("reference-empty").textContent = "Не удалось открыть референс. Проверьте путь к исходному файлу."; }
  else { $("candidate-empty").hidden = false; $("candidate-empty-text").textContent = "Не удалось открыть изображение варианта. Обновите страницу или проверьте локальный файл."; }
});

load();

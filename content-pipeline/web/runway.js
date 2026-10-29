"use strict";

const RUNWAY_ACTIVE_STATUSES = new Set(["SUBMITTING", "UNKNOWN", "PENDING", "THROTTLED", "RUNNING"]);
const RUNWAY_STATUS_LABELS = {
  SUBMITTING: "Отправляется", UNKNOWN: "Нужно проверить запуск", PENDING: "В очереди",
  THROTTLED: "Ожидает свободного слота", RUNNING: "Генерируется", SUCCEEDED: "Генерация завершена",
  FAILED: "Не получилось", CANCELED: "Отменена",
};

function runwayNode(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function runwayLocalUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && ["http:", "https:"].includes(url.protocol) ? `${url.pathname}${url.search}` : null;
  } catch { return null; }
}

class RunwayPanel {
  constructor({ api, run, announce, formatDate }) {
    this.api = api;
    this.run = run;
    this.announce = announce;
    this.formatDate = formatDate;
    this.context = {};
    this.status = null;
    this.statusStarted = false;
    this.statusLoading = false;
    this.statusError = "";
    this.actionError = "";
    this.listError = "";
    this.packetId = null;
    this.listLoading = null;
    this.localBusy = false;
    this.model = "";
    this.referenceId = "";
    this.generations = new Map();
    this.historySignature = "";
    this.refreshing = new Set();
    this.refreshTimes = new Map();
    this.uncertainPackets = new Map();
    this.$ = (id) => document.getElementById(`runway-${id}`);
    this.$("key-form").addEventListener("submit", (event) => { event.preventDefault(); this.saveKey(); });
    this.$("generate").addEventListener("click", () => this.generate());
    this.$("reconnect").addEventListener("click", () => this.loadStatus());
    this.$("reload-list").addEventListener("click", () => { if (this.packetId) this.loadGenerations(this.packetId); });
    this.$("model").addEventListener("change", (event) => { this.model = event.target.value; this.render(); });
    this.$("reference").addEventListener("change", (event) => { this.referenceId = event.target.value; this.render(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.pauseVideos(); });
  }

  sync(context) {
    this.context = context;
    this.$("section").hidden = !context.animation;
    if (!context.animation) this.pauseVideos();
    const packetId = context.animation ? context.packetId : null;
    if (packetId !== this.packetId) {
      this.pauseVideos();
      this.packetId = packetId;
      this.referenceId = context.references?.[0]?.id || "";
      this.actionError = "";
      this.listError = "";
      this.historySignature = "";
      if (packetId) this.loadGenerations(packetId);
    }
    if (context.animation && !this.statusStarted) this.loadStatus();
    this.render();
  }

  pauseVideos() { this.$("generations").querySelectorAll("video").forEach((video) => video.pause()); }

  async loadStatus() {
    if (this.statusLoading) return;
    this.statusStarted = true;
    this.statusLoading = true;
    this.statusError = "";
    this.render();
    try {
      const status = await this.api("/api/runway/status");
      const firstStatus = !this.status;
      this.status = status;
      if (firstStatus) this.$("key-details").open = !status.configured;
    } catch (error) {
      this.statusError = error.message || "Не удалось прочитать настройки Runway.";
    } finally {
      this.statusLoading = false;
      this.render();
    }
  }

  async loadGenerations(packetId) {
    if (this.listLoading === packetId) return;
    this.listLoading = packetId;
    this.listError = "";
    this.render();
    try {
      const result = await this.api(`/api/runway/generations?packetId=${encodeURIComponent(packetId)}`);
      this.generations.set(packetId, result.generations || []);
      const previousIds = this.uncertainPackets.get(packetId);
      if (previousIds && result.generations?.some((generation) => !previousIds.has(generation.id))) this.uncertainPackets.delete(packetId);
    } catch (error) {
      if (this.packetId === packetId) this.listError = error.message || "Не удалось загрузить историю генераций.";
    } finally {
      if (this.listLoading === packetId) this.listLoading = null;
      this.render();
    }
  }

  async action(work) {
    if (this.localBusy || this.context.busy) return;
    this.localBusy = true;
    this.actionError = "";
    this.render();
    try {
      await this.run(async () => {
        try { await work(); }
        catch (error) { this.actionError = error.message || "Действие Runway не выполнено."; }
      });
    } finally {
      this.localBusy = false;
      this.render();
    }
  }

  async saveKey() {
    const apiKey = this.$("key").value.trim();
    if (!apiKey) return;
    await this.action(async () => {
      this.status = await this.api("/api/runway/key", { apiKey });
      this.statusStarted = true;
      this.statusError = "";
      this.$("key").value = "";
      this.$("key-details").open = false;
      this.announce("API-ключ сохранён локально. Можно выбрать модель и запустить видеопробу.");
    });
  }

  generationReason() {
    if (this.localBusy || this.context.busy) return "Дождитесь завершения текущего действия.";
    if (this.statusLoading || !this.status) return "Проверяем настройки Runway.";
    if (this.statusError) return "Восстановите подключение к локальному серверу.";
    if (!this.status.configured) return "Сначала сохраните API-ключ Runway.";
    if (!this.context.packetId) return "Сначала подготовьте и сохраните запрос выше.";
    if (this.context.promptChanged) return "Промпт изменён. Нажмите «Подготовить запрос», чтобы сохранить новую версию перед генерацией.";
    if (this.listLoading === this.packetId) return "Загружаем историю запусков, чтобы не создать повторный.";
    if (this.listError || !this.generations.has(this.packetId)) return "Обновите список запусков перед новой генерацией.";
    const active = (this.generations.get(this.packetId) || []).find((generation) => RUNWAY_ACTIVE_STATUSES.has(generation.status));
    if (active?.status === "UNKNOWN") return "Результат отправки неизвестен. Проверьте запуск в Runway; новая платная генерация заблокирована.";
    if (active) return "У этого запроса уже есть активная генерация. Обновите её статус ниже.";
    if (this.uncertainPackets.has(this.packetId)) return "Ответ на запуск потерян. Обновите список и проверьте Runway перед повторным запуском.";
    if (!this.model || !this.status.models?.some((model) => model.id === this.model)) return "Выберите доступную модель.";
    if (!this.referenceId || !this.context.references?.some((reference) => reference.id === this.referenceId)) return "В сохранённом запросе нужен референс для первого кадра.";
    return "Один клик запускает одну платную генерацию. Автоматических повторов нет.";
  }

  canGenerate() {
    return this.generationReason() === "Один клик запускает одну платную генерацию. Автоматических повторов нет.";
  }

  async generate() {
    if (!this.canGenerate()) return;
    const { jobId, packetId } = this.context;
    const referenceId = this.referenceId;
    const model = this.model;
    const clientRequestId = crypto.randomUUID();
    await this.action(async () => {
      this.uncertainPackets.set(packetId, new Set((this.generations.get(packetId) || []).map((generation) => generation.id)));
      try {
        const result = await this.api("/api/runway/generate", { jobId, packetId, referenceId, model, clientRequestId });
        this.mergeGeneration(result.generation);
        this.uncertainPackets.delete(packetId);
        if (result.generation.status === "UNKNOWN") this.announce("Ответ Runway на запуск неизвестен. Задача сохранена, новый запуск заблокирован: проверьте сведения ниже и аккаунт Runway.", true);
        else if (result.generation.status === "FAILED") this.announce("Runway не выполнил генерацию. Ошибка сохранена в истории ниже; автоматического повтора нет.", true);
        else this.announce("Видеопроба отправлена в Runway. Статус и результат появятся в списке ниже; кнопка «Обновить статус» не запускает новую генерацию.");
      } catch (error) {
        if (error.status >= 400 && error.status < 500 && error.status !== 408) this.uncertainPackets.delete(packetId);
        await this.loadGenerations(packetId);
        throw error;
      }
    });
  }

  mergeGeneration(generation) {
    const packetId = generation.packetId;
    const existing = this.generations.get(packetId) || [];
    this.generations.set(packetId, [...existing.filter((item) => item.id !== generation.id), generation].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
  }

  async refreshGeneration(generation) {
    if (this.localBusy || this.context.busy || this.refreshing.has(generation.id)) return;
    if (Date.now() - (this.refreshTimes.get(generation.id) || 0) < 5000) {
      this.actionError = "Статус можно обновлять раз в 5 секунд. Подождите немного и нажмите ещё раз.";
      this.render();
      return;
    }
    this.refreshing.add(generation.id);
    this.refreshTimes.set(generation.id, Date.now());
    await this.action(async () => {
      const result = await this.api("/api/runway/refresh", { generationId: generation.id });
      this.mergeGeneration(result.generation);
    });
    this.refreshing.delete(generation.id);
    this.render();
  }

  render() {
    const busy = this.localBusy || this.context.busy;
    const configured = Boolean(this.status?.configured);
    this.$("connection").textContent = this.statusLoading ? "Проверяем настройки…" : this.statusError ? "Сервер недоступен" : configured ? this.status.source === "environment" ? "Ключ из окружения" : "Ключ сохранён локально" : "Нужен API-ключ";
    this.$("connection").className = `tiny-status ${configured && !this.statusError ? "pass" : ""}`;
    this.$("key").disabled = busy;
    this.$("key-save").disabled = busy;
    this.$("service-error").hidden = !this.statusError;
    this.$("service-error").textContent = this.statusError;
    this.$("reconnect").hidden = !this.statusError;
    this.$("reconnect").disabled = busy || this.statusLoading;
    const models = this.status?.models || [];
    if (!models.some((model) => model.id === this.model)) this.model = models[0]?.id || "";
    const modelSelect = this.$("model");
    modelSelect.replaceChildren(...(models.length ? models.map((model) => { const option = runwayNode("option", "", model.label); option.value = model.id; return option; }) : [runwayNode("option", "", "Модели появятся после подключения сервера")]));
    modelSelect.value = this.model;
    modelSelect.disabled = busy || !models.length;
    const references = this.context.references || [];
    if (!references.some((reference) => reference.id === this.referenceId)) this.referenceId = references[0]?.id || "";
    const referenceSelect = this.$("reference");
    referenceSelect.replaceChildren(...(references.length ? references.map((reference) => { const option = runwayNode("option", "", reference.title); option.value = reference.id; return option; }) : [runwayNode("option", "", "Сначала сохраните запрос с референсом")]));
    referenceSelect.value = this.referenceId;
    referenceSelect.disabled = busy || !references.length;
    const model = models.find((item) => item.id === this.model);
    const cost = typeof model?.estimatedCostUsd === "number" ? `$${model.estimatedCostUsd.toFixed(2)}` : null;
    this.$("generate").textContent = `Сгенерировать ${this.status?.duration || 5} с${cost ? ` · ≈ ${cost}` : ""}`;
    this.$("generate").disabled = !this.canGenerate();
    this.$("cost").textContent = cost ? "Оценка стоимости одного запуска в аккаунте Runway." : "Стоимость появится после загрузки моделей.";
    this.$("generate-reason").textContent = this.generationReason();
    this.$("action-error").hidden = !this.actionError;
    this.$("action-error").textContent = this.actionError;
    this.$("reload-list").disabled = busy || !this.packetId || this.listLoading === this.packetId;
    this.renderHistory();
    this.$("generations").querySelectorAll("button").forEach((button) => { button.disabled = busy || this.refreshing.has(button.dataset.generationId); });
  }

  renderHistory() {
    const generations = this.generations.get(this.packetId) || [];
    this.$("history-empty").hidden = Boolean(generations.length) && !this.listError;
    this.$("history-empty").textContent = this.listError || (this.listLoading === this.packetId && this.packetId ? "Загружаем сохранённые видеопробы…" : this.packetId ? "У этого запроса ещё нет видеогенераций." : "Сначала подготовьте запрос выше.");
    const signature = JSON.stringify([this.packetId, generations, this.status?.models]);
    if (signature === this.historySignature) return;
    this.historySignature = signature;
    this.pauseVideos();
    this.$("generations").replaceChildren(...generations.slice().reverse().map((generation) => {
      const article = runwayNode("article", "runway-generation");
      const heading = runwayNode("div", "runway-generation-heading");
      const model = this.status?.models?.find((item) => item.id === generation.model);
      heading.append(runwayNode("h4", "", model?.label || generation.model), runwayNode("span", `runway-generation-status status-${generation.status.toLowerCase()}`, RUNWAY_STATUS_LABELS[generation.status] || generation.status));
      article.append(heading, runwayNode("p", "subtle-text", `${this.formatDate(generation.createdAt)}${typeof generation.estimatedCostUsd === "number" ? ` · оценка $${generation.estimatedCostUsd.toFixed(2)}` : ""}`));
      if (generation.taskId) article.append(runwayNode("p", "runway-task-id", `Runway task: ${generation.taskId}`));
      if (generation.status === "UNKNOWN") article.append(runwayNode("p", "runway-error", "Ответ на отправку потерян. Автоматического повтора не будет. Проверьте задачу в аккаунте Runway."));
      else if (RUNWAY_ACTIVE_STATUSES.has(generation.status)) article.append(runwayNode("p", "subtle-text", "Задача сохранена. Обновляйте статус вручную — это не создаёт новый запуск."));
      if (generation.error) article.append(runwayNode("p", "runway-error", generation.error));
      const videoUrl = runwayLocalUrl(generation.videoUrl);
      const downloadUrl = runwayLocalUrl(generation.downloadUrl);
      if (videoUrl) {
        const video = runwayNode("video", "runway-video");
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.src = videoUrl;
        video.setAttribute("aria-label", `Видеопроба ${model?.label || generation.model}`);
        const error = runwayNode("p", "runway-error", "Не удалось воспроизвести локальный MP4. Попробуйте скачать исходник.");
        error.hidden = true;
        video.addEventListener("error", () => { error.hidden = false; });
        article.append(video, error);
      } else if (generation.status === "SUCCEEDED") article.append(runwayNode("p", "subtle-text", "Видео сгенерировано, локальный MP4 ещё не сохранён. «Обновить статус» повторит только получение результата."));
      const actions = runwayNode("div", "runway-generation-actions");
      if (downloadUrl) {
        const download = runwayNode("a", "text-link", "Скачать исходный MP4");
        download.href = downloadUrl;
        download.download = "";
        actions.append(download);
      }
      if (RUNWAY_ACTIVE_STATUSES.has(generation.status) || (generation.status === "SUCCEEDED" && !videoUrl)) {
        const refresh = runwayNode("button", "", "Обновить статус");
        refresh.type = "button";
        refresh.dataset.generationId = generation.id;
        refresh.addEventListener("click", () => this.refreshGeneration(generation));
        actions.append(refresh);
      }
      article.append(actions, runwayNode("p", "runway-draft-note", "Видеочерновик: прозрачность и стык цикла ещё не подготовлены. Для проверки и принятия покадровой анимации загрузите подготовленные PNG отдельным ZIP."));
      return article;
    }));
  }
}

globalThis.ChewyRunway = { RunwayPanel };

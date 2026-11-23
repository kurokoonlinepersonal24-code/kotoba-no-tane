const DB_NAME = "kotoba-no-tane";
const DB_VERSION = 1;
const BACKUP_FORMAT = "kotoba-no-tane-backup";
const BACKUP_VERSION = 1;

const PATTERNS = {
  hook: "冒頭インパクト型",
  pitch: "エレベーターピッチ型",
  reframe: "あるある → 見方の転換型",
  question: "体験 → 問いかけ型",
  redefine: "思い込みの再定義型",
  translate: "感情の翻訳型",
  analogy: "たとえ話型"
};

const PATTERN_HINTS = {
  hook: {
    hint: "印象に残る一言から、自分の体験と気づきにつなげます。",
    template: "【冒頭の一言】\n【自分の体験】\n【そこから気づいたこと】\n【聞き手への問い】"
  },
  pitch: {
    hint: "誰に、どんな悩みに向けて、どんな視点を届けるかを短くまとめます。",
    template: "【届けたい相手】\n【その人が抱えていそうな悩み】\n【伝えたい視点】\n【一言で伝えるメッセージ】"
  },
  reframe: {
    hint: "身近な「あるある」から始め、少し違う見方を差し出します。",
    template: "【よくある場面】\n【そのとき感じること】\n【別の見方・気づき】\n【聞き手への問い】"
  },
  question: {
    hint: "小さな体験を話してから、聞き手自身にも考える問いを渡します。",
    template: "【起きた出来事】\n【そのときの気持ち】\n【あとから気づいたこと】\n【聞き手への問い】"
  },
  redefine: {
    hint: "当たり前だと思っていた言葉や考えを、自分の体験から捉え直します。",
    template: "【以前の自分が信じていたこと】\n【考えが変わった体験】\n【今の自分にとっての新しい意味】"
  },
  translate: {
    hint: "行動の奥にある気持ちを、決めつけず「かもしれない」と表現します。",
    template: "【表に出ていた行動】\n【その奥にあったかもしれない気持ち】\n【自分が気づいたこと】\n【聞き手への問い】"
  },
  analogy: {
    hint: "身近なたとえを使い、どこが自分の気持ちと似ているのかをつなぎます。",
    template: "【身近なたとえ】\n【たとえのどこが似ているか】\n【そこから伝えたい気づき】\n【聞き手への問い】"
  }
};

const elements = {
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  entryForm: document.querySelector("#entry-form"),
  entryId: document.querySelector("#entry-id"),
  entryText: document.querySelector("#entry-text"),
  entryMood: document.querySelector("#entry-mood"),
  entryTags: document.querySelector("#entry-tags"),
  entryMetaphor: document.querySelector("#entry-metaphor"),
  entrySubmit: document.querySelector("#entry-submit"),
  entryCancel: document.querySelector("#entry-cancel"),
  entrySearch: document.querySelector("#entry-search"),
  entryMoodFilter: document.querySelector("#entry-mood-filter"),
  entryTagFilter: document.querySelector("#entry-tag-filter"),
  entryList: document.querySelector("#entry-list"),
  entryEmpty: document.querySelector("#entry-empty"),
  ideaForm: document.querySelector("#idea-form"),
  ideaId: document.querySelector("#idea-id"),
  ideaTitle: document.querySelector("#idea-title"),
  ideaPattern: document.querySelector("#idea-pattern"),
  ideaSource: document.querySelector("#idea-source"),
  ideaText: document.querySelector("#idea-text"),
  patternHint: document.querySelector("#pattern-hint"),
  patternInsert: document.querySelector("#pattern-insert"),
  ideaSubmit: document.querySelector("#idea-submit"),
  ideaCancel: document.querySelector("#idea-cancel"),
  ideaSearch: document.querySelector("#idea-search"),
  ideaList: document.querySelector("#idea-list"),
  ideaEmpty: document.querySelector("#idea-empty"),
  backupButton: document.querySelector("#backup-button"),
  exportButton: document.querySelector("#export-button"),
  importFile: document.querySelector("#import-file"),
  importDialog: document.querySelector("#import-dialog"),
  importSummary: document.querySelector("#import-summary"),
  mergeButton: document.querySelector("#merge-button"),
  replaceButton: document.querySelector("#replace-button"),
  toast: document.querySelector("#toast")
};

let database;
let pendingBackup;
let toastTimeout;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("entries")) {
        db.createObjectStore("entries", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("ideas")) {
        db.createObjectStore("ideas", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("データの保存に失敗しました。"));
    transaction.onerror = () => reject(transaction.error || new Error("データの保存に失敗しました。"));
  });
}

async function getAll(storeName) {
  const transaction = database.transaction(storeName, "readonly");
  return requestResult(transaction.objectStore(storeName).getAll());
}

async function putRecord(storeName, record) {
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(record);
  await transactionDone(transaction);
}

async function deleteRecord(storeName, id) {
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(id);
  await transactionDone(transaction);
}

async function clearStore(storeName) {
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).clear();
  await transactionDone(transaction);
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const values = crypto.getRandomValues(new Uint8Array(16));
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function now() {
  return new Date().toISOString();
}

function today() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => elements.toast.classList.remove("is-visible"), 2800);
}

function parseTags(value) {
  return [...new Set(value.split(/[,、]/).map((tag) => tag.trim()).filter(Boolean))];
}

function setActiveView(viewId) {
  for (const tab of elements.tabs) {
    const active = tab.dataset.view === viewId;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  for (const view of elements.views) {
    const active = view.id === viewId;
    view.classList.toggle("is-visible", active);
    view.hidden = !active;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetEntryForm() {
  elements.entryForm.reset();
  elements.entryId.value = "";
  elements.entrySubmit.textContent = "記録を保存";
  elements.entryCancel.classList.add("is-hidden");
}

function resetIdeaForm() {
  elements.ideaForm.reset();
  elements.ideaId.value = "";
  elements.ideaSubmit.textContent = "アイデアを保存";
  elements.ideaCancel.classList.add("is-hidden");
  updatePatternHint();
}

function updatePatternHint() {
  const pattern = PATTERN_HINTS[elements.ideaPattern.value];
  elements.patternHint.textContent = pattern?.hint || "型を選ぶと、話の組み立て方のヒントが表示されます。";
}

function insertPatternTemplate() {
  const pattern = PATTERN_HINTS[elements.ideaPattern.value];
  if (!pattern) {
    showToast("先に話し方の型を選んでください。");
    elements.ideaPattern.focus();
    return;
  }
  const currentText = elements.ideaText.value.trim();
  elements.ideaText.value = currentText ? `${currentText}\n\n${pattern.template}` : pattern.template;
  elements.ideaText.focus();
}

function entryCard(entry) {
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  return `
    <article class="entry-card">
      <div class="card-meta">
        <span>${escapeHtml(formatDate(entry.date || ""))}</span>
        ${entry.mood ? `<span class="mood-pill">${escapeHtml(entry.mood)}</span>` : ""}
      </div>
      <p class="card-text">${escapeHtml(entry.text)}</p>
      ${tags.length ? `<div class="tag-list">${tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${entry.metaphor ? `<div class="card-section"><strong>たとえるなら</strong><span class="card-text">${escapeHtml(entry.metaphor)}</span></div>` : ""}
      <div class="card-actions">
        <button class="text-button" type="button" data-action="make-idea" data-id="${escapeHtml(entry.id)}">アイデアにする</button>
        <button class="text-button" type="button" data-action="edit-entry" data-id="${escapeHtml(entry.id)}">編集</button>
        <button class="text-button delete" type="button" data-action="delete-entry" data-id="${escapeHtml(entry.id)}">削除</button>
      </div>
    </article>`;
}

function ideaCard(idea, entriesById) {
  const source = idea.sourceId ? entriesById.get(idea.sourceId) : null;
  return `
    <article class="idea-card">
      <div class="card-heading">
        <h3 class="card-title">${escapeHtml(idea.title)}</h3>
        ${idea.pattern ? `<span class="pattern-pill">${escapeHtml(PATTERNS[idea.pattern] || idea.pattern)}</span>` : ""}
      </div>
      <p class="card-meta">${source ? `もとになった記録：${escapeHtml(formatDate(source.date))}` : "発信アイデア"}</p>
      <p class="card-text">${escapeHtml(idea.text)}</p>
      <div class="card-actions">
        <button class="text-button" type="button" data-action="edit-idea" data-id="${escapeHtml(idea.id)}">編集</button>
        <button class="text-button delete" type="button" data-action="delete-idea" data-id="${escapeHtml(idea.id)}">削除</button>
      </div>
    </article>`;
}

async function renderEntries() {
  const entries = (await getAll("entries")).sort((a, b) => {
    const dateOrder = String(b.date).localeCompare(String(a.date));
    return dateOrder || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  updateEntryFilters(entries);
  const query = elements.entrySearch.value.trim().toLocaleLowerCase();
  const selectedMood = elements.entryMoodFilter.value;
  const selectedTag = elements.entryTagFilter.value;
  const filtered = entries.filter((entry) => {
    const searchable = [entry.text, entry.mood, entry.metaphor, ...(entry.tags || [])]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    return searchable.includes(query)
      && (!selectedMood || entry.mood === selectedMood)
      && (!selectedTag || (entry.tags || []).includes(selectedTag));
  });
  elements.entryList.innerHTML = filtered.map(entryCard).join("");
  elements.entryEmpty.classList.toggle("is-visible", filtered.length === 0);
  const hasFilters = query || selectedMood || selectedTag;
  elements.entryEmpty.textContent = hasFilters && entries.length
    ? "検索条件に合う記録はありません。"
    : "まだ記録はありません。最初のひとことを残してみましょう。";
  await renderSourceOptions(entries);
}

function updateEntryFilters(entries) {
  const selectedMood = elements.entryMoodFilter.value;
  const selectedTag = elements.entryTagFilter.value;
  const moods = [...new Set(entries.map((entry) => entry.mood).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));
  const tags = [...new Set(entries.flatMap((entry) => entry.tags || []).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));

  elements.entryMoodFilter.innerHTML = `<option value="">すべての気持ち</option>${moods.map((mood) => `
    <option value="${escapeHtml(mood)}">${escapeHtml(mood)}</option>
  `).join("")}`;
  elements.entryTagFilter.innerHTML = `<option value="">すべてのタグ</option>${tags.map((tag) => `
    <option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>
  `).join("")}`;

  if (moods.includes(selectedMood)) {
    elements.entryMoodFilter.value = selectedMood;
  }
  if (tags.includes(selectedTag)) {
    elements.entryTagFilter.value = selectedTag;
  }
}

async function renderSourceOptions(entries) {
  const selected = elements.ideaSource.value;
  elements.ideaSource.innerHTML = `<option value="">選択しない</option>${entries.map((entry) => `
    <option value="${escapeHtml(entry.id)}">${escapeHtml(formatDate(entry.date))} — ${escapeHtml(entry.text.slice(0, 44))}</option>
  `).join("")}`;
  if (entries.some((entry) => entry.id === selected)) {
    elements.ideaSource.value = selected;
  }
}

async function renderIdeas() {
  const [ideas, entries] = await Promise.all([getAll("ideas"), getAll("entries")]);
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  ideas.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const query = elements.ideaSearch.value.trim().toLocaleLowerCase();
  const filtered = ideas.filter((idea) => `${idea.title} ${idea.text} ${PATTERNS[idea.pattern] || ""}`
    .toLocaleLowerCase().includes(query));
  elements.ideaList.innerHTML = filtered.map((idea) => ideaCard(idea, entriesById)).join("");
  elements.ideaEmpty.classList.toggle("is-visible", filtered.length === 0);
  elements.ideaEmpty.textContent = query && ideas.length
    ? "検索条件に合うアイデアはありません。"
    : "保存したアイデアはまだありません。";
}

async function renderAll() {
  await renderEntries();
  await renderIdeas();
}

async function handleEntrySubmit(event) {
  event.preventDefault();
  const id = elements.entryId.value || createId();
  const existing = elements.entryId.value
    ? (await getAll("entries")).find((entry) => entry.id === id)
    : null;
  const timestamp = now();
  const record = {
    id,
    date: existing?.date || today(),
    text: elements.entryText.value.trim(),
    mood: elements.entryMood.value,
    tags: parseTags(elements.entryTags.value),
    metaphor: elements.entryMetaphor.value.trim(),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };
  if (!record.text) {
    elements.entryText.focus();
    return;
  }
  await putRecord("entries", record);
  resetEntryForm();
  await renderAll();
  showToast(existing ? "記録を更新しました。" : "記録を保存しました。");
}

async function handleIdeaSubmit(event) {
  event.preventDefault();
  const id = elements.ideaId.value || createId();
  const existing = elements.ideaId.value
    ? (await getAll("ideas")).find((idea) => idea.id === id)
    : null;
  const timestamp = now();
  const record = {
    id,
    title: elements.ideaTitle.value.trim(),
    pattern: elements.ideaPattern.value,
    sourceId: elements.ideaSource.value,
    text: elements.ideaText.value.trim(),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };
  if (!record.title || !record.text) {
    return;
  }
  await putRecord("ideas", record);
  resetIdeaForm();
  await renderAll();
  showToast(existing ? "アイデアを更新しました。" : "アイデアを保存しました。");
}

async function beginEditEntry(id) {
  const entry = (await getAll("entries")).find((item) => item.id === id);
  if (!entry) {
    showToast("記録が見つかりませんでした。");
    return;
  }
  elements.entryId.value = entry.id;
  elements.entryText.value = entry.text;
  elements.entryMood.value = entry.mood || "";
  elements.entryTags.value = (entry.tags || []).join("、");
  elements.entryMetaphor.value = entry.metaphor || "";
  elements.entrySubmit.textContent = "変更を保存";
  elements.entryCancel.classList.remove("is-hidden");
  setActiveView("journal-view");
  elements.entryText.focus();
}

async function beginCreateIdeaFromEntry(id) {
  const entry = (await getAll("entries")).find((item) => item.id === id);
  if (!entry) {
    showToast("記録が見つかりませんでした。");
    return;
  }
  resetIdeaForm();
  elements.ideaSource.value = entry.id;
  elements.ideaText.value = entry.metaphor
    ? `記録からの気づき：\n${entry.text}\n\nたとえ：\n${entry.metaphor}`
    : `記録からの気づき：\n${entry.text}`;
  setActiveView("ideas-view");
  elements.ideaTitle.focus();
}

async function beginEditIdea(id) {
  const idea = (await getAll("ideas")).find((item) => item.id === id);
  if (!idea) {
    showToast("アイデアが見つかりませんでした。");
    return;
  }
  elements.ideaId.value = idea.id;
  elements.ideaTitle.value = idea.title;
  elements.ideaPattern.value = idea.pattern || "";
  elements.ideaSource.value = idea.sourceId || "";
  elements.ideaText.value = idea.text;
  elements.ideaSubmit.textContent = "変更を保存";
  elements.ideaCancel.classList.remove("is-hidden");
  setActiveView("ideas-view");
  elements.ideaTitle.focus();
}

async function handleCardAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const { action, id } = button.dataset;
  if (action === "edit-entry") {
    await beginEditEntry(id);
  } else if (action === "make-idea") {
    await beginCreateIdeaFromEntry(id);
  } else if (action === "delete-entry") {
    if (window.confirm("この記録を削除しますか？")) {
      await deleteRecord("entries", id);
      await renderAll();
      showToast("記録を削除しました。");
    }
  } else if (action === "edit-idea") {
    await beginEditIdea(id);
  } else if (action === "delete-idea") {
    if (window.confirm("この発信アイデアを削除しますか？")) {
      await deleteRecord("ideas", id);
      await renderAll();
      showToast("発信アイデアを削除しました。");
    }
  }
}

async function createBackup() {
  const [entries, ideas] = await Promise.all([getAll("entries"), getAll("ideas")]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now(),
    entries,
    ideas
  };
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportBackup() {
  const backup = await createBackup();
  const date = today();
  downloadFile(`kotoba-no-tane-backup-${date}.json`, JSON.stringify(backup, null, 2), "application/json");
  showToast("バックアップを書き出しました。");
}

function isValidRecord(record, type) {
  if (!record || typeof record !== "object" || typeof record.id !== "string" || !record.id) {
    return false;
  }
  if (type === "entries") {
    return typeof record.text === "string" && typeof record.date === "string";
  }
  return typeof record.title === "string" && typeof record.text === "string";
}

function validateBackup(value) {
  if (!value || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error("このアプリで読み込めるバックアップ形式ではありません。");
  }
  if (!Array.isArray(value.entries) || !Array.isArray(value.ideas)) {
    throw new Error("バックアップ内のデータ形式が正しくありません。");
  }
  if (!value.entries.every((entry) => isValidRecord(entry, "entries"))
    || !value.ideas.every((idea) => isValidRecord(idea, "ideas"))) {
    throw new Error("バックアップ内に読み込めない記録があります。");
  }
  return {
    ...value,
    entries: value.entries,
    ideas: value.ideas
  };
}

function recordsMatch(first, second) {
  const normalize = (record) => JSON.stringify(
    Object.entries(record)
      .filter(([key]) => key !== "createdAt" && key !== "updatedAt")
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
  );
  return normalize(first) === normalize(second);
}

async function handleImportSelection(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) {
    return;
  }
  try {
    const backup = validateBackup(JSON.parse(await file.text()));
    pendingBackup = backup;
    elements.importSummary.textContent =
      `バックアップには記録 ${backup.entries.length} 件、保存済みアイデア ${backup.ideas.length} 件が含まれています。`;
    elements.importDialog.showModal();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "バックアップを読み込めませんでした。");
  }
}

async function mergeBackup() {
  const transaction = database.transaction(["entries", "ideas"], "readwrite");
  const done = transactionDone(transaction);
  const counts = {
    entries: { added: 0, conflicts: 0 },
    ideas: { added: 0, conflicts: 0 }
  };
  const storeImports = [
    ["entries", pendingBackup.entries],
    ["ideas", pendingBackup.ideas]
  ].map(([storeName, incomingRecords]) => new Promise((resolve, reject) => {
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => {
      const currentById = new Map(request.result.map((record) => [record.id, record]));
      for (const incoming of incomingRecords) {
        const current = currentById.get(incoming.id);
        if (!current) {
          store.put(incoming);
          counts[storeName].added += 1;
        } else if (!recordsMatch(current, incoming)) {
          counts[storeName].conflicts += 1;
        }
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  }));
  await Promise.all([...storeImports, done]);
  elements.importDialog.close();
  pendingBackup = null;
  await renderAll();
  const conflicts = counts.entries.conflicts + counts.ideas.conflicts;
  const message = `統合しました（記録 +${counts.entries.added}、アイデア +${counts.ideas.added}）。`;
  showToast(conflicts ? `${message} 内容が異なる重複 ${conflicts} 件は端末側を残しました。` : message);
}

async function replaceWithBackup() {
  if (!window.confirm("現在この端末にあるすべての記録とアイデアを削除し、バックアップの内容に置き換えます。よろしいですか？")) {
    return;
  }
  const transaction = database.transaction(["entries", "ideas"], "readwrite");
  transaction.objectStore("entries").clear();
  transaction.objectStore("ideas").clear();
  for (const entry of pendingBackup.entries) {
    transaction.objectStore("entries").put(entry);
  }
  for (const idea of pendingBackup.ideas) {
    transaction.objectStore("ideas").put(idea);
  }
  await transactionDone(transaction);
  elements.importDialog.close();
  pendingBackup = null;
  await renderAll();
  showToast("バックアップの内容に置き換えました。");
}

function handleTabClick(event) {
  const tab = event.target.closest(".tab");
  if (tab) {
    setActiveView(tab.dataset.view);
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }
}

async function initialize() {
  if (!("indexedDB" in window)) {
    document.body.innerHTML = "<main class='layout'><h1>このブラウザでは端末内保存を利用できません。</h1><p>iPhoneのSafariを最新の状態にして、もう一度お試しください。</p></main>";
    return;
  }
  try {
    database = await openDatabase();
    elements.entryForm.addEventListener("submit", (event) => {
      handleEntrySubmit(event).catch((error) => {
        console.error(error);
        showToast("記録を保存できませんでした。");
      });
    });
    elements.ideaForm.addEventListener("submit", (event) => {
      handleIdeaSubmit(event).catch((error) => {
        console.error(error);
        showToast("アイデアを保存できませんでした。");
      });
    });
    elements.tabs.forEach((tab) => tab.addEventListener("click", handleTabClick));
    elements.entryList.addEventListener("click", (event) => {
      handleCardAction(event).catch((error) => {
        console.error(error);
        showToast("操作を完了できませんでした。");
      });
    });
    elements.ideaList.addEventListener("click", (event) => {
      handleCardAction(event).catch((error) => {
        console.error(error);
        showToast("操作を完了できませんでした。");
      });
    });
    elements.entryCancel.addEventListener("click", resetEntryForm);
    elements.ideaCancel.addEventListener("click", resetIdeaForm);
    elements.ideaPattern.addEventListener("change", updatePatternHint);
    elements.patternInsert.addEventListener("click", insertPatternTemplate);
    elements.entrySearch.addEventListener("input", () => {
      renderEntries().catch((error) => console.error(error));
    });
    elements.entryMoodFilter.addEventListener("change", () => {
      renderEntries().catch((error) => console.error(error));
    });
    elements.entryTagFilter.addEventListener("change", () => {
      renderEntries().catch((error) => console.error(error));
    });
    elements.ideaSearch.addEventListener("input", () => {
      renderIdeas().catch((error) => console.error(error));
    });
    elements.backupButton.addEventListener("click", () => setActiveView("data-view"));
    elements.exportButton.addEventListener("click", () => {
      exportBackup().catch((error) => {
        console.error(error);
        showToast("バックアップを書き出せませんでした。");
      });
    });
    elements.importFile.addEventListener("change", (event) => {
      handleImportSelection(event).catch((error) => {
        console.error(error);
        showToast("バックアップを読み込めませんでした。");
      });
    });
    elements.mergeButton.addEventListener("click", () => {
      mergeBackup().catch((error) => {
        console.error(error);
        showToast("バックアップを統合できませんでした。");
      });
    });
    elements.replaceButton.addEventListener("click", () => {
      replaceWithBackup().catch((error) => {
        console.error(error);
        showToast("バックアップを復元できませんでした。");
      });
    });
    await renderAll();
    registerServiceWorker();
  } catch (error) {
    console.error("App initialization failed:", error);
    document.body.innerHTML = "<main class='layout'><h1>アプリを起動できませんでした。</h1><p>ブラウザの設定を確認して、もう一度お試しください。</p></main>";
  }
}

initialize();

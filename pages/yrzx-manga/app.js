"use strict";

const LEGACY_CATALOG_URL = "https://manga-assets.rikkuma.kdns.fr/v1/catalog.json";
const CURRENT_POINTER_URL = "https://manga-assets.rikkuma.kdns.fr/current.json";
const READER_STATE_KEY = "rikkuma-yrzx-reader-v1";
const THEME_KEY = "rikkuma-yrzx-theme";
const WIDTH_KEY = "rikkuma-yrzx-width";
const $ = (selector) => document.querySelector(selector);
const elements = {
  root: document.documentElement, title: $("#readerTitle"), meta: $("#chapterMeta"), select: $("#chapterSelect"),
  previous: $("#previousChapter"), next: $("#nextChapter"), bottomPrevious: $("#bottomPrevious"),
  bottomNext: $("#bottomNext"), bottomTitle: $("#bottomChapterTitle"), bottomNav: $("#bottomNav"),
  reader: $("#comicReader"), loadState: $("#loadState"), errorState: $("#errorState"),
  errorMessage: $("#errorMessage"), retry: $("#retryChapter"), progress: $("#readingProgress"),
  backToTop: $("#backToTop"), themeToggle: $("#themeToggle"), widthToggle: $("#widthToggle")
};
const state = { catalog: null, currentOrder: 1, manifest: null, controller: null, observer: null, loaded: 0, progressFrame: null };

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* Reader still works without storage. */ } }
function savedChapter() { try { return Number(JSON.parse(storageGet(READER_STATE_KEY) || "{}").chapter); } catch { return 0; } }
function rememberChapter() { storageSet(READER_STATE_KEY, JSON.stringify({ chapter: state.currentOrder, updatedAt: new Date().toISOString() })); }

function requestedChapter(maximum) {
  const query = Number(new URLSearchParams(location.search).get("chapter"));
  if (Number.isInteger(query) && query >= 1 && query <= maximum) return query;
  const saved = savedChapter();
  return Number.isInteger(saved) && saved >= 1 && saved <= maximum ? saved : 1;
}
function updateUrl(order, replace = false) {
  const url = new URL(location.href); url.searchParams.set("chapter", String(order));
  history[replace ? "replaceState" : "pushState"]({ chapter: order }, "", url);
}
async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`资源请求失败（HTTP ${response.status}）`);
  return response.json();
}
async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function fetchActiveCatalog() {
  const pointerResponse = await fetch(CURRENT_POINTER_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  let catalogUrl = LEGACY_CATALOG_URL, expectedSha = null;
  if (pointerResponse.status !== 404) {
    if (!pointerResponse.ok) throw new Error(`\u66f4\u65b0\u6307\u9488\u8bf7\u6c42\u5931\u8d25\uff08HTTP ${pointerResponse.status}\uff09`);
    const pointer = await pointerResponse.json();
    if (pointer?.manga_id !== "23475" || !/^https:\/\//.test(pointer?.catalog_url || "") || !/^[a-f0-9]{64}$/i.test(pointer?.catalog_sha256 || "")) {
      throw new Error("\u6f2b\u753b\u66f4\u65b0\u6307\u9488\u683c\u5f0f\u4e0d\u6b63\u786e");
    }
    catalogUrl = pointer.catalog_url;
    expectedSha = pointer.catalog_sha256.toLowerCase();
  }
  const catalogResponse = await fetch(catalogUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!catalogResponse.ok) throw new Error(`\u6f2b\u753b\u76ee\u5f55\u8bf7\u6c42\u5931\u8d25\uff08HTTP ${catalogResponse.status}\uff09`);
  const catalogText = await catalogResponse.text();
  if (expectedSha) {
    const actualSha = await sha256Hex(catalogText);
    if (actualSha && actualSha !== expectedSha) throw new Error("\u6f2b\u753b\u76ee\u5f55\u6821\u9a8c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
  }
  return JSON.parse(catalogText);
}
function validateCatalog(catalog) {
  if (!catalog?.manga || !Array.isArray(catalog.chapters) || catalog.chapters.length === 0 || Number(catalog.manga.total_chapters) !== catalog.chapters.length) throw new Error("漫画目录格式不正确");
  catalog.chapters.forEach((chapter, index) => {
    if (chapter.order !== index + 1 || !chapter.manifest) throw new Error(`漫画目录在第 ${index + 1} 章处顺序异常`);
  });
}
function validateManifest(manifest, chapter) {
  if (manifest?.order !== chapter.order || manifest?.image_count !== chapter.image_count || !Array.isArray(manifest.images) || manifest.images.length !== chapter.image_count) {
    throw new Error(`第 ${chapter.order} 章清单与总目录不一致`);
  }
  manifest.images.forEach((image, index) => {
    const sequence = index + 1, filename = `${String(sequence).padStart(4, "0")}.webp`;
    if (image.sequence !== sequence || image.filename !== filename) throw new Error(`第 ${chapter.order} 章第 ${sequence} 页顺序异常`);
  });
}
function fillChapterSelect() {
  const fragment = document.createDocumentFragment();
  state.catalog.chapters.forEach((chapter) => {
    const option = document.createElement("option"); option.value = String(chapter.order);
    option.textContent = `第 ${chapter.order} 章 · ${chapter.title}`; fragment.append(option);
  });
  elements.select.replaceChildren(fragment); elements.select.disabled = false;
}
function showLoading(message) {
  elements.loadState.hidden = false; elements.loadState.querySelector("p").textContent = message;
  elements.errorState.hidden = true; elements.bottomNav.hidden = true;
}
function showError(error) {
  elements.loadState.hidden = true; elements.errorState.hidden = false; elements.bottomNav.hidden = true;
  elements.errorMessage.textContent = error instanceof Error ? error.message : "请检查网络连接后重试。";
}
function updateNavigation(chapter) {
  [elements.previous, elements.bottomPrevious].forEach((button) => { button.disabled = chapter.order === 1; });
  [elements.next, elements.bottomNext].forEach((button) => { button.disabled = chapter.order === state.catalog.chapters.length; });
  elements.bottomTitle.textContent = chapter.title;
}
function retryImage(image) {
  const retryUrl = new URL(image.dataset.originalSrc); retryUrl.searchParams.set("retry", String(Date.now()));
  image.closest(".comic-page")?.querySelector(".page-error")?.remove(); image.classList.remove("is-loaded"); image.src = retryUrl.href;
}
function imageFailed(image, sequence) {
  const page = image.closest(".comic-page"); if (!page || page.querySelector(".page-error")) return;
  const message = document.createElement("div"); message.className = "page-error";
  const content = document.createElement("div"), strong = document.createElement("strong"), button = document.createElement("button");
  strong.textContent = `第 ${sequence} 页载入失败`; button.type = "button"; button.textContent = "重试这一页";
  button.addEventListener("click", () => retryImage(image)); content.append(strong, document.createElement("br"), button); message.append(content); page.append(message);
}
function observeImages() {
  state.observer?.disconnect(); const images = [...elements.reader.querySelectorAll("img[data-src]")];
  if (!("IntersectionObserver" in window)) { images.forEach((image) => { image.src = image.dataset.src; delete image.dataset.src; }); return; }
  state.observer = new IntersectionObserver((entries, observer) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return; const image = entry.target; image.src = image.dataset.src; delete image.dataset.src; observer.unobserve(image);
  }), { rootMargin: "1400px 0px" });
  images.forEach((image) => state.observer.observe(image));
}
function renderManifest(manifest, chapter) {
  state.loaded = 0; const fragment = document.createDocumentFragment(), assetBase = new URL(state.catalog.asset_base);
  manifest.images.forEach((imageData, index) => {
    const figure = document.createElement("figure"), image = document.createElement("img"); figure.className = "comic-page";
    const imageUrl = new URL(`${manifest.image_base}${imageData.filename}`, assetBase).href;
    image.alt = `${chapter.title} · 第 ${imageData.sequence} 页`; image.dataset.originalSrc = imageUrl; image.decoding = "async"; image.draggable = false;
    if (index < 2) { image.src = imageUrl; image.fetchPriority = index === 0 ? "high" : "auto"; }
    else { image.dataset.src = imageUrl; image.loading = "lazy"; }
    image.addEventListener("load", () => {
      if (!image.dataset.counted) { image.dataset.counted = "1"; state.loaded += 1; }
      image.classList.add("is-loaded"); image.closest(".comic-page")?.querySelector(".page-error")?.remove();
      elements.meta.textContent = `第 ${chapter.order} / ${state.catalog.chapters.length} 章 · ${manifest.image_count} 页 · 已载入 ${state.loaded} 页`;
    });
    image.addEventListener("error", () => imageFailed(image, imageData.sequence)); figure.append(image); fragment.append(figure);
  });
  elements.reader.replaceChildren(fragment); observeImages();
}
async function loadChapter(order, options = {}) {
  if (!state.catalog) return; const chapter = state.catalog.chapters[order - 1]; if (!chapter) return;
  state.controller?.abort(); state.controller = new AbortController(); state.currentOrder = order; state.manifest = null;
  state.observer?.disconnect(); elements.reader.replaceChildren(); elements.title.textContent = chapter.title;
  elements.meta.textContent = `第 ${chapter.order} / ${state.catalog.chapters.length} 章 · 正在读取章节清单`;
  elements.select.value = String(order); updateNavigation(chapter); showLoading(`正在载入第 ${order} 章…`);
  if (options.updateHistory !== false) updateUrl(order, options.replaceHistory === true);
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
  try {
    const manifest = await fetchJson(new URL(chapter.manifest, state.catalog.asset_base).href, state.controller.signal);
    validateManifest(manifest, chapter); state.manifest = manifest; renderManifest(manifest, chapter);
    elements.loadState.hidden = true; elements.errorState.hidden = true; elements.bottomNav.hidden = false;
    elements.meta.textContent = `第 ${chapter.order} / ${state.catalog.chapters.length} 章 · ${manifest.image_count} 页`; rememberChapter();
  } catch (error) { if (error?.name !== "AbortError") showError(error); }
}
function navigate(delta) {
  const order = state.currentOrder + delta; if (order >= 1 && order <= (state.catalog?.chapters.length || 0)) loadChapter(order);
}
function updateProgress() {
  state.progressFrame = null; const scrollable = document.documentElement.scrollHeight - innerHeight;
  const ratio = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;
  elements.progress.style.width = `${ratio * 100}%`; elements.backToTop.hidden = scrollY < 900;
}
function requestProgress() { if (state.progressFrame === null) state.progressFrame = requestAnimationFrame(updateProgress); }
function applyPreferences() {
  const theme = storageGet(THEME_KEY) === "paper" ? "paper" : "dark"; elements.root.dataset.theme = theme;
  elements.themeToggle.textContent = theme === "paper" ? "深色阅读" : "浅色阅读"; elements.themeToggle.setAttribute("aria-pressed", String(theme === "paper"));
  const width = storageGet(WIDTH_KEY) === "original" ? "original" : "fit"; elements.root.dataset.readerWidth = width;
  elements.widthToggle.textContent = width === "original" ? "适合屏幕" : "原图宽度"; elements.widthToggle.setAttribute("aria-pressed", String(width === "original"));
}
function bindEvents() {
  elements.select.addEventListener("change", () => loadChapter(Number(elements.select.value)));
  elements.previous.addEventListener("click", () => navigate(-1)); elements.next.addEventListener("click", () => navigate(1));
  elements.bottomPrevious.addEventListener("click", () => navigate(-1)); elements.bottomNext.addEventListener("click", () => navigate(1));
  elements.retry.addEventListener("click", () => loadChapter(state.currentOrder, { replaceHistory: true }));
  elements.backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  elements.themeToggle.addEventListener("click", () => { storageSet(THEME_KEY, elements.root.dataset.theme === "paper" ? "dark" : "paper"); applyPreferences(); });
  elements.widthToggle.addEventListener("click", () => { storageSet(WIDTH_KEY, elements.root.dataset.readerWidth === "original" ? "fit" : "original"); applyPreferences(); });
  addEventListener("scroll", requestProgress, { passive: true }); addEventListener("resize", requestProgress, { passive: true });
  addEventListener("popstate", () => { const order = requestedChapter(state.catalog?.chapters.length || 1); if (order !== state.currentOrder) loadChapter(order, { updateHistory: false }); });
  addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || ["INPUT","SELECT","TEXTAREA","BUTTON"].includes(document.activeElement?.tagName)) return;
    if (event.key === "ArrowLeft") navigate(-1); if (event.key === "ArrowRight") navigate(1);
  });
}
async function initialize() {
  applyPreferences(); bindEvents(); requestProgress();
  try {
    const catalog = await fetchActiveCatalog(); validateCatalog(catalog); state.catalog = catalog; fillChapterSelect();
    await loadChapter(requestedChapter(catalog.chapters.length), { replaceHistory: true, instant: true, scroll: false });
  } catch (error) { showError(error); elements.title.textContent = "漫画目录载入失败"; elements.meta.textContent = "未能连接漫画资源。"; }
}
initialize();
"use strict";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const byKey = new Map(MEDIA.map(item => [item.key, item]));
const mainSamples = MEDIA.filter(item => item.section === "main");
document.querySelector("#gallery-total").textContent = mainSamples.length;
const videoStates = new WeakMap();
const sectionPaused = new Set(reducedMotion ? ["hero-mosaic", "results-grid", "comparison-grid"] : []);
let viewerOpen = false;

function ensurePoster(video) {
  if (video.dataset.poster && !video.hasAttribute("poster")) video.poster = video.dataset.poster;
}

function ensureSource(video) {
  ensurePoster(video);
  if (video.dataset.src && !video.getAttribute("src")) {
    video.src = video.dataset.src;
    video.load();
  }
}

const bufferObserver = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  for (const {target: video, isIntersecting} of entries) {
    if (isIntersecting) {
      ensurePoster(video);
    } else if (video.hasAttribute("src")) {
      const state = videoStates.get(video);
      if (video.currentTime > 0) state.resumeTime = video.currentTime;
      pauseAutomatically(video);
      video.removeAttribute("src");
      video.load();
    }
  }
}, {rootMargin: "900px 0px"}) : null;

function canAutoPlay(video) {
  const activeView = video.id === "modal-video" ? viewerOpen : !viewerOpen;
  return activeView && !document.hidden && !sectionPaused.has(video.dataset.group) && !videoStates.get(video)?.manualPause;
}

const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const video = entry.target;
    const state = videoStates.get(video);
    state.visible = entry.isIntersecting;
    if (entry.isIntersecting) {
      ensureSource(video);
      if (canAutoPlay(video)) video.play().catch(() => {});
    } else {
      state.automaticPause = true;
      video.pause();
    }
  });
}, { threshold: 0.2 }) : null;

function watchVideo(video) {
  videoStates.set(video, { visible: false, automaticPause: false, manualPause: false });
  if (video.dataset.poster && bufferObserver) {
    bufferObserver.observe(video);
    video.addEventListener("loadedmetadata", () => {
      const state = videoStates.get(video);
      if (state.resumeTime > 0 && state.resumeTime < video.duration) video.currentTime = state.resumeTime;
      state.resumeTime = 0;
    });
  }
  video.addEventListener("pause", () => {
    const state = videoStates.get(video);
    if (state.automaticPause) state.automaticPause = false;
    else if (state.visible) state.manualPause = true;
  });
  video.addEventListener("play", () => {
    const state = videoStates.get(video);
    state.manualPause = false;
    state.automaticPause = false;
  });
  if (observer) observer.observe(video);
  else ensureSource(video);
}

function pauseAutomatically(video) {
  videoStates.get(video).automaticPause = true;
  video.pause();
}

function filterGroup(item) {
  if (item.domain === "recorded") return "human";
  if (item.domain !== "game") return item.domain;
  const label = item.domainLabel.toLowerCase();
  if (label.includes("counter-strike")) return "counter_strike";
  if (label === "minecraft") return "minecraft";
  if (label.includes("gta") || label.includes("grand theft auto")) return "gta";
  if (label.includes("it takes two")) return "it_takes_two";
  return "game";
}

function makeCard(item, group, comparison = false) {
  const figure = document.createElement("figure");
  figure.className = "video-card" + (comparison && item.method === "CoWorld" ? " ours" : "");
  figure.dataset.domain = filterGroup(item);
  figure.dataset.sample = item.key;
  const wrap = document.createElement("div");
  wrap.className = "video-wrap";
  if (!comparison && item.width && item.height) wrap.style.aspectRatio = `${item.width} / ${item.height}`;
  const video = document.createElement("video");
  video.controls = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "none";
  video.dataset.poster = item.poster;
  video.dataset.src = item.video;
  video.dataset.group = group;
  video.setAttribute("aria-label", `${item.method}: ${item.domainLabel}, ${item.title}`);
  const expand = document.createElement("button");
  expand.type = "button";
  expand.className = "expand-video";
  expand.textContent = "↗";
  expand.setAttribute("aria-label", `Expand ${item.method}: ${item.domainLabel}, ${item.title}`);
  expand.addEventListener("click", () => openViewer(item));
  wrap.append(video, expand);
  const caption = document.createElement("figcaption");
  const title = document.createElement("strong");
  title.textContent = comparison ? item.method : item.title;
  const detail = document.createElement("span");
  detail.className = "case-domain";
  detail.textContent = comparison ? `${item.duration.toFixed(2)} s` : item.domainLabel;
  caption.append(title);
  if (group !== "results-grid" || item.domain === "game") caption.append(detail);
  if (group === "results-grid" && item.caption) {
    const description = document.createElement("p");
    description.className = "case-description";
    description.textContent = item.caption;
    caption.append(description);
  }
  if (comparison) figure.append(caption, wrap);
  else figure.append(wrap, caption);
  watchVideo(video);
  return figure;
}


const mosaicVideos = [...document.querySelectorAll(".hero-mosaic video")];
const motionButton = document.querySelector("#hero-motion");
if (reducedMotion) {
  sectionPaused.add("hero-mosaic");
  motionButton.textContent = "▷ Play motion";
  motionButton.setAttribute("aria-pressed", "true");
}
mosaicVideos.forEach(watchVideo);
motionButton.addEventListener("click", () => {
  const paused = !sectionPaused.has("hero-mosaic");
  if (paused) sectionPaused.add("hero-mosaic");
  else sectionPaused.delete("hero-mosaic");
  motionButton.textContent = paused ? "▷ Play motion" : "Ⅱ Pause motion";
  motionButton.setAttribute("aria-pressed", String(paused));
  mosaicVideos.forEach(video => {
    if (paused) pauseAutomatically(video);
    else if (videoStates.get(video).visible) {
      ensureSource(video);
      video.play().catch(() => {});
    }
  });
});

const collections = [
  {key: "human", label: "Human–human", lead: "SH03"},
  {key: "human_robot", label: "Human–robot", lead: "M013"},
  {key: "robot", label: "Robot–robot", lead: "R011"},
  {key: "games", label: "Games", lead: "X036", filters: [
    ["game", "Other games"], ["it_takes_two", "It Takes Two"], ["counter_strike", "Counter-Strike"],
    ["gta", "GTA V"], ["minecraft", "Minecraft"]
  ]}
];
const resultGrid = document.querySelector("#results-grid");
const resultFilter = document.querySelector("#result-filter");
const collectionNav = document.querySelector(".collection-nav");
const collectionIndex = document.querySelector("#collection-index");
const galleryGroups = [];
resultFilter.add(new Option(`All ${mainSamples.length} scenes`, "all"));
const sceneFilters = new Map([
  ["action", {label: "New action scenes", param: "action", matches: item => item.actionCollection}],
  ["both-moving", {label: "Both participants moving", param: "both", matches: item => item.bothMove}]
]);
for (const [key, filter] of sceneFilters) {
  const count = mainSamples.filter(filter.matches).length;
  if (count) resultFilter.add(new Option(`${filter.label} (${count})`, key));
}

const rankedCollections = collections.map(collection => {
  const filters = collection.filters || [[collection.key, collection.label]];
  const buckets = filters.map(([key, label]) => ({
    key, label, matching: mainSamples.filter(item => filterGroup(item) === key)
  })).sort((a, b) => b.matching.length - a.matching.length);
  return {...collection, buckets, total: buckets.reduce((sum, bucket) => sum + bucket.matching.length, 0)};
}).sort((a, b) => b.total - a.total);

for (const collection of rankedCollections) {
  const items = [];
  let options = resultFilter;
  if (collection.filters) {
    options = document.createElement("optgroup");
    options.label = collection.label;
  }
  for (const {key, label, matching} of collection.buckets) {
    if (!matching.length) continue;
    const leadIndex = matching.findIndex(item => item.key === collection.lead);
    if (leadIndex > 0) matching.unshift(matching.splice(leadIndex, 1)[0]);
    items.push(...matching);
    const option = new Option(`${label} (${matching.length})`, key);
    option.dataset.label = label;
    options.append(option);
  }
  if (!items.length) continue;
  if (options !== resultFilter) resultFilter.append(options);

  const section = document.createElement("section");
  section.className = "generation-group";
  section.dataset.group = collection.key;
  section.id = `collection-${collection.key}`;
  section.tabIndex = -1;
  const header = document.createElement("header");
  const heading = document.createElement("h3");
  heading.id = section.id + "-heading";
  heading.textContent = collection.label;
  section.setAttribute("aria-labelledby", heading.id);
  const count = document.createElement("span");
  header.append(heading, count);
  const grid = document.createElement("div");
  grid.className = "video-grid collection-grid";
  const cards = items.map(item => makeCard(item, "results-grid"));
  grid.append(...cards);
  section.append(header, grid);
  resultGrid.append(section);

  const link = document.createElement("a");
  link.href = "#" + section.id;
  link.append(collection.label);
  const number = document.createElement("span");
  number.textContent = items.length;
  link.append(number);
  collectionIndex.append(link);
  galleryGroups.push({section, heading, count, cards, link, label: collection.label, total: items.length});
}

function applyGalleryFilter() {
  const all = resultFilter.value === "all";
  const sceneFilter = sceneFilters.get(resultFilter.value);
  collectionNav.hidden = !(all || sceneFilter);
  for (const group of galleryGroups) {
    const {section, heading, count, cards, label, link} = group;
    let visible = 0;
    for (const card of cards) {
      card.hidden = sceneFilter ? !sceneFilter.matches(byKey.get(card.dataset.sample)) : !all && card.dataset.domain !== resultFilter.value;
      card.classList.toggle("lead-case", !card.hidden && visible === 0);
      if (card.hidden) pauseAutomatically(card.querySelector("video"));
      else visible++;
    }
    group.visible = visible;
    section.hidden = visible === 0;
    link.hidden = visible === 0;
    link.querySelector("span").textContent = visible;
    heading.textContent = all || sceneFilter ? label : resultFilter.selectedOptions[0].dataset.label;
    count.textContent = `${visible} ${visible === 1 ? "scene" : "scenes"}`;
  }
  galleryGroups.sort((a, b) => b.visible - a.visible || b.total - a.total);
  galleryGroups.forEach(({section, link}, index) => {
    if (resultGrid.children[index] !== section) resultGrid.insertBefore(section, resultGrid.children[index]);
    if (collectionIndex.children[index] !== link) collectionIndex.insertBefore(link, collectionIndex.children[index]);
  });
}

function updateCurrentCollection() {
  if (collectionNav.hidden || !galleryGroups.length) return;
  const threshold = Math.min(160, window.innerHeight * 0.22);
  const shown = galleryGroups.filter(group => !group.section.hidden);
  if (!shown.length) return;
  let current = shown[0];
  for (const group of shown) {
    if (group.section.getBoundingClientRect().top > threshold) break;
    current = group;
  }
  if (current.link.hasAttribute("aria-current")) return;
  for (const {link} of galleryGroups) link.removeAttribute("aria-current");
  current.link.setAttribute("aria-current", "location");
}
let scrollFrame = 0;
function scheduleCollectionUpdate() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    updateCurrentCollection();
  });
}
resultFilter.addEventListener("change", () => {
  if (location.protocol === "http:" || location.protocol === "https:") {
    const url = new URL(location.href);
    const filter = sceneFilters.get(resultFilter.value);
    if (filter) url.searchParams.set("motion", filter.param);
    else url.searchParams.delete("motion");
    if (url.hash.startsWith("#collection-")) url.hash = "#results";
    history.replaceState(null, "", url);
  }
  applyGalleryFilter();
  scheduleCollectionUpdate();
});
const motionParam = new URLSearchParams(location.search).get("motion");
for (const option of resultFilter.options) {
  if (sceneFilters.get(option.value)?.param === motionParam) resultFilter.value = option.value;
}
applyGalleryFilter();
if (["#more-worlds", "#collection-simulation"].includes(location.hash)) {
  const games = document.querySelector("#collection-games");
  if (games) {
    history.replaceState(null, "", "#collection-games");
    games.scrollIntoView();
  }
}
scheduleCollectionUpdate();
window.addEventListener("scroll", scheduleCollectionUpdate, {passive: true});
window.addEventListener("resize", scheduleCollectionUpdate);

function renderComparison(button) {
  const grid = document.querySelector("#comparison-grid");
  grid.querySelectorAll("video").forEach(video => { pauseAutomatically(video); observer?.unobserve(video); bufferObserver?.unobserve(video); });
  grid.replaceChildren();
  const sample = button.dataset.comparison;
  document.querySelector("#comparison-note").textContent = byKey.get(sample).comparisonNote;
  [sample, `${sample}-solaris`, `${sample}-multiworld`, `${sample}-gamma`].forEach(key => grid.append(makeCard(byKey.get(key), "comparison-grid", true)));
  grid.setAttribute("aria-labelledby", button.id);
  document.querySelectorAll("[data-comparison]").forEach(b => {
    b.setAttribute("aria-selected", String(b === button));
    b.tabIndex = b === button ? 0 : -1;
  });
}
const comparisonTabs = [...document.querySelectorAll("[data-comparison]")];
comparisonTabs.forEach((button, index) => {
  button.addEventListener("click", () => renderComparison(button));
  button.addEventListener("keydown", event => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % comparisonTabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + comparisonTabs.length) % comparisonTabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = comparisonTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    comparisonTabs[next].focus();
    renderComparison(comparisonTabs[next]);
  });
});
renderComparison(comparisonTabs[0]);

document.querySelectorAll(".play-toggle").forEach(button => {
  const group = button.dataset.target;
  if (reducedMotion) {
    sectionPaused.add(group);
    button.textContent = "Play videos ▷";
  }
  button.addEventListener("click", () => {
    const paused = !sectionPaused.has(group);
    if (paused) sectionPaused.add(group);
    else sectionPaused.delete(group);
    button.textContent = paused ? "Play videos ▷" : "Pause videos Ⅱ";
    document.querySelectorAll(`#${group} video`).forEach(video => {
      if (paused) pauseAutomatically(video);
      else if (videoStates.get(video).visible) {
        videoStates.get(video).manualPause = false;
        ensureSource(video);
        video.play().catch(() => {});
      }
    });
  });
});

document.addEventListener("visibilitychange", () => {
  document.querySelectorAll("video").forEach(video => {
    if (document.hidden) pauseAutomatically(video);
    else if (videoStates.get(video).visible && canAutoPlay(video)) video.play().catch(() => {});
  });
});

const dialog = document.querySelector("#video-dialog");
const modalVideo = document.querySelector("#modal-video");
modalVideo.dataset.group = "viewer";
watchVideo(modalVideo);
let pausedForViewer = [];
let viewerTrigger = null;

function openViewer(item) {
  viewerTrigger = document.activeElement;
  pausedForViewer = [...document.querySelectorAll("video")].filter(video => !video.paused && video !== modalVideo);
  viewerOpen = true;
  pausedForViewer.forEach(pauseAutomatically);
  document.querySelector("#modal-title").textContent = `${item.domainLabel} / ${item.title}`;
  const camera = item.cameraRegime === "third_person" ? " · Native third-person views" : "";
  document.querySelector("#modal-source").textContent = `${item.method} · ${item.duration.toFixed(2)} s${camera}`;
  document.querySelector("#modal-left").textContent = `Left · ${item.roleA || "A"}`;
  document.querySelector("#modal-right").textContent = `Right · ${item.roleB || "B"}`;
  const caption = document.querySelector("#modal-caption");
  caption.textContent = item.caption || "";
  caption.hidden = !item.caption;
  const credit = document.querySelector("#modal-credit");
  credit.textContent = item.sourceCredit || "";
  if (item.sourceUrl) {
    const sourceLink = document.createElement("a");
    const source = new URL(item.sourceUrl);
    let at = "";
    if (Number.isFinite(item.sourceTimestamp)) {
      const seconds = Math.floor(item.sourceTimestamp);
      const clock = [Math.floor(seconds / 60), String(seconds % 60).padStart(2, "0")];
      if (seconds >= 3600) clock.splice(0, 1, Math.floor(seconds / 3600), String(clock[0] % 60).padStart(2, "0"));
      at = " · " + clock.join(":");
      if (["www.youtube.com", "youtube.com", "youtu.be"].includes(source.hostname)) source.searchParams.set("t", seconds + "s");
    }
    sourceLink.href = source.href;
    sourceLink.textContent = (item.creator || "Source recording") + at;
    credit.textContent = "Gameplay first frame · ";
    credit.append(sourceLink);
  }
  credit.hidden = !credit.textContent;
  const promptDetails = document.querySelector("#modal-prompt");
  promptDetails.open = false;
  promptDetails.hidden = !item.videoPrompt;
  promptDetails.querySelector("p").textContent = item.videoPrompt || "";
  modalVideo.poster = item.poster;
  modalVideo.src = item.video;
  modalVideo.setAttribute("aria-label", `${item.method}: ${item.domainLabel}, ${item.title}, expanded`);
  modalVideo.load();
  document.body.classList.add("viewer-open");
  dialog.showModal();
  modalVideo.play().catch(() => {});
  document.querySelector("#close-video").focus();
}

document.querySelector("#close-video").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener("close", () => {
  pauseAutomatically(modalVideo);
  viewerOpen = false;
  document.body.classList.remove("viewer-open");
  pausedForViewer.forEach(video => {
    if (videoStates.get(video).visible && canAutoPlay(video)) video.play().catch(() => {});
  });
  pausedForViewer = [];
  viewerTrigger?.focus();
});

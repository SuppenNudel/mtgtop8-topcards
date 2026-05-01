const FORMAT_FILES = {
  Standard: "./Standard.json",
  Pioneer: "./Pioneer.json",
  Modern: "./Modern.json",
  Legacy: "./Legacy.json",
  Pauper: "./Pauper.json",
};

const state = {
  rows: [],
  loadedFormats: [],
  sortKey: "mainDecks",
  sortDir: "desc",
  scryfallCache: new Map(),
};

const els = {
  formatFilter: document.querySelector("#formatFilter"),
  searchFilter: document.querySelector("#searchFilter"),
  boardFilter: document.querySelector("#boardFilter"),
  minDeckShare: document.querySelector("#minDeckShare"),
  minAvgCopies: document.querySelector("#minAvgCopies"),
  rowLimit: document.querySelector("#rowLimit"),
  tableBody: document.querySelector("#tableBody"),
  statusText: document.querySelector("#statusText"),
  resetFilters: document.querySelector("#resetFilters"),
  emptyRowTpl: document.querySelector("#emptyRowTpl"),
  sortButtons: Array.from(document.querySelectorAll(".sort-btn")),
};

const preview = {
  element: null,
  activeCard: null,
};

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function num(value) {
  return Number(value || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function scryfallSearchUrl(cardname) {
  const query = `!"${cardname}"`;
  return `https://scryfall.com/search?q=${encodeURIComponent(query)}`;
}

function getCardImageUrl(cardData) {
  if (cardData?.image_uris?.normal) {
    return cardData.image_uris.normal;
  }
  if (Array.isArray(cardData?.card_faces)) {
    for (const face of cardData.card_faces) {
      if (face?.image_uris?.normal) {
        return face.image_uris.normal;
      }
    }
  }
  return null;
}

function createPreviewElement() {
  const container = document.createElement("div");
  container.className = "card-preview hidden";
  container.innerHTML = `
    <p class="card-preview-title"></p>
    <img class="card-preview-image" alt="" loading="lazy" />
    <p class="card-preview-fallback">No image found.</p>
  `;
  document.body.append(container);
  return container;
}

function movePreview(event) {
  if (!preview.element || preview.element.classList.contains("hidden")) {
    return;
  }
  const offset = 18;
  const maxLeft = window.innerWidth - preview.element.offsetWidth - 10;
  const maxTop = window.innerHeight - preview.element.offsetHeight - 10;
  const left = Math.min(event.clientX + offset, Math.max(10, maxLeft));
  const top = Math.min(event.clientY + offset, Math.max(10, maxTop));
  preview.element.style.left = `${left}px`;
  preview.element.style.top = `${top}px`;
}

function setPreviewContent(cardname, imageUrl) {
  const title = preview.element.querySelector(".card-preview-title");
  const image = preview.element.querySelector(".card-preview-image");
  const fallback = preview.element.querySelector(".card-preview-fallback");

  title.textContent = cardname;

  if (imageUrl) {
    image.src = imageUrl;
    image.alt = `${cardname} preview`;
    image.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    image.removeAttribute("src");
    image.alt = "";
    image.classList.add("hidden");
    fallback.classList.remove("hidden");
  }
}

async function fetchScryfallCard(cardname) {
  if (state.scryfallCache.has(cardname)) {
    return state.scryfallCache.get(cardname);
  }

  const promise = (async () => {
    const exactUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardname)}`;
    const fuzzyUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardname)}`;

    async function fetchNamed(url) {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return {
        imageUrl: getCardImageUrl(data),
        cardUrl: data?.scryfall_uri || scryfallSearchUrl(cardname),
      };
    }

    let result = await fetchNamed(exactUrl);
    if (!result) {
      result = await fetchNamed(fuzzyUrl);
    }
    if (!result) {
      result = { imageUrl: null, cardUrl: scryfallSearchUrl(cardname) };
    }
    return result;
  })().catch(() => ({ imageUrl: null, cardUrl: scryfallSearchUrl(cardname) }));

  state.scryfallCache.set(cardname, promise);
  return promise;
}

async function showPreviewFor(cardname, event) {
  preview.activeCard = cardname;
  setPreviewContent(cardname, null);
  preview.element.classList.remove("hidden");
  movePreview(event);

  const result = await fetchScryfallCard(cardname);
  if (preview.activeCard !== cardname) {
    return;
  }
  setPreviewContent(cardname, result.imageUrl);
}

function hidePreview() {
  preview.activeCard = null;
  preview.element.classList.add("hidden");
}

function normalizeRows(formatName, jsonData) {
  const cards = Object.values(jsonData || {});
  return cards.map((card) => {
    const mainDecks = num(card.mainboard?.decks);
    const sideDecks = num(card.sideboard?.decks);
    const mainAvg = num(card.mainboard?.avg);
    const sideAvg = num(card.sideboard?.avg);

    return {
      format: formatName,
      cardname: String(card.cardname || "Unknown"),
      mainDecks,
      mainAvg,
      sideDecks,
      sideAvg,
    };
  });
}

async function loadData() {
  const loaded = [];
  const rows = [];

  for (const [formatName, path] of Object.entries(FORMAT_FILES)) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      rows.push(...normalizeRows(formatName, json));
      loaded.push(formatName);
    } catch (error) {
      console.warn(`Failed to load ${path}:`, error);
    }
  }

  state.rows = rows;
  state.loadedFormats = loaded;

  hydrateFormatFilter();
  wireEvents();
  render();
}

function hydrateFormatFilter() {
  for (const formatName of state.loadedFormats) {
    const option = document.createElement("option");
    option.value = formatName;
    option.textContent = formatName;
    els.formatFilter.append(option);
  }
}

function wireEvents() {
  [
    els.formatFilter,
    els.searchFilter,
    els.boardFilter,
    els.minDeckShare,
    els.minAvgCopies,
    els.rowLimit,
  ].forEach((element) => {
    element.addEventListener("input", render);
    element.addEventListener("change", render);
  });

  els.resetFilters.addEventListener("click", () => {
    els.formatFilter.value = "all";
    els.searchFilter.value = "";
    els.boardFilter.value = "either";
    els.minDeckShare.value = "0";
    els.minAvgCopies.value = "0";
    els.rowLimit.value = "50";
    state.sortKey = "mainDecks";
    state.sortDir = "desc";
    render();
  });

  for (const button of els.sortButtons) {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (!key) {
        return;
      }
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = key === "cardname" || key === "format" ? "asc" : "desc";
      }
      render();
    });
  }

  preview.element = createPreviewElement();

  els.tableBody.addEventListener("mouseover", (event) => {
    const trigger = event.target.closest(".card-preview-trigger");
    if (!trigger) {
      return;
    }
    const cardname = trigger.dataset.cardname;
    if (!cardname) {
      return;
    }
    if (preview.activeCard === cardname) {
      movePreview(event);
      return;
    }
    showPreviewFor(cardname, event);
  });

  els.tableBody.addEventListener("mousemove", (event) => {
    if (preview.activeCard) {
      movePreview(event);
    }
  });

  els.tableBody.addEventListener("mouseout", (event) => {
    const fromTrigger = event.target.closest(".card-preview-trigger");
    if (!fromTrigger) {
      return;
    }
    const toEl = event.relatedTarget;
    if (toEl && fromTrigger.contains(toEl)) {
      return;
    }
    hidePreview();
  });

  els.tableBody.addEventListener("focusin", (event) => {
    const trigger = event.target.closest(".card-preview-trigger");
    if (!trigger) {
      return;
    }
    const cardname = trigger.dataset.cardname;
    if (!cardname) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const pseudoEvent = { clientX: rect.left, clientY: rect.bottom };
    showPreviewFor(cardname, pseudoEvent);
  });

  els.tableBody.addEventListener("focusout", (event) => {
    const trigger = event.target.closest(".card-preview-trigger");
    if (!trigger) {
      return;
    }
    hidePreview();
  });
}

function boardPasses(row, boardFilter) {
  if (boardFilter === "main") {
    return row.mainDecks > 0;
  }
  if (boardFilter === "side") {
    return row.sideDecks > 0;
  }
  if (boardFilter === "both") {
    return row.mainDecks > 0 && row.sideDecks > 0;
  }
  return row.mainDecks > 0 || row.sideDecks > 0;
}

function targetShare(row, boardFilter) {
  if (boardFilter === "main") {
    return row.mainDecks;
  }
  if (boardFilter === "side") {
    return row.sideDecks;
  }
  if (boardFilter === "both") {
    return Math.min(row.mainDecks, row.sideDecks);
  }
  return Math.max(row.mainDecks, row.sideDecks);
}

function targetAvg(row, boardFilter) {
  if (boardFilter === "main") {
    return row.mainAvg;
  }
  if (boardFilter === "side") {
    return row.sideAvg;
  }
  if (boardFilter === "both") {
    return Math.min(row.mainAvg || 0, row.sideAvg || 0);
  }
  return Math.max(row.mainAvg || 0, row.sideAvg || 0);
}

function getFilteredRows() {
  const formatFilter = els.formatFilter.value;
  const search = els.searchFilter.value.trim().toLowerCase();
  const boardFilter = els.boardFilter.value;
  const minShare = num(els.minDeckShare.value) / 100;
  const minAvg = num(els.minAvgCopies.value);

  return state.rows.filter((row) => {
    if (formatFilter !== "all" && row.format !== formatFilter) {
      return false;
    }
    if (search && !row.cardname.toLowerCase().includes(search)) {
      return false;
    }
    if (!boardPasses(row, boardFilter)) {
      return false;
    }
    if (targetShare(row, boardFilter) < minShare) {
      return false;
    }
    if (targetAvg(row, boardFilter) < minAvg) {
      return false;
    }
    return true;
  });
}

function compareValues(a, b) {
  const key = state.sortKey;
  const direction = state.sortDir === "asc" ? 1 : -1;

  const av = a[key];
  const bv = b[key];

  if (typeof av === "string" && typeof bv === "string") {
    return av.localeCompare(bv) * direction;
  }

  return (num(av) - num(bv)) * direction;
}

function updateSortButtonLabels() {
  for (const button of els.sortButtons) {
    const key = button.dataset.sort;
    if (!key) {
      continue;
    }
    const active = key === state.sortKey;
    const suffix = !active ? "" : state.sortDir === "asc" ? " \u2191" : " \u2193";
    const baseText = button.textContent.replace(" \u2191", "").replace(" \u2193", "");
    button.textContent = `${baseText}${suffix}`;
  }
}

function rowHtml(row) {
  const cardname = escapeHtml(row.cardname);
  const format = escapeHtml(row.format);
  const scryfallUrl = scryfallSearchUrl(row.cardname);

  return `
    <tr>
      <td class="codeish">${format}</td>
      <td>
        <div class="card-cell">
          <button class="card-preview-trigger" type="button" data-cardname="${cardname}">${cardname}</button>
          <a class="scryfall-link" href="${scryfallUrl}" target="_blank" rel="noopener noreferrer">Scryfall</a>
        </div>
      </td>
      <td>${pct(row.mainDecks)}</td>
      <td>${row.mainAvg.toFixed(1)}</td>
      <td>${pct(row.sideDecks)}</td>
      <td>${row.sideAvg.toFixed(1)}</td>
    </tr>
  `;
}

function render() {
  updateSortButtonLabels();

  const filtered = getFilteredRows().sort(compareValues);
  const limit = Number.parseInt(els.rowLimit.value, 10);
  const visible = limit > 0 ? filtered.slice(0, limit) : filtered;

  if (visible.length === 0) {
    els.tableBody.innerHTML = "";
    els.tableBody.append(els.emptyRowTpl.content.cloneNode(true));
  } else {
    els.tableBody.innerHTML = visible.map(rowHtml).join("");
  }

  const formatCount = state.loadedFormats.length;
  const total = state.rows.length;
  const shown = visible.length;
  const matched = filtered.length;

  els.statusText.textContent =
    `Loaded ${formatCount} format(s), ${total} cards. Showing ${shown} of ${matched} matched cards.`;
}

loadData();

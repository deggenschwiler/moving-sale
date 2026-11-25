// Moving sale site. All item data comes from the "Public" tab of the
// Moving Sale Tracker Google Sheet, published to the web as CSV.
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbeE1KQT-EdT0eIV1sHzML2mmn7ijfSMkU610F-9smM0wh0aJJrXeX3bgHW-EuZ5_Rzd_6flv47vSV/pub?gid=2&single=true&output=csv";
const WHATSAPP_NUMBER = "16164032081"; // international format, no + or spaces

const TEXT = {
  en: {
    title: "Moving Sale",
    lede: "We're moving from San Sebastián back to the US, so all of this needs a new home. Tap an item for more photos and details.",
    hideSold: "Hide sold items",
    footer: "Prices are in euros. Message me on WhatsApp about anything here.",
    message: "Message me on WhatsApp",
    all: "All",
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    askPrice: "Ask for price",
    noPhoto: "Photo coming soon",
    count: (shown, avail) => `${shown} items shown, ${avail} still available`,
    loading: "Loading items…",
    error: "The item list couldn't load right now. Please try again in a minute.",
    empty: "Nothing in this category right now.",
    waText: (item, price) => `Hi! I'm interested in the ${item}${price ? ` (${price})` : ""} from your moving sale. Is it still available?`,
    categories: {
      "Bikes & outdoor": "Bikes & outdoor",
      "Kitchen": "Kitchen",
      "Home": "Home",
      "Clothing & accessories": "Clothing & accessories",
    },
  },
  es: {
    title: "Venta por mudanza",
    lede: "Nos mudamos de San Sebastián a Estados Unidos, así que todo esto necesita un nuevo hogar. Toca un artículo para ver más fotos y detalles.",
    hideSold: "Ocultar vendidos",
    footer: "Precios en euros. Escríbeme por WhatsApp para cualquier cosa.",
    message: "Escríbeme por WhatsApp",
    all: "Todo",
    available: "Disponible",
    reserved: "Reservado",
    sold: "Vendido",
    askPrice: "Consultar precio",
    noPhoto: "Foto próximamente",
    count: (shown, avail) => `${shown} artículos, ${avail} disponibles`,
    loading: "Cargando artículos…",
    error: "No se ha podido cargar la lista ahora mismo. Inténtalo de nuevo en un minuto.",
    empty: "Ahora mismo no hay nada en esta categoría.",
    waText: (item, price) => `¡Hola! Me interesa ${item}${price ? ` (${price})` : ""} de tu venta por mudanza. ¿Sigue disponible?`,
    categories: {
      "Bikes & outdoor": "Bicis y aire libre",
      "Kitchen": "Cocina",
      "Home": "Hogar",
      "Clothing & accessories": "Ropa y accesorios",
    },
  },
};

const STATUS_ORDER = { available: 0, reserved: 1, sold: 2 };

const state = {
  lang: pickLang(),
  items: [],
  category: "all",
  hideSold: false,
  open: null,
  photoIndex: 0,
};

function pickLang() {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "es") return saved;
  } catch (e) { /* storage blocked */ }
  return (navigator.language || "").toLowerCase().startsWith("es") ? "es" : "en";
}

// RFC 4180 CSV parser: handles quoted fields, escaped quotes and line breaks inside quotes.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toItems(rows) {
  const [header, ...body] = rows;
  const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const c = {
    item: col("item"), es: col("es"), en: col("en"), price: col("price"),
    status: col("status"), photos: col("photos"), category: col("category"),
  };
  return body
    .filter((r) => (r[c.item] || "").trim())
    .map((r, idx) => {
      const raw = (r[c.status] || "").trim().toLowerCase();
      const status = raw === "sold" ? "sold" : raw === "pending" ? "reserved" : "available";
      return {
        id: idx,
        item: r[c.item].trim(),
        en: (r[c.en] || "").trim(),
        es: (r[c.es] || "").trim(),
        price: (r[c.price] || "").trim(),
        status,
        category: (r[c.category] || "").trim(),
        photos: (r[c.photos] || "").split(",").map((s) => s.trim()).filter(Boolean),
      };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

const $ = (id) => document.getElementById(id);
const t = () => TEXT[state.lang];
const desc = (it) => (state.lang === "es" ? it.es || it.en : it.en || it.es);
const photoUrl = (name, thumb) => "photos/" + encodeURIComponent(thumb ? name.replace(/\.jpg$/i, "-t.jpg") : name);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const ch of children) if (ch) node.append(ch);
  return node;
}

function badge(status) {
  return el("span", { class: `badge ${status}`, text: t()[status] });
}

function priceNode(it) {
  return it.price
    ? el("p", { class: "price", text: it.price })
    : el("p", { class: "price ask", text: t().askPrice });
}

function renderStaticText() {
  document.documentElement.lang = state.lang;
  document.title = t().title;
  document.querySelectorAll("[data-i18n]").forEach((n) => {
    const v = t()[n.dataset.i18n];
    if (typeof v === "string") n.textContent = v;
  });
  document.querySelectorAll(".lang button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang));
  });
}

function renderChips() {
  const cats = [...new Set(state.items.map((i) => i.category).filter(Boolean))];
  const chips = $("chips");
  chips.replaceChildren();
  for (const key of ["all", ...cats]) {
    const label = key === "all" ? t().all : t().categories[key] || key;
    const b = el("button", { type: "button", class: "chip", "aria-pressed": String(state.category === key), text: label });
    b.addEventListener("click", () => { state.category = key; renderChips(); renderGrid(); });
    chips.append(b);
  }
}

function renderGrid() {
  const grid = $("grid");
  grid.replaceChildren();
  const list = state.items.filter((i) =>
    (state.category === "all" || i.category === state.category) && !(state.hideSold && i.status === "sold"));
  const avail = state.items.filter((i) => i.status === "available").length;
  $("count").textContent = state.items.length ? t().count(list.length, avail) : "";
  const msg = $("msg");
  msg.hidden = list.length > 0 || !state.items.length;
  if (!list.length && state.items.length) msg.textContent = t().empty;

  for (const it of list) {
    const thumb = el("div", { class: "thumb" });
    if (it.photos.length) {
      thumb.append(el("img", { src: photoUrl(it.photos[0], true), alt: it.item, loading: "lazy", decoding: "async" }));
    } else {
      thumb.append(el("div", { class: "noimg", text: t().noPhoto }));
    }
    thumb.append(badge(it.status));
    const card = el("button", { type: "button", class: `card is-${it.status}` },
      thumb,
      el("div", { class: "info" },
        el("h3", { text: it.item }),
        el("p", { class: "snippet", text: desc(it).replace(/\s+/g, " ") }),
        priceNode(it)));
    card.addEventListener("click", () => openDetail(it, card));
    grid.append(card);
  }
}

let lastFocus = null;
function openDetail(it, from) {
  state.open = it;
  state.photoIndex = 0;
  lastFocus = from || null;
  renderDetail();
  const d = $("detail");
  if (!d.open) d.showModal();
  history.replaceState(null, "", "#" + slug(it.item));
}

function closeDetail() {
  $("detail").close();
}

function renderDetail() {
  const it = state.open;
  if (!it) return;
  const img = $("dImg");
  const n = it.photos.length;
  if (n) {
    img.src = photoUrl(it.photos[state.photoIndex], false);
    img.alt = `${it.item}, photo ${state.photoIndex + 1} of ${n}`;
    img.hidden = false;
  } else {
    img.hidden = true;
  }
  $("dPrev").hidden = $("dNext").hidden = n < 2;
  const dots = $("dDots");
  dots.replaceChildren(...(n > 1 ? it.photos.map((_, i) => el("span", { class: i === state.photoIndex ? "on" : "" })) : []));
  const b = $("dBadge");
  b.className = `badge ${it.status}`;
  b.textContent = t()[it.status];
  $("dTitle").textContent = it.item;
  const p = $("dPrice");
  p.className = it.price ? "price" : "price ask";
  p.textContent = it.price || t().askPrice;
  $("dDesc").textContent = desc(it);
  const wa = $("dWa");
  if (it.status === "sold") {
    wa.setAttribute("aria-disabled", "true");
    wa.removeAttribute("href");
  } else {
    wa.removeAttribute("aria-disabled");
    wa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t().waText(it.item, it.price))}`;
  }
  // Preload the next photo so swiping feels instant.
  if (n > 1) new Image().src = photoUrl(it.photos[(state.photoIndex + 1) % n], false);
}

function step(delta) {
  const n = state.open ? state.open.photos.length : 0;
  if (n < 2) return;
  state.photoIndex = (state.photoIndex + delta + n) % n;
  renderDetail();
}

function slug(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function wireEvents() {
  document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => {
    state.lang = b.dataset.lang;
    try { localStorage.setItem("lang", state.lang); } catch (e) { /* storage blocked */ }
    renderStaticText(); renderChips(); renderGrid(); renderDetail();
  }));
  $("hideSold").addEventListener("change", (e) => { state.hideSold = e.target.checked; renderGrid(); });
  $("dClose").addEventListener("click", closeDetail);
  $("dPrev").addEventListener("click", () => step(-1));
  $("dNext").addEventListener("click", () => step(1));
  const d = $("detail");
  d.addEventListener("click", (e) => { if (e.target === d) closeDetail(); });
  d.addEventListener("close", () => {
    state.open = null;
    history.replaceState(null, "", location.pathname + location.search);
    if (lastFocus) lastFocus.focus();
  });
  d.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  let startX = null;
  const g = d.querySelector(".gallery");
  g.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  g.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    startX = null;
  });
}

async function load() {
  const msg = $("msg");
  msg.hidden = false;
  msg.textContent = t().loading;
  try {
    const sep = SHEET_CSV_URL.includes("?") ? "&" : "?";
    const res = await fetch(`${SHEET_CSV_URL}${sep}t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    state.items = toItems(parseCSV(await res.text()));
    msg.hidden = true;
  } catch (e) {
    msg.textContent = t().error;
    return;
  }
  renderChips();
  renderGrid();
  // Open an item directly when the link includes its name, e.g. .../#wall-mirror
  const hash = decodeURIComponent(location.hash.slice(1));
  const match = hash && state.items.find((i) => slug(i.item) === hash);
  if (match) openDetail(match);
}

renderStaticText();
wireEvents();
load();

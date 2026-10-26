// Tarasvini page builder. Netlify runs this on every deploy (see netlify.toml).
// It reads the same published Google Sheet as the website and writes:
//   p/<product>.html   one page per product (Google can show each one in search)
//   <category>.html    one page per category (sarees.html, salwar-suits.html, ...)
//   sitemap.xml        list of all pages for Google
//   feed.xml           product feed for Google Merchant Center (free Shopping listings)
// Nothing here needs changing when you add products: just edit the sheet and redeploy.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";

const SITE = "https://www.tarasvini.com";
const BRAND = "Tarasvini";
const IG_DM = "https://ig.me/m/tarasvini";

// Settings and rules are read from app.js so there is only one place to change them.
const app = readFileSync("app.js", "utf8");
const grab = (re, what) => { const m = app.match(re); if (!m) throw new Error("Could not read " + what + " from app.js"); return m[1]; };
const SHEET_URL = grab(/const SHEET_URL\s*=\s*"([^"]+)"/, "SHEET_URL");
const SHEET_TABS = JSON.parse(grab(/const SHEET_TABS\s*=\s*(\[[^\]]*\])/, "SHEET_TABS"));
const WA = grab(/const WA\s*=\s*"(\d+)"/, "WA");
const BACKUP_CSV = grab(/const BACKUP_CSV\s*=\s*"([^"]+)"/, "BACKUP_CSV");
const ALIAS = new Function("return " + grab(/const ALIAS\s*=\s*(\{[^;]*\});/, "ALIAS"))();
const CROP_TOP = Number(grab(/const CROP_TOP\s*=\s*([\d.]+)/, "CROP_TOP"));
const KNOWN = new Function("return " + grab(/const KNOWN\s*=\s*(\[\[[^;]*\]\]);/, "KNOWN"))();
const tabURL = g => SHEET_URL + (g ? "?gid=" + g + "&single=true&output=csv" : "?output=csv");

// ---------- helpers (same rules as app.js) ----------
// Cloudinary photos: right size, light format, top strip with the code label trimmed (CROP_TOP in app.js)
const pic = (u, w) => { const m = String(u || "").match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!m || /^[a-z]{1,4}_[^/]*\//.test(m[2])) return u;
  return m[1] + (CROP_TOP ? "c_crop,g_south,w_1.0,h_" + (1 - CROP_TOP / 100).toFixed(2) + "/" : "") + "c_limit,w_" + w + ",f_auto,q_auto/" + m[2]; };
const FAIL = `onerror="if(this.dataset.o){this.src=this.dataset.o;this.removeAttribute('data-o')}else this.remove()"`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const title = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const inr = n => "₹" + n.toLocaleString("en-IN");
const num = v => Number(String(v || "").replace(/[^\d.]/g, "")) || 0;
const yes = v => /^(y|yes|true|1|✓|✔|x)$/i.test(String(v || "").trim());
const hkey = h => { const k = String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); return ALIAS[k] || k; };
const slug = s => String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function parseCSV(t) {
  const rows = []; let r = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c == '"') { if (t[i + 1] == '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c == '"') q = true;
    else if (c == ",") { r.push(f); f = ""; }
    else if (c == "\n") { r.push(f); rows.push(r); r = []; f = ""; }
    else if (c != "\r") f += c;
  }
  if (f !== "" || r.length) { r.push(f); rows.push(r); }
  return rows;
}
const catInfo = v => {
  v = String(v || "").replace(/\s+/g, " ").trim(); const k = v.toLowerCase();
  const kn = KNOWN.find(c => c.some(x => x.toLowerCase() === k) || c[0].toLowerCase() + "s" === k || (c[0] === "Cord-set" && /^co-?ord|^cord ?sets?$/.test(k)));
  if (kn) return kn;
  const t = v === k ? title(v) : v, pl = /s$/i.test(t) ? t : t + "s"; return [t, pl, t.toLowerCase(), pl.toLowerCase()];
};
const imgURL = u => { const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{20,})/) || u.match(/docs\.google\.com\/uc\?(?:export=\w+&)?id=([\w-]{20,})/); return m ? "https://lh3.googleusercontent.com/d/" + m[1] + "=w1200" : u; };
const getImgs = o => { const seen = []; Object.keys(o).filter(k => /^image_url(_\d+)?$/.test(k)).sort((a, b) => (parseInt(a.split("_")[2]) || 1) - (parseInt(b.split("_")[2]) || 1)).forEach(k => String(o[k] || "").split(/[\s,|]+/).forEach(u => { u = imgURL(u.trim()); if (/^https?:\/\//.test(u) && !seen.includes(u)) seen.push(u); })); return seen.slice(0, 8); };
const colInfo = v => { v = String(v || "").trim(); if (/^\d+$/.test(v)) return { colours: +v, cnames: [] }; const n = v.split(/[,;\/|]+/).map(x => x.trim()).filter(Boolean); return { colours: n.length, cnames: n }; };
const cut = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,.;:]$/, "") + "…";
const and = a => a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a.join("");
const CCOL = { Saree: ["#B43C18", "#F7E3DB"], Salwar: ["#B0185A", "#F7DCE8"], Kurti: ["#0F6B6B", "#D8ECEB"], Lehenga: ["#C9850A", "#FBEACB"], "Cord-set": ["#3C3C18", "#E8E8D8"] };
const PAL = [["#B43C18", "#F7E3DB"], ["#B0185A", "#F7DCE8"], ["#0F6B6B", "#D8ECEB"], ["#C9850A", "#FBEACB"], ["#1F8A4C", "#DDF0E4"], ["#5B3FA8", "#E6E0F5"]];

// ---------- read the catalogue ----------
async function fetchText(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try { const r = await fetch(url, { signal: ctl.signal, redirect: "follow" }); return r.ok ? await r.text() : ""; }
  catch { return ""; } finally { clearTimeout(t); }
}
async function readCatalogue() {
  const isCat = t => { const h = (parseCSV(t)[0] || []).map(hkey); return h.includes("id") && h.includes("name"); };
  let texts = (await Promise.all(SHEET_TABS.map(g => fetchText(tabURL(g))))).filter(t => t && isCat(t));
  let source = "Google Sheet";
  if (!texts.length) { texts = [readFileSync(BACKUP_CSV, "utf8")]; source = BACKUP_CSV + " (Google Sheet could not be reached)"; }
  const seen = new Set(); let recs = [], hasShow = false;
  texts.forEach(t => {
    const rows = parseCSV(t), head = rows[0].map(hkey); if (head.includes("show")) hasShow = true;
    rows.slice(1).forEach(r => {
      const o = {}; head.forEach((h, i) => o[h] = (r[i] || "").trim());
      if (o.id && o.name && !/^hid/i.test(o.available) && !seen.has(o.id)) { seen.add(o.id); recs.push(o); }
    });
  });
  if (hasShow && recs.some(o => yes(o.show))) recs = recs.filter(o => yes(o.show));
  const cats = []; recs.forEach(o => { const c = catInfo(o.category); if (c[0] && !cats.some(x => x[0].toLowerCase() === c[0].toLowerCase())) cats.push(c); });
  const items = recs.map((o, i) => {
    const mrp = num(o.price), sp = num(o.sale), onsale = sp > 0 && sp < mrp;
    const cat = catInfo(o.category);
    const tidy = c => c === c.toLowerCase() ? title(c) : c;
    return {
      ...o, i, cat, category: cat[0], ...colInfo(o.colours),
      price: onsale ? sp : mrp, was: onsale ? mrp : 0, onsale,
      coll: tidy(String(o.collection || "").replace(/\s+/g, " ").trim()),
      occ: String(o.occ || "").split(/[,;\/]+/).map(x => title(x.trim())).filter(Boolean),
      imgs: getImgs(o), sold: /^sold/i.test(o.available), feat: yes(o.featured), isnew: yes(o.isnew),
      slug: (slug(o.name) || "product") + "-" + (slug(o.id) || i),
    };
  });
  return { items, cats, source };
}

// ---------- page pieces ----------
const index = readFileSync("index.html", "utf8");
const HEADER = index.slice(index.indexOf("<body>") + 6, index.indexOf('<main id="main">'));
const FOOTER = index.slice(index.indexOf("</main>") + 7, index.indexOf("</body>")).replace(/<dialog id="dlg"[^>]*><\/dialog>\s*/, "");
const catSlug = c => slug(c[1]);
const ccol = (k, cats) => CCOL[k] || PAL[Math.max(0, cats.findIndex(c => c[0] === k)) % PAL.length];
const priceHTML = p => p.price ? inr(p.price) + (p.was ? `<s class="was">${inr(p.was)}</s><span class="off">${Math.round((1 - p.price / p.was) * 100)}% off</span>` : "") : "";
const colText = p => p.cnames.length > 1 ? p.cnames.join(", ") : p.colours > 1 ? p.colours + " colours" : p.cnames[0] || "";
const pageURL = p => SITE + "/p/" + p.slug + ".html";
const waLink = p => "https://wa.me/" + WA + "?text=" + encodeURIComponent([
  pic(p.imgs[0] || "", 600), "Hi Tarasvini, I'd like to order:", p.name, "Code: " + p.id,
  p.price ? "Price: " + inr(p.price) + (p.was ? " (sale price, was " + inr(p.was) + ")" : "") : "",
  p.colours > 1 ? "Colour: " : "", p.sizes ? "Size: " : "", "Link: " + pageURL(p), "Please confirm availability and delivery."].filter(Boolean).join("\n"));
const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.9 7L4 20l1.5-4A8 8 0 1 1 20 11.5z"/><path d="M9.2 8.8c.3 2.4 2.5 4.6 5 5l1-1.2-1.7-.9-.8.6c-.9-.4-1.6-1.1-2-2l.6-.8-.9-1.7z"/></svg>';
const IG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>';

// A plain-language summary built from the sheet, used when the Description column is empty.
function summary(p) {
  const kind = p.cat[2];
  const what = [p.coll && !p.name.toLowerCase().includes(p.coll.toLowerCase()) ? p.coll : "", p.fabric_group && !(p.coll + p.name).toLowerCase().includes(p.fabric_group.toLowerCase()) ? p.fabric_group.toLowerCase() : ""].filter(Boolean).join(" ");
  const s = [`${p.name}${what ? `, a ${what} ${kind}` : ""} from ${BRAND}, Chennai.`];
  if (p.occ.length) s.push(`Ideal for ${and(p.occ.map(o => o.toLowerCase()))}.`);
  const c = colText(p); if (c) s.push(`Available in ${/colours$/.test(c) ? c : "these colours: " + c}.`);
  if (p.sizes) s.push(`Sizes: ${p.sizes}.`);
  s.push(`Free shipping across India${p.delivery ? `, delivered in ${p.delivery.replace(/\s*days?$/i, "")} working days` : ""}. Order on WhatsApp.`);
  return s.join(" ");
}
const descHTML = t => String(t).replace(/\r/g, "").split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => /^[*•\-–]\s*/.test(x) ? `<li>${esc(x.replace(/^[*•\-–]\s*/, ""))}</li>` : `<p>${esc(x)}</p>`).join("").replace(/(<li>.*?<\/li>)+/g, m => `<ul>${m}</ul>`);
const plainDesc = p => (p.description ? String(p.description).replace(/\s*\n\s*/g, " ").replace(/^[*•\-–]\s*/g, "") : summary(p)).slice(0, 4900);

function ph(p, cats, eager, idx = 0) {
  const [c, t] = ccol(p.category, cats);
  const img = p.imgs[idx] ? `<img src="${esc(pic(p.imgs[idx], eager ? 1200 : 600))}" data-o="${esc(p.imgs[idx])}" alt="${esc(p.name)}" loading="${eager ? "eager" : "lazy"}" ${FAIL}>` : "";
  const tag = p.sold ? '<span class="tags"><span class="tag sold">Sold out</span></span>' : (p.isnew || p.onsale) ? `<span class="tags">${p.isnew ? '<span class="tag new">New arrival</span>' : ""}${p.onsale ? '<span class="tag sale">Sale</span>' : ""}</span>` : "";
  return `<div class="ph" style="--c:${c};--t:${t}"><b>${esc(p.id)}</b><span>Photo coming soon</span>${img}${tag}<div class="zari" aria-hidden="true"></div></div>`;
}
const card = (p, cats) => `<article class="card${p.sold ? " is-sold" : ""}" data-id="${esc(p.id)}"><a class="open" href="/p/${p.slug}.html">${ph(p, cats, false)}<div class="info">${p.coll ? `<p class="ty">${esc(p.coll)}</p>` : ""}<h3>${esc(p.name)}</h3><div class="prow"><span class="price">${priceHTML(p)}</span>${colText(p) && !p.cnames.length ? `<span class="cols">${esc(colText(p))}</span>` : ""}</div></div></a>${p.sold ? '<button class="btn order" type="button" disabled>Sold out</button>' : `<a class="btn order" href="${waLink(p)}" target="_blank" rel="noopener">${WA_ICON}Order on WhatsApp</a>`}</article>`;
const order = (a, b) => (a.sold - b.sold) || (b.isnew - a.isnew) || (b.feat - a.feat) || ((b.imgs.length > 0) - (a.imgs.length > 0)) || (a.i - b.i);
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

function page({ path, title: t, desc, image, body, schema = [] }) {
  const url = SITE + path;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/">
<title>${esc(t)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:image" content="${esc(image || SITE + "/assets/logo.png")}">
<link rel="icon" type="image/png" href="assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
${schema.map(ld).join("\n")}
</head>
<body>${HEADER}<main id="main">${body}</main>${FOOTER}</body>
</html>
`;
}
const crumbs = list => `<nav class="crumbs wrap" aria-label="Breadcrumb">${list.map((c, i) => i < list.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(c[0])}</span>`).join("")}</nav>`;
const crumbLD = list => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: list.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c[0], item: SITE + c[1] })) });

function productPage(p, all, cats) {
  const cpath = "/" + catSlug(p.cat) + ".html";
  const trail = [["Home", "/"], [p.cat[1], cpath], [p.name, "/p/" + p.slug + ".html"]];
  const sizes = String(p.sizes || "").split(/[,\s]+/).filter(Boolean);
  const more = all.filter(x => x.category === p.category && x !== p && !x.sold).sort((a, b) => ((b.coll === p.coll) - (a.coll === p.coll)) || order(a, b)).slice(0, 8);
  const gallery = `<div class="gal pgal">${ph(p, cats, true, 0)}${p.imgs.length > 1 ? `<div class="thumbs">${p.imgs.map((u, i) => `<button type="button" data-src="${esc(pic(u, 1200))}" data-o="${esc(u)}" aria-label="Photo ${i + 1}"${i ? "" : ' aria-current="true"'}><img src="${esc(pic(u, 200))}" data-o="${esc(u)}" alt="" loading="lazy" ${FAIL}></button>`).join("")}</div>` : ""}</div>`;
  const body = `${crumbs(trail)}
<section class="wrap pdp" data-id="${esc(p.id)}"><div class="dg">${gallery}
<div class="body">${p.coll ? `<p class="ty">${esc(p.coll)}</p>` : ""}<h1>${esc(p.name)}</h1><div class="price">${priceHTML(p)}</div>
${sizes.length ? `<div class="opt"><h4>Sizes</h4><div class="sizes">${sizes.map(s => `<span>${esc(s)}</span>`).join("")}</div></div>` : ""}
<div class="desc">${p.description ? descHTML(p.description) : `<p>${esc(summary(p))}</p>`}</div>
<dl><dt>Code</dt><dd>${esc(p.id)}</dd>${p.fabric_group ? `<dt>Fabric</dt><dd>${esc(p.fabric_group)}</dd>` : ""}${colText(p) ? `<dt>Colours</dt><dd>${esc(colText(p))}</dd>` : ""}${p.occ.length ? `<dt>Occasion</dt><dd>${esc(p.occ.join(", "))}</dd>` : ""}${p.delivery ? `<dt>Delivery</dt><dd>${esc(p.delivery.replace(/\s*days?$/i, ""))} working days</dd>` : ""}<dt>Shipping</dt><dd>Free across India</dd></dl>
<div class="dacts">${p.sold ? '<button class="btn" type="button" disabled>Sold out</button>' : `<a class="btn wa" href="${waLink(p)}" target="_blank" rel="noopener">${WA_ICON}Order on WhatsApp</a>`}<div class="row"><a class="btn" href="${IG_DM}" target="_blank" rel="noopener">${IG_ICON}Ask on Instagram</a><a class="btn" href="index.html?item=${encodeURIComponent(p.id)}">See in catalogue</a></div></div>
<div class="policy"><p><strong>Free shipping across India.</strong> Prepaid orders only, no cash on delivery.</p><p>Returns or exchanges only for damaged or wrong items, reported within 24–48 hours with a full, uncut unboxing video. <a href="shipping-returns.html">Shipping and returns</a></p></div>
</div></div></section>
${more.length ? `<section class="wrap shop related" aria-labelledby="moreh"><div class="shophead"><h2 id="moreh">More ${esc(p.cat[3])}</h2><a class="btn" href="${cpath.slice(1)}">See all ${esc(p.cat[3])}</a></div><div class="grid">${more.map(x => card(x, cats)).join("")}</div></section>` : ""}
<script>(function(){var g=document.querySelector(".pgal");if(!g)return;g.addEventListener("click",function(e){var b=e.target.closest(".thumbs button");if(!b)return;var i=g.querySelector(".ph img");if(!i){i=document.createElement("img");g.querySelector(".ph").appendChild(i)}i.dataset.o=b.dataset.o;i.onerror=function(){if(this.dataset.o){this.src=this.dataset.o;this.removeAttribute("data-o")}};i.src=b.dataset.src;g.querySelectorAll(".thumbs button").forEach(function(x){x.setAttribute("aria-current",x===b)})})})();</script>`;
  const offers = p.price ? {
    "@type": "Offer", url: pageURL(p), priceCurrency: "INR", price: p.price.toFixed(2), itemCondition: "https://schema.org/NewCondition",
    availability: p.sold ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", seller: { "@type": "Organization", name: BRAND },
    shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: "0", currency: "INR" }, shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" } },
  } : undefined;
  const schema = [{ "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.id, brand: { "@type": "Brand", name: BRAND }, description: plainDesc(p), url: pageURL(p), ...(p.imgs.length ? { image: p.imgs.map(u => pic(u, 1200)) } : {}), ...(p.fabric_group ? { material: p.fabric_group } : {}), category: p.cat[0] + (p.coll ? " > " + p.coll : ""), ...(offers ? { offers } : {}) }, crumbLD(trail)];
  const t = `${p.name}${p.price ? " | " + inr(p.price) : ""} | ${BRAND}`;
  const d = cut(p.description ? plainDesc(p) : summary(p), 158);
  return page({ path: "/p/" + p.slug + ".html", title: t, desc: d, image: pic(p.imgs[0], 1200), body, schema });
}

function categoryPage(c, all, cats) {
  const items = all.filter(p => p.category === c[0]).sort(order);
  const path = "/" + catSlug(c) + ".html";
  const top = (key, n) => { const m = {}; items.forEach(p => { const v = p[key]; if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]); };
  const colls = top("coll", 6), fabs = top("fabric_group", 4).map(f => f.toLowerCase());
  const prices = items.filter(p => p.price && !p.sold).map(p => p.price);
  const intro = [`Shop ${items.length} ${c[3]} from ${BRAND}, Chennai${colls.length ? `, including ${and(colls)}` : ""}.`,
    fabs.length ? `Choose from ${and(fabs)} styles${prices.length ? `, priced from ${inr(Math.min(...prices))}` : ""}.` : "",
    "Free shipping across India. Tap any product to see photos and details, then order on WhatsApp."].filter(Boolean).join(" ");
  const trail = [["Home", "/"], [c[1], path]];
  const body = `${crumbs(trail)}<section class="pagehead"><div class="wrap"><h1>${esc(c[1])}</h1><div class="zari" aria-hidden="true"></div></div></section>
<section class="wrap shop catpage"><p class="catintro">${esc(intro)}</p><p><a class="btn" href="index.html?cat=${encodeURIComponent(c[0])}">Filter by fabric, price and occasion</a></p><div class="grid">${items.map(p => card(p, cats)).join("")}</div></section>`;
  const schema = [crumbLD(trail), { "@context": "https://schema.org", "@type": "ItemList", itemListElement: items.slice(0, 50).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: pageURL(p) })) }];
  return page({ path, title: `${c[1]} Online | ${BRAND}, Chennai | Free Shipping India`, desc: cut(intro, 158), image: pic(items.find(p => p.imgs.length)?.imgs[0], 1200), body, schema });
}

// ---------- Google Merchant Center feed ----------
const xml = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
function feed(items) {
  const rows = items.filter(p => p.imgs.length && p.price).map(p => `<item>
<g:id>${xml(p.id)}</g:id>
<g:title>${xml(p.name.slice(0, 150))}</g:title>
<g:description>${xml(plainDesc(p))}</g:description>
<g:link>${xml(pageURL(p))}</g:link>
<g:image_link>${xml(pic(p.imgs[0], 1200))}</g:image_link>
${p.imgs.slice(1, 10).map(u => `<g:additional_image_link>${xml(pic(u, 1200))}</g:additional_image_link>`).join("\n")}
<g:availability>${p.sold ? "out_of_stock" : "in_stock"}</g:availability>
<g:price>${(p.was || p.price).toFixed(2)} INR</g:price>
${p.was ? `<g:sale_price>${p.price.toFixed(2)} INR</g:sale_price>` : ""}
<g:condition>new</g:condition>
<g:brand>${BRAND}</g:brand>
<g:identifier_exists>no</g:identifier_exists>
<g:product_type>${xml([p.cat[1], p.coll].filter(Boolean).join(" > "))}</g:product_type>
${p.fabric_group ? `<g:material>${xml(p.fabric_group)}</g:material>` : ""}
<g:gender>female</g:gender>
<g:age_group>adult</g:age_group>
<g:shipping><g:country>IN</g:country><g:price>0.00 INR</g:price></g:shipping>
</item>`.replace(/\n\n+/g, "\n"));
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${BRAND}</title>
<link>${SITE}/</link>
<description>${BRAND} women's ethnic wear: sarees, salwar suits, kurtis and lehengas</description>
${rows.join("\n")}
</channel>
</rss>
`;
}

// ---------- write everything ----------
const { items, cats, source } = await readCatalogue();
if (!items.length) throw new Error("No products found, stopping so the live site is not replaced by an empty one.");
if (existsSync("p")) rmSync("p", { recursive: true });
mkdirSync("p");
items.forEach(p => writeFileSync("p/" + p.slug + ".html", productPage(p, items, cats)));
const present = cats.filter(c => items.some(p => p.category === c[0]));
present.forEach(c => writeFileSync(catSlug(c) + ".html", categoryPage(c, items, cats)));
const today = new Date().toISOString().slice(0, 10);
const urls = [["/", today], ...present.map(c => ["/" + catSlug(c) + ".html", today]), ["/reviews.html"], ["/contact.html"], ["/shipping-returns.html"], ["/privacy.html"], ...items.map(p => ["/p/" + p.slug + ".html"])];
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${SITE}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`);
writeFileSync("feed.xml", feed(items));
// Home page intro: point category links at the new category pages (only for categories that have products)
const intro = index.match(/<section class="block seointro"[\s\S]*?<\/section>/);
if (intro) {
  const fixed = intro[0].replace(/href="index\.html\?cat=([^"]+)"/g, (m, v) => { const c = present.find(x => x[0] === catInfo(decodeURIComponent(v))[0]); return c ? `href="${catSlug(c)}.html"` : m; });
  writeFileSync("index.html", index.replace(intro[0], fixed));
}
// ---------- prepare photos in Cloudinary ----------
// Cloudinary makes each trimmed/resized photo the first time it is asked for (1-2 seconds).
// Asking for every size here, during the deploy, means customers never wait for that.
// Sizes: 600 (product cards), 1200 (big photo), 200 (thumbnails). Never stops the deploy.
async function warmPhotos(items) {
  const urls = new Set();
  items.forEach(p => p.imgs.forEach((u, i) => { if (pic(u, 600) === u) return; [200, 1200].concat(i ? [] : [600]).forEach(w => urls.add(pic(u, w))); }));
  const list = [...urls]; let ok = 0, bad = 0, n = 0; const failed = [];
  const accept = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"; // same as Chrome, so the AVIF/WebP copy is made
  const t0 = Date.now(), LIMIT = 240000; // stop after 4 minutes; the rest are made on first view
  async function worker() {
    while (n < list.length && Date.now() - t0 < LIMIT) {
      const u = list[n++]; const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
      try { const r = await fetch(u, { headers: { accept }, signal: ctl.signal }); await r.arrayBuffer(); if (r.ok) ok++; else { bad++; if (failed.length < 3) failed.push(r.status + " " + u); } }
      catch (e) { bad++; if (failed.length < 3) failed.push((e.name === "AbortError" ? "timeout " : "no connection ") + u); } finally { clearTimeout(t); }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`Photos prepared in Cloudinary: ${ok} ready, ${bad} failed, ${list.length - ok - bad} left for later (${Math.round((Date.now() - t0) / 1000)}s)`);
  if (failed.length) console.log("Photo problems (the site shows the original photo instead):\n  " + failed.join("\n  "));
}
if (process.env.NETLIFY || process.env.WARM_PHOTOS) await warmPhotos(items).catch(e => console.log("Photo preparation skipped:", e.message));

console.log(`Tarasvini build: ${items.length} products from ${source}; ${present.length} category pages (${present.map(c => catSlug(c) + ".html").join(", ")}); ${items.filter(p => p.imgs.length && p.price).length} products in feed.xml`);

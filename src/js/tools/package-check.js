// Instruction package checker. Reads PDFs in the browser with pdf.js; nothing is uploaded.
import * as pdfjsLib from "/js/vendor/pdfjs/pdf.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/vendor/pdfjs/pdf.worker.min.js";

const MAX_PAGES = 600;

// EU official languages, plus languages often found in the same manuals. A language that is
// missing from this list gets assigned to its nearest neighbour (Russian became Bulgarian).
const LANGS = {
  bg: { name: "Bulgarian", words: "и в на да се не за от е или те тя той им ще тях има между това са към във със като които който която тази този но също може трябва при след" },
  cs: { name: "Czech", words: "a se na je že v s nebo pro to jsou při není jako také který která které byl být jeho ale může musí před pouze" },
  da: { name: "Danish", words: "og det ikke er til af en med som for på den eller de at et har var kan også fra blev efter skal hvis nogle mellem hvad meget kun være sig mig nu uden anden end bliver giver sådan dog hos" },
  de: { name: "German", words: "der die und das nicht ist mit den für von zu werden auf sie des dem bei oder eine ein wird sich auch als wie nach" },
  el: { name: "Greek", words: "και το να η της του με για δεν ή τα την στο από είναι πρέπει οι των σε που στην ένα μια" },
  en: { name: "English", words: "the and of to is for with that this are be not from or when must use it as by was which can" },
  es: { name: "Spanish", words: "de el los las del que para con una por no es se debe ser en y también como pero sus son fue al" },
  et: { name: "Estonian", words: "ja on ei või kui see mis ning ka et oli ta seda kuid ainult nagu aga selle mida tuleb peab välja" },
  fi: { name: "Finnish", words: "ja on ei se että tai kun ole voi tämä sen joka myös ovat oli mutta kuin vain sekä jos niin kanssa ovat" },
  fr: { name: "French", words: "de le la les et des est pour une dans pas du que sur avec ne être ou un au par qui sont aux" },
  ga: { name: "Irish", words: "agus an na ar is le níl go don chun sin nó bhfuil é a ag atá i mar ach sa" },
  hr: { name: "Croatian", words: "i je se na za ne da ili su pri koji s mora može treba koja koje kao od što bio biti također" },
  hu: { name: "Hungarian", words: "a az és nem hogy egy van meg vagy csak kell ha is mint ez el be ki volt lehet által amely" },
  it: { name: "Italian", words: "il di che per non della una sono con del gli alla deve essere nel le la è dei delle anche come" },
  lt: { name: "Lithuanian", words: "ir yra kad su ar į nuo tai prie būti jei arba buvo kaip bet iš per taip pat jo ji gali kuris kuri yra" },
  lv: { name: "Latvian", words: "un ir ar vai uz nav ka var lai no kas pie arī bija tā tas kā par" },
  mt: { name: "Maltese", words: "u li ma huwa għandu jew tal fil għal biex dan din hija kien kienet minn mill wara" },
  nl: { name: "Dutch", words: "de het en van een niet is op voor met te worden moet zijn bij dat die ook door wordt als aan" },
  pl: { name: "Polish", words: "i w nie się na z do jest że to lub przez jak od oraz które który która był być jego także może są należy" },
  pt: { name: "Portuguese", words: "de o os as do da dos não para com uma em que deve ser é ao das um também pelo pela" },
  ro: { name: "Romanian", words: "de se mai prea dacă și şi nu să sǎ este cu pentru la sau care trebuie pe în un o din fi sunt" },
  sk: { name: "Slovak", words: "a sa na je že v s alebo pre to sú pri nie ako tiež ktorý ktorá ktoré bol byť jeho ale môže musí" },
  sl: { name: "Slovenian", words: "in je se na za ne da ali so pri ki z s mora lahko tudi kot bil biti ter" },
  sv: { name: "Swedish", words: "och det inte är till av en med som för ska på den eller får att har var kan också från blev efter om" },
  no: { name: "Norwegian", words: "og det ikke er til av en med som for på den eller de at et har var kan også fra ble etter skal hvis noen mellom hva mye bare være ved seg meg nå uten annen enn blir gir slik" },
  tr: { name: "Turkish", words: "ve bir bu için ile değil olarak veya gibi daha önce da de olan çok en" },
  ru: { name: "Russian", words: "и в не на что с по это как для из к у от о за же так но было его она они быть или при также только может был были которые который должны" },
  uk: { name: "Ukrainian", words: "і в на не що з до як та це для від за у є також його але або при може був були які який яка цей має" },
};
for (const k of Object.keys(LANGS)) LANGS[k].set = new Set(LANGS[k].words.split(" "));
// A word shared by several languages counts for less than a word only one language uses.
const WEIGHT = new Map();
for (const l of Object.values(LANGS)) for (const w of l.set) WEIGHT.set(w, (WEIGHT.get(w) || 0) + 1);
for (const [w, n] of WEIGHT) WEIGHT.set(w, 1 / n);

// A label, an optional "Nr."/"No.", then a value that contains at least one digit.
const REV_PATTERNS = [
  /\b(?:rev(?:ision)?|ver|revisión|révision|revisione|version|versión|versione|edition|edición|édition|ausgabe|issue|wydanie|verze|verzió)\.?\s*(?:n[ro]\.?|nummer|number)?\s*[:#]?\s*(?:(?=[\w.\-/]*\d)[A-Z0-9][\w.\-/]{0,20}|(?<=[\s.:#])[A-Z](?![\p{L}\p{N}]))/giu,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:19|20)\d{2}\b/g,
  /\b(?:19|20)\d{2}[-./](?:0?[1-9]|1[0-2])(?:[-./](?:0?[1-9]|[12]\d|3[01]))?\b/g,
  /\b(?:(?:0?[1-9]|[12]\d|3[01])[./])?(?:0?[1-9]|1[0-2])[./](?:19|20)\d{2}\b/g,
];

function tokens(text) {
  return text.toLowerCase().match(/[\p{L}']+/gu) || [];
}

function detectLanguage(text) {
  const toks = tokens(text);
  if (toks.length < 25) return null;
  const scores = [];
  for (const [code, l] of Object.entries(LANGS)) {
    let n = 0;
    for (const t of toks) if (l.set.has(t)) n += WEIGHT.get(t);
    scores.push([code, n / toks.length]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  const [best, s1] = scores[0];
  const s2 = scores[1][1];
  // Inflected languages (Finnish, Lithuanian, Russian) have few function words, so the floor is
  // low; the winner must still beat the runner-up by a margin.
  if (s1 < 0.02 || s1 < s2 * 1.25) return null;
  return best;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Exact: the name as typed, whitespace collapsed, not inside a longer word or number.
// Boundaries also reject "-", "/", "." or "_" followed by more of a code, so "TE-AC 400/50"
// does not match inside "TE-AC 400/50/10 V".
const BEFORE = "(?<![\\p{L}\\p{N}])(?<![\\p{L}\\p{N}][\\-_./])";
const AFTER = "(?![\\p{L}\\p{N}])(?![\\-_./][\\p{L}\\p{N}])";
function exactRe(model) {
  const body = model.trim().split(/\s+/).map(escapeRe).join("\\s+");
  return new RegExp(BEFORE + body + AFTER, "iu");
}
// Loose: same letters and digits, with any spacing or - _ . / between them.
function looseRe(model) {
  const chars = [...model.replace(/[\s\-_./]+/g, "")].map(escapeRe).join("[\\s\\-_./]*");
  return new RegExp(BEFORE + chars + AFTER, "iu");
}

async function readPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const result = { name: file.name, pages: 0, textPages: 0, pageLangs: [], text: "", edgeText: "", printAllowed: null, error: null };
  let doc, task;
  try {
    task = pdfjsLib.getDocument({ data, isEvalSupported: false, enableXfa: false, verbosity: 0 });
    doc = await task.promise;
  } catch (e) {
    result.error = e && e.name === "PasswordException"
      ? "The file asks for a password to open."
      : "The file could not be read as a PDF.";
    if (task) task.destroy();
    return result;
  }
  result.pages = doc.numPages;
  const perms = await doc.getPermissions();
  if (perms) {
    const P = pdfjsLib.PermissionFlag;
    const has = (f) => (typeof perms.has === "function" ? perms.has(f) : [...perms].includes(f));
    result.printAllowed = has(P.PRINT) || has(P.PRINT_HIGH_QUALITY);
  } else {
    result.printAllowed = true;
  }
  const n = Math.min(doc.numPages, MAX_PAGES);
  const texts = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const t = tc.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("");
    texts.push(t);
    if (t.trim().length > 40) result.textPages++;
    result.pageLangs.push(detectLanguage(t));
    page.cleanup();
  }
  result.truncated = doc.numPages > MAX_PAGES;
  result.text = texts.join("\n");
  // Revision strings come from the real last two pages, even when the file is longer than MAX_PAGES.
  // Each of the last two pages comes from the pages already read, or is read now.
  const tail = [];
  for (let i = Math.max(1, doc.numPages - 1); i <= doc.numPages; i++) {
    if (i <= n) {
      tail.push(texts[i - 1]);
      continue;
    }
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    tail.push(tc.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join(""));
    page.cleanup();
  }
  result.edgeText = texts.slice(0, 2).concat(tail).join("\n");
  await task.destroy();
  return result;
}

// Pages with no detected language (drawings, tables) do not split a run if the same
// language continues within two pages.
function langRuns(pageLangs) {
  const runs = [];
  pageLangs.forEach((l, i) => {
    if (!l) return;
    const last = runs[runs.length - 1];
    if (last && last.lang === l && i + 1 - last.to <= 3) last.to = i + 1;
    else runs.push({ lang: l, from: i + 1, to: i + 1 });
  });
  return runs;
}

function revCandidates(text) {
  const found = new Set();
  for (const re of REV_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const s = m[0].replace(/\s+/g, " ").trim();
      if (/[^\p{L}][a-z]$/u.test(s)) continue; // "Rev. a" is a word, not a revision letter
      found.add(s);
    }
  }
  return [...found].slice(0, 12);
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}

function selectedLangs() {
  return [...document.querySelectorAll("#langs input:checked")].map((i) => i.value);
}
function models() {
  return document.getElementById("models").value.split("\n").map((s) => s.trim()).filter(Boolean);
}

function render(files) {
  const out = document.getElementById("results");
  out.replaceChildren();
  const lines = [];
  const say = (node, text) => { out.append(node); if (text) lines.push(text); };

  say(el("p", { class: "pc-note" }, "This report checks files, not compliance. It does not tell you whether a product meets the regulation."),
    "This report checks files, not compliance. It does not tell you whether a product meets the regulation.");

  // Languages across the package
  const found = new Map();
  for (const f of files) f.pageLangs.forEach((l) => { if (l) found.set(l, (found.get(l) || 0) + 1); });
  const want = selectedLangs();
  say(el("h3", {}, "Languages"), "\nLanguages");
  if (want.length) {
    const missing = want.filter((l) => !found.has(l));
    const t = missing.length
      ? "Not detected in any file: " + missing.map((l) => LANGS[l].name).join(", ")
      : "All selected languages were detected in at least one file.";
    say(el("p", { class: missing.length ? "pc-warn" : "pc-ok" }, t), t);
  } else {
    say(el("p", {}, "No required languages selected."), "No required languages selected.");
  }
  const seen = [...found.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${LANGS[l].name} (${n} page${n > 1 ? "s" : ""})`).join(", ");
  say(el("p", {}, "Detected: " + (seen || "none")), "Detected: " + (seen || "none"));
  // A cover or contents page that mixes languages can be assigned one of them, so a language seen
  // on a single page may not have its own section.
  const single = want.filter((l) => found.get(l) === 1);
  if (single.length) {
    const t = "Detected on only one page, so check that each has its own section: " + single.map((l) => LANGS[l].name).join(", ");
    say(el("p", { class: "pc-warn" }, t), t);
  }

  // Per file
  const mods = models();
  for (const f of files) {
    const box = el("section", { class: "pc-file" }, el("h3", {}, f.name));
    lines.push("\n" + f.name);
    const add = (cls, t) => { box.append(el("p", { class: cls }, t)); lines.push("- " + t); };
    if (f.error) { add("pc-warn", f.error); out.append(box); continue; }
    add("", `${f.pages} page${f.pages > 1 ? "s" : ""}` + (f.truncated ? ` (languages and model designations were checked on the first ${MAX_PAGES})` : ""));
    if (f.textPages === 0) add("pc-warn", "No page had enough extractable text, so the language and model checks did not run. The file may be scanned images.");
    else if (f.textPages < Math.min(f.pages, MAX_PAGES)) add("", `${Math.min(f.pages, MAX_PAGES) - f.textPages} page(s) have little or no extractable text.`);
    add(f.printAllowed ? "pc-ok" : "pc-warn", f.printAllowed ? "Printing is allowed by the PDF's settings." : "The PDF's security settings do not allow printing.");
    const runs = langRuns(f.pageLangs).filter((r) => r.lang);
    if (runs.length) add("", "Languages by page: " + runs.map((r) => `${LANGS[r.lang].name} ${r.from === r.to ? "p." + r.from : "pp." + r.from + "-" + r.to}`).join("; "));
    if (mods.length && f.textPages) {
      for (const m of mods) {
        if (exactRe(m).test(f.text)) add("pc-ok", `Model "${m}": found.`);
        else if (looseRe(m).test(f.text)) add("pc-ok", `Model "${m}": found with different spacing or punctuation.`);
        else add("pc-warn", `Model "${m}": not found.`);
      }
    }
    const revs = revCandidates(f.edgeText);
    add("pc-ref", "For reference, revision or date strings on the first two and last two pages: " + (revs.length ? revs.join(" | ") : "none found"));
    out.append(box);
  }

  const copy = el("button", { type: "button" }, "Copy report as text");
  copy.addEventListener("click", () => navigator.clipboard.writeText(lines.join("\n")).then(() => { copy.textContent = "Copied"; }));
  out.append(copy);
}

async function run(fileList) {
  const pdfs = [...fileList].filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  const status = document.getElementById("status");
  if (!pdfs.length) { status.textContent = "Select one or more PDF files."; return; }
  const results = [];
  for (const [i, f] of pdfs.entries()) {
    status.textContent = `Reading ${i + 1} of ${pdfs.length}: ${f.name}`;
    try {
      results.push(await readPdf(f));
    } catch (e) {
      results.push({ name: f.name, error: "The file could not be read: " + (e && e.message ? e.message : e) });
    }
  }
  status.textContent = `Read ${pdfs.length} file${pdfs.length > 1 ? "s" : ""}. Nothing was uploaded.`;
  window.__lastResults = results;
  render(results);
}

function init() {
  const box = document.getElementById("langs");
  for (const [code, l] of Object.entries(LANGS)) {
    box.append(el("label", {}, el("input", { type: "checkbox", value: code }), " " + l.name));
  }
  const input = document.getElementById("files");
  input.addEventListener("change", () => run(input.files));
  const drop = document.getElementById("drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("pc-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("pc-over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("pc-over"); run(e.dataTransfer.files); });
  document.getElementById("rerun").addEventListener("click", () => { if (window.__lastResults) render(window.__lastResults); });
}

init();

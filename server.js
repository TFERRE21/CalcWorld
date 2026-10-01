const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const ANALYTICS_FILE = process.env.ANALYTICS_FILE || path.join(ROOT, ".data", "analytics.json");
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD_HASH = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || "").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
// CalcWorld deployment marker: keep ICP webhook releases aligned with main.
const MARKET_CACHE_MS = 60 * 1000;
const marketCache = new Map();
const researchCache = new Map();
const researchLimits = new Map();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

const sessions = new Map();
const loginAttempts = new Map();
const VISIT_WINDOW_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function ensureAnalyticsFile() {
  const dir = path.dirname(ANALYTICS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(ANALYTICS_FILE)) {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify({ version: 1, days: {} }, null, 2));
  }
}

function readAnalytics() {
  ensureAnalyticsFile();
  try {
    const raw = fs.readFileSync(ANALYTICS_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.days) throw new Error("Invalid analytics data");
    return data;
  } catch {
    return { version: 1, days: {} };
  }
}

function writeAnalytics(data) {
  ensureAnalyticsFile();
  const tmp = ANALYTICS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, ANALYTICS_FILE);
}

function dateKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.ANALYTICS_TIMEZONE || "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function cleanPath(value) {
  if (typeof value !== "string") return "/";
  const p = value.split("?")[0].split("#")[0].trim();
  if (!p.startsWith("/") || p.length > 500) return "/";
  return p.replace(/\\/g, "/") || "/";
}

function hashVisitorId(id) {
  return crypto.createHash("sha256")
    .update(SESSION_SECRET || "calcworld-analytics")
    .update(String(id))
    .digest("hex");
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const match = header.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (options.maxAge != null) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function clearCookie(res, name) {
  res.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

function sameOrigin(req) {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}

function passwordMatches(password, stored) {
  try {
    const [scheme, n, r, p, salt, digest] = stored.split("$");
    if (scheme !== "scrypt" || !n || !r || !p || !salt || !digest) return false;
    const derived = crypto.scryptSync(password, Buffer.from(salt, "base64"), 64, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024
    });
    const expected = Buffer.from(digest, "base64");
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function sessionFor(req) {
  const token = getCookie(req, "cw_admin");
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function requireAdmin(req, res, next) {
  if (!SESSION_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
    return res.status(503).json({ error: "Admin is not configured." });
  }
  if (!sessionFor(req)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.post("/api/analytics/visit", (req, res) => {
  try {
    const pathName = cleanPath(req.body?.path);
    let visitorId = getCookie(req, "cw_vid");
    if (!visitorId || visitorId.length < 20 || visitorId.length > 100) {
      visitorId = crypto.randomUUID();
      setCookie(res, "cw_vid", visitorId, { maxAge: 31536000000 });
    }

    const now = Date.now();
    const visitCookie = getCookie(req, "cw_visit");
    const lastVisit = visitCookie ? Number(visitCookie) : 0;
    const isVisit = !Number.isFinite(lastVisit) || now - lastVisit >= VISIT_WINDOW_MS;
    if (isVisit) setCookie(res, "cw_visit", String(now), { maxAge: 86400000 });

    const data = readAnalytics();
    const day = dateKey();
    const entry = data.days[day] || { visits: 0, pageviews: 0, uniqueVisitors: 0, pages: {}, visitorKeys: [] };
    entry.pageviews += 1;
    entry.pages[pathName] = (entry.pages[pathName] || 0) + 1;

    if (isVisit) {
      entry.visits += 1;
      const visitorKey = hashVisitorId(visitorId);
      if (!entry.visitorKeys.includes(visitorKey)) {
        entry.visitorKeys.push(visitorKey);
        entry.uniqueVisitors += 1;
      }
    }

    // Keep the daily unique list bounded for large traffic volumes.
    if (entry.visitorKeys.length > 100000) entry.visitorKeys = entry.visitorKeys.slice(-100000);
    data.days[day] = entry;
    writeAnalytics(data);
    res.status(204).end();
  } catch (error) {
    console.error("analytics error", error.message);
    res.status(204).end();
  }
});

app.post("/api/admin/login", (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  if (!SESSION_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
    return res.status(503).json({ error: "Configure ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET in the hosting environment." });
  }

  const ip = req.ip || "unknown";
  const attempt = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
  if (attempt.resetAt < Date.now()) {
    attempt.count = 0;
    attempt.resetAt = Date.now() + 15 * 60 * 1000;
  }
  if (attempt.count >= 10) return res.status(429).json({ error: "Too many attempts. Try again later." });

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const valid = email === ADMIN_EMAIL && passwordMatches(password, ADMIN_PASSWORD_HASH);
  if (!valid) {
    attempt.count += 1;
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: "Invalid credentials." });
  }
  loginAttempts.delete(ip);

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  const secure = req.secure || req.get("x-forwarded-proto") === "https";
  setCookie(res, "cw_admin", token, { maxAge: SESSION_TTL_MS, secure });
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ ok: true }));

app.post("/api/admin/logout", (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  const token = getCookie(req, "cw_admin");
  if (token) sessions.delete(token);
  clearCookie(res, "cw_admin");
  res.json({ ok: true });
});

app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  const data = readAnalytics();
  const days = Object.keys(data.days).sort();
  const today = dateKey();
  const toDay = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: process.env.ANALYTICS_TIMEZONE || "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit"
    }).format(d);
  };
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const key = toDay(-i);
    const e = data.days[key] || {};
    last30.push({ date: key, visits: e.visits || 0, pageviews: e.pageviews || 0, uniqueVisitors: e.uniqueVisitors || 0 });
  }

  const aggregate = (list) => list.reduce((a, e) => ({
    visits: a.visits + (e.visits || 0),
    pageviews: a.pageviews + (e.pageviews || 0),
    uniqueVisitors: a.uniqueVisitors + (e.uniqueVisitors || 0)
  }), { visits: 0, pageviews: 0, uniqueVisitors: 0 });

  const seven = last30.slice(-7);
  const todayEntry = data.days[today] || {};
  const yesterdayKey = toDay(-1);  const yesterdayEntry = data.days[yesterdayKey] || {};
  const allEntries = days.map(k => data.days[k]);
  const total = aggregate(allEntries);
  const topPages = Object.entries(todayEntry.pages || {})
    .sort((a,b) => b[1] - a[1]).slice(0, 10)
    .map(([page, views]) => ({ page, views }));

  res.json({
    timezone: process.env.ANALYTICS_TIMEZONE || "America/Sao_Paulo",
    today,
    today: { date: today, visits: todayEntry.visits || 0, pageviews: todayEntry.pageviews || 0, uniqueVisitors: todayEntry.uniqueVisitors || 0 },
    yesterday: { date: yesterdayKey, visits: yesterdayEntry.visits || 0, pageviews: yesterdayEntry.pageviews || 0, uniqueVisitors: yesterdayEntry.uniqueVisitors || 0 },
    last7: aggregate(seven),
    last30: aggregate(last30),
    total,
    chart: last30,
    topPages,
    daysTracked: days.length
  });
});


function safeMarketParam(value, fallback = "") {
  return String(value || fallback).trim().slice(0, 120).replace(/[^\w./:+ -]/g, "");
}
async function openAIJson(prompt, cacheKey, ttl = MARKET_CACHE_MS) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const cached = marketCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "developer",
          content: "Você é o motor de dados de mercado do CalcWorld. Pesquise a web antes de responder. Use fontes atuais e confiáveis, priorizando fontes oficiais, bolsas, emissores e provedores financeiros reconhecidos. Nunca invente preço, data, variação ou série histórica. Se não conseguir confirmar um dado, use null ou lista vazia. Responda SOMENTE com JSON válido, sem markdown, sem comentários e sem texto fora do JSON."
        },
        { role: "user", content: prompt }
      ],
      max_output_tokens: 5000,
      store: false
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("OpenAI market error:", data?.error?.message || response.status);
    throw new Error(data?.error?.message || "OpenAI não conseguiu consultar os dados de mercado.");
  }

  const raw = data.output_text || data.output
    ?.filter(item => item.type === "message")
    ?.flatMap(item => item.content || [])
    ?.filter(part => part.type === "output_text")
    ?.map(part => part.text)
    ?.join("\n") || "";

  const cleaned = String(raw).trim()
    .replace(new RegExp("^" + String.fromCharCode(96,96,96) + "json\\s*", "i"), "")
    .replace(new RegExp(String.fromCharCode(96,96,96) + "$"), "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("A resposta da pesquisa de mercado não veio em formato válido.");
  }

  const result = { ...parsed, provider: "OpenAI Web Search", fetchedAt: new Date().toISOString() };
  marketCache.set(cacheKey, { expiresAt: Date.now() + ttl, data: result });
  return result;
}

function periodDescription(period) {
  return ({
    "24h": "últimas 24 horas, com pontos horários quando disponíveis",
    "1m": "último mês, com pontos diários ou semanais representativos",
    "6m": "últimos 6 meses, com pontos semanais ou diários representativos",
    "1y": "último ano, com pontos semanais ou mensais representativos",
    "5y": "últimos 5 anos, com pontos mensais ou trimestrais representativos",
    "max": "todo o histórico disponível, com pontos representativos ao longo de toda a série"
  })[period] || "último ano";
}

async function fetchBinance(path) {
  const response = await fetch("https://api.binance.com" + path, { headers: { "Accept": "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.msg || "Binance indisponível");
  return data;
}

async function fetchBinanceCryptoQuote(symbol, displayCurrency, period) {
  const coin = String(symbol || "").split("/")[0].trim().toUpperCase();
  if (!/^[A-Z0-9]{2,15}$/.test(coin)) return null;

  const quoteCandidates = displayCurrency === "BRL" ? ["BRL", "USDT"] : displayCurrency === "USD" ? ["USDT"] : [displayCurrency, "USDT"];
  let pair = null;
  let ticker = null;
  for (const quote of quoteCandidates) {
    const candidate = coin + quote;
    try {
      ticker = await fetchBinance("/api/v3/ticker/24hr?symbol=" + encodeURIComponent(candidate));
      if (ticker && Number.isFinite(Number(ticker.lastPrice))) { pair = candidate; break; }
    } catch {}
  }
  if (!pair || !ticker) return null;

  let conversion = 1;
  let outputCurrency = displayCurrency;
  if (displayCurrency === "BRL" && pair.endsWith("USDT")) {
    try {
      const fx = await fetchBinance("/api/v3/ticker/price?symbol=USDTBRL");
      const rate = Number(fx.price);
      if (Number.isFinite(rate) && rate > 0) conversion = rate;
    } catch {}
  } else if (displayCurrency !== "USDT" && pair.endsWith("USDT") && displayCurrency !== "USD") {
    outputCurrency = "USD";
  }

  const price = Number(ticker.lastPrice) * conversion;
  const change = Number(ticker.priceChange) * conversion;
  const percentChange = Number(ticker.priceChangePercent);
  const ranges = {"24h":["1d","1h"],"1m":["1mo","1d"],"6m":["6mo","1d"],"1y":["1y","1d"],"5y":["5y","1wk"],"max":["5y","1mo"]};
  const [range, interval] = ranges[period] || ranges["1y"];
  let values = [];
  try {
    const klines = await fetchBinance("/api/v3/klines?symbol=" + encodeURIComponent(pair) + "&interval=" + interval + "&limit=1000");
    values = (Array.isArray(klines) ? klines : []).map(k => ({
      datetime: new Date(Number(k[0])).toISOString(),
      close: Number(k[4]) * conversion
    })).filter(x => x.datetime && Number.isFinite(x.close) && x.close > 0);
  } catch {}

  return {
    symbol: coin + "/" + outputCurrency,
    name: coin,
    exchange: "BINANCE",
    type: "crypto",
    currency: outputCurrency,
    price,
    previousClose: price - change,
    change,
    percentChange,
    datetime: new Date(Number(ticker.closeTime || Date.now())).toISOString(),
    values,
    sourceNote: "Cotação e histórico consultados diretamente na Binance, sem necessidade de token.",
    sources: [{title:"Binance API",url:"https://www.binance.com/"}],
    provider: "Binance",
    fetchedAt: new Date().toISOString()
  };
}

async function fetchBinanceCryptoCatalog(q = "", limit = 60, page = 1) {
  const data = await fetchBinance("/api/v3/exchangeInfo");
  const symbols = Array.isArray(data.symbols) ? data.symbols : [];
  const query = String(q || "").trim().toUpperCase();
  const seen = new Set();
  const rows = [];
  for (const x of symbols) {
    if (x.status !== "TRADING" || x.isSpotTradingAllowed === false) continue;
    const quote = String(x.quoteAsset || "").toUpperCase();
    if (!["USDT","USDC","FDUSD","BRL","BTC","ETH"].includes(quote)) continue;
    const base = String(x.baseAsset || "").toUpperCase();
    if (!base || seen.has(base)) continue;
    if (query && !base.includes(query) && !String(x.symbol || "").includes(query)) continue;
    seen.add(base);
    rows.push({symbol:base + "/USDT",name:base,exchange:"BINANCE",type:"crypto",currency:"USD"});
  }
  rows.sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const start=(Math.max(1,page)-1)*limit;
  return {rows:rows.slice(start,start+limit),total:rows.length,hasNextPage:start+limit<rows.length};
}

async function fetchBrapi(path, options = {}) {
  const headers = { "Accept": "application/json", ...(options.headers || {}) };
  if (process.env.BRAPI_API_KEY) headers.Authorization = "Bearer " + process.env.BRAPI_API_KEY;
  const response = await fetch("https://brapi.dev" + path, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "brapi indisponível");
  return data;
}

app.get("/api/market/catalog", async (req, res) => {
  try {
    const type = String(req.query.type || "stock").trim().slice(0, 20);
    const q = String(req.query.q || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(20, Number.parseInt(req.query.limit || "50", 10) || 50));
    const cacheKey = ["catalog", type, q.toLowerCase(), page, limit].join(":");
    const cached = marketCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.data);

    let rows = [];
    let total = null;
    let hasNextPage = false;
    let source = "OpenAI Web Search";

    if (type === "crypto") {
      try {
        const binance = await fetchBinanceCryptoCatalog(q, limit, page);
        rows = binance.rows;
        total = binance.total;
        hasNextPage = binance.hasNextPage;
        source = "Binance";
      } catch {
        try {
          const data = await fetchBrapi("/api/v2/crypto/available" + (q ? "?search=" + encodeURIComponent(q) : ""));
          rows = (Array.isArray(data.coins) ? data.coins : []).map(symbol => ({
            symbol: String(symbol) + "/USDT", name: String(symbol), exchange: "CRYPTO", type: "crypto", currency: "USD"
          }));
          source = "brapi.dev";
        } catch {}
      }
    } else if (type === "fx") {
      try {
        const data = await fetchBrapi("/api/v2/currency/available" + (q ? "?search=" + encodeURIComponent(q) : ""));
        rows = (Array.isArray(data.currencies) ? data.currencies : []).map(x => ({
          symbol: String(x.name || ""), name: String(x.currency || x.name || ""), exchange: "FOREX", type: "fx", currency: "BRL"
        })).filter(x => x.symbol);
        source = "brapi.dev / Banco Central";
      } catch {}
    } else {
      const subtype = type === "fii" ? "fii" : type === "stock" ? "stock" : "";
      try {
        const params = new URLSearchParams({
          limit: String(limit), page: String(page), ...(subtype ? { subType: subtype } : { type: "fund" }),
          sortBy: "name", sortOrder: "asc"
        });
        if (q) params.set("search", q);
        const data = await fetchBrapi("/api/quote/list?" + params.toString());
        rows = (Array.isArray(data.stocks) ? data.stocks : []).map(x => ({
          symbol: String(x.stock || ""), name: String(x.name || x.stock || ""), exchange: "BVMF",
          type: String(x.subType || x.type || type), currency: "BRL"
        })).filter(x => x.symbol);
        total = Number.isFinite(Number(data.totalCount)) ? Number(data.totalCount) : null;
        hasNextPage = Boolean(data.hasNextPage);
        source = "brapi.dev / B3";
      } catch {}
    }

    if (!rows.length) {
      const typeLabel = ({crypto:"criptomoedas",stock:"ações, BDRs e ETFs",fii:"fundos imobiliários e FIAGROs",fund:"ETFs e fundos",fx:"moedas e pares cambiais"})[type] || "ativos financeiros";
      const prompt = [
        "Monte um catálogo pesquisável de ativos financeiros reais.",
        "Categoria: " + typeLabel,
        q ? "Filtro: " + q : "Sem filtro.",
        "Pesquise fontes de mercado, bolsas, emissores e provedores reconhecidos.",
        "Retorne até " + limit + " ativos confirmados nesta página.",
        "Formato JSON: {data:[{symbol:...,name:...,exchange:...,type:...,country:...,currency:...}],hasNextPage:false}",
        "Não invente símbolos e não repita ativos."
      ].join("\n");
      const data = await openAIJson(prompt, cacheKey + ":ai", 30 * 60 * 1000);
      rows = Array.isArray(data.data) ? data.data.slice(0, limit) : [];
      hasNextPage = Boolean(data.hasNextPage);
    }

    const payload = {
      data: rows.slice(0, limit),
      page,
      limit,
      total,
      hasNextPage,
      source,
      fetchedAt: new Date().toISOString()
    };
    marketCache.set(cacheKey, { expiresAt: Date.now() + 15 * 60 * 1000, data: payload });
    res.json(payload);
  } catch (error) {
    console.error("market catalog error:", error.message);
    res.status(502).json({ error: error.message || "Não foi possível carregar o catálogo." });
  }
});

async function fetchFastCryptoOverview(symbol, displayCurrency, period) {
  try {
    const fast = await fetchBinanceCryptoQuote(symbol, displayCurrency, period);
    if (fast) return fast;
  } catch (error) {
    console.warn("crypto Binance fallback:", error.message);
  }
  const coin = String(symbol || "").split("/")[0].trim().toUpperCase();
  if (!/^[A-Z0-9]{2,15}$/.test(coin)) return null;
  const ranges = {"24h":["1d","1h"],"1m":["1mo","1d"],"6m":["6mo","1d"],"1y":["1y","1d"],"5y":["5y","1wk"],"max":["5y","1mo"]};
  const [range, interval] = ranges[period] || ranges["1y"];
  const query = new URLSearchParams({coin,currency:displayCurrency,range,interval});
  const data = await fetchBrapi("/api/v2/crypto?" + query.toString());
  const item = Array.isArray(data.coins) ? data.coins[0] : null;
  if (!item || !Number.isFinite(Number(item.regularMarketPrice))) return null;
  const history = Array.isArray(item.historicalDataPrice) ? item.historicalDataPrice : [];
  const values = history.map(x => ({datetime:String(x.date || x.datetime || x.timestamp || ""),close:Number(x.close ?? x.regularMarketPrice ?? x.price)})).filter(x => x.datetime && Number.isFinite(x.close));
  const previousClose = Number(item.regularMarketPrice) - Number(item.regularMarketChange || 0);
  return {symbol:coin+"/"+displayCurrency,name:item.coinName||coin,exchange:"CRYPTO",type:"crypto",currency:item.currency||displayCurrency,price:Number(item.regularMarketPrice),previousClose:Number.isFinite(previousClose)?previousClose:0,change:Number(item.regularMarketChange||0),percentChange:Number(item.regularMarketChangePercent||0),datetime:item.regularMarketTime||data.requestedAt||null,values,sourceNote:"Cotação e histórico consultados pela API de mercado.",sources:[{title:"brapi.dev",url:"https://brapi.dev/docs/criptomoedas"}],provider:"brapi.dev",fetchedAt:new Date().toISOString()};
}
function typeFromSymbol(symbol) {
  const s = String(symbol || "").toUpperCase();
  if (/11$/.test(s)) return "fii";
  return "stock";
}

async function fetchFastMarketOverview(symbol, exchange, type, displayCurrency, period) {
  const clean = String(symbol || "").trim().toUpperCase();
  if (type === "fx") {
    const pair = clean.replace("/", "-");
    const data = await fetchBrapi("/api/v2/currency?currency=" + encodeURIComponent(pair));
    const item = Array.isArray(data.currency) ? data.currency[0] : null;
    if (!item) return null;
    const price = Number(item.bidPrice ?? item.askPrice);
    if (!Number.isFinite(price)) return null;
    return {symbol:clean,name:item.name||clean,exchange:"FOREX",type:"fx",currency:displayCurrency,price,previousClose:price-Number(item.bidVariation||0),change:Number(item.bidVariation||0),percentChange:Number(item.percentageChange||0),datetime:item.updatedAtDate||data.requestedAt||null,values:[],sourceNote:"Cotação PTAX consultada diretamente pela brapi.dev / Banco Central.",sources:[{title:"brapi.dev — moedas",url:"https://brapi.dev/docs/moedas"}],provider:"brapi.dev",fetchedAt:new Date().toISOString()};
  }
  if (!clean) return null;
  if (type === "crypto" || clean.includes("/")) {
    return fetchFastCryptoOverview(clean, displayCurrency, period);
  }
  const ranges = {"24h":["1d","1h"],"1m":["1mo","1d"],"6m":["6mo","1d"],"1y":["1y","1wk"],"5y":["5y","1mo"],"max":["5y","1mo"]};
  const [range, interval] = ranges[period] || ranges["1y"];
  let quoteData;
  try {
    quoteData = await fetchBrapi("/api/quote/" + encodeURIComponent(clean) + "?range=" + range + "&interval=" + interval);
  } catch {
    quoteData = await fetchBrapi("/api/v2/stocks/quote?symbols=" + encodeURIComponent(clean));
  }
  const item = Array.isArray(quoteData.results) ? (quoteData.results[0]?.data || quoteData.results[0]) : (Array.isArray(quoteData.stocks) ? quoteData.stocks[0] : null);
  if (!item) return null;
  const price = Number(item.regularMarketPrice ?? item.close);
  if (!Number.isFinite(price)) return null;
  const previousClose = Number(item.regularMarketPreviousClose ?? item.previousClose ?? (price - Number(item.regularMarketChange || item.change || 0)));
  const change = Number(item.regularMarketChange ?? item.change ?? 0);
  const percentChange = Number(item.regularMarketChangePercent ?? item.changePercent ?? 0);
  const history = Array.isArray(item.historicalDataPrice) ? item.historicalDataPrice : [];
  const values = history.map(x => ({datetime:String(x.date || x.datetime || x.timestamp || ""),close:Number(x.close ?? x.adjustedClose)})).filter(x=>x.datetime&&Number.isFinite(x.close));
  return {
    symbol: clean,
    name: item.shortName || item.longName || item.name || clean,
    exchange: exchange || "BVMF",
    type: type || item.type || item.subType || "stock",
    currency: item.currency || displayCurrency || "BRL",
    price,
    previousClose: Number.isFinite(previousClose) ? previousClose : 0,
    change: Number.isFinite(change) ? change : 0,
    percentChange: Number.isFinite(percentChange) ? percentChange : 0,
    datetime: item.regularMarketTime || quoteData.requestedAt || null,
    values,
    sourceNote: "Cotação consultada diretamente pela API de mercado.",    sources: [{title:"brapi.dev",url:"https://brapi.dev/docs"}],
    provider:"brapi.dev",
    fetchedAt:new Date().toISOString()
  };
}

app.get("/api/market/quote-fast", async (req, res) => {
  try {
    const symbol = safeMarketParam(req.query.symbol);
    const exchange = safeMarketParam(req.query.exchange);
    const displayCurrency = safeMarketParam(req.query.currency, "BRL").toUpperCase();
    const requestedType = safeMarketParam(req.query.type, "").toLowerCase();
    if (!symbol) return res.status(400).json({ error: "Informe o símbolo do ativo." });
    const detectedType = requestedType || (exchange.toUpperCase() === "CRYPTO" ? "crypto" : typeFromSymbol(symbol));
    const data = await fetchFastMarketOverview(symbol, exchange, detectedType, displayCurrency, "24h");
    if (!data) return res.status(502).json({ error: "Cotação rápida indisponível para este ativo." });
    data.values = [];
    res.json(data);
  } catch (error) {
    console.error("market quote-fast error:", error.message);
    res.status(502).json({ error: error.message || "Não foi possível obter a cotação rápida." });
  }
});

app.get("/api/market/history-fast", async (req, res) => {
  try {
    const symbol = safeMarketParam(req.query.symbol);
    const exchange = safeMarketParam(req.query.exchange);
    const period = safeMarketParam(req.query.period, "1y");
    const displayCurrency = safeMarketParam(req.query.currency, "BRL").toUpperCase();
    const requestedType = safeMarketParam(req.query.type, "").toLowerCase();
    if (!symbol) return res.status(400).json({ error: "Informe o símbolo do ativo." });
    const detectedType = requestedType || (exchange.toUpperCase() === "CRYPTO" ? "crypto" : typeFromSymbol(symbol));
    const data = await fetchFastMarketOverview(symbol, exchange, detectedType, displayCurrency, period);
    if (!data) return res.status(502).json({ error: "Histórico rápido indisponível para este ativo." });
    res.json({
      symbol: data.symbol,
      currency: data.currency,
      period,
      values: Array.isArray(data.values) ? data.values : [],
      sourceNote: data.sourceNote || "",
      provider: data.provider || "brapi.dev"
    });
  } catch (error) {
    console.error("market history-fast error:", error.message);
    res.status(502).json({ error: error.message || "Não foi possível obter o histórico rápido." });
  }
});

app.get("/api/market/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    const type = String(req.query.type || "").trim().slice(0, 30);
    if (!q) return res.status(400).json({ error: "Informe um ativo para pesquisar." });
    if (type === "crypto") {
      try {
        const data = await fetchBrapi("/api/v2/crypto/available?search=" + encodeURIComponent(q));
        const coins = Array.isArray(data.coins) ? data.coins.slice(0, 50) : [];
        return res.json({data:coins.map(symbol=>({symbol:String(symbol),name:String(symbol),exchange:"CRYPTO",type:"crypto",currency:"BRL"}))});
      } catch {}
    }
    const typeLabel = ({crypto:"criptomoedas",stock:"ações, BDRs e ETFs",fii:"fundos imobiliários e FIAGROs",fund:"ETFs e fundos",fx:"moedas e pares cambiais"})[type] || "ativos financeiros";
    const prompt = [
      "Pesquise na web ativos financeiros reais que correspondam à busca.",
      "Busca: " + q,
      "Categoria solicitada: " + typeLabel,
      "Não fique limitado a uma lista pré-cadastrada. Procure em fontes de mercado, bolsas, emissores e provedores financeiros reconhecidos.",
      "Para uma busca por ticker ou nome, retorne todas as correspondências relevantes que conseguir confirmar, até o limite técnico.",
      "Retorne JSON exatamente neste formato:",
      '{"data":[{"symbol":"...","name":"...","exchange":"...","type":"...","country":"...","currency":"..."}]}',
      "Máximo 50 resultados. Não crie símbolos. Inclua somente ativos confirmados."
    ].join("\n");
    const data = await openAIJson(prompt,"ai-search:"+type+":"+q.toLowerCase().replace(/\s+/g," "),10*60*1000);
    res.json({data:Array.isArray(data.data)?data.data.slice(0,50):[]});
  } catch(error) {
    console.error("market search error:",error.message);
    res.status(502).json({error:error.message||"Não foi possível pesquisar esse ativo agora."});
  }
});

app.get("/api/market/overview", async (req, res) => {
  try {
    const symbol = safeMarketParam(req.query.symbol);
    const exchange = safeMarketParam(req.query.exchange);
    const period = safeMarketParam(req.query.period, "1y");
    const displayCurrency = safeMarketParam(req.query.currency, "BRL").toUpperCase();
    const requestedType = safeMarketParam(req.query.type, "").toLowerCase();
    if (!symbol) return res.status(400).json({ error: "Informe o símbolo do ativo." });

    const detectedType = requestedType || (exchange.toUpperCase() === "CRYPTO" ? "crypto" : typeFromSymbol(symbol));
    try {
      const fast = await fetchFastMarketOverview(symbol, exchange, detectedType, displayCurrency, period);
      if (fast) return res.json(fast);
    } catch (fastError) {
      console.warn("market fast path fallback:", fastError.message);
    }

    const prompt = [
      "Pesquise na web o ativo financeiro identificado abaixo e monte um retrato de mercado atual + histórico.",
      "Ativo: " + symbol,
      "Mercado/bolsa informado: " + (exchange || "não informado"),
      "Período solicitado: " + periodDescription(period),
      "Moeda de exibição solicitada: " + displayCurrency,
      "",
      "REGRAS IMPORTANTES:",
      "1. O preço atual deve ser o último preço verificável encontrado na web. Informe a data/hora da cotação.",
      "2. previousClose deve ser o fechamento anterior verificável. percentChange deve ser a variação percentual entre preço atual e fechamento anterior quando possível.",
      "3. Para o histórico, forneça pontos cronológicos REAIS encontrados ou derivados de dados históricos confiáveis. Não invente pontos para preencher o gráfico. Use entre 12 e 40 pontos, conforme a disponibilidade.",
      "4. Cada ponto deve ter datetime ISO ou YYYY-MM-DD e close numérico.",
      "5. Se a fonte estiver em outra moeda, converta para " + displayCurrency + " somente se conseguir confirmar uma taxa cambial atual. Informe que a conversão exibida usa câmbio de referência atual.",
      "6. Para cripto, ações, FIIs e ETFs, identifique claramente o ativo e o mercado. Para câmbio, trate o par como o próprio ativo.",
      "7. Se não for possível confirmar preço ou histórico, retorne null/lista vazia em vez de estimar.",
      "",
      "Retorne SOMENTE este JSON:",
      '{"symbol":"...","name":"...","exchange":"...","type":"...","currency":"BRL","price":0,"previousClose":0,"change":0,"percentChange":0,"datetime":"...","values":[{"datetime":"...","close":0,"open":0,"high":0,"low":0,"volume":0}],"sourceNote":"...","sources":[{"title":"...","url":"https://..."}]}'
    ].join("\n");

    const data = await openAIJson(
      prompt,
      ["ai-market", symbol, exchange, period, displayCurrency].join(":"),
      MARKET_CACHE_MS
    );

    const values = Array.isArray(data.values) ? data.values.map(x => ({
      datetime: String(x.datetime || ""),
      close: Number(x.close),
      open: Number(x.open ?? x.close),
      high: Number(x.high ?? x.close),
      low: Number(x.low ?? x.close),
      volume: Number(x.volume || 0)
    })).filter(x => x.datetime && Number.isFinite(x.close)) : [];

    res.json({
      symbol: data.symbol || symbol,
      name: data.name || symbol,
      exchange: data.exchange || exchange,
      type: data.type || null,
      currency: data.currency || displayCurrency,
      price: Number.isFinite(Number(data.price)) ? Number(data.price) : null,
      previousClose: Number.isFinite(Number(data.previousClose)) ? Number(data.previousClose) : 0,
      change: Number.isFinite(Number(data.change)) ? Number(data.change) : 0,
      percentChange: Number.isFinite(Number(data.percentChange)) ? Number(data.percentChange) : 0,
      datetime: data.datetime || null,
      values,
      sourceNote: data.sourceNote || "",
      sources: Array.isArray(data.sources) ? data.sources.slice(0, 8) : [],
      provider: "OpenAI Web Search",
      fetchedAt: data.fetchedAt
    });
  } catch (error) {
    console.error("market overview error:", error.message);
    res.status(502).json({ error: error.message || "Não foi possível obter os dados de mercado." });
  }
});

app.get("/api/market/backtest", async (req, res) => {
  try {
    const symbol = safeMarketParam(req.query.symbol);
    const exchange = safeMarketParam(req.query.exchange);
    const date = safeMarketParam(req.query.date);
    const currency = safeMarketParam(req.query.currency, "BRL").toUpperCase();
    if (!symbol || !date) return res.status(400).json({ error: "Informe o ativo e a data do investimento." });
    // Caminho rápido: tenta o histórico estruturado antes da pesquisa por IA.
    try {
      const requestedType = safeMarketParam(req.query.type, "").toLowerCase();
      const detectedType = requestedType || (exchange.toUpperCase() === "CRYPTO" ? "crypto" : typeFromSymbol(symbol));
      let fast = null;
      if (detectedType === "crypto") {
        fast = await fetchFastCryptoOverview(symbol, currency, "max");
      } else if (detectedType !== "fx") {
        fast = await fetchFastMarketOverview(symbol, exchange, detectedType, currency, "max");
      }
      const values = Array.isArray(fast?.values) ? fast.values : [];
      if (values.length) {
        const target = date.slice(0, 10);
        const ordered = values
          .map(x => ({ date: String(x.datetime || "").slice(0,10), close: Number(x.close) }))
          .filter(x => x.date && Number.isFinite(x.close) && x.close > 0)
          .sort((a,b) => a.date.localeCompare(b.date));
        const start = ordered.filter(x => x.date <= target).pop() || ordered[0];
        const end = ordered[ordered.length - 1];
        if (start && end && start.close > 0 && end.close > 0) {
          return res.json({
            symbol: fast.symbol || symbol,
            name: fast.name || symbol,
            currency: fast.currency || currency,
            requestedDate: date,
            start,
            end,
            events: [],
            sourceNote: "Simulação calculada com histórico estruturado da brapi.dev.",
            sources: [{title:"brapi.dev",url:"https://brapi.dev/docs"}],
            provider: "brapi.dev"
          });
        }
      }
    } catch (fastError) {
      console.warn("market backtest fast path fallback:", fastError.message);
    }

    const prompt = [
      "Pesquise na web dados históricos verificáveis para calcular uma simulação de investimento.",
      "Ativo: " + symbol,
      "Mercado/bolsa: " + (exchange || "não informado"),
      "Data pretendida do investimento: " + date,
      "Moeda de exibição: " + currency,
      "",
      "REGRAS:",
      "1. Encontre o fechamento real da data pretendida. Se não houver pregão nessa data, use o pregão imediatamente anterior e informe a data efetivamente usada.",
      "2. Encontre o último preço/fechamento verificável disponível e informe a data.",
      "3. Não invente preços. Se não conseguir confirmar a data inicial ou final, retorne null.",
      "4. Se houver dividendos, juros sobre capital, splits ou desdobramentos no intervalo, NÃO aplique automaticamente ao valor. Apenas liste eventos confirmados separadamente.",
      "5. Se houver conversão de moeda, use uma taxa verificável e informe que a conversão pode usar câmbio de referência.",
      "",
      "Retorne SOMENTE JSON:",
      '{"symbol":"...","name":"...","currency":"' + currency + '","requestedDate":"' + date + '","start":{"date":"YYYY-MM-DD","close":0},"end":{"date":"YYYY-MM-DD","close":0},"events":[{"date":"YYYY-MM-DD","type":"dividend|split|other","value":0,"description":"..."}],"sourceNote":"...","sources":[{"title":"...","url":"https://..."}]}'
    ].join("\n");
    const data = await openAIJson(prompt, ["ai-backtest", symbol, exchange, date, currency].join(":"), MARKET_CACHE_MS);
    const startClose = Number(data?.start?.close);
    const endClose = Number(data?.end?.close);
    const valid = Number.isFinite(startClose) && startClose > 0 && Number.isFinite(endClose) && endClose > 0;
    if (!valid) return res.status(422).json({ error: "Não foi possível confirmar preços históricos suficientes para essa data." });
    res.json({
      symbol: data.symbol || symbol,
      name: data.name || symbol,
      currency: data.currency || currency,
      requestedDate: date,
      start: { date: String(data.start.date || date), close: startClose },
      end: { date: String(data.end.date || "").slice(0,10), close: endClose },
      events: Array.isArray(data.events) ? data.events.slice(0,30) : [],
      sourceNote: data.sourceNote || "",
      sources: Array.isArray(data.sources) ? data.sources.slice(0,8) : [],
      provider: "OpenAI Web Search"
    });
  } catch (error) {
    console.error("market backtest error:", error.message);
    res.status(502).json({ error: error.message || "Não foi possível calcular a simulação histórica." });
  }
});

app.get("/api/market/quote", async (req, res) => {
  try {
    const symbol = safeMarketParam(req.query.symbol);
    const exchange = safeMarketParam(req.query.exchange);
    const currency = safeMarketParam(req.query.currency, "BRL").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "Informe o símbolo do ativo." });
    const data = await openAIJson(
      [
        "Pesquise o preço atual verificável do ativo " + symbol + (exchange ? " na bolsa " + exchange : "") + ".",
        "Retorne SOMENTE JSON no formato:",
        '{"symbol":"...","name":"...","exchange":"...","currency":"' + currency + '","price":0,"previousClose":0,"change":0,"percentChange":0,"datetime":"...","sourceNote":"..."}',
        "Não invente valores. Se não conseguir confirmar, use null."
      ].join("\n"),
      ["ai-quote", symbol, exchange, currency].join(":"),
      MARKET_CACHE_MS
    );
    res.json({ ...data, provider: "OpenAI Web Search" });
  } catch (error) {
    res.status(502).json({ error: error.message || "Não foi possível obter a cotação." });
  }
});

app.get("/api/market/history", async (req, res) => {
  try {
    const symbol = safeMarketParam(req.query.symbol);
    const exchange = safeMarketParam(req.query.exchange);
    const period = safeMarketParam(req.query.period, "1y");
    const currency = safeMarketParam(req.query.currency, "BRL").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "Informe o símbolo do ativo." });
    const data = await openAIJson(
      [
        "Pesquise dados históricos verificáveis do ativo " + symbol + (exchange ? " na bolsa " + exchange : "") + ".",
        "Período: " + periodDescription(period) + ".",
        "Retorne SOMENTE JSON no formato:",
        '{"symbol":"...","currency":"' + currency + '","interval":"' + period + '","values":[{"datetime":"YYYY-MM-DD","close":0}],"sourceNote":"..."}',
        "Use entre 12 e 40 pontos reais e cronológicos. Não invente dados."
      ].join("\n"),
      ["ai-history", symbol, exchange, period, currency].join(":"),
      MARKET_CACHE_MS
    );
    res.json({
      symbol: data.symbol || symbol,
      currency: data.currency || currency,
      interval: period,
      period,
      values: Array.isArray(data.values) ? data.values.map(x => ({ datetime: String(x.datetime || ""), close: Number(x.close) })).filter(x => x.datetime && Number.isFinite(x.close)) : [],
      sourceNote: data.sourceNote || "",
      provider: "OpenAI Web Search"
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "Não foi possível obter o histórico." });
  }
});

app.get("/api/market/currency", async (req, res) => {
  try {
    const from = safeMarketParam(req.query.from, "USD").toUpperCase();
    const to = safeMarketParam(req.query.to, "BRL").toUpperCase();
    if (from === to) return res.json({ from, to, rate: 1, provider: "OpenAI Web Search" });
    const data = await openAIJson(
      [
        "Pesquise a taxa de câmbio atual verificável de " + from + "/" + to + ".",
        "Retorne SOMENTE JSON no formato:",
        '{"from":"' + from + '","to":"' + to + '","rate":0,"datetime":"..."}',
        "Não invente. Se não conseguir confirmar, use null."
      ].join("\n"),
      "ai-fx:" + from + ":" + to,
      MARKET_CACHE_MS
    );
    res.json({ from, to, rate: Number(data.rate), datetime: data.datetime || null, provider: "OpenAI Web Search" });
  } catch (error) {
    res.status(502).json({ error: error.message || "Não foi possível obter o câmbio." });
  }
});

app.post("/api/research", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(503).json({ error: "Pesquisa por IA não configurada no servidor." });

    const ip = String(req.ip || "unknown");
    const now = Date.now();
    const limit = researchLimits.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
    if (limit.resetAt <= now) { limit.count = 0; limit.resetAt = now + 15 * 60 * 1000; }
    if (limit.count >= 8) return res.status(429).json({ error: "Limite de pesquisas atingido. Tente novamente em alguns minutos." });
    limit.count += 1;
    researchLimits.set(ip, limit);
    const question = String(req.body?.question || "").trim().slice(0, 1200);
    if (!question) return res.status(400).json({ error: "Digite uma pergunta." });
    const cacheKey = question.toLowerCase().replace(/\s+/g, " ");
    const cachedResearch = researchCache.get(cacheKey);
    if (cachedResearch && cachedResearch.expiresAt > now) return res.json(cachedResearch.data);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-5",
        tools: [{ type: "web_search" }],
        input: [
          {
            role: "developer",
            content: "Você é o pesquisador do CalcWorld. Responda em português do Brasil. Pesquise na web antes de responder perguntas sobre fatos atuais, preços, investimentos, economia, produtos financeiros ou qualquer assunto que dependa de informação recente. Dê respostas objetivas, explique de onde vieram os dados e diferencie dado atual, histórico, estimativa e opinião. Em investimentos, não faça recomendação personalizada de compra ou venda. Quando a pergunta envolver preço ou desempenho de ativo, informe a data/hora de referência e deixe claro quando a informação puder estar atrasada. Não invente números; se não encontrar dado confiável, diga isso. Ao final, inclua uma pequena seção 'Fontes consultadas' com os principais sites usados."
          },
          { role: "user", content: question }
        ],
        max_output_tokens: 1400,
        store: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI research error:", data?.error?.message || response.status);
      return res.status(502).json({ error: data?.error?.message || "Não foi possível realizar a pesquisa." });
    }

    const textParts = data.output
      ?.filter(item => item.type === "message")
      ?.flatMap(item => item.content || [])
      ?.filter(part => part.type === "output_text") || [];
    const textOutput = textParts.map(part => part.text).join("\n").trim() || data.output_text || "";
    const sources = textParts.flatMap(part => part.annotations || [])
      .filter(a => a.type === "url_citation" && a.url)
      .map(a => ({ title: a.title || a.url, url: a.url }))
      .filter((x, i, arr) => arr.findIndex(y => y.url === x.url) === i)
      .slice(0, 8);

    if (!textOutput) return res.status(502).json({ error: "A pesquisa não retornou conteúdo." });
    const payload = { answer: textOutput, sources };
    researchCache.set(cacheKey, { expiresAt: now + 15 * 60 * 1000, data: payload });
    res.json(payload);
  } catch (error) {
    console.error("research error:", error.message);
    res.status(502).json({ error: "Não foi possível realizar a pesquisa agora." });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "CalcWorld" });
});


/* Site-wide AdSense injection for public HTML pages.
   Calculator pages already have .ad-slot/.ad-slot-02, so they are not duplicated. */
app.get("*", (req, res, next) => {
  try {
    if (req.path.startsWith("/api/") || req.path.startsWith("/admin")) return next();

    let relative = decodeURIComponent(req.path || "/").replace(/^\/+/, "");
    if (!relative) relative = "index.html";
    if (relative.endsWith("/")) relative += "index.html";
    let filePath = path.resolve(ROOT, relative);

    if (!path.extname(relative)) {
      const asHtml = filePath + ".html";
      const asIndex = path.join(filePath, "index.html");
      if (fs.existsSync(asHtml)) filePath = asHtml;
      else if (fs.existsSync(asIndex)) filePath = asIndex;
    }

    if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, "index.html")) return next();
    if (!filePath.endsWith(".html") || !fs.existsSync(filePath)) return next();

    let html = fs.readFileSync(filePath, "utf8");

    // Do not add extra site-wide units where the calculator already has the two managed units.
    const hasManagedAds = html.includes('class="ad-slot"') || html.includes('class="ad-slot-02"');
    if (!hasManagedAds && !html.includes("CalcWorld_Sitewide_Display")) {
      const adScript = `
<script>
(function(){
  var client="ca-pub-6472882150880001";
  var slots=["4923852670","9030618647"];
  function loadAds(){
    if(!window.adsbygoogle) window.adsbygoogle=[];
    document.querySelectorAll(".cw-sitewide-ad").forEach(function(el,i){
      if(el.dataset.adsenseMounted==="1") return;
      el.dataset.adsenseMounted="1";
      var ins=document.createElement("ins");
      ins.className="adsbygoogle";
      ins.style.display="block";
      ins.setAttribute("data-ad-client",client);
      ins.setAttribute("data-ad-slot",slots[i]||slots[0]);
      ins.setAttribute("data-ad-format","auto");
      ins.setAttribute("data-full-width-responsive","true");
      el.innerHTML="";
      el.appendChild(ins);
      window.adsbygoogle.push({});
    });
  }
  function start(){
    if(!document.querySelector(".cw-sitewide-ad")) return;
    if(!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')){
      var s=document.createElement("script");
      s.async=true;
      s.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+client;
      s.crossOrigin="anonymous";
      document.head.appendChild(s);
      s.onload=loadAds;
    } else loadAds();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start);
  else start();
})();
</script>`;

      const firstAd = '<div class="cw-sitewide-ad" style="margin:24px auto;min-height:100px;max-width:970px" aria-label="Publicidade">Publicidade</div>';
      const secondAd = '<div class="cw-sitewide-ad" style="margin:32px auto;min-height:100px;max-width:970px" aria-label="Publicidade">Publicidade</div>';

      if (/<main[^>]*>/i.test(html)) {
        html = html.replace(/(<main[^>]*>)/i, "$1" + firstAd);
      } else {
        html = html.replace(/(<body[^>]*>)/i, "$1" + firstAd);
      }
      if (/<\/main>/i.test(html)) {
        html = html.replace(/<\/main>/i, secondAd + "</main>");
      } else {
        html = html.replace(/<\/body>/i, secondAd + "</body>");
      }
      html = html.replace(/<\/head>/i, '<meta name="google-adsense-account" content="ca-pub-6472882150880001"></head>');
      html = html.replace(/<\/body>/i, '<!-- CalcWorld_Sitewide_Display --></body>');
    }

    res.type("html").send(html);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(ROOT, {
  extensions: ["html"],
  index: "index.html"
}));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  return res.status(404).send("Page not found");
});

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt < now) sessions.delete(token);
  for (const [ip, attempt] of loginAttempts) if (attempt.resetAt < now) loginAttempts.delete(ip);
  for (const [ip, attempt] of researchLimits) if (attempt.resetAt < now) researchLimits.delete(ip);
  for (const [key, item] of researchCache) if (item.expiresAt < now) researchCache.delete(key);
}, 15 * 60 * 1000).unref();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CalcWorld running on port ${PORT}`);
});
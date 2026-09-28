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
const TWELVE_DATA_API_KEY = String(process.env.TWELVE_DATA_API_KEY || "").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
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
  const yesterdayKey = toDay(-1);
  const yesterdayEntry = data.days[yesterdayKey] || {};
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


async function marketFetch(endpoint, params) {
  if (!TWELVE_DATA_API_KEY) throw new Error("TWELVE_DATA_API_KEY not configured");
  const url = new URL("https://api.twelvedata.com/" + endpoint);
  Object.entries({ ...params, apikey: TWELVE_DATA_API_KEY }).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error("Market provider HTTP " + response.status);
  const data = await response.json();
  if (data.status === "error" || data.code) throw new Error(data.message || "Market provider error");
  return data;
}
async function cachedMarket(key, loader) {
  const hit = marketCache.get(key);
  if (hit && Date.now() - hit.at < MARKET_CACHE_MS) return hit.data;
  const data = await loader();
  marketCache.set(key, { at: Date.now(), data });
  return data;
}
function safeMarketParam(value, fallback = "") {
  return String(value || fallback).trim().slice(0, 80).replace(/[^\w./:+ -]/g, "");
}
function marketDates(period) {
  const end = new Date();
  const start = new Date(end);
  const days = ({ "24h": 2, "1m": 35, "6m": 190, "1y": 380, "5y": 1900, max: 9000 })[period] || 380;
  start.setUTCDate(start.getUTCDate() - days);
  return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) };
}
app.get("/api/market/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 80);
    if (!q) return res.status(400).json({ error: "Informe um ativo para pesquisar." });
    const key = "market-search:" + q.toLowerCase();
    const cached = marketCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.data);
    const data = await marketFetch("symbol_search", { symbol: q, outputsize: 30 });
    const result = {
      data: (data.data || []).map(x => ({
        symbol: x.symbol,
        name: x.instrument_name,
        exchange: x.exchange,
        type: x.instrument_type,
        country: x.country,
        currency: x.currency
      }))
    };
    marketCache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, data: result });
    res.json(result);
  } catch (error) {
    console.error("market search error:", error.message);
    res.status(502).json({ error: "Não foi possível pesquisar esse ativo agora." });
  }
});

app.get("/api/market/quote", async (req, res) => {
  try {
    const symbol = safeMarketParam(req.query.symbol);
    const exchange = safeMarketParam(req.query.exchange);
    if (!symbol) return res.status(400).json({ error: "Informe o símbolo do ativo." });
    const key = "q:" + symbol + ":" + exchange;
    const data = await cachedMarket(key, () => marketFetch("quote", {
      symbol, exchange, interval: "1day", dp: 8, eod: true
    }));
    res.json({
      symbol: data.symbol, name: data.name || data.symbol, exchange: data.exchange || exchange,
      currency: data.currency || "USD", price: Number(data.close ?? data.price),
      previousClose: Number(data.previous_close ?? 0),
      change: Number(data.change ?? 0), percentChange: Number(data.percent_change ?? 0),
      datetime: data.datetime || null, type: data.type || null
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "Não foi possível obter a cotação." });
  }
});
app.get("/api/market/history", async (req, res) => {
  try {
    const symbol = safeMarketParam(req.query.symbol);
    const exchange = safeMarketParam(req.query.exchange);
    const period = safeMarketParam(req.query.period, "1y");
    if (!symbol) return res.status(400).json({ error: "Informe o símbolo do ativo." });
    const dates = marketDates(period);
    const interval = period === "24h" ? "1h" : period === "5y" || period === "max" ? "1week" : "1day";
    const key = ["h",symbol,exchange,period].join(":");
    const data = await cachedMarket(key, () => marketFetch("time_series", {
      symbol, exchange, interval, start_date: dates.start, end_date: dates.end,
      outputsize: 5000, order: "ASC", timezone: "UTC", dp: 8, ...(symbol.includes("/") ? {} : { adjust: "all" })
    }));
    const values = Array.isArray(data.values) ? data.values : [];
    res.json({
      symbol: data.meta?.symbol || symbol, currency: data.meta?.currency || "USD",
      interval, period, values: values.map(x => ({
        datetime: x.datetime, close: Number(x.close), open: Number(x.open || x.close),
        high: Number(x.high || x.close), low: Number(x.low || x.close), volume: Number(x.volume || 0)
      })).filter(x => Number.isFinite(x.close))
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "Não foi possível obter o histórico." });
  }
});
app.get("/api/market/currency", async (req, res) => {
  try {
    const from = safeMarketParam(req.query.from, "USD").toUpperCase();
    const to = safeMarketParam(req.query.to, "BRL").toUpperCase();
    if (from === to) return res.json({ from, to, rate: 1 });
    const data = await cachedMarket("fx:" + from + ":" + to, () => marketFetch("exchange_rate", { symbol: from + "/" + to, dp: 8 }));
    res.json({ from, to, rate: Number(data.rate) });
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

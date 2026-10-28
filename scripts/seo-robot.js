#!/usr/bin/env node
"use strict";

// CalcWorld SEO discovery robot. Keeps keyword history and only adds real HTML
// URLs to the existing sitemap, preserving current calculator and guide URLs.
const fs=require("fs");
const path=require("path");
const ROOT=path.resolve(__dirname,"..");
const SITE="https://calcworld.com.br";
const KEYWORDS_FILE=path.join(ROOT,"seo-data","keyword-opportunities.json");
const STATE_FILE=path.join(ROOT,"seo-data","robot-state.json");
const SEEDS=[
"como calcular porcentagem","calculadora de regra de três","como calcular média aritmética",
"calculadora de juros simples","calculadora de juros compostos","calculadora de desconto",
"como calcular aumento percentual","calculadora de financiamento","calculadora de salário líquido",
"como calcular férias proporcionais","como calcular décimo terceiro salário","calculadora de rescisão CLT",
"como calcular hora extra","calculadora de IMC","calculadora de consumo de combustível",
"calculadora de datas e dias úteis","conversor de unidades online","calculadora de margem de lucro",
"calculadora de markup","ponto de equilíbrio financeiro","simulador de investimento CDI",
"calculadora de rendimento da poupança","como calcular porcentagem de aumento","calculadora de comissão de vendas",
"calculadora de probabilidade","como calcular área de círculo","como converter temperatura Celsius Fahrenheit",
"calculadora de pace corrida","calculadora de calorias","calculadora de parcelamento"
];
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch(e){if(e.code!=="ENOENT")console.warn("[seo-robot] read warning",e.message);return fallback}}
function writeJson(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+".tmp";fs.writeFileSync(tmp,JSON.stringify(data,null,2)+"\n");fs.renameSync(tmp,file)}
function normalize(s){return String(s||"").replace(/\s+/g," ").trim().toLocaleLowerCase("pt-BR")}
async function suggestions(query){
 const endpoint="https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&q="+encodeURIComponent(query);
 const res=await fetch(endpoint,{headers:{"user-agent":"CalcWorldSEOResearch/1.0"},signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw new Error("Google suggestions HTTP "+res.status);
 const data=await res.json();return Array.isArray(data[1])?data[1].filter(x=>typeof x==="string"&&x.trim()).slice(0,15):[];
}
function htmlFiles(dir,base){
 if(!fs.existsSync(dir))return [];
 let out=[];
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,item.name),rel=path.posix.join(base||"",item.name);
  if(item.isDirectory())out=out.concat(htmlFiles(full,rel));
  else if(item.isFile()&&item.name.toLowerCase().endsWith(".html"))out.push(rel);
 }
 return out;
}
function createSitemap(){
 const files=htmlFiles(ROOT,"").filter(p=>!p.split("/").some(x=>x.startsWith(".")||x==="node_modules"||x==="seo-data"||x==="scripts"||x==="admin"));
 const urls=new Set();
 for(const p of files){
  if(["404.html"].includes(p)||p.endsWith("/404.html"))continue;
  let url=SITE+"/"+p.split(path.sep).join("/");
  if(p==="index.html")url=SITE+"/";
  else if(p.endsWith("/index.html"))url=SITE+"/"+p.slice(0,-"index.html".length);
  if(/\.(html|xml|txt|json)$/i.test(url)||url.endsWith("/")) {
    if(url.endsWith(".xml")||url.endsWith(".txt")||url.endsWith(".json"))continue;
    urls.add(url);
  }
 }
 // Preserve the current sitemap URLs if their pages are still real and present.
 const sitemapPath=path.join(ROOT,"sitemap.xml");
 if(fs.existsSync(sitemapPath)){
  const old=fs.readFileSync(sitemapPath,"utf8");
  for(const match of old.matchAll(/<loc>(https:\/\/calcworld\.com\.br[^<]+)<\/loc>/g)){
   const u=match[1];
   const pathname=new URL(u).pathname;
   let rel=decodeURIComponent(pathname.replace(/^\//,""));
   if(!rel||pathname.endsWith("/"))rel=path.posix.join(rel,"index.html");
   if(fs.existsSync(path.join(ROOT,rel))&&fs.statSync(path.join(ROOT,rel)).isFile())urls.add(u);
  }
 }
 const sorted=Array.from(urls).sort();
 const day=new Date().toISOString().slice(0,10);
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sorted.map(u=>'  <url><loc>'+u+'</loc><lastmod>'+day+'</lastmod></url>').join("\n")+'\n</urlset>\n';
 fs.writeFileSync(sitemapPath,xml);
 const robotsPath=path.join(ROOT,"robots.txt");
 let robots="User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: "+SITE+"/sitemap.xml\n";
 fs.writeFileSync(robotsPath,robots);
 return sorted.length;
}
async function main(){
 const cat=readJson(KEYWORDS_FILE,{site:SITE,updatedAt:null,keywords:[]});
 if(!Array.isArray(cat.keywords))cat.keywords=[];
 const byKey=new Map(cat.keywords.map(k=>[normalize(k.keyword),k]));
 const state=readJson(STATE_FILE,{seedIndex:0,totalRuns:0,lastRunAt:null,lastError:null});
 const idx=Number.isInteger(state.seedIndex)?state.seedIndex%SEEDS.length:0;
 const seed=SEEDS[idx],now=new Date().toISOString();
 let terms=[],err=null;
 try{terms=await suggestions(seed)}catch(e){err=e.message;console.warn("[seo-robot] suggestions unavailable:",e.message)}
 let added=0;
 for(const term of [seed,...terms]){
  const key=normalize(term);if(!key||key.length>180)continue;
  if(byKey.has(key)){const item=byKey.get(key);item.lastSeenAt=now;item.occurrences=(item.occurrences||1)+1}
  else{byKey.set(key,{keyword:term,firstSeenAt:now,lastSeenAt:now,occurrences:1,source:term===seed?"seed":"google-autocomplete",topic:seed});added++}
 }
 cat.site=SITE;cat.updatedAt=now;cat.keywords=Array.from(byKey.values()).sort((a,b)=>a.keyword.localeCompare(b.keyword,"pt-BR"));
 writeJson(KEYWORDS_FILE,cat);
 const urls=createSitemap();
 const next={seedIndex:(idx+1)%SEEDS.length,totalRuns:(state.totalRuns||0)+1,lastRunAt:now,lastError:err,lastSeed:seed,keywordCount:cat.keywords.length,newKeywordsThisRun:added,suggestionCount:terms.length,sitemapUrlCount:urls};
 writeJson(STATE_FILE,next);
 console.log("[seo-robot] success",JSON.stringify(next));
}
main().catch(e=>{console.error("[seo-robot] fatal",e);process.exitCode=1});

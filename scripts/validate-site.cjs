const fs=require("fs");
const vm=require("vm");
const source=fs.readFileSync("calculators.js","utf8");
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
const c=sandbox.window.CALCULATORS||[];
const errors=[];
const ids=new Set(),slugs=new Set(),types=new Set();
for(const x of c){
 if(!x.id||ids.has(x.id)) errors.push("Duplicate/missing id: "+x.id);
 if(!x.slug||slugs.has(x.slug)) errors.push("Duplicate/missing slug: "+x.slug);
 if(!x.type) errors.push("Missing type: "+x.id);
 if(!x.cat) errors.push("Missing category: "+x.id);
 for(const l of ["pt","en","es"]) if(!x.title?.[l]||!x.desc?.[l]) errors.push("Missing "+l+" metadata: "+x.id);
 ids.add(x.id);slugs.add(x.slug);types.add(x.type);
}
const calcSource=fs.readFileSync("calculator.js","utf8");
const required=[...types].filter(t=>!calcSource.includes(t+":"));
for(const t of required) errors.push("Catalog type not implemented in calculator.js: "+t);
if(c.length<100) errors.push("Expected at least 100 calculators, found "+c.length);

// Content-quality and localization regression checks after generation.
const homepage=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("app.js","utf8");
if(!homepage.includes('lang="pt-BR"')) errors.push("Homepage must declare pt-BR as its default language");
if(!homepage.includes('name":"As calculadoras são gratuitas?')) errors.push("Homepage FAQ structured data must be in Portuguese");
if(!app.includes('return "pt-BR";')) errors.push("New visitors must default to Portuguese on the Brazil-first site");
if(homepage.includes('name":"Are the calculators free?')) errors.push("Homepage FAQ structured data still contains English");
for(const [file,checks] of [
 ["calculadoras/porcentagem/index.html",["Exemplo resolvido","Memória de cálculo","Calculadora de porcentagem"]],
 ["calculadoras/salario-liquido/index.html",["Exemplo ilustrativo","salário bruto","Memória de cálculo"]],
 ["en/calculators/porcentagem/index.html",["Worked example","Calculation details","Percentage calculator"]]
]){
 if(!fs.existsSync(file)){errors.push("Generated page missing: "+file);continue}
 const html=fs.readFileSync(file,"utf8");
 for(const phrase of checks) if(!html.toLowerCase().includes(phrase.toLowerCase())) errors.push(file+" missing expected content: "+phrase);
 if(html.includes("Quem pesquisa por")) errors.push(file+" contains keyword-stuffed search-intent text");
}
const sitemap=fs.existsSync("sitemap.xml")?fs.readFileSync("sitemap.xml","utf8"):"";
if(!sitemap) errors.push("sitemap.xml missing after generation");
if(sitemap.includes("<loc>https://calcworld.com.br/robots.txt</loc>")) errors.push("robots.txt must not be listed in sitemap.xml");
if(sitemap.includes("<loc>https://calcworld.com.br/ads.txt</loc>")) errors.push("ads.txt must not be listed in sitemap.xml");
const sitemapUrls=sitemap.split("<loc>").slice(1).map(entry=>entry.split("</loc>")[0]);
if(sitemapUrls.some(url=>url.includes("?"))) errors.push("Sitemap must not contain query-string URLs");
if(new Set(sitemapUrls).size!==sitemapUrls.length) errors.push("Sitemap contains duplicate URLs");
const ptPage=fs.existsSync("calculadoras/porcentagem/index.html")?fs.readFileSync("calculadoras/porcentagem/index.html","utf8"):"";
const enPage=fs.existsSync("en/calculators/porcentagem/index.html")?fs.readFileSync("en/calculators/porcentagem/index.html","utf8"):"";
if(ptPage.includes("Calculation details")) errors.push("Portuguese calculator page contains English sidebar labels");
if(enPage.includes("Memória de cálculo")) errors.push("English calculator page contains Portuguese sidebar labels");
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("CalcWorld validation OK: "+c.length+" calculators, "+types.size+" calculator types, localized homepage, and generated PT/EN quality checks.");

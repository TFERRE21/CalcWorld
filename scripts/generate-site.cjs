const fs=require("fs");
const path=require("path");
const vm=require("vm");
const root=process.cwd();
const source=fs.readFileSync(path.join(root,"calculators.js"),"utf8");
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
const calculators=sandbox.window.CALCULATORS||[];
if(!calculators.length) throw new Error("No calculators found");
const site="https://calcworld.com";
const categoryNames={math:{pt:"Matemática",en:"Math",es:"Matemáticas"},finance:{pt:"Finanças",en:"Finance",es:"Finanzas"},work:{pt:"Trabalho",en:"Work",es:"Trabajo"},business:{pt:"Negócios",en:"Business",es:"Negocios"},daily:{pt:"Dia a dia",en:"Everyday",es:"Día a día"},date:{pt:"Datas",en:"Dates",es:"Fechas"},health:{pt:"Saúde",en:"Health",es:"Salud"}};
const localeData={
pt:{folder:"calculadoras",categoryFolder:"categoria",lang:"pt-BR",back:"Voltar",home:"Início",how:"Como usar",howText:"Informe os valores solicitados e clique em calcular. O resultado aparece no navegador.",important:"Importante",importantText:"Esta ferramenta é informativa. Em cálculos trabalhistas, fiscais, financeiros ou de saúde, confirme as regras aplicáveis.",related:"Você também pode gostar",ad:"Espaço para publicidade",categoryIntro:"Encontre calculadoras e ferramentas desta categoria."},
en:{folder:"calculators",categoryFolder:"category",lang:"en",back:"Back",home:"Home",how:"How to use",howText:"Enter the requested values and click calculate. The result appears in your browser.",important:"Important",importantText:"This tool is informational. Verify applicable rules for legal, financial, tax or health calculations.",related:"Related calculators",ad:"Advertising space",categoryIntro:"Find calculators and tools in this category."},
es:{folder:"calculadoras",categoryFolder:"categoria",lang:"es",back:"Volver",home:"Inicio",how:"Cómo usar",howText:"Introduce los valores y pulsa calcular. El resultado aparece en tu navegador.",important:"Importante",importantText:"Esta herramienta es informativa. Verifica las reglas aplicables en cálculos legales, financieros, fiscales o de salud.",related:"Calculadoras relacionadas",ad:"Espacio publicitario",categoryIntro:"Encuentra calculadoras y herramientas de esta categoría."}
};
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function prefix(l){return l==="pt"?"../../":"../../../"}
function calcUrl(l,slug){return l==="pt"?"/calculadoras/"+slug+"/":l==="en"?"/en/calculators/"+slug+"/":"/es/calculadoras/"+slug+"/"}
function catUrl(l,cat){const d=localeData[l];return l==="pt"?"/"+d.categoryFolder+"/"+cat+"/":"/"+l+"/"+d.categoryFolder+"/"+cat+"/"}
function seoText(c,l){
 const n=esc(c.title[l]);
 if(l==="pt") return "Use a "+n+" para obter um resultado rápido a partir dos dados informados. Confira os campos, revise os valores e use o resultado como referência.";
 if(l==="en") return "Use the "+n+" calculator to get a quick result from the values you enter. Review the inputs and use the result as a reference.";
 return "Usa la "+n+" para obtener un resultado rápido a partir de los datos introducidos. Revisa los valores y utiliza el resultado como referencia.";
}
function card(c,l){
 const d=localeData[l];
 return '<a class="card" href="'+calcUrl(l,c.slug)+'"><div class="icon">'+esc(c.icon)+'</div><h3>'+esc(c.title[l])+'</h3><p>'+esc(c.desc[l])+'</p><span class="tag">'+esc(categoryNames[c.cat][l])+'</span></a>';
}
function page(c,l){
 const d=localeData[l],title=esc(c.title[l]),desc=esc(c.desc[l]),p=prefix(l),canonical=site+calcUrl(l,c.slug);
 const alts=[["pt-BR",site+calcUrl("pt",c.slug)],["en",site+calcUrl("en",c.slug)],["es",site+calcUrl("es",c.slug)]];
 const related=calculators.filter(x=>x.cat===c.cat&&x.id!==c.id).slice(0,6).map(x=>card(x,l)).join("");
 const catName=esc(categoryNames[c.cat][l]);
 const catFolder=d.categoryFolder;
 const catRel=l==="pt"?"../"+catFolder+"/"+c.cat+"/":"../../"+catFolder+"/"+c.cat+"/";
 const breadcrumb='<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="'+p+'">'+d.home+'</a><span>›</span><a href="'+catRel+'">'+catName+'</a><span>›</span><span>'+title+'</span></nav>';
 const schema=JSON.stringify({"@context":"https://schema.org","@type":"WebApplication","name":c.title[l],"description":c.desc[l],"url":canonical,"applicationCategory":"UtilitiesApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}});
 return '<!doctype html><html lang="'+d.lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' — CalcWorld</title><meta name="description" content="'+desc+'"><meta name="robots" content="index,follow"><meta name="theme-color" content="#2563eb"><link rel="canonical" href="'+canonical+'">'+alts.map(([hl,u])=>'<link rel="alternate" hreflang="'+hl+'" href="'+u+'">').join("")+'<link rel="alternate" hreflang="x-default" href="'+site+calcUrl("en",c.slug)+'"><link rel="stylesheet" href="'+p+'styles.css"><script type="application/ld+json">'+schema+'</script></head><body><header class="header"><div class="wrap nav"><a class="brand" href="'+p+'">Calc<span>World</span></a><a href="'+p+'" style="margin-left:auto;color:var(--muted);text-decoration:none;font-weight:700">← '+d.back+'</a></div></header><main class="wrap" style="padding:35px 0 80px">'+breadcrumb+'<div class="eyebrow">CALCWORLD</div><h1>'+title+'</h1><p class="hero-copy" style="font-size:18px">'+desc+'</p><div class="ad-slot">'+d.ad+'</div><section id="form" class="calc-box"></section><div class="ad-slot">'+d.ad+'</div><section class="info"><h2>'+d.how+'</h2><p>'+d.howText+'</p><p>'+seoText(c,l)+'</p><h2>'+d.important+'</h2><p>'+d.importantText+'</p></section><section class="section"><div class="section-title"><h2>'+d.related+'</h2></div><div class="grid">'+related+'</div></section></main><script src="'+p+'calculators.js"></script><script src="'+p+'calculator.js"></script></body></html>';
}
function categoryPage(cat,l){
 const d=localeData[l],name=esc(categoryNames[cat][l]),p=l==="pt"?"../../":"../../../",canonical=site+catUrl(l,cat);
 const items=calculators.filter(x=>x.cat===cat),links=items.map(x=>card(x,l)).join("");
 const desc=esc(l==="pt"?"Calculadoras de "+categoryNames[cat].pt+" online e gratuitas no CalcWorld.":l==="en"?"Free online "+categoryNames[cat].en.toLowerCase()+" calculators and tools on CalcWorld.":"Calculadoras gratuitas de "+categoryNames[cat].es.toLowerCase()+" en CalcWorld.");
 const alts=[["pt-BR",site+catUrl("pt",cat)],["en",site+catUrl("en",cat)],["es",site+catUrl("es",cat)]];
 const schema=JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":categoryNames[cat][l],"description":desc,"url":canonical});
 return '<!doctype html><html lang="'+d.lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name+' — CalcWorld</title><meta name="description" content="'+desc+'"><meta name="robots" content="index,follow"><meta name="theme-color" content="#2563eb"><link rel="canonical" href="'+canonical+'">'+alts.map(([hl,u])=>'<link rel="alternate" hreflang="'+hl+'" href="'+u+'">').join("")+'<link rel="alternate" hreflang="x-default" href="'+site+catUrl("en",cat)+'"><link rel="stylesheet" href="'+p+'styles.css"><script type="application/ld+json">'+schema+'</script></head><body><header class="header"><div class="wrap nav"><a class="brand" href="'+p+'">Calc<span>World</span></a><a href="'+p+'" style="margin-left:auto;color:var(--muted);text-decoration:none;font-weight:700">← '+d.home+'</a></div></header><main class="wrap" style="padding:45px 0 80px"><div class="eyebrow">CALCWORLD</div><h1>'+name+'</h1><p class="hero-copy" style="font-size:18px">'+d.categoryIntro+'</p><div class="ad-slot">'+d.ad+'</div><section class="section"><div class="grid">'+links+'</div></section></main></body></html>';
}
for(const c of calculators) for(const l of ["pt","en","es"]){
 const d=localeData[l],dir=l==="pt"?path.join(root,"calculadoras",c.slug):path.join(root,l,d.folder,c.slug);
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"index.html"),page(c,l));
}
for(const cat of Object.keys(categoryNames)) for(const l of ["pt","en","es"]){
 const d=localeData[l],dir=l==="pt"?path.join(root,d.categoryFolder,cat):path.join(root,l,d.categoryFolder,cat);
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"index.html"),categoryPage(cat,l));
}
const urls=[site+"/",site+"/privacy.html",site+"/terms.html"];
for(const c of calculators) for(const l of ["pt","en","es"]) urls.push(site+calcUrl(l,c.slug));
for(const cat of Object.keys(categoryNames)) for(const l of ["pt","en","es"]) urls.push(site+catUrl(l,cat));
const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+u+'</loc></url>').join("")+'</urlset>';
fs.writeFileSync(path.join(root,"sitemap.xml"),xml);
console.log("Generated "+calculators.length+" calculators x 3 locales + "+Object.keys(categoryNames).length+" categories x 3 locales.");

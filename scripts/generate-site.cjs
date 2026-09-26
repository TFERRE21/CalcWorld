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
const localeData={
  pt:{folder:"calculadoras",lang:"pt-BR",back:"Voltar",how:"Como usar",howText:"Informe os valores solicitados e clique em calcular. O resultado aparece no navegador.",important:"Importante",importantText:"Esta ferramenta é informativa. Em cálculos trabalhistas, fiscais, financeiros ou de saúde, confirme as regras aplicáveis.",ad:"Espaço para publicidade"},
  en:{folder:"calculators",lang:"en",back:"Back",how:"How to use",howText:"Enter the requested values and click calculate. The result appears in your browser.",important:"Important",importantText:"This tool is informational. Verify applicable rules for legal, financial, tax or health calculations.",ad:"Advertising space"},
  es:{folder:"calculadoras",lang:"es",back:"Volver",how:"Cómo usar",howText:"Introduce los valores y pulsa calcular. El resultado aparece en tu navegador.",important:"Importante",importantText:"Esta herramienta es informativa. Verifica las reglas aplicables en cálculos legales, financieros, fiscales o de salud.",ad:"Espacio publicitario"}
};
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function page(c,l){
 const d=localeData[l], title=esc(c.title[l]), desc=esc(c.desc[l]);
 const prefix=l==="pt"?"../../":l==="en"?"../../../../":"../../../../";
 const canonical=l==="pt"?site+"/calculadoras/"+c.slug+"/":site+"/"+d.folder+"/"+c.slug+"/";
 const altPt=site+"/calculadoras/"+c.slug+"/",altEn=site+"/en/calculators/"+c.slug+"/",altEs=site+"/es/calculadoras/"+c.slug+"/";
 return `<!doctype html><html lang="${d.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — CalcWorld</title><meta name="description" content="${desc}"><meta name="robots" content="index,follow"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="pt-BR" href="${altPt}"><link rel="alternate" hreflang="en" href="${altEn}"><link rel="alternate" hreflang="es" href="${altEs}"><link rel="alternate" hreflang="x-default" href="${altEn}"><link rel="stylesheet" href="${prefix}styles.css"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"${title}","url":"${canonical}","applicationCategory":"UtilitiesApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script><script>localStorage.setItem("cw-lang","${l==="pt"?"pt-BR":l}");</script></head><body><header class="header"><div class="wrap nav"><a class="brand" href="${prefix}">Calc<span>World</span></a><a href="${prefix}#calculadoras" style="margin-left:auto;color:var(--muted);text-decoration:none;font-weight:700">← ${d.back}</a></div></header><main class="wrap" style="padding:45px 0 80px"><div class="eyebrow">CALCWORLD</div><h1>${title}</h1><p class="hero-copy" style="font-size:18px">${desc}</p><div class="ad-slot">${d.ad}</div><section id="form" class="calc-box"></section><div class="ad-slot">${d.ad}</div><section class="info"><h2>${d.how}</h2><p>${d.howText}</p><h2>${d.important}</h2><p>${d.importantText}</p></section></main><script src="${prefix}calculators.js"></script><script src="${prefix}calculator.js"></script></body></html>`;
}
for(const c of calculators){
 for(const l of ["pt","en","es"]){
   const d=localeData[l];
   const dir=l==="pt"?path.join(root,"calculadoras",c.slug):path.join(root,l,d.folder,c.slug);
   fs.mkdirSync(dir,{recursive:true});
   fs.writeFileSync(path.join(dir,"index.html"),page(c,l));
 }
}
const urls=[site+"/"];
for(const c of calculators){urls.push(site+"/calculadoras/"+c.slug+"/",site+"/en/calculators/"+c.slug+"/",site+"/es/calculadoras/"+c.slug+"/")}
urls.push(site+"/privacy.html",site+"/terms.html");
const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+u+'</loc></url>').join("")+'</urlset>';
fs.writeFileSync(path.join(root,"sitemap.xml"),xml);
console.log("Generated "+calculators.length+" calculators x 3 locales = "+(calculators.length*3)+" pages.");

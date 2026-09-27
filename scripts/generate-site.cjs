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
const site="https://calcworld.com.br";
const buildDate=new Date().toISOString().slice(0,10);
const categoryNames={math:{pt:"Matemática",en:"Math"},finance:{pt:"Finanças",en:"Finance"},work:{pt:"Trabalho",en:"Work"},business:{pt:"Negócios",en:"Business"},daily:{pt:"Dia a dia",en:"Everyday"},date:{pt:"Datas",en:"Dates"},health:{pt:"Saúde",en:"Health"}};
const localeData={
pt:{folder:"calculadoras",categoryFolder:"categoria",lang:"pt-BR",back:"Voltar",home:"Início",how:"Como usar",howText:"Informe os valores solicitados e clique em calcular. O resultado aparece no navegador.",important:"Importante",importantText:"Esta ferramenta é informativa. Em cálculos trabalhistas, fiscais, financeiros ou de saúde, confirme as regras aplicáveis.",related:"Você também pode gostar",ad:"Espaço para publicidade",categoryIntro:"Encontre calculadoras e ferramentas desta categoria."},
en:{folder:"calculators",categoryFolder:"category",lang:"en",back:"Back",home:"Home",how:"How to use",howText:"Enter the requested values and click calculate. The result appears in your browser.",important:"Important",importantText:"This tool is informational. Verify applicable rules for legal, financial, tax or health calculations.",related:"Related calculators",ad:"Advertising space",categoryIntro:"Find calculators and tools in this category."},
};
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function prefix(l){return l==="pt"?"../../":"../../../"}
function calcUrl(l,slug){return l==="pt"?"/calculadoras/"+slug+"/":"/en/calculators/"+slug+"/"}
function catUrl(l,cat){const d=localeData[l];return l==="pt"?"/"+d.categoryFolder+"/"+cat+"/":"/"+l+"/"+d.categoryFolder+"/"+cat+"/"}
function formulaText(c,l){
 const map={
 percentage:{pt:"Resultado = valor × taxa ÷ 100",en:"Result = value × rate ÷ 100",es:"Resultado = valor × tasa ÷ 100"},
 rule3:{pt:"Regra de três: valor procurado = (B × C) ÷ A",en:"Rule of three: result = (B × C) ÷ A",es:"Regla de tres: resultado = (B × C) ÷ A"},
 average:{pt:"Média = soma dos valores ÷ quantidade de valores",en:"Average = sum of values ÷ number of values",es:"Promedio = suma de valores ÷ cantidad"},
 sum:{pt:"Soma = valor 1 + valor 2 + ...",en:"Sum = value 1 + value 2 + ...",es:"Suma = valor 1 + valor 2 + ..."},
 simpleInterest:{pt:"Montante = principal × (1 + taxa × períodos)",en:"Amount = principal × (1 + rate × periods)",es:"Monto = principal × (1 + tasa × períodos)"},
 compoundInterest:{pt:"Montante = principal × (1 + taxa) ^ períodos",en:"Amount = principal × (1 + rate) ^ periods",es:"Monto = principal × (1 + tasa) ^ períodos"},
 discount:{pt:"Preço final = preço × (1 − desconto ÷ 100)",en:"Final price = price × (1 − discount ÷ 100)",es:"Precio final = precio × (1 − descuento ÷ 100)"},
 increase:{pt:"Variação (%) = (novo − antigo) ÷ antigo × 100",en:"Change (%) = (new − old) ÷ old × 100",es:"Variación (%) = (nuevo − anterior) ÷ anterior × 100"},
 margin:{pt:"Margem = (vendas − custo) ÷ vendas × 100",en:"Margin = (sales − cost) ÷ sales × 100",es:"Margen = (ventas − costo) ÷ ventas × 100"},
 markup:{pt:"Preço de venda = custo × (1 + markup ÷ 100)",en:"Selling price = cost × (1 + markup ÷ 100)",es:"Precio de venta = costo × (1 + markup ÷ 100)"},
 commission:{pt:"Comissão = vendas × taxa ÷ 100",en:"Commission = sales × rate ÷ 100",es:"Comisión = ventas × tasa ÷ 100"},
 bmi:{pt:"IMC = peso ÷ altura²",en:"BMI = weight ÷ height²",es:"IMC = peso ÷ altura²"},
 speed:{pt:"Velocidade média = distância ÷ tempo",en:"Average speed = distance ÷ time",es:"Velocidad media = distancia ÷ tiempo"},
 pace:{pt:"Ritmo = tempo ÷ distância",en:"Pace = time ÷ distance",es:"Ritmo = tiempo ÷ distancia"},
 area:{pt:"Área = largura × comprimento",en:"Area = width × length",es:"Área = ancho × largo"},
 volume:{pt:"Volume = largura × comprimento × profundidade",en:"Volume = width × length × depth",es:"Volumen = ancho × largo × profundidad"},
 unitCost:{pt:"Custo unitário = custo total ÷ quantidade",en:"Unit cost = total cost ÷ quantity",es:"Costo unitario = costo total ÷ cantidad"},
 reorder:{pt:"Ponto de reposição = consumo diário × prazo + estoque de segurança",en:"Reorder point = daily usage × lead time + safety stock",es:"Punto de reposición = consumo diario × plazo + stock de seguridad"}
 };
 return map[c.type]?.[l]||"";
}
function seoText(c,l){
 const n=esc(c.title[l]);
 if(l==="pt") return "Use a "+n+" online para calcular o resultado com os dados informados. Confira os valores antes de calcular e use o resultado como referência para sua decisão.";
 if(l==="en") return "Use the "+n+" online to calculate a result from the values you enter. Review the inputs and use the result as a reference.";
 return "Usa la "+n+" online para calcular el resultado con los datos introducidos. Revisa los valores y utiliza el resultado como referencia.";
}
function card(c,l){
 const d=localeData[l];
 return '<a class="card" href="'+calcUrl(l,c.slug)+'"><div class="icon">'+esc(c.icon)+'</div><h3>'+esc(c.title[l])+'</h3><p>'+esc(c.desc[l])+'</p><span class="tag">'+esc(categoryNames[c.cat][l])+'</span></a>';
}
function seoExtra(c,l){
 const pt=l==="pt";
 const special={
  netSalary:pt?["Entenda o salário líquido","Esta calculadora estima o valor recebido a partir do salário bruto, considerando INSS, IRRF, dependentes e outros descontos informados.","Informe o salário bruto e confira o relatório para separar os principais descontos."]:["Understand take-home pay","This calculator estimates take-home pay from gross salary, considering INSS, IRRF, dependents and other deductions entered.","Enter gross salary and review the report to understand the main deductions."],
  termination:pt?["Entenda a rescisão trabalhista","O resultado muda conforme o motivo do desligamento. A ferramenta permite comparar dispensa sem justa causa, justa causa, pedido de demissão, acordo e outras situações.","Selecione o motivo, informe datas, salário e FGTS e confira a memória de cálculo."]:["Understand employment termination","The result depends on the termination reason. The tool compares different termination scenarios using the entered dates, salary and FGTS.","Select the reason, enter dates, salary and FGTS, then review the calculation report."],
  loan:pt?["Entenda o financiamento","A parcela depende do valor financiado, entrada, prazo e taxa. Tarifas, seguros e impostos podem alterar o custo efetivo.","Use a taxa que você realmente quer simular e compare o custo total, não apenas a parcela."]:["Understand loan payments","Payments depend on amount, down payment, term and rate. Fees, insurance and taxes can change the effective cost.","Use the rate you want to simulate and compare total cost, not only the installment."],
  compoundInterest:pt?["Entenda os juros compostos","Os juros de cada período são incorporados ao saldo, fazendo a base de cálculo crescer ao longo do tempo.","Compare diferentes taxas e períodos para visualizar o efeito da capitalização."]:["Understand compound interest","Each period's interest is added to the balance, so the calculation base grows over time.","Compare different rates and periods to see the effect of compounding."],
  fuel:pt?["Planeje o custo da viagem","A estimativa usa distância, consumo e preço por litro. O consumo real pode variar conforme trânsito, velocidade, carga e condições do veículo."]:["Plan your trip cost","The estimate uses distance, consumption and price per liter. Real consumption can vary with traffic, speed, load and vehicle conditions."],
  vacation:pt?["Entenda o cálculo de férias","A estimativa considera o salário informado e o adicional de um terço. Descontos e particularidades da folha podem alterar o valor recebido."]:["Understand vacation pay","The estimate uses the entered salary and one-third premium. Payroll deductions and specific conditions can change the amount received."],
  thirteenth:pt?["Entenda o 13º salário","O valor proporcional depende da remuneração e dos meses considerados no cálculo. Parcelas salariais e descontos podem alterar o valor final."]:["Understand 13th salary","The proportional amount depends on remuneration and eligible months. Payroll components and deductions can change the final amount."],
  overtime:pt?["Entenda as horas extras","O adicional informado é aplicado ao valor da hora e à quantidade de horas. A apuração completa pode depender de jornada e convenção coletiva."]:["Understand overtime","The entered premium is applied to the hourly rate and overtime hours. Full payroll calculation may depend on schedule and collective agreements."],
  fgts:pt?["Entenda o FGTS","A calculadora estima o depósito mensal com base na remuneração informada. O saldo acumulado depende dos depósitos realizados ao longo do contrato."]:["Understand FGTS","The calculator estimates a monthly deposit from the entered remuneration. The accumulated balance depends on deposits made during employment."],
  increase:pt?["Calcule reajustes com clareza","A variação percentual compara o valor final com o valor inicial. Isso permite simular reajustes salariais, preços e outras mudanças."]:["Calculate percentage increases clearly","The percentage change compares the final value with the initial value, useful for salary, price and other adjustments."],
  discount:pt?["Entenda o desconto","O percentual é aplicado sobre o preço original para mostrar economia e preço final. Descontos sucessivos devem ser calculados em sequência."]:["Understand discounts","The percentage is applied to the original price to show savings and final price. Successive discounts should be calculated sequentially."],
  bmi:pt?["Entenda o IMC","O IMC é um indicador matemático baseado em peso e altura. Ele não substitui avaliação individual de saúde."]:["Understand BMI","BMI is a mathematical indicator based on weight and height. It does not replace an individual health assessment."]
 };
 const x=special[c.type]||(
  pt?["Como usar esta calculadora","Informe os dados solicitados, confira as unidades e períodos e gere o relatório para ver o resultado e a memória de cálculo.","Use o resultado como referência e confira regras específicas quando o cálculo depender de legislação, contrato ou instituição."]:
     ["How to use this calculator","Enter the requested values, check units and periods, and generate the report to see the result and calculation details.","Use the result as a reference and verify specific rules when the calculation depends on law, contracts or institutions."]
 );
 const faq=pt?[["O resultado é oficial?","Não. É uma estimativa informativa e pode depender das regras e dados do caso concreto."],["Posso salvar o resultado?","Sim. O relatório pode ser impresso ou salvo em PDF pelo navegador."],["Funciona no celular?","Sim. A página é responsiva e pode ser usada em celular, tablet ou computador."]]:[["Is the result official?","No. It is an informational estimate and may depend on the rules and data of the specific case."],["Can I save the result?","Yes. The report can be printed or saved as a PDF from the browser."],["Does it work on mobile?","Yes. The page is responsive and works on phones, tablets and desktops."]];
 return '<section class="seo-guide"><h2>'+esc(x[0])+'</h2><p>'+esc(x[1])+'</p><p>'+esc(x[2])+'</p><h2>'+(pt?"Perguntas frequentes":"Frequently asked questions")+'</h2><div class="seo-faq">'+faq.map(q=>'<details><summary>'+esc(q[0])+'</summary><p>'+esc(q[1])+'</p></details>').join("")+'</div></section>';
}
function page(c,l){
 const d=localeData[l],title=esc(c.title[l]),desc=esc(c.desc[l]),p=prefix(l),canonical=site+calcUrl(l,c.slug),metaDesc=esc((l==="pt"?"Calculadora online grátis: "+c.title[l]+". "+c.desc[l]:"Online calculator: "+c.title[l]+". "+c.desc[l]));
 const alts=[["pt-BR",site+calcUrl("pt",c.slug)],["en",site+calcUrl("en",c.slug)]];
 const related=calculators.filter(x=>x.cat===c.cat&&x.id!==c.id).slice(0,6).map(x=>card(x,l)).join("");
 const catName=esc(categoryNames[c.cat][l]);
 const catFolder=d.categoryFolder;
 const catRel=l==="pt"?"../"+catFolder+"/"+c.cat+"/":"../../"+catFolder+"/"+c.cat+"/";
 const breadcrumb='<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="'+p+'">'+d.home+'</a><span>›</span><a href="'+catRel+'">'+catName+'</a><span>›</span><span>'+title+'</span></nav>';
 const schema=JSON.stringify({"@context":"https://schema.org","@type":"WebApplication","name":c.title[l],"description":c.desc[l],"url":canonical,"applicationCategory":"UtilitiesApplication","applicationSubCategory":"Calculator","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"BRL"}});
 return '<!doctype html><html lang="'+d.lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' — CalcWorld</title><meta name="description" content="'+metaDesc+'"><meta name="robots" content="index,follow"><meta name="theme-color" content="#2563eb"><link rel="canonical" href="'+canonical+'">'+alts.map(([hl,u])=>'<link rel="alternate" hreflang="'+hl+'" href="'+u+'">').join("")+'<link rel="alternate" hreflang="x-default" href="'+site+calcUrl("en",c.slug)+'"><link rel="stylesheet" href="'+p+'styles.css"><script type="application/ld+json">'+schema+'</script></head><body><header class="header"><div class="wrap nav"><a class="brand" href="'+p+'"><img src="'+p+'logo.svg" alt="CalcWorld"></a><div class="page-tools"><button id="themeToggle" class="theme-toggle" type="button" aria-label="Alterar tema"><span class="theme-icon">☀</span><span class="theme-text">Tema</span></button><select id="pageLang" aria-label="Idioma"><option value="pt-BR">🇧🇷 PT</option><option value="en">🇺🇸 EN</option></select><a id="back" href="'+p+'" style="color:var(--muted);text-decoration:none;font-weight:700">← '+d.back+'</a></div></div></header><main class="wrap calc-page" style="padding:35px 0 80px">'+breadcrumb+'<div class="eyebrow">CALCWORLD</div><h1 id="title">'+title+'</h1><p id="desc" class="hero-copy" style="font-size:18px">'+desc+'</p><div class="calc-layout"><section class="calc-main"><div class="ad-slot">'+d.ad+'</div><section id="form" class="calc-box"></section><div class="ad-slot">'+d.ad+'</div><section class="info calc-info"><h2>'+d.how+'</h2><p>'+d.howText+'</p><p>'+seoText(c,l)+'</p><h2>'+(l==="pt"?"Sobre esta calculadora":"About this calculator")+'</h2><p>'+(l==="pt"?"Esta página mostra os dados informados, a fórmula ou método aplicável e uma interpretação simples do resultado.":"This page shows the inputs, the applicable formula or method, and a simple interpretation of the result.")+'</p>'+(formulaText(c,l)?'<h3>'+(l==="pt"?"Fórmula / método":"Formula / method")+'</h3><p><strong>'+esc(formulaText(c,l))+'</strong></p>':'')+'<h2>'+d.important+'</h2><p>'+d.importantText+'</p></section>'+seoExtra(c,l)+'</section></section><aside class="calc-sidebar"><div class="calc-side-card"><span class="eyebrow">CALCWORLD</span><h2>Memória de cálculo</h2><p>Depois de calcular, confira os dados informados, as parcelas consideradas, a fórmula e a interpretação do resultado.</p></div><div class="calc-side-card"><h3>Resultado transparente</h3><ul><li>Dados informados</li><li>Memória de cálculo</li><li>Fórmula / método</li><li>Observações e limitações</li><li>Imprimir ou salvar em PDF</li></ul></div><div class="calc-side-card calc-side-note"><strong>Atenção</strong><p>Resultados trabalhistas, fiscais, financeiros e de saúde são estimativas informativas. Confira as regras aplicáveis ao seu caso.</p></div></aside></div><section class="section"><div class="section-title"><h2>'+d.related+'</h2></div><div class="grid">'+related+'</div></section></main><script src="'+p+'calculators.js"></script><script src="'+p+'calculator.js"></script><script>(function(){var pl=document.getElementById("pageLang");if(pl){pl.value="'+(l==="pt"?"pt-BR":"en")+'";pl.onchange=function(){location.href=pl.value==="pt-BR"?"/calculadoras/'+c.slug+'/":"/en/calculators/'+c.slug+'/";};}var t=localStorage.getItem("cw-theme-v2")||"light";document.documentElement.dataset.theme=t;var b=document.getElementById("themeToggle");if(b){b.querySelector(".theme-icon").textContent=t==="dark"?"☀":"☾";b.querySelector(".theme-text").textContent=t==="dark"?"Claro":"Escuro";b.onclick=function(){t=document.documentElement.dataset.theme==="dark"?"light":"dark";localStorage.setItem("cw-theme-v2",t);document.documentElement.dataset.theme=t;b.querySelector(".theme-icon").textContent=t==="dark"?"☀":"☾";b.querySelector(".theme-text").textContent=t==="dark"?"Claro":"Escuro";};;}})();</script></body></html>';
}
function categoryPage(cat,l){
 const d=localeData[l],name=esc(categoryNames[cat][l]),p=l==="pt"?"../../":"../../../",canonical=site+catUrl(l,cat);
 const items=calculators.filter(x=>x.cat===cat),links=items.map(x=>card(x,l)).join("");
 const desc=esc(l==="pt"?"Calculadoras de "+categoryNames[cat].pt+" online e gratuitas no CalcWorld.":l==="en"?"Free online "+categoryNames[cat].en.toLowerCase()+" calculators and tools on CalcWorld.":"Calculadoras gratuitas de "+categoryNames[cat].es.toLowerCase()+" en CalcWorld.");
 const alts=[["pt-BR",site+catUrl("pt",cat)],["en",site+catUrl("en",cat)]];
 const schema=JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":categoryNames[cat][l],"description":desc,"url":canonical});
 return '<!doctype html><html lang="'+d.lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name+' — CalcWorld</title><meta name="description" content="'+desc+'"><meta name="robots" content="index,follow"><meta name="theme-color" content="#2563eb"><link rel="canonical" href="'+canonical+'">'+alts.map(([hl,u])=>'<link rel="alternate" hreflang="'+hl+'" href="'+u+'">').join("")+'<link rel="alternate" hreflang="x-default" href="'+site+catUrl("en",cat)+'"><link rel="stylesheet" href="'+p+'styles.css"><script type="application/ld+json">'+schema+'</script></head><body><header class="header"><div class="wrap nav"><a class="brand" href="'+p+'"><img src="'+p+'logo.svg" alt="CalcWorld"></a><div class="page-tools"><button id="themeToggle" class="theme-toggle" type="button" aria-label="Change theme">☾</button><a href="'+p+'" style="color:var(--muted);text-decoration:none;font-weight:700">← '+d.home+'</a></div></div></header><main class="wrap" style="padding:45px 0 80px"><div class="eyebrow">CALCWORLD</div><h1>'+name+'</h1><p class="hero-copy" style="font-size:18px">'+d.categoryIntro+'</p><div class="ad-slot">'+d.ad+'</div><section class="section"><div class="grid">'+links+'</div></section></main><script>(function(){var t=localStorage.getItem("cw-theme-v2")||"light";document.documentElement.dataset.theme=t;var b=document.getElementById("themeToggle");if(b){b.textContent=t==="dark"?"☀":"☾";b.onclick=function(){t=document.documentElement.dataset.theme==="dark"?"light":"dark";localStorage.setItem("cw-theme-v2",t);document.documentElement.dataset.theme=t;b.textContent=t==="dark"?"☀":"☾";};}})();</script></body></html>';
}
for(const c of calculators) for(const l of ["pt","en"]){
 const d=localeData[l],dir=l==="pt"?path.join(root,"calculadoras",c.slug):path.join(root,l,d.folder,c.slug);
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"index.html"),page(c,l));
}
for(const cat of Object.keys(categoryNames)) for(const l of ["pt","en"]){
 const d=localeData[l],dir=l==="pt"?path.join(root,d.categoryFolder,cat):path.join(root,l,d.categoryFolder,cat);
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"index.html"),categoryPage(cat,l));
}
const urls=[site+"/",site+"/privacy.html",site+"/terms.html",site+"/legislacao.html",site+"/robots.txt",site+"/ads.txt"];
for(const c of calculators) for(const l of ["pt","en"]) urls.push(site+calcUrl(l,c.slug));
for(const cat of Object.keys(categoryNames)) for(const l of ["pt","en"]) urls.push(site+catUrl(l,cat));
const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+u+'</loc></url>').join("")+'</urlset>';
fs.writeFileSync(path.join(root,"sitemap.xml"),xml);
console.log("Generated "+calculators.length+" calculators x 2 locales + "+Object.keys(categoryNames).length+" categories x 2 locales.");

const fs=require("fs");
const SOURCES={
 inss:"https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal",
 irrf:"https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026",
 minimum:"https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/areas-de-atuacao/documentos-xlsx/salario-minimo-nacional.xlsx/view"
};
async function get(url){const r=await fetch(url,{headers:{"user-agent":"CalcWorld-LegalUpdater/1.0"}});if(!r.ok)throw new Error(url+" -> "+r.status);return await r.text()}
function money(s){return Number(String(s).replace(/\./g,"").replace(",", "."))}
(async()=>{
 const [inss,irrf]=await Promise.all([get(SOURCES.inss),get(SOURCES.irrf)]);
 const current=JSON.parse(fs.readFileSync("legal-rules.json","utf8"));
 const text=(inss+"\n"+irrf).replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ");
 const values=[...text.matchAll(/R\$\s*([0-9.]+,[0-9]{2})/g)].map(m=>money(m[1]));
 const has2026Inss=values.includes(1621)&&values.includes(8475.55);
 const has2026Irrf=values.includes(2428.80)&&values.includes(4664.68)&&values.includes(607.20);
 if(!has2026Inss||!has2026Irrf) throw new Error("Official pages changed format or expected 2026 values were not found; manual review required.");
 current.updatedAt=new Date().toISOString();
 current.sourceCheck={inssChecked:true,irrfChecked:true,checkedAt:current.updatedAt};
 fs.writeFileSync("legal-rules.json",JSON.stringify(current,null,2)+"\n");
 console.log("Official legal sources checked successfully.");
})();
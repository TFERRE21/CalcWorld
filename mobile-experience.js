(() => {
  "use strict";
  const HISTORY_KEY = "cw-calculation-history-v1";
  const MAX_HISTORY = 30;

  function isAdmin(){ return location.pathname.startsWith("/admin/"); }
  function readHistory(){
    try { const d=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]"); return Array.isArray(d)?d:[]; } catch(_){ return []; }
  }
  function writeHistory(items){ try{ localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,MAX_HISTORY))); }catch(_){} }
  function ctx(){
    const form=document.getElementById("form"), go=document.getElementById("go"), result=document.getElementById("result");
    return form&&go?{form,go,result}:null;
  }
  function fields(){
    const c=ctx(); if(!c)return [];
    return Array.from(c.form.querySelectorAll("input,select,textarea")).map(el=>({id:el.id,value:el.value})).filter(x=>x.id);
  }
  function restore(list){
    const c=ctx(); if(!c)return;
    list.forEach(x=>{const el=document.getElementById(x.id);if(el)el.value=x.value;});
    c.go.click();
  }
  function title(){
    return document.getElementById("title")?.textContent?.trim() ||
      document.querySelector(".calc-page h1")?.textContent?.trim() ||
      document.title.replace(/\s*[—|-].*$/,"").trim() || "Cálculo";
  }
  let toastTimer;
  function toast(msg){
    let el=document.getElementById("cwToast");
    if(!el){el=document.createElement("div");el.id="cwToast";el.className="cw-toast";document.body.appendChild(el);}
    el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove("show"),2400);
  }
  function save(manual){
    const c=ctx();if(!c)return null;
    const item={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:title(),url:location.pathname,fields:fields(),result:c.result?.textContent?.trim()||"",createdAt:new Date().toISOString()};
    const h=readHistory().filter(x=>!(x.url===item.url&&JSON.stringify(x.fields)===JSON.stringify(item.fields)));
    h.unshift(item);writeHistory(h);if(manual)toast("Cálculo salvo neste dispositivo.");return item;
  }
  function esc(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
  function renderHistory(){
    const list=document.getElementById("cwHistoryList");if(!list)return;
    const h=readHistory();
    if(!h.length){list.innerHTML='<div class="cw-empty-history">Ainda não há cálculos salvos neste dispositivo.</div>';return;}
    list.innerHTML=h.map(x=>{
      const d=new Date(x.createdAt),when=Number.isNaN(d.getTime())?"":d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
      return '<article class="cw-history-item"><div><strong>'+esc(x.title)+'</strong><small>'+esc(when)+'</small><span>'+esc(x.result||"Resultado salvo")+'</span></div><div class="cw-history-actions"><button type="button" data-cw-open="'+x.id+'">Abrir</button><button type="button" data-cw-delete="'+x.id+'" aria-label="Excluir">×</button></div></article>';
    }).join("");
  }
  function historyModal(){
    if(document.getElementById("cwHistoryModal"))return;
    const m=document.createElement("div");m.id="cwHistoryModal";m.className="cw-modal";
    m.innerHTML='<div class="cw-modal-backdrop" data-cw-close></div><section class="cw-sheet" role="dialog" aria-modal="true" aria-labelledby="cwHistoryTitle"><div class="cw-sheet-head"><div><div class="eyebrow">CALCWORLD</div><h2 id="cwHistoryTitle">Meus cálculos</h2><p>Salvos apenas neste dispositivo.</p></div><button class="cw-close" type="button" data-cw-close aria-label="Fechar">×</button></div><div id="cwHistoryList"></div><div class="cw-sheet-foot"><button class="btn secondary" type="button" id="cwClearHistory">Limpar histórico</button></div></section></div>';
    document.body.appendChild(m);
    m.addEventListener("click",e=>{
      if(e.target.closest("[data-cw-close]"))m.classList.remove("open");
      const o=e.target.closest("[data-cw-open]");
      if(o){const item=readHistory().find(x=>x.id===o.dataset.cwOpen);if(!item)return;if(location.pathname!==item.url){location.href=item.url+"?cw_restore="+encodeURIComponent(item.id);return;}restore(item.fields||[]);m.classList.remove("open");toast("Cálculo restaurado.");}
      const del=e.target.closest("[data-cw-delete]");
      if(del){writeHistory(readHistory().filter(x=>x.id!==del.dataset.cwDelete));renderHistory();}
    });
    document.getElementById("cwClearHistory").onclick=()=>{writeHistory([]);renderHistory();toast("Histórico limpo.");};
  }
  function showHistory(){historyModal();renderHistory();document.getElementById("cwHistoryModal").classList.add("open");}
  function exportCalc(){
    const c=ctx();if(!c)return;
    const lines=["CalcWorld — "+title(),"Data: "+new Date().toLocaleString("pt-BR"),"","DADOS INFORMADOS",...fields().map(x=>x.id+": "+x.value),"","RESULTADO",c.result?.textContent?.trim()||"—"];
    const url=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"})),a=document.createElement("a");
    a.href=url;a.download="calcworld-"+location.pathname.split("/").filter(Boolean).pop()+".txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function whatsapp(){
    const c=ctx();if(!c)return;
    const text=title()+"\nResultado: "+(c.result?.textContent?.trim()||"—")+"\n\nCalcWorld: "+location.href;
    window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener");
  }
  function addTools(){
    const c=ctx();if(!c||document.getElementById("cwCalcTools"))return;
    const t=document.createElement("div");t.id="cwCalcTools";t.className="cw-calc-tools";
    t.innerHTML='<button type="button" data-cw-action="save">💾 <span>Salvar</span></button><button type="button" data-cw-action="history">🕘 <span>Histórico</span></button><button type="button" data-cw-action="whatsapp">💬 <span>WhatsApp</span></button><button type="button" data-cw-action="print">🖨️ <span>Imprimir</span></button><button type="button" data-cw-action="export">📄 <span>Exportar</span></button>';
    c.form.parentNode.insertBefore(t,c.form);
    t.addEventListener("click",e=>{const a=e.target.closest("[data-cw-action]")?.dataset.cwAction;if(!a)return;if(a==="save")save(true);if(a==="history")showHistory();if(a==="whatsapp")whatsapp();if(a==="print")window.print();if(a==="export")exportCalc();});
    c.go.addEventListener("click",()=>setTimeout(()=>save(false),80));
    const restoreId=new URLSearchParams(location.search).get("cw_restore");
    if(restoreId)setTimeout(()=>{const item=readHistory().find(x=>x.id===restoreId);if(item)restore(item.fields||[]);},150);
  }
  function addNav(){
    if(isAdmin()||document.getElementById("cwMobileNav"))return;
    const nav=document.createElement("nav");nav.id="cwMobileNav";nav.className="cw-mobile-nav";
    const home=location.pathname==="/"||location.pathname==="";
    nav.innerHTML='<a href="'+(home?"#calculadoras":"/")+'" aria-label="Início">⌂<span>Início</span></a><button type="button" data-cw-mobile="search" aria-label="Buscar">⌕<span>Buscar</span></button><button type="button" data-cw-mobile="history" aria-label="Histórico">◷<span>Histórico</span></button><button type="button" data-cw-mobile="theme" aria-label="Tema">☾<span>Tema</span></button>';
    document.body.appendChild(nav);
    nav.addEventListener("click",e=>{const a=e.target.closest("[data-cw-mobile]")?.dataset.cwMobile;if(!a)return;if(a==="search"){if(home){const s=document.getElementById("search");s?.focus();s?.scrollIntoView({behavior:"smooth",block:"center"});}else location.href="/#calculadoras";}if(a==="history")showHistory();if(a==="theme")window.toggleCalcWorldTheme?.();});
  }
  function home(){if(location.pathname!=="/"&&location.pathname!=="")return;document.getElementById("search")?.setAttribute("enterkeyhint","search");}
  function init(){addNav();addTools();home();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
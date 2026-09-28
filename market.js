(() => {
  const $ = id => document.getElementById(id);
  const money = (v, c) => Number.isFinite(v) ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:c||"BRL",maximumFractionDigits:2}).format(v) : "—";
  const pct = v => Number.isFinite(v) ? (v>=0?"+":"")+v.toFixed(2)+"%" : "—";
  const esc = v => String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const presets = {
    crypto:[
      ["BTC/USD","Bitcoin","CRYPTO"],["ETH/USD","Ethereum","CRYPTO"],["SOL/USD","Solana","CRYPTO"],["BNB/USD","BNB","CRYPTO"],
      ["XRP/USD","XRP","CRYPTO"],["ADA/USD","Cardano","CRYPTO"],["DOGE/USD","Dogecoin","CRYPTO"],["AVAX/USD","Avalanche","CRYPTO"],
      ["LINK/USD","Chainlink","CRYPTO"],["DOT/USD","Polkadot","CRYPTO"],["TRX/USD","TRON","CRYPTO"],["LTC/USD","Litecoin","CRYPTO"]
    ],
    stock:[
      ["PETR4","Petrobras","BVMF"],["VALE3","Vale","BVMF"],["ITUB4","Itaú Unibanco","BVMF"],["BBAS3","Banco do Brasil","BVMF"],
      ["BBDC4","Bradesco","BVMF"],["ABEV3","Ambev","BVMF"],["WEGE3","WEG","BVMF"],["MGLU3","Magazine Luiza","BVMF"],
      ["PRIO3","PRIO","BVMF"],["RENT3","Localiza","BVMF"],["SUZB3","Suzano","BVMF"],["ELET3","Eletrobras","BVMF"],
      ["AAPL","Apple","NASDAQ"],["MSFT","Microsoft","NASDAQ"],["NVDA","NVIDIA","NASDAQ"],["AMZN","Amazon","NASDAQ"],
      ["GOOGL","Alphabet","NASDAQ"],["META","Meta Platforms","NASDAQ"],["TSLA","Tesla","NASDAQ"],["NFLX","Netflix","NASDAQ"]
    ],
    fii:[
      ["MXRF11","Maxi Renda","BVMF"],["HGLG11","CSHG Logística","BVMF"],["KNRI11","Kinea Renda Imobiliária","BVMF"],
      ["XPLG11","XP Log","BVMF"],["HGRU11","CSHG Renda Urbana","BVMF"],["VISC11","Vinci Shopping Centers","BVMF"],
      ["BCFF11","BTG Fundo de Fundos","BVMF"],["CPTS11","Capitânia Securities II","BVMF"],["XPML11","XP Malls","BVMF"],
      ["BTLG11","BTG Logística","BVMF"],["IRDM11","Iridium Recebíveis","BVMF"],["MCCI11","Mauá Capital Recebíveis","BVMF"]
    ],
    fund:[
      ["BOVA11","ETF Ibovespa","BVMF"],["IVVB11","ETF S&P 500","BVMF"],["SMAL11","ETF Small Caps","BVMF"],
      ["HASH11","ETF de criptomoedas","BVMF"],["GOLD11","ETF de ouro","BVMF"],["DIVO11","ETF de dividendos","BVMF"],
      ["SPXI11","ETF S&P 500 em reais","BVMF"],["XINA11","ETF China","BVMF"]
    ],
    fx:[
      ["USD/BRL","Dólar","FOREX"],["EUR/BRL","Euro","FOREX"],["GBP/BRL","Libra","FOREX"],["JPY/BRL","Iene","FOREX"],
      ["CAD/BRL","Dólar canadense","FOREX"],["AUD/BRL","Dólar australiano","FOREX"],["CHF/BRL","Franco suíço","FOREX"]
    ]
  };
  let state={quote:null,history:[],currency:"BRL",period:"1y"};

  function allAssets(){ return Object.values(presets).flat(); }
  function currentType(){ return $("assetType").value; }
  function findAsset(query){
    const q=String(query||"").trim().toLowerCase();
    if(!q) return null;
    const list=presets[currentType()]||[];
    return list.find(x=>x[0].toLowerCase()===q || x[1].toLowerCase()===q)
      || list.find(x=>x[0].toLowerCase().startsWith(q) || x[1].toLowerCase().startsWith(q))
      || null;
  }
  function presetList(type, filter=""){
    const list=presets[type]||presets.stock;
    const q=String(filter||"").trim().toLowerCase();
    const rows=q ? list.filter(x=>x[0].toLowerCase().includes(q)||x[1].toLowerCase().includes(q)) : list;
    $("assetPresets").innerHTML=rows.length
      ? rows.map(x=>'<button type="button" data-symbol="'+esc(x[0])+'" data-name="'+esc(x[1])+'" data-exchange="'+esc(x[2])+'"><strong>'+esc(x[0])+'</strong><span>'+esc(x[1])+'</span></button>').join("")
      : '<div class="asset-list-empty">Nenhum ativo desta categoria corresponde à pesquisa.</div>';
    $("assetPresets").querySelectorAll("button").forEach(b=>b.onclick=()=>{
      $("symbol").value=b.dataset.symbol;
      $("exchange").value=b.dataset.exchange==="CRYPTO"?"":b.dataset.exchange;
      $("symbolSuggestions").innerHTML="";
      loadAll();
    });
  }
  function syncTypedAsset(){
    const asset=findAsset($("symbol").value);
    if(asset){
      $("symbol").value=asset[0];
      $("exchange").value=asset[2]==="CRYPTO"?"":asset[2];
      presetList(currentType(), asset[0]);
      return asset;
    }
    presetList(currentType(), $("symbol").value);
    return null;
  }
  async function getJSON(url){
    const r=await fetch(url,{cache:"no-store"});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||"Erro ao consultar mercado");
    return d;
  }
  function setStatus(text,kind=""){ $("marketStatus").textContent=text; $("marketStatus").className="market-status "+kind; }function searchSymbols(){
    const q=$("symbol").value.trim();
    const box=$("symbolSuggestions");
    const list=presets[currentType()]||[];
    if(!q){ if(box) box.innerHTML=""; presetList(currentType()); return; }
    const rows=list.filter(x=>x[0].toLowerCase().includes(q.toLowerCase())||x[1].toLowerCase().includes(q.toLowerCase())).slice(0,10);
    if(!box)return;
    box.innerHTML=rows.map(x=>'<button type="button" class="symbol-option" data-symbol="'+esc(x[0])+'" data-exchange="'+esc(x[2])+'"><strong>'+esc(x[0])+'</strong><span>'+esc(x[1])+' • '+esc(x[2])+'</span></button>').join("")
      || '<div class="symbol-empty">Nenhum ativo encontrado na lista.</div>';
    box.querySelectorAll(".symbol-option").forEach(b=>b.onclick=()=>{
      $("symbol").value=b.dataset.symbol;
      $("exchange").value=b.dataset.exchange==="CRYPTO"?"":b.dataset.exchange;
      box.innerHTML="";
      presetList(currentType(),b.dataset.symbol);
      loadAll();
    });
    presetList(currentType(),q);
  }

  function drawChart(values){
    const el=$("marketChart");
    if(!values.length){el.innerHTML='<div class="chart-empty">Histórico indisponível para este ativo.</div>';return;}
    const w=900,h=300,p=24, ys=values.map(x=>x.close), min=Math.min(...ys),max=Math.max(...ys),range=max-min||1;
    const points=values.map((x,i)=>{const X=p+(i/(values.length-1||1))*(w-p*2),Y=h-p-((x.close-min)/range)*(h-p*2);return X.toFixed(1)+","+Y.toFixed(1)}).join(" ");
    const first=values[0].close,last=values[values.length-1].close;
    el.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" role="img" aria-label="Gráfico histórico"><defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#2563eb" stop-opacity=".22"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs><polyline points="'+points+'" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><polyline points="'+p+','+(h-p)+' '+points+' '+(w-p)+','+(h-p)+'" fill="url(#cg)" stroke="none"/></svg><div class="chart-range"><span>'+money(min,state.quote?.currency)+'</span><span>'+money(max,state.quote?.currency)+'</span><span>Período: '+esc(state.period)+'</span></div>';
  }
  function renderQuote(q){
    state.quote=q;
    $("marketName").textContent=q.name||q.symbol;
    $("marketSymbol").textContent=q.symbol+(q.exchange?" • "+q.exchange:"");
    $("marketPrice").textContent=money(q.price,q.currency);
    $("marketChange").textContent=pct(q.percentChange);
    $("marketChange").className="market-change "+(q.percentChange>=0?"up":"down");
    $("marketMeta").innerHTML='<span>Moeda: <b>'+esc(q.currency)+'</b></span><span>Anterior: <b>'+money(q.previousClose,q.currency)+'</b></span><span>Atualização: <b>'+esc(q.datetime||"—")+'</b></span>';
  }
  function renderBacktest(values){
    const amount=Number($("backtestAmount").value||0), date=$("backtestDate").value;
    if(!amount||!date||!state.quote||!values.length){$("backtestResult").innerHTML="Informe valor e data para simular.";return;}
    const start=values.find(x=>x.datetime.slice(0,10)>=date)||values[0], current=values[values.length-1];
    const units=amount/start.close, currentValue=units*current.close, result=(currentValue/amount-1)*100;
    $("backtestResult").innerHTML='<div><small>Se você tivesse investido</small><strong>'+money(amount,state.quote.currency)+'</strong></div><div><small>Na data</small><strong>'+esc(start.datetime.slice(0,10))+'</strong></div><div><small>Preço de entrada</small><strong>'+money(start.close,state.quote.currency)+'</strong></div><div><small>Valor estimado hoje</small><strong>'+money(currentValue,state.quote.currency)+'</strong></div><div><small>Variação pelo preço</small><strong class="'+(result>=0?"up":"down")+'">'+pct(result)+'</strong></div><p>Simulação por variação de preço. Não inclui corretagem, impostos, dividendos, splits ou outros eventos quando não incorporados pelo provedor.</p>';
  }
  async function loadAll(){
    let symbol=$("symbol").value.trim(), exchange=$("exchange").value.trim(), period=state.period;
    const asset=findAsset(symbol);
    if(!symbol){setStatus("Escolha um ativo da lista ou digite para filtrar a lista.","error");return;}
    if(!asset){
      setStatus("Esse ativo não está na lista disponível para a categoria selecionada.","error");
      presetList(currentType(),symbol);
      return;
    }
    symbol=asset[0];
    exchange=asset[2]==="CRYPTO"?"":asset[2];
    $("symbol").value=symbol;
    $("exchange").value=exchange;
    setStatus("Consultando dados de mercado…");
    $("marketName").textContent="Carregando…";$("marketPrice").textContent="—";$("marketChart").innerHTML='<div class="chart-empty">Carregando histórico…</div>';
    try{
      const displayCurrency=$("currencyDisplay").value;
      const q=await getJSON("/api/market/overview?symbol="+encodeURIComponent(symbol)+"&exchange="+encodeURIComponent(exchange)+"&period="+encodeURIComponent(period)+"&currency="+encodeURIComponent(displayCurrency));
      if(!q || !q.values?.length){
        throw new Error("A pesquisa não encontrou histórico verificável para este ativo.");
      }
      renderQuote(q);
      state.history=q.values||[];
      drawChart(state.history);
      renderBacktest(state.history);
      const note=q.sourceNote ? " "+q.sourceNote : "";
      setStatus("Dados pesquisados pela OpenAI na web. Atualização: "+(q.datetime||"data não informada")+"."+note,"ok");
    }catch(e){setStatus(e.message || "Não foi possível consultar os dados de mercado pela OpenAI.","error");$("marketChart").innerHTML='<div class="chart-empty">Não foi possível carregar os dados.</div>';}
  }
  function periodButtons(){
    document.querySelectorAll("[data-period]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-period]").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.period=b.dataset.period;loadAll();});
  }
  $("assetType").onchange=e=>{ $("symbol").value=""; $("exchange").value=""; $("symbolSuggestions").innerHTML=""; presetList(e.target.value); };
  $("currencyDisplay").onchange=e=>{state.currency=e.target.value;if(state.quote)loadAll();};
  $("marketSearch").onsubmit=e=>{e.preventDefault();loadAll()};
  $("symbol").addEventListener("input",()=>{searchSymbols();});
  $("backtestDate").value=new Date(new Date().setFullYear(new Date().getFullYear()-1)).toISOString().slice(0,10);
  $("backtestAmount").oninput=()=>renderBacktest(state.history);
  periodButtons();
  presetList("crypto");
  loadAll();
})();
const loginView=document.getElementById("loginView");
const dashboard=document.getElementById("dashboard");
const loginForm=document.getElementById("loginForm");
const loginError=document.getElementById("loginError");
const refreshBtn=document.getElementById("refreshBtn");
const logoutBtn=document.getElementById("logoutBtn");
const chart=document.getElementById("chart");
const chartLabels=document.getElementById("chartLabels");
const topPages=document.getElementById("topPages");
const status=document.getElementById("status");

function fmt(n){return new Intl.NumberFormat("pt-BR").format(n||0)}
function showLogin(){loginView.hidden=false;dashboard.hidden=true}
function showDashboard(){loginView.hidden=true;dashboard.hidden=false}

async function api(url,options){
  const r=await fetch(url,Object.assign({credentials:"same-origin"},options||{}));
  let data=null;try{data=await r.json()}catch(e){}
  if(!r.ok)throw new Error(data&&data.error?data.error:"Erro na solicitação");
  return data;
}

async function checkSession(){
  try{await api("/api/admin/me");showDashboard();await loadAnalytics()}catch(e){showLogin()}
}

loginForm.addEventListener("submit",async e=>{
  e.preventDefault();loginError.textContent="";
  const btn=loginForm.querySelector("button");btn.disabled=true;
  try{await api("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:document.getElementById("email").value,password:document.getElementById("password").value})});loginForm.reset();showDashboard();await loadAnalytics()}
  catch(err){loginError.textContent=err.message}
  finally{btn.disabled=false}
});

logoutBtn.addEventListener("click",async()=>{try{await api("/api/admin/logout",{method:"POST"})}finally{showLogin()}});
refreshBtn.addEventListener("click",loadAnalytics);

function drawChart(rows){
  chart.innerHTML="";
  const max=Math.max(1,...rows.map(x=>x.visits));
  rows.forEach(x=>{
    const wrap=document.createElement("div");wrap.className="bar-wrap";
    const bar=document.createElement("div");bar.className="bar";bar.style.height=Math.max(4,(x.visits/max)*100)+"%";bar.title=x.date+": "+fmt(x.visits)+" visitas";
    wrap.appendChild(bar);chart.appendChild(wrap);
  });
  chartLabels.innerHTML="";
  rows.forEach((x,i)=>{
    const s=document.createElement("span");s.textContent=i===0||i===rows.length-1?x.date.slice(5):"";chartLabels.appendChild(s);
  });
}

function renderTopPages(items){
  topPages.innerHTML=items.length?items.map(x=>"<tr><td title=\""+x.page+"\">"+x.page+"</td><td>"+fmt(x.views)+"</td></tr>").join(""):"<tr><td colspan=\"2\">Ainda não há dados.</td></tr>";
}

async function loadAnalytics(){
  status.textContent="Atualizando…";refreshBtn.disabled=true;
  try{
    const d=await api("/api/admin/analytics");
    document.getElementById("today").textContent=fmt(d.today.visits);
    document.getElementById("yesterday").textContent=fmt(d.yesterday.visits);
    document.getElementById("last7").textContent=fmt(d.last7.visits);
    document.getElementById("last30").textContent=fmt(d.last30.visits);
    document.getElementById("pageviews").textContent=fmt(d.last30.pageviews);
    document.getElementById("unique").textContent=fmt(d.last30.uniqueVisitors);
    document.getElementById("total").textContent=fmt(d.total.visits);
    document.getElementById("tracked").textContent=fmt(d.daysTracked);
    drawChart(d.chart);renderTopPages(d.topPages);
    status.textContent="Atualizado agora • "+d.timezone;
  }catch(e){status.textContent=e.message;if(e.message==="Unauthorized")showLogin()}
  finally{refreshBtn.disabled=false}
}
checkSession();
(() => {
"use strict";
/* Contradicta 2.0 — cliente. Datos compartidos vía API + eventos en vivo (SSE). */

const CATS = ["Política nacional","Política internacional","Mexicanos en el extranjero","Economía","Sociedad","Derechos","Medio ambiente","Cultura","Otro"];
const TYPES = {
  single:   {name:"Opción única",   desc:"Elegir una sola respuesta."},
  multiple: {name:"Opción múltiple",desc:"Marcar varias respuestas."},
  likert:   {name:"Grado de acuerdo",desc:"De totalmente en desacuerdo a totalmente de acuerdo."},
  spectrum: {name:"Espectro",       desc:"Ubicarse entre dos polos opuestos (0–10)."}
};
const LIKERT = ["Totalmente en desacuerdo","En desacuerdo","Neutral","De acuerdo","Totalmente de acuerdo"];
const REGION_NAME = {mx:"México", ext:"El extranjero"};

/* Preguntas frecuentes por categoría: [pregunta, tipo, opciones | [polo0, polo10]] */
const SUGGEST = {
  "Política nacional":[
    ["¿Cómo calificas el desempeño del gobierno federal?","likert"],
    ["¿Apruebas la elección por voto popular de jueces y ministros?","single",["Sí","No","No sé"]],
    ["¿Qué tema debe ser la prioridad del gobierno?","single",["Seguridad","Economía y empleo","Salud","Educación","Corrupción"]],
    ["¿Dónde te ubicas políticamente?","spectrum",["Izquierda","Derecha"]],
    ["¿Debe mantenerse la Guardia Nacional bajo mando militar?","single",["Sí","No","No sé"]],
    ["¿Qué tanto confías en el INE?","likert"]
  ],
  "Política internacional":[
    ["¿Cómo debe ser la relación de México con Estados Unidos?","spectrum",["Mayor autonomía","Mayor integración"]],
    ["¿Debe México revisar el T-MEC?","single",["Sí, renegociarlo","Mantenerlo igual","Salir del tratado","No sé"]],
    ["¿Cuál debe ser la postura ante la migración en tránsito por México?","single",["Contención y control","Regularización y acogida","Equilibrio entre ambas","No sé"]],
    ["¿Debe México mantener una política exterior de no intervención?","likert"],
    ["¿Con qué región debe México fortalecer sus lazos?","multiple",["Norteamérica","América Latina","Europa","Asia","África"]]
  ],
  "Mexicanos en el extranjero":[
    ["¿Debe facilitarse el voto de los mexicanos en el extranjero?","single",["Sí, con voto por internet","Sí, con más casillas en consulados","Mantenerlo como está","No sé"]],
    ["¿Debe haber diputados y senadores que representen a los migrantes?","single",["Sí","No","No sé"]],
    ["¿Cómo calificas la atención de los consulados mexicanos?","likert"],
    ["¿Qué debe priorizar el gobierno para los mexicanos en el extranjero?","single",["Protección legal y consular","Documentos de identidad","Defensa ante deportaciones","Facilidades para enviar remesas","Programas de retorno"]],
    ["¿Qué tanto te afecta el impuesto de 1% de EE. UU. a las remesas pagadas en efectivo (vigente desde enero de 2026)?","likert"],
    ["¿Cómo debe responder México a las deportaciones masivas?","spectrum",["Cooperación con EE. UU.","Confrontación diplomática"]],
    ["¿Planeas regresar a vivir a México?","single",["Sí, pronto","Algún día","No","No sé"]],
    ["¿Qué apoyos necesitan los connacionales que regresan a México?","multiple",["Empleo","Revalidación de estudios","Vivienda","Salud","Trámites de identidad"]]
  ],
  "Economía":[
    ["¿Quién debe dirigir la economía?","spectrum",["Estado","Mercado"]],
    ["¿Cómo percibes tu situación económica frente al año pasado?","single",["Mejor","Igual","Peor"]],
    ["¿Debe aumentar el salario mínimo por encima de la inflación?","likert"],
    ["¿Qué tipo de reforma fiscal apoyas?","single",["Más impuestos a altos ingresos","Menos impuestos en general","Mantener como está","No sé"]],
    ["¿Debe el sector energético estar en manos del Estado?","spectrum",["Control estatal","Apertura privada"]],
    ["¿Cuál es el principal problema económico del país?","single",["Inflación","Desempleo","Bajos salarios","Informalidad","Desigualdad"]]
  ],
  "Sociedad":[
    ["¿Cuál es el principal problema de tu comunidad?","single",["Inseguridad","Falta de empleo","Servicios públicos","Transporte","Contaminación"]],
    ["¿Te sientes seguro en tu colonia?","likert"],
    ["¿Debe legalizarse el uso recreativo de la marihuana?","single",["Sí","No","No sé"]],
    ["¿Qué tanto confías en la policía local?","likert"],
    ["¿Los programas sociales deben ser universales o focalizados?","spectrum",["Universales","Focalizados"]]
  ],
  "Derechos":[
    ["¿Apoyas el matrimonio igualitario en todo el país?","single",["Sí","No","No sé"]],
    ["¿Debe despenalizarse el aborto en todo el país?","single",["Sí","No","No sé"]],
    ["¿Se respeta la libertad de expresión en México?","likert"],
    ["¿Qué derecho está menos garantizado hoy?","single",["Salud","Vivienda","Seguridad","Acceso a la justicia","Educación"]],
    ["¿Seguridad o libertades civiles: qué debe priorizarse?","spectrum",["Libertades civiles","Seguridad"]]
  ],
  "Medio ambiente":[
    ["¿Debe México acelerar la transición a energías renovables?","likert"],
    ["¿Crecimiento económico o protección ambiental?","spectrum",["Protección ambiental","Crecimiento económico"]],
    ["¿Cuál es el problema ambiental más grave?","single",["Escasez de agua","Contaminación del aire","Deforestación","Basura y plásticos","Cambio climático"]],
    ["¿Apoyas prohibir los plásticos de un solo uso?","single",["Sí","No","No sé"]],
    ["¿Qué tanto te preocupa la falta de agua en tu ciudad?","likert"]
  ],
  "Cultura":[
    ["¿Debe aumentar el presupuesto público para cultura?","likert"],
    ["¿Qué actividades culturales realizas con frecuencia?","multiple",["Leer","Cine","Museos","Conciertos","Teatro","Ninguna"]],
    ["¿Cómo te informas principalmente sobre política?","single",["Redes sociales","Televisión","Prensa digital","Radio","Conversaciones"]],
    ["¿Los medios de comunicación son imparciales?","likert"],
    ["¿Debe regularse la desinformación en redes sociales?","spectrum",["Sin regulación","Regulación estricta"]]
  ],
  "Otro":[
    ["¿Qué tan interesado estás en la política?","likert"],
    ["¿Participarías en una consulta popular?","single",["Sí","No","Depende del tema"]],
    ["¿Qué tema quieres que encuestemos después?","single",["Seguridad","Economía","Elecciones","Derechos","Medio ambiente"]],
    ["¿Qué tan útiles te parecen las encuestas de opinión?","likert"]
  ]
};
const sugFor = cat => cat==="Todas" ? CATS.flatMap(c=>(SUGGEST[c]||[]).slice(0,1).map(x=>[...x,c])) : (SUGGEST[cat]||[]).map(x=>[...x,cat]);

/* ---------- Estado ---------- */
const store = (k, v) => { try { if (v===undefined) return localStorage.getItem(k); if (v===null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch(_) { return null; } };
const S = {
  polls:new Map(), loaded:false, failed:false, stats:null, online:0, live:false,
  region: store("region") || null,
  admin: store("adminToken") || "",
  filter:{cat:"Todas", q:"", sort:"recientes"},
  draft:{}, builtFor:null, detail:{id:null, args:[], canManage:false}
};
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Number(n||0).toLocaleString("es-MX");
const getPoll = id => S.polls.get(id);
let toastT;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"), 2400); }
function ago(ts){
  const s=Math.max(1,Math.round((Date.now()-ts)/1000));
  if (s<60) return "hace un momento"; const m=Math.round(s/60); if (m<60) return `hace ${m} min`;
  const h=Math.round(m/60); if (h<24) return `hace ${h} h`; const d=Math.round(h/24); if (d<30) return `hace ${d} d`;
  return new Date(ts).toLocaleDateString("es",{day:"numeric",month:"short",year:"numeric"});
}

/* ---------- API ---------- */
async function api(method, url, body){
  const headers = {"Accept":"application/json"};
  if (body!==undefined) headers["Content-Type"]="application/json";
  if (S.admin) headers["X-Admin-Token"]=S.admin;
  const r = await fetch(url, {method, headers, credentials:"same-origin", body: body===undefined?undefined:JSON.stringify(body)});
  let data=null; try { data = await r.json(); } catch(_){}
  if (!r.ok){ const e = new Error((data&&data.error)||"No se pudo completar la acción."); e.status=r.status; e.data=data; throw e; }
  return data;
}
function mergePoll(p){
  const old = S.polls.get(p.id);
  if (old && !("myVote" in p)) { p.myVote = old.myVote; p.mine = old.mine; }
  S.polls.set(p.id, p);
}

/* ---------- Tensión ---------- */
const tensionOf = p => p.agg ? p.agg.tension : null;
function tensionLabel(t){
  if (t===null || t===undefined) return "Sin datos suficientes";
  if (t<.34) return "Consenso";
  if (t<.67) return "Disputa";
  return "Contradicción aguda";
}
function stanceLabel(p, v){
  if (v===null || v===undefined) return "";
  if (p.type==="single") return p.options[v] ?? "";
  if (p.type==="multiple") return (Array.isArray(v)?v:[v]).map(i=>p.options[i]).filter(Boolean).join(" + ");
  if (p.type==="likert") return LIKERT[v-1] ?? "";
  return v<5 ? `${v}/10 · hacia ${p.left}` : v>5 ? `${v}/10 · hacia ${p.right}` : "5/10 · al centro";
}

/* ---------- Rutas ---------- */
function route(){ return (location.hash||"").replace(/^#/,"") || "encuestas"; }
function render(force){
  const r = route();
  document.querySelectorAll("#tabs a").forEach(a=>a.classList.toggle("on", a.dataset.r===r || (a.dataset.r==="encuestas" && r.startsWith("p-"))));
  if (r==="crear"){ if (force || S.builtFor!=="crear") renderCreate(); return; }
  if (r==="manifiesto"){ if (force || S.builtFor!=="manifiesto") renderAbout(); return; }
  if (r==="pulso") return renderPulse();
  if (r.startsWith("p-")) return renderDetail(r.slice(2), force);
  renderList();
}
window.addEventListener("hashchange", ()=>{
  const r = route();
  if (r.startsWith("admin=")){ S.admin = decodeURIComponent(r.slice(6)); store("adminToken", S.admin || null); toast(S.admin?"Modo administración activado":"Modo administración desactivado"); location.hash="encuestas"; return; }
  S.builtFor=null; render(true); window.scrollTo(0,0);
});

/* ---------- Región del participante ---------- */
function paintRegion(){
  document.querySelectorAll("#region button").forEach(b=>b.classList.toggle("on", b.dataset.g===S.region));
}
document.querySelectorAll("#region button").forEach(b=>b.addEventListener("click", ()=>{
  S.region = S.region===b.dataset.g ? null : b.dataset.g;
  store("region", S.region);
  paintRegion();
  toast(S.region ? `Participas desde ${REGION_NAME[S.region].toLowerCase()}` : "Región sin indicar");
  const r=route(); if (r.startsWith("p-")) { const p=getPoll(r.slice(2)); if (p) renderVote(p); }
}));

/* ---------- Estado de conexión ---------- */
function paintStatus(){
  const el=$("#status");
  if (S.failed && !S.loaded){ el.className="status warn"; el.textContent="No se pudo conectar con el servidor. Reintentando…"; return; }
  if (!S.loaded){ el.className="status warn"; el.textContent="Conectando…"; return; }
  const st=S.stats||{};
  el.className="status"+(S.live?"":" warn");
  el.innerHTML = `${S.live?"En vivo":"Reconectando…"} · ${fmt(S.polls.size)} encuestas · ${fmt(st.participants)} participantes · ${fmt(st.votes)} votos<span class="live">${S.online?`${S.online} ${S.online===1?"persona":"personas"} conectadas`:""}</span>`;
}
function refreshStats(){
  const voters = S.stats ? S.stats.participants : 0;
  let votes=0, args=0; for (const p of S.polls.values()){ votes+=p.agg.n; args+=p.argsCount||0; }
  S.stats = {...(S.stats||{}), polls:S.polls.size, votes, args, participants: Math.max(voters, 0)};
}

/* ---------- Lista ---------- */
function renderList(){
  const v = $("#view");
  const searchHadFocus = document.activeElement && document.activeElement.id==="q";
  let polls = [...S.polls.values()];
  const f = S.filter;
  if (f.cat!=="Todas") polls = polls.filter(p=>p.category===f.cat);
  if (f.q.trim()){ const q=f.q.toLowerCase(); polls = polls.filter(p=>(p.title+" "+(p.description||"")).toLowerCase().includes(q)); }
  if (f.sort==="recientes") polls.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if (f.sort==="votadas") polls.sort((a,b)=>b.agg.n-a.agg.n);
  if (f.sort==="tensas") polls.sort((a,b)=>(tensionOf(b)??-1)-(tensionOf(a)??-1));
  if (f.sort==="tendencia") polls.sort((a,b)=>b.agg.last24-a.agg.last24 || b.agg.n-a.agg.n);
  if (f.sort==="debatidas") polls.sort((a,b)=>(b.argsCount||0)-(a.argsCount||0));

  const cards = polls.map(p=>{ const t=p.agg, tn=tensionOf(p); const fresh = Date.now()-(p.createdAt||0) < 864e5;
    return `
    <a class="card" href="#p-${esc(p.id)}">
      <div class="meta"><span class="tag">${esc(p.category)}</span><span>${esc(TYPES[p.type]?.name||"")}</span>${p.closed?'<span class="tag red">Cerrada</span>':""}${fresh&&!p.closed?'<span class="badge-new">Nueva</span>':""}${p.myVote!==null&&p.myVote!==undefined?"<span>· votaste</span>":""}</div>
      <h3>${esc(p.title)}</h3>
      <div class="foot"><span>${fmt(t.n)} ${t.n===1?"voto":"votos"}${t.last24?` <span class="hot">· +${t.last24} hoy</span>`:""}${p.argsCount?` <span class="args-n">· ${p.argsCount} arg.</span>`:""}</span>
        <span style="display:flex;align-items:center">${tn===null?"Tensión —":"Tensión "+Math.round(tn*100)}<span class="tbar"><i style="width:${Math.round((tn||0)*100)}%"></i></span></span></div>
    </a>`; }).join("");

  v.innerHTML = `
    <h2 class="sec">Encuestas abiertas al debate</h2>
    <div class="toolbar">
      <input id="q" list="qsug" autocomplete="off" placeholder="Buscar una pregunta… (p. ej. ${esc((sugFor(f.cat)[0]||[""])[0])})" value="${esc(f.q)}" aria-label="Buscar">
      <datalist id="qsug">${sugFor(f.cat).concat(f.cat==="Todas"?CATS.flatMap(c=>(SUGGEST[c]||[]).slice(1)):[]).map(x=>`<option value="${esc(x[0])}">`).join("")}</datalist>
      <select id="sort" aria-label="Ordenar">
        <option value="recientes"${f.sort==="recientes"?" selected":""}>Más recientes</option>
        <option value="tendencia"${f.sort==="tendencia"?" selected":""}>En tendencia (24 h)</option>
        <option value="votadas"${f.sort==="votadas"?" selected":""}>Más votadas</option>
        <option value="tensas"${f.sort==="tensas"?" selected":""}>Más tensas</option>
        <option value="debatidas"${f.sort==="debatidas"?" selected":""}>Más debatidas</option>
      </select>
    </div>
    <div class="chips">${["Todas",...CATS].map(c=>`<button class="chip${f.cat===c?" on":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="sugg">
      <div class="sugg-h"><span>Preguntas frecuentes · ${esc(f.cat==="Todas"?"todas las categorías":f.cat)}</span><small>Toca una para votarla o crearla</small></div>
      <div class="sugg-list">${sugFor(f.cat).map((x,i)=>{ const ex=[...S.polls.values()].find(p=>p.title.trim().toLowerCase()===x[0].toLowerCase());
        return `<button class="sugg-item" data-s="${i}"><span class="sugg-t">${esc(TYPES[x[1]].name)}</span>${esc(x[0])}<span class="sugg-go">${ex?"Votar →":"Crear +"}</span></button>`; }).join("")}</div>
    </div>
    ${!S.loaded ? `<div class="empty">${S.failed?"No se pudo conectar. Reintentando…":"Cargando encuestas…"}</div>`
      : cards ? `<div class="grid">${cards}</div>`
      : `<div class="empty">${S.polls.size?"Ninguna encuesta coincide con el filtro.":"Aún no hay encuestas."}<br><br><a class="btn" href="#crear">Crear la primera</a></div>`}
  `;
  S.builtFor="encuestas";
  const qi=$("#q");
  qi.addEventListener("input", e=>{ S.filter.q=e.target.value; renderList(); });
  v.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click", ()=>{
    const x=sugFor(S.filter.cat)[Number(b.dataset.s)];
    const ex=[...S.polls.values()].find(p=>p.title.trim().toLowerCase()===x[0].toLowerCase());
    if (ex){ location.hash="p-"+ex.id; return; }
    S.prefill={title:x[0], type:x[1], extra:x[2], category:x[3]};
    location.hash="crear";
  }));
  if (searchHadFocus){ qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  $("#sort").addEventListener("change", e=>{ S.filter.sort=e.target.value; renderList(); });
  v.querySelectorAll("[data-cat]").forEach(b=>b.addEventListener("click", ()=>{ S.filter.cat=b.dataset.cat; renderList(); }));
}

/* ---------- Pulso (panel general) ---------- */
function renderPulse(){
  S.builtFor="pulso";
  const v=$("#view");
  const polls=[...S.polls.values()];
  const st=S.stats||{};
  const withT = polls.filter(p=>tensionOf(p)!==null);
  const avgT = withT.length ? withT.reduce((s,p)=>s+tensionOf(p),0)/withT.length : null;
  const rank = (arr, val) => arr.length ? `<div class="rank">${arr.map((p,i)=>`<a href="#p-${esc(p.id)}"><i>${i+1}</i><span>${esc(p.title)}</span><b>${val(p)}</b></a>`).join("")}</div>` : `<div class="empty">Aún no hay datos.</div>`;
  const tense = [...withT].sort((a,b)=>tensionOf(b)-tensionOf(a)).slice(0,5);
  const consensus = [...withT].sort((a,b)=>tensionOf(a)-tensionOf(b)).slice(0,5);
  const voted = [...polls].filter(p=>p.agg.n).sort((a,b)=>b.agg.n-a.agg.n).slice(0,5);
  const trending = [...polls].filter(p=>p.agg.last24).sort((a,b)=>b.agg.last24-a.agg.last24).slice(0,5);
  const heat = CATS.map(c=>{ const ps=withT.filter(p=>p.category===c); const n=polls.filter(p=>p.category===c).reduce((s,p)=>s+p.agg.n,0);
    const w=ps.reduce((s,p)=>s+p.agg.n,0); const t = ps.length ? ps.reduce((s,p)=>s+tensionOf(p)*p.agg.n,0)/(w||1) : null; return {c,t,n,k:polls.filter(p=>p.category===c).length}; });
  v.innerHTML = `
    <h2 class="sec">Pulso de la contradicción</h2>
    <div class="kpis">
      <div><b>${fmt(st.participants)}</b><span>participantes</span></div>
      <div><b>${fmt(st.votes)}</b><span>votos emitidos</span></div>
      <div><b>${fmt(polls.length)}</b><span>encuestas</span></div>
      <div><b>${fmt(st.args)}</b><span>argumentos publicados</span></div>
      <div><b>${avgT===null?"—":Math.round(avgT*100)}</b><span>tensión media · ${tensionLabel(avgT).toLowerCase()}</span></div>
    </div>
    <div class="two-col">
      <section class="panel"><h4>Contradicciones más agudas</h4>${rank(tense, p=>Math.round(tensionOf(p)*100))}</section>
      <section class="panel"><h4>Mayor consenso</h4>${rank(consensus, p=>Math.round(tensionOf(p)*100))}</section>
      <section class="panel"><h4>Más votadas</h4>${rank(voted, p=>fmt(p.agg.n)+" votos")}</section>
      <section class="panel"><h4>En tendencia · últimas 24 h</h4>${rank(trending, p=>"+"+fmt(p.agg.last24))}</section>
    </div>
    <h2 class="sec">Tensión por categoría</h2>
    <div class="heat">${heat.map(h=>`<div style="background:${h.t===null?"var(--card)":`rgba(255,61,90,${(0.08+h.t*0.45).toFixed(2)})`}">
      <span>${esc(h.c)}</span><b>${h.t===null?"—":Math.round(h.t*100)}</b><small>${h.k} ${h.k===1?"encuesta":"encuestas"} · ${fmt(h.n)} votos</small></div>`).join("")}</div>
    <p class="note" style="margin-top:14px">Tensión ponderada por número de votos. 0 = unanimidad; 100 = polarización máxima.</p>`;
}

/* ---------- Detalle ---------- */
async function loadDetail(pid){
  try {
    const d = await api("GET", `/api/polls/${encodeURIComponent(pid)}`);
    mergePoll(d.poll);
    S.detail = {id:pid, args:d.args, canManage:d.canManage};
  } catch(e){
    if (e.status===404){ S.polls.delete(pid); S.detail={id:pid, args:[], canManage:false, missing:true}; }
  }
  if (route()==="p-"+pid) render(true);
}
function renderDetail(pid, force){
  const v = $("#view");
  const p = getPoll(pid);
  if (S.detail.id!==pid){ S.detail={id:pid, args:[], canManage:false, loading:true}; loadDetail(pid); }
  if (!p){
    S.builtFor=null;
    v.innerHTML = `<a class="back" href="#encuestas">← Todas las encuestas</a><div class="empty">${S.detail.missing||(S.loaded&&!S.detail.loading)?"Esta encuesta no existe o fue eliminada.":"Cargando encuesta…"}</div>`;
    return;
  }
  if (force || S.builtFor!=="p-"+pid){
    const closes = p.closesAt && !p.closed ? `<span>· cierra ${new Date(p.closesAt).toLocaleString("es",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>` : "";
    v.innerHTML = `
      <a class="back" href="#encuestas">← Todas las encuestas</a>
      <div class="detail">
        <div class="q-head">
          <div class="meta"><span class="tag">${esc(p.category)}</span><span>${esc(TYPES[p.type]?.name||"")}</span>${p.closed?'<span class="tag red">Cerrada</span>':""}<span>${p.createdAt?new Date(p.createdAt).toLocaleDateString("es",{day:"numeric",month:"long",year:"numeric"}):""}</span>${closes}</div>
          <h2>${esc(p.title)}</h2>
          ${p.description?`<p>${esc(p.description)}</p>`:""}
          <div class="share" style="margin-top:16px">
            <button class="btn ghost" id="sh-copy">Copiar enlace</button>
            ${navigator.share?'<button class="btn ghost" id="sh-native">Compartir…</button>':""}
            <a class="btn ghost" id="sh-wa" target="_blank" rel="noopener">WhatsApp</a>
            <a class="btn ghost" id="sh-x" target="_blank" rel="noopener">X</a>
            <a class="btn ghost" href="/api/polls/${esc(p.id)}/export.csv" download>Descargar CSV</a>
          </div>
        </div>
        <section class="panel" id="vote-panel"></section>
        <section class="panel" id="res-panel"></section>
        <section class="panel cmp-panel" id="cmp-panel"></section>
        <section class="panel args" id="args-panel"></section>
        <div class="q-head row" id="admin"></div>
      </div>`;
    S.builtFor="p-"+pid;
    wireShare(p);
    renderVote(p); renderAdmin(p);
  }
  renderResults(p); renderCompare(p); renderArgs(p);
}

function wireShare(p){
  const url = `${location.origin}/p/${encodeURIComponent(p.id)}`;
  const text = `${p.title} — toma posición en Contradicta`;
  $("#sh-copy").addEventListener("click", async ()=>{ try { await navigator.clipboard.writeText(url); toast("Enlace copiado"); } catch(_){ prompt("Copia el enlace:", url); } });
  const n=$("#sh-native"); if (n) n.addEventListener("click", ()=>navigator.share({title:"Contradicta", text, url}).catch(()=>{}));
  $("#sh-wa").href = "https://wa.me/?text="+encodeURIComponent(text+" "+url);
  $("#sh-x").href = "https://x.com/intent/post?text="+encodeURIComponent(text)+"&url="+encodeURIComponent(url);
}

function renderVote(p){
  const box = $("#vote-panel"); if (!box) return;
  const current = p.myVote ?? undefined;
  const d = S.draft[p.id] !== undefined ? S.draft[p.id] : current;
  const disabled = p.closed;
  let body="";
  if (p.type==="single" || p.type==="multiple"){
    const sel = new Set(Array.isArray(d)?d:(d!==undefined?[d]:[]));
    body = p.options.map((o,i)=>`<button class="opt${p.type==="single"?" round":""}${sel.has(i)?" sel":""}" data-i="${i}" ${disabled?"disabled":""}><span class="box"></span><span>${esc(o)}</span></button>`).join("");
  } else if (p.type==="likert"){
    body = `<div class="likert">${LIKERT.map((l,i)=>`<button class="opt${d===i+1?" sel":""}" data-i="${i+1}" ${disabled?"disabled":""}><b>${i+1}</b>${esc(l)}</button>`).join("")}</div>`;
  } else {
    const val = d!==undefined ? d : 5;
    body = `<div class="spectrum">
      <div class="poles"><span>← ${esc(p.left||"Tesis")}</span><span>${esc(p.right||"Antítesis")} →</span></div>
      <input type="range" min="0" max="10" step="1" value="${val}" id="rng" aria-label="Tu posición" ${disabled?"disabled":""}>
      <div class="val" id="rngv">${val}</div></div>`;
  }
  const voted = current!==undefined;
  box.innerHTML = `<h4>${p.closed?"Votación cerrada":voted?"Tu posición":"Toma posición"}</h4>${body}
    <div class="row">
      ${p.closed?"":`<button class="btn" id="cast">${voted?"Actualizar voto":"Votar"}</button>`}
      ${voted&&!p.closed?`<button class="btn ghost" id="retract">Retirar voto</button>`:""}
      <span class="note${voted?" ok":""}" id="vnote">${
        voted ? "Voto registrado. Puedes cambiarlo cuando quieras." :
        p.type==="multiple" ? "Puedes marcar varias opciones." : ""}</span>
    </div>
    ${!p.closed && !S.region ? `<p class="note" style="margin-top:12px">Indica arriba si participas desde México o desde el extranjero para comparar ambas miradas.</p>` : ""}`;

  if (p.type==="single"||p.type==="multiple"||p.type==="likert"){
    box.querySelectorAll(".opt").forEach(b=>b.addEventListener("click", ()=>{
      const i = Number(b.dataset.i);
      if (p.type==="multiple"){
        const base = S.draft[p.id] ?? current;
        const cur = new Set(Array.isArray(base) ? base : []);
        cur.has(i)?cur.delete(i):cur.add(i);
        S.draft[p.id] = [...cur].sort((a,b)=>a-b);
      } else S.draft[p.id] = i;
      renderVote(p);
    }));
  } else {
    const r=$("#rng"); if (r) r.addEventListener("input", ()=>{ S.draft[p.id]=Number(r.value); $("#rngv").textContent=r.value; });
  }
  const c=$("#cast");
  if (c) c.addEventListener("click", async ()=>{
    let val = S.draft[p.id] !== undefined ? S.draft[p.id] : current;
    if (p.type==="spectrum" && val===undefined) val = Number($("#rng").value);
    if (val===undefined || (Array.isArray(val) && !val.length)){ $("#vnote").textContent="Elige una opción primero."; $("#vnote").className="note"; return; }
    c.disabled=true; $("#vnote").textContent="Guardando…";
    try {
      const d = await api("POST", `/api/polls/${encodeURIComponent(p.id)}/vote`, {value:val, region:S.region});
      delete S.draft[p.id]; mergePoll(d.poll); const np=getPoll(p.id);
      renderVote(np); renderResults(np); renderCompare(np); renderArgs(np); toast(voted?"Voto actualizado":"Voto registrado");
    } catch(e){ c.disabled=false; $("#vnote").textContent=e.message; $("#vnote").className="note"; }
  });
  const rt=$("#retract");
  if (rt) rt.addEventListener("click", async ()=>{
    rt.disabled=true;
    try { const d = await api("DELETE", `/api/polls/${encodeURIComponent(p.id)}/vote`); delete S.draft[p.id]; mergePoll(d.poll); const np=getPoll(p.id); renderVote(np); renderResults(np); renderCompare(np); renderArgs(np); toast("Voto retirado"); }
    catch(e){ rt.disabled=false; $("#vnote").textContent=e.message; }
  });
}

function renderResults(p){
  const box=$("#res-panel"); if (!box) return;
  const t = p.agg;
  const mine = p.myVote;
  let body="";
  if (t.n===0){ body = `<div class="note">Todavía no hay votos. La contradicción espera ser expresada.</div>`; }
  else if (p.type==="single"||p.type==="multiple"){
    const mineSet = new Set(Array.isArray(mine)?mine:(mine!==null&&mine!==undefined?[mine]:[]));
    const max = Math.max(...t.counts);
    body = p.options.map((o,i)=>{ const pct = t.n? t.counts[i]/t.n*100 : 0;
      return `<div class="res-row${mineSet.has(i)?" mine":""}${t.counts[i]===max&&max>0?" lead":""}"><div class="lbl"><span>${esc(o)}</span><span>${Math.round(pct)}% · ${fmt(t.counts[i])}</span></div><div class="res-bar"><i style="width:${pct}%"></i></div></div>`; }).join("");
    if (p.type==="multiple") body += `<div class="note">Porcentajes sobre ${fmt(t.n)} participantes; pueden sumar más de 100%.</div>`;
  } else if (p.type==="likert"){
    body = LIKERT.map((l,i)=>{ const pct=t.counts[i]/t.n*100;
      return `<div class="res-row${mine===i+1?" mine":""}"><div class="lbl"><span>${i+1}. ${esc(l)}</span><span>${Math.round(pct)}% · ${fmt(t.counts[i])}</span></div><div class="res-bar"><i style="width:${pct}%"></i></div></div>`; }).join("");
  } else {
    const max = Math.max(...t.counts,1);
    const meanPos = t.mean/10;
    body = `<div class="poles" style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;margin-bottom:22px"><span>← ${esc(p.left||"Tesis")}</span><span>${esc(p.right||"Antítesis")} →</span></div>
      <div class="hist">${t.counts.map((c,i)=>`<div class="${mine===i?"mine":""}" style="height:${c/max*100}%" title="${i}: ${c}"></div>`).join("")}
        <span class="mean" style="left:calc(${(meanPos*(10/11)+ (0.5/11))*100}% - 1px)"></span></div>
      <div class="hist-x">${t.counts.map((c,i)=>`<span>${i}</span>`).join("")}</div>`;
  }
  const stats = (p.type==="likert"||p.type==="spectrum") && t.n ? `<div class="stats"><span>Media <b>${t.mean.toFixed(1)}</b></span><span>Desv. <b>${t.sd.toFixed(2)}</b></span><span>Votos <b>${fmt(t.n)}</b></span>${t.last24?`<span>Hoy <b>+${fmt(t.last24)}</b></span>`:""}</div>`
    : `<div class="stats"><span>Votos <b>${fmt(t.n)}</b></span>${t.last24?`<span>Hoy <b>+${fmt(t.last24)}</b></span>`:""}</div>`;
  const tp = t.tension===null?null:Math.round(t.tension*100);
  box.innerHTML = `<h4>Resultados en vivo</h4>${body}${stats}
    <div class="tension">
      <div class="big"><b>${tp===null?"—":tp}</b><span>${tensionLabel(t.tension)}</span></div>
      <div class="tmeter">${tp===null?"":`<i style="left:calc(${tp}% - 1px)"></i>`}</div>
      <div class="note" style="margin-top:6px">Índice de tensión (0–100): cuán dividida está la opinión. 0 = unanimidad; 100 = polarización máxima.</div>
    </div>`;
}

/* México vs. extranjero */
function renderCompare(p){
  const box=$("#cmp-panel"); if (!box) return;
  const t=p.agg, N=t.regionN;
  if (!N.mx && !N.ext){ box.innerHTML = `<h4>México vs. el extranjero</h4><div class="note">Aún no hay votos con región indicada. Elige arriba desde dónde participas para que tu voto entre en la comparación.</div>`; return; }
  let body="";
  if (p.type==="likert"||p.type==="spectrum"){
    const f = x => x===null ? "—" : x.toFixed(1);
    const gap = t.means.mx!==null && t.means.ext!==null ? Math.abs(t.means.mx-t.means.ext) : null;
    const scale = p.type==="likert"?4:10;
    body = `<div class="cmp-grid">
        <div class="st"><b>${f(t.means.mx)}</b><span>media en México · ${fmt(N.mx)} votos</span></div>
        <div class="off"><b>${f(t.means.ext)}</b><span>media en el extranjero · ${fmt(N.ext)} votos</span></div>
      </div>
      ${gap===null?"":`<div class="gap">Brecha: <b>${gap.toFixed(1)}</b> puntos · ${gap/scale<.1?"miradas casi idénticas":gap/scale<.25?"diferencia moderada":"contradicción entre ambas orillas"}</div>`}`;
  } else {
    const labels = p.options;
    body = `<div class="mini-lg"><span><i class="sw st"></i>México · ${fmt(N.mx)}</span><span><i class="sw off"></i>El extranjero · ${fmt(N.ext)}</span></div>` +
      labels.map((l,i)=>{ const a=N.mx?t.byRegion.mx[i]/N.mx*100:0, b=N.ext?t.byRegion.ext[i]/N.ext*100:0; const d=a-b;
        return `<div class="cmp-row"><div class="lbl"><span>${esc(l)}</span><em class="${d>0?"up":"down"}">${N.mx&&N.ext?(d>0?"+":"")+Math.round(d)+" pts":""}</em></div>
          <div class="pair"><i class="st" style="width:${a*.85}%"></i><b>${Math.round(a)}%</b></div>
          <div class="pair"><i class="off" style="width:${b*.85}%"></i><b>${Math.round(b)}%</b></div></div>`; }).join("");
  }
  box.innerHTML = `<h4>México vs. el extranjero</h4>${body}`;
}

/* Argumentos */
function renderArgs(p){
  const box=$("#args-panel"); if (!box) return;
  const list = S.detail.id===p.id ? S.detail.args : [];
  const voted = p.myVote!==null && p.myVote!==undefined;
  const keep = $("#arg-text") ? $("#arg-text").value : "";
  const hadFocus = document.activeElement && document.activeElement.id==="arg-text";
  box.innerHTML = `<h4>Argumentos · ${list.length}</h4>
    ${voted ? `<div class="arg-form"><textarea id="arg-text" maxlength="400" placeholder="¿Por qué piensas así? Defiende tu posición (${esc(stanceLabel(p,p.myVote))})."></textarea><button class="btn" id="arg-send">Publicar</button></div><div class="err" id="arg-err"></div>`
      : `<p class="note">Vota para poder publicar un argumento que defienda tu posición.</p>`}
    ${list.length ? list.map(a=>`<div class="arg">
        <span class="stance">${esc(stanceLabel(p,a.stance))}</span>
        <p>${esc(a.text)}</p>
        <div class="row"><span class="when">${ago(a.createdAt)}${a.mine?" · tuyo":""}</span>
          <span style="display:flex;gap:10px;align-items:center">${a.mine||S.detail.canManage?`<button class="linkbtn" data-del="${esc(a.id)}">Eliminar</button>`:""}
          <button class="like${a.liked?" on":""}" data-like="${esc(a.id)}" aria-pressed="${a.liked}">▲ ${a.likes}</button></span></div>
      </div>`).join("") : `<div class="note">Todavía nadie ha argumentado. Sé la primera voz.</div>`}`;
  const ta=$("#arg-text");
  if (ta){ ta.value=keep; if (hadFocus){ ta.focus(); ta.setSelectionRange(keep.length, keep.length); } }
  const send=$("#arg-send");
  if (send) send.addEventListener("click", async ()=>{
    send.disabled=true; $("#arg-err").textContent="";
    try { const d=await api("POST", `/api/polls/${encodeURIComponent(p.id)}/args`, {text:ta.value}); ta.value=""; S.detail.args=d.args; renderArgs(getPoll(p.id)); toast("Argumento publicado"); }
    catch(e){ send.disabled=false; $("#arg-err").textContent=e.message; }
  });
  box.querySelectorAll("[data-like]").forEach(b=>b.addEventListener("click", async ()=>{
    b.disabled=true;
    try { const d=await api("POST", `/api/args/${encodeURIComponent(b.dataset.like)}/like`); S.detail.args=d.args; renderArgs(getPoll(p.id)); }
    catch(e){ b.disabled=false; toast(e.message); }
  }));
  box.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", async ()=>{
    if (b.dataset.armed!=="1"){ b.dataset.armed="1"; b.textContent="¿Seguro?"; return; }
    try { const d=await api("DELETE", `/api/args/${encodeURIComponent(b.dataset.del)}`); S.detail.args=d.args; renderArgs(getPoll(p.id)); }
    catch(e){ toast(e.message); }
  }));
}

function renderAdmin(p){
  const box=$("#admin"); if (!box) return;
  if (!(p.mine || S.detail.canManage)){ box.innerHTML=""; return; }
  box.innerHTML = `<button class="btn ghost" id="toggle">${p.closed?"Reabrir votación":"Cerrar votación"}</button>
    <button class="btn danger" id="del">Eliminar encuesta</button><span class="note" id="anote"></span>`;
  $("#toggle").addEventListener("click", async e=>{
    e.target.disabled=true;
    try{ const d=await api("PATCH", `/api/polls/${encodeURIComponent(p.id)}`, {closed:!p.closed}); mergePoll(d.poll); S.builtFor=null; render(true); }
    catch(ex){ $("#anote").textContent=ex.message; e.target.disabled=false; }
  });
  let armed=false;
  $("#del").addEventListener("click", async e=>{
    if (!armed){ armed=true; e.target.textContent="¿Seguro? Pulsa de nuevo"; setTimeout(()=>{ if(armed && e.target.isConnected){armed=false; e.target.textContent="Eliminar encuesta";} },4000); return; }
    e.target.disabled=true;
    try{ await api("DELETE", `/api/polls/${encodeURIComponent(p.id)}`); S.polls.delete(p.id); toast("Encuesta eliminada"); location.hash="encuestas"; }
    catch(ex){ $("#anote").textContent=ex.message; e.target.disabled=false; }
  });
}

/* ---------- Crear ---------- */
function renderCreate(){
  S.builtFor="crear";
  const v=$("#view");
  const pf = S.prefill; S.prefill=null;
  const st = {type:"single", options:["",""]};
  if (pf){ st.type=pf.type; if ((pf.type==="single"||pf.type==="multiple") && pf.extra) st.options=[...pf.extra]; if (pf.type==="spectrum" && pf.extra){ st.left=pf.extra[0]; st.right=pf.extra[1]; } }
  const draw = () => {
    const optsHtml = st.type==="single"||st.type==="multiple" ? `
      <div class="field"><label>Opciones de respuesta</label>
        <div id="opts">${st.options.map((o,i)=>`<div class="optline"><input data-o="${i}" value="${esc(o)}" placeholder="Opción ${i+1}" maxlength="140">${st.options.length>2?`<button type="button" data-rm="${i}" aria-label="Quitar">✕</button>`:""}</div>`).join("")}</div>
        ${st.options.length<10?`<button type="button" class="btn ghost" id="addopt" style="margin-top:4px">+ Añadir opción</button>`:""}
      </div>` : st.type==="spectrum" ? `
      <div class="field"><label>Los dos polos de la contradicción</label>
        <div class="two"><input id="left" placeholder="Polo izquierdo (0) · p. ej. Estado" maxlength="60" value="${esc(st.left||"")}"><input id="right" placeholder="Polo derecho (10) · p. ej. Mercado" maxlength="60" value="${esc(st.right||"")}"></div>
      </div>` : `<div class="field"><label>Escala</label><div class="note">${LIKERT.map((l,i)=>`${i+1}. ${l}`).join(" · ")}</div></div>`;
    $("#typed").innerHTML = optsHtml;
    v.querySelectorAll(".types button").forEach(b=>b.classList.toggle("on", b.dataset.t===st.type));
    v.querySelectorAll("[data-o]").forEach(i=>i.addEventListener("input", ()=>{ st.options[Number(i.dataset.o)] = i.value; }));
    v.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click", ()=>{ st.options.splice(Number(b.dataset.rm),1); draw(); }));
    const add=$("#addopt"); if (add) add.addEventListener("click", ()=>{ st.options.push(""); draw(); const ins=v.querySelectorAll("[data-o]"); ins[ins.length-1].focus(); });
    const l=$("#left"), r=$("#right"); if (l){ l.addEventListener("input",()=>st.left=l.value); r.addEventListener("input",()=>st.right=r.value); }
  };
  v.innerHTML = `
    <h2 class="sec">Plantear una pregunta</h2>
    <div class="caveat" id="cprefill" hidden>Pregunta sugerida precargada. Ajusta el texto, el tipo o las opciones antes de publicar.</div>
    <form class="form" id="cf" novalidate>
      <div class="field"><label for="ct">Pregunta</label><input id="ct" maxlength="200" placeholder="¿Debe el Estado garantizar la vivienda como derecho?"></div>
      <div class="field"><label for="cd">Contexto (opcional)</label><textarea id="cd" maxlength="600" placeholder="Datos, antecedentes o matices que ayuden a responder."></textarea></div>
      <div class="two">
        <div class="field"><label for="cc">Categoría</label><select id="cc">${CATS.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div>
        <div class="field"><label for="cz">Cierre automático (opcional)</label><input id="cz" type="datetime-local"><small class="hint">Déjalo vacío para mantenerla abierta.</small></div>
      </div>
      <div class="field"><label>Tipo de encuesta</label>
        <div class="types">${Object.entries(TYPES).map(([k,t])=>`<button type="button" data-t="${k}"><b>${t.name}</b><small>${t.desc}</small></button>`).join("")}</div></div>
      <div id="typed"></div>
      <div class="err" id="cerr"></div>
      <div class="row"><button class="btn" type="submit" id="csub">Publicar encuesta</button><span class="note">Podrás cerrarla o eliminarla desde este dispositivo.</span></div>
    </form>`;
  v.querySelectorAll(".types button").forEach(b=>b.addEventListener("click", ()=>{ st.type=b.dataset.t; draw(); }));
  draw();
  if (pf){ $("#ct").value=pf.title; if (pf.category) $("#cc").value=pf.category; $("#cprefill").hidden=false; }
  $("#cf").addEventListener("submit", async e=>{
    e.preventDefault();
    const err=$("#cerr"); err.textContent="";
    const title=$("#ct").value.trim();
    if (title.length<5){ err.textContent="Escribe una pregunta (mínimo 5 caracteres)."; return; }
    const body = {title, description:$("#cd").value.trim(), category:$("#cc").value, type:st.type};
    const cz=$("#cz").value; if (cz){ const ts=new Date(cz).getTime(); if (!(ts>Date.now())){ err.textContent="La fecha de cierre debe estar en el futuro."; return; } body.closesAt=ts; }
    if (st.type==="single"||st.type==="multiple"){
      const opts = st.options.map(o=>o.trim()).filter(Boolean);
      if (opts.length<2){ err.textContent="Añade al menos dos opciones."; return; }
      if (new Set(opts.map(o=>o.toLowerCase())).size!==opts.length){ err.textContent="Hay opciones repetidas."; return; }
      body.options=opts;
    }
    if (st.type==="spectrum"){
      body.left=(st.left||"").trim(); body.right=(st.right||"").trim();
      if (!body.left||!body.right){ err.textContent="Define ambos polos del espectro."; return; }
    }
    $("#csub").disabled=true;
    try { const d = await api("POST", "/api/polls", body); mergePoll(d.poll); toast("Encuesta publicada"); location.hash = "p-"+d.poll.id; }
    catch(ex){
      $("#csub").disabled=false;
      if (ex.status===409 && ex.data && ex.data.id){ err.innerHTML = `${esc(ex.message)} <a href="#p-${esc(ex.data.id)}">Ir a votarla →</a>`; }
      else err.textContent = ex.message;
    }
  });
}

/* ---------- Manifiesto ---------- */
function renderAbout(){
  S.builtFor="manifiesto";
  $("#view").innerHTML = `
    <p class="manifesto">Toda sociedad es una <em>contradicción</em> en movimiento. Contradicta la hace <em>visible</em>.</p>
    <div class="cols">
      <div><h3>Praxis</h3><p>La opinión no es un dato inerte: se forma al confrontarse. Aquí cada pregunta es una tesis puesta a prueba por quienes participan.</p></div>
      <div><h3>Polos</h3><p>Las encuestas de espectro sitúan la opinión entre dos fuerzas opuestas —Estado y mercado, orden y libertad— en lugar de reducirla a sí o no.</p></div>
      <div><h3>Tensión</h3><p>Cada resultado lleva un índice de tensión: 0 cuando hay unanimidad, 100 cuando la sociedad está partida. No buscamos el consenso, lo medimos.</p></div>
      <div><h3>Movimiento</h3><p>Los votos pueden cambiarse o retirarse. Las posiciones se mueven, y los resultados se actualizan en vivo para todos.</p></div>
      <div><h3>Argumento</h3><p>Votar no basta: cada posición puede defenderse con razones, y las mejores suben por el respaldo de los demás.</p></div>
      <div><h3>Dos orillas</h3><p>Millones de mexicanos viven fuera del país. Contradicta compara lo que se piensa en México y en el extranjero.</p></div>
    </div>
    <h2 class="sec" style="margin-top:36px">Tipos de encuesta</h2>
    <div class="cols">${Object.values(TYPES).map(t=>`<div><h3>${t.name}</h3><p>${t.desc}</p></div>`).join("")}</div>
    <h2 class="sec" style="margin-top:36px">Cómo funciona</h2>
    <div class="cols">
      <div><h3>Un voto por dispositivo</h3><p>No pedimos registro. Una cookie anónima identifica tu dispositivo para que puedas cambiar tu voto sin duplicarlo.</p></div>
      <div><h3>Datos abiertos</h3><p>Cada encuesta puede descargarse como CSV con los resultados agregados, sin datos personales.</p></div>
      <div><h3>Sin muestra representativa</h3><p>Los resultados reflejan solo a quienes participan. Son una conversación, no un sondeo científico.</p></div>
    </div>`;
}

/* ---------- Datos en vivo ---------- */
function onData(){
  paintStatus();
  const r = route();
  if (r==="crear"||r==="manifiesto") return;
  if (r==="pulso") return renderPulse();
  if (r.startsWith("p-")){
    const pid=r.slice(2), p=getPoll(pid);
    if (!p || S.builtFor!=="p-"+pid){ render(true); return; }
    renderResults(p); renderCompare(p);
    const head = $("#vote-panel h4");
    if (head && ((p.closed && !/cerrada/i.test(head.textContent)) || (!p.closed && /cerrada/i.test(head.textContent)))) render(true);
    return;
  }
  renderList();
}

async function loadAll(){
  try {
    const d = await api("GET", "/api/polls");
    S.polls = new Map(d.polls.map(p=>[p.id,p]));
    S.stats = d.stats; S.online = d.online || S.online; S.loaded=true; S.failed=false;
  } catch(_){ S.failed=true; setTimeout(loadAll, 4000); }
  onData();
}

let statsTimer=null;
function scheduleStats(){ clearTimeout(statsTimer); statsTimer=setTimeout(async ()=>{ try { const d=await api("GET","/api/polls"); S.stats=d.stats; paintStatus(); if (route()==="pulso") renderPulse(); } catch(_){} }, 1500); }

function connect(){
  if (!window.EventSource) return;
  const es = new EventSource("/api/stream");
  let first = true;
  es.addEventListener("hello", e=>{ S.live=true; try { S.online=JSON.parse(e.data).online; } catch(_){} if (!first) loadAll(); first=false; paintStatus(); });
  es.addEventListener("online", e=>{ try { S.online=JSON.parse(e.data).online; } catch(_){} paintStatus(); });
  es.addEventListener("poll", e=>{ try { const p=JSON.parse(e.data); mergePoll(p); refreshStats(); scheduleStats(); onData(); } catch(_){} });
  es.addEventListener("deleted", e=>{ try { const {id}=JSON.parse(e.data); S.polls.delete(id); scheduleStats(); onData(); } catch(_){} });
  es.addEventListener("args", async e=>{
    try {
      const {pollId}=JSON.parse(e.data);
      if (S.detail.id===pollId){ const d=await api("GET", `/api/polls/${encodeURIComponent(pollId)}`); mergePoll(d.poll); S.detail.args=d.args; const p=getPoll(pollId); if (route()==="p-"+pollId) renderArgs(p); }
      scheduleStats();
    } catch(_){}
  });
  es.onerror = () => { S.live=false; paintStatus(); };
}

/* ---------- Arranque ---------- */
const m = location.pathname.match(/^\/p\/([A-Za-z0-9_-]+)/);
if (m) history.replaceState(null, "", "/#p-"+m[1]);
paintRegion();
render(true);
loadAll();
connect();
})();

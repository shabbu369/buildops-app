/* ═══════════════════════════════════════════════════════════
   BUILDOPS — Core Application (app.js)
   State · Auth · Router · UI · Dashboard · Settings
════════════════════════════════════════════════════════════ */

// ── Utilities ────────────────────────────────────────────────────────────────
const uid  = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const today= () => new Date().toISOString().slice(0,10);
const fmtSAR = n => 'SAR '+Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtNum = n => Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
const num  = v => parseFloat(v)||0;
const esc  = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function statusBadge(status){
  const map={
    'New':'badge-grey','Assigned':'badge-blue','Sourcing':'badge-amber',
    'Interview Scheduled':'badge-purple','Workers Selected':'badge-amber',
    'Mobilized':'badge-green','Active':'badge-green','Completed':'badge-steel',
    'Cancelled':'badge-red',
    'Draft':'badge-grey','Under Review':'badge-amber','Approved':'badge-blue',
    'Sent':'badge-purple','Paid':'badge-green','Overdue':'badge-red',
    'Available':'badge-green','Assigned to Job':'badge-blue','Inactive':'badge-red',
    'Low':'badge-green','Medium':'badge-amber','High':'badge-red',
    'Pass':'badge-green','Fail':'badge-red','Pending':'badge-amber',
  };
  const cls = map[status]||'badge-grey';
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

// ── State Management ─────────────────────────────────────────────────────────
const State = {
  _d: null,
  defaults(){
    return {
      settings:{ apiKey:'', company:{ name:'Your Company LLC', vatNumber:'300000000000003', address:'Riyadh, Saudi Arabia', cr:'', bank:'Saudi National Bank — IBAN: SA00 0000 0000 0000 0000 0000' }},
      coordinators:[],
      clients:[],
      manpower:{ requirements:[], workers:[], mobilizations:[], timesheets:[], invoices:[], expenses:[], payments:[] },
      equipment:{ requirements:[], units:[], mobilizations:[], usageLogs:[], invoices:[], expenses:[], payments:[] }
    };
  },
  init(){ try{ this._d=JSON.parse(localStorage.getItem('buildops_v2')||'null')||this.defaults(); }catch{ this._d=this.defaults(); } },
  save(){ localStorage.setItem('buildops_v2',JSON.stringify(this._d)); },
  get(path){ return path.split('.').reduce((o,k)=>o?.[k],this._d); },
  set(path,val){ const k=path.split('.'),l=k.pop(),o=k.reduce((x,p)=>x[p],this._d); o[l]=val; this.save(); },
  push(path,item){ const a=this.get(path)||[]; a.push(item); this.set(path,a); return item; },
  update(path,id,up){ const a=this.get(path)||[],i=a.findIndex(x=>x.id===id); if(i>=0){a[i]={...a[i],...up};this.set(path,a);} },
  remove(path,id){ this.set(path,(this.get(path)||[]).filter(x=>x.id!==id)); },
  find(path,id){ return (this.get(path)||[]).find(x=>x.id===id); }
};

// ── ZATCA QR ─────────────────────────────────────────────────────────────────
const ZATCA = {
  buildTLV(seller,vatNo,dt,total,vat){
    const enc=new TextEncoder();
    const tlv=(t,v)=>{const b=enc.encode(String(v));return [t,b.length,...b];};
    const d=new Uint8Array([...tlv(1,seller),...tlv(2,vatNo||'300000000000003'),...tlv(3,dt),...tlv(4,num(total).toFixed(2)),...tlv(5,num(vat).toFixed(2))]);
    return btoa(String.fromCharCode(...d));
  },
  qrUrl(b64,size=120){ return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(b64)}&size=${size}x${size}`; },
  qrImg(seller,vatNo,dt,total,vat,size=120){
    const b64=this.buildTLV(seller,vatNo,dt,total,vat);
    return `<img src="${this.qrUrl(b64,size)}" width="${size}" height="${size}" style="border:1px solid #D6CFC4;border-radius:6px" alt="ZATCA QR"/>`;
  }
};

// ── Anthropic API ─────────────────────────────────────────────────────────────
const API = {
  async call(messages, maxTokens=3000){
    const key = State.get('settings.apiKey');
    if(!key) throw new Error('Anthropic API key not set. Go to Settings to add it.');
    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:maxTokens, messages })
    });
    if(!r.ok) throw new Error(`API error: ${r.status}`);
    const d=await r.json();
    return d.content.map(b=>b.text||'').join('').replace(/```json|```/g,'').trim();
  },

  async processTimesheet(b64Data, mimeType){
    const parts=[];
    if(mimeType==='application/pdf'){
      parts.push({type:'document',source:{type:'base64',media_type:'application/pdf',data:b64Data}});
    } else {
      parts.push({type:'image',source:{type:'base64',media_type:mimeType,data:b64Data}});
    }
    parts.push({type:'text',text:`Analyze this timesheet document carefully. Extract ALL worker/employee information.
Return ONLY valid JSON (no markdown):
{
  "period":{"start":"YYYY-MM-DD","end":"YYYY-MM-DD","month":"Month Year"},
  "clientOrProject":"name if visible",
  "workers":[{
    "name":"Full Name",
    "id":"ID or badge number if shown",
    "trade":"trade or position if visible",
    "regularHours":0,
    "overtimeHours":0,
    "totalHours":0,
    "totalDays":0,
    "remarks":"any notes"
  }],
  "notes":"any overall notes or special observations from the document"
}`});
    const raw = await this.call([{role:'user',content:parts}],2000);
    return JSON.parse(raw);
  },

  async generateInvoiceItems(timesheetData, mobilizations){
    const prompt=`Based on this timesheet data and mobilization rates, generate invoice line items.
Timesheet: ${JSON.stringify(timesheetData)}
Mobilization rates: ${JSON.stringify(mobilizations)}
Return ONLY valid JSON array:
[{"workerName":"","workerID":"","regularHours":0,"regularRate":0,"regularAmount":0,"overtimeHours":0,"overtimeRate":0,"overtimeAmount":0,"totalAmount":0}]
Use the PO rate (client rate) from mobilizations for each worker. OT rate = regular rate × 1.5.`;
    const raw = await this.call([{role:'user',content:prompt}],2000);
    return JSON.parse(raw);
  }
};

// ── Auth ──────────────────────────────────────────────────────────────────────
const Auth = {
  USERS:[
    { email:'admin@buildops.sa', password:'admin123', name:'Mohammed Al-Rashid', role:'Partner — Construction Projects', initials:'MA' },
    { email:'coordinator@buildops.sa', password:'coord123', name:'Ahmed Al-Zahrami', role:'Manpower Coordinator', initials:'AA' },
    { email:'finance@buildops.sa', password:'fin123', name:'Sara Al-Otaibi', role:'Finance Manager', initials:'SO' }
  ],
  currentUser: null,
  login(){
    const email=document.getElementById('login-email').value.trim().toLowerCase();
    const pass=document.getElementById('login-pass').value;
    const user=this.USERS.find(u=>u.email===email&&u.password===pass);
    const errEl=document.getElementById('login-err');
    if(!user){ errEl.style.display='block'; errEl.textContent='Invalid email or password.'; return; }
    errEl.style.display='none';
    this.currentUser=user;
    sessionStorage.setItem('buildops_user',JSON.stringify(user));
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app-screen').style.display='flex';
    document.getElementById('sb-user-name').textContent=user.name;
    document.getElementById('sb-user-role').textContent=user.role;
    document.getElementById('sb-avatar').textContent=user.initials;
    document.getElementById('topbar-date').textContent=new Date().toLocaleDateString('en-SA',{weekday:'short',year:'numeric',month:'short',day:'numeric'});
    Nav.go('dashboard');
  },
  logout(){
    sessionStorage.removeItem('buildops_user');
    this.currentUser=null;
    document.getElementById('app-screen').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('login-email').value='';
    document.getElementById('login-pass').value='';
  },
  checkSession(){
    try{
      const u=JSON.parse(sessionStorage.getItem('buildops_user'));
      if(u){ this.currentUser=u; return true; }
    }catch{}
    return false;
  }
};

// ── Modal ─────────────────────────────────────────────────────────────────────
const Modal = {
  show(title, bodyHtml, footerHtml='', large=false){
    document.getElementById('modal-title').textContent=title;
    document.getElementById('modal-body').innerHTML=bodyHtml;
    document.getElementById('modal-footer').innerHTML=footerHtml||`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Close</button>`;
    const box=document.getElementById('modal-box');
    box.className='modal-box'+(large?' modal-lg':'');
    document.getElementById('modal').style.display='flex';
  },
  close(){ document.getElementById('modal').style.display='none'; },
  getForm(id){ const f=document.getElementById(id); if(!f) return {}; return Object.fromEntries(new FormData(f)); }
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = {
  show(msg, type='success'){
    const el=document.createElement('div');
    el.className=`toast toast-${type}`;
    el.textContent=msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(()=>el.remove(),3500);
  }
};

// ── Navigation ────────────────────────────────────────────────────────────────
const Nav = {
  current:'dashboard',
  go(page, sub=0){
    this.current=page;
    this.currentSub=sub;
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
    // Breadcrumb
    const labels={dashboard:'Dashboard',manpower:'Manpower Rental',equipment:'Equipment Rental',projects:'Construction Projects',finance:'Finance & Reports',hr:'HR & Compliance',settings:'Settings'};
    document.getElementById('topbar-breadcrumb').textContent=labels[page]||page;
    // Render content
    const el=document.getElementById('content');
    if(page==='dashboard') el.innerHTML=Dashboard.render();
    else if(page==='manpower') WorkforceModule.render('manpower',sub);
    else if(page==='equipment') WorkforceModule.render('equipment',sub);
    else if(page==='projects') ConstructionModule.render();
    else if(page==='settings') Settings.render();
    else if(page==='finance') Finance.render();
    else if(page==='hr') el.innerHTML=ComingSoon.render('HR & Compliance','📁','Employee records, contracts and compliance documentation coming soon.');
    else el.innerHTML=ComingSoon.render(page,'🚧','This module is coming soon.');
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('mob-open');
    document.getElementById('mob-overlay').classList.remove('show');
  }
};

// ── Sidebar helpers ───────────────────────────────────────────────────────────
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  sb.classList.toggle('collapsed');
}
function toggleMobSidebar(){
  document.getElementById('sidebar').classList.toggle('mob-open');
  document.getElementById('mob-overlay').classList.toggle('show');
}
function togglePass(){
  const i=document.getElementById('login-pass');
  i.type=i.type==='password'?'text':'password';
  document.getElementById('pass-eye').textContent=i.type==='password'?'👁️':'🙈';
}

// ── File to Base64 ────────────────────────────────────────────────────────────
function fileToBase64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res({data:r.result.split(',')[1],type:file.type,name:file.name});
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

// ── Coming Soon placeholder ───────────────────────────────────────────────────
const ComingSoon = {
  render(label,icon,msg){
    return `<div class="empty-state" style="height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div class="empty-icon">${icon||'🚧'}</div>
      <h3>${esc(label)} Module</h3>
      <p>${esc(msg||'Coming soon!')}</p>
    </div>`;
  }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = {
  render(){
    const mp=State.get('manpower'), eq=State.get('equipment');
    const mpActive=(mp.mobilizations||[]).filter(m=>m.status==='Active').length;
    const eqActive=(eq.mobilizations||[]).filter(m=>m.status==='Active').length;
    const mpInv=(mp.invoices||[]).reduce((s,i)=>s+num(i.total),0);
    const eqInv=(eq.invoices||[]).reduce((s,i)=>s+num(i.total),0);
    const mpPaid=(mp.payments||[]).reduce((s,p)=>s+num(p.amount),0);
    const eqPaid=(eq.payments||[]).reduce((s,p)=>s+num(p.amount),0);
    const mpReq=(mp.requirements||[]).filter(r=>r.status!=='Completed'&&r.status!=='Cancelled').length;
    const eqReq=(eq.requirements||[]).filter(r=>r.status!=='Completed'&&r.status!=='Cancelled').length;
    const user=Auth.currentUser||{name:'User'};
    return `
<div class="page-header">
  <div><h1>Good day, ${esc(user.name.split(' ')[0])} 👋</h1><p>Here's your BUILDOPS overview for ${new Date().toLocaleDateString('en-SA',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p></div>
</div>

<div class="section-label">👷 Manpower Rental</div>
<div class="grid-4" style="margin-bottom:20px">
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Active Workers</div><div class="stat-value" style="color:var(--blue)">${mpActive}</div><div class="stat-sub">Currently deployed</div></div>
  <div class="stat-card" style="border-left-color:var(--amber)"><div class="stat-label">Open Requirements</div><div class="stat-value" style="color:var(--amber)">${mpReq}</div><div class="stat-sub">Pending fulfillment</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Total Invoiced</div><div class="stat-value" style="color:var(--success)">${fmtSAR(mpInv)}</div><div class="stat-sub">All time</div></div>
  <div class="stat-card" style="border-left-color:var(--purple)"><div class="stat-label">Collected</div><div class="stat-value" style="color:var(--purple)">${fmtSAR(mpPaid)}</div><div class="stat-sub">Payments received</div></div>
</div>

<div class="section-label">🏗️ Equipment Rental</div>
<div class="grid-4" style="margin-bottom:20px">
  <div class="stat-card" style="border-left-color:var(--purple)"><div class="stat-label">Active Equipment</div><div class="stat-value" style="color:var(--purple)">${eqActive}</div><div class="stat-sub">Currently deployed</div></div>
  <div class="stat-card" style="border-left-color:var(--amber)"><div class="stat-label">Open Requirements</div><div class="stat-value" style="color:var(--amber)">${eqReq}</div><div class="stat-sub">Pending fulfillment</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Total Invoiced</div><div class="stat-value" style="color:var(--success)">${fmtSAR(eqInv)}</div><div class="stat-sub">All time</div></div>
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Collected</div><div class="stat-value" style="color:var(--blue)">${fmtSAR(eqPaid)}</div><div class="stat-sub">Payments received</div></div>
</div>

<div class="grid-2">
  <div class="card">
    <div class="card-title">⚡ Quick Actions</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-amber w-full" onclick="Nav.go('manpower',0)">👷 New Manpower Requirement</button>
      <button class="btn btn-steel w-full" onclick="Nav.go('equipment',0)">🏗️ New Equipment Requirement</button>
      <button class="btn btn-blue w-full" onclick="Nav.go('manpower',3)">📋 Process Timesheets</button>
      <button class="btn btn-success w-full" onclick="Nav.go('manpower',4)">🧾 Generate Invoice</button>
    </div>
  </div>
  <div class="card">
    <div class="card-title">📊 Combined Summary</div>
    ${[['Total Active Workers + Equipment',(mpActive+eqActive)+' units',''],[`Total Invoiced (Both)`,fmtSAR(mpInv+eqInv),''],[`Total Collected`,fmtSAR(mpPaid+eqPaid),''],[`Outstanding Balance`,fmtSAR((mpInv+eqInv)-(mpPaid+eqPaid)),'']].map(([l,v])=>`<div class="flex-between mb-8"><span class="text-muted">${l}</span><strong>${v}</strong></div>`).join('')}
    <div class="divider"></div>
    <div class="flex-between"><span class="text-muted text-sm">Coordinators Registered</span><strong>${(State.get('coordinators')||[]).length}</strong></div>
    <div class="flex-between mt-8"><span class="text-muted text-sm">Clients Registered</span><strong>${(State.get('clients')||[]).length}</strong></div>
  </div>
</div>`;
  }
};

// ── Finance overview ──────────────────────────────────────────────────────────
const Finance = {
  render(){
    const el=document.getElementById('content');
    const mp=State.get('manpower'), eq=State.get('equipment');
    const allInv=[...(mp.invoices||[]).map(i=>({...i,mod:'Manpower'})),...(eq.invoices||[]).map(i=>({...i,mod:'Equipment'}))];
    const allPay=[...(mp.payments||[]),...(eq.payments||[])];
    const totalInv=allInv.reduce((s,i)=>s+num(i.total),0);
    const totalPaid=allPay.reduce((s,p)=>s+num(p.amount),0);
    const outstanding=totalInv-totalPaid;
    el.innerHTML=`
<div class="page-header"><div><h1>💰 Finance & Reports</h1><p>Combined financial overview across Manpower and Equipment</p></div></div>
<div class="grid-4">
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Total Invoiced</div><div class="stat-value" style="color:var(--blue)">${fmtSAR(totalInv)}</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Total Collected</div><div class="stat-value" style="color:var(--success)">${fmtSAR(totalPaid)}</div></div>
  <div class="stat-card" style="border-left-color:var(--danger)"><div class="stat-label">Outstanding</div><div class="stat-value" style="color:var(--danger)">${fmtSAR(outstanding)}</div></div>
  <div class="stat-card" style="border-left-color:var(--amber)"><div class="stat-label">Total Invoices</div><div class="stat-value" style="color:var(--amber)">${allInv.length}</div></div>
</div>
<div class="card">
  <div class="tbl-header"><h3>All Invoices</h3></div>
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Invoice #</th><th>Module</th><th>Client</th><th>Date</th><th>Amount (SAR)</th><th>Status</th></tr></thead>
    <tbody>${allInv.length===0?`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">No invoices yet.</td></tr>`:allInv.map(i=>`<tr><td>${esc(i.number)}</td><td><span class="badge ${i.mod==='Manpower'?'badge-blue':'badge-purple'}">${i.mod}</span></td><td>${esc(i.clientName)}</td><td>${esc(i.date)}</td><td class="text-right">${fmtSAR(i.total)}</td><td>${statusBadge(i.status)}</td></tr>`).join('')}</tbody>
  </table></div>
</div>`;
  }
};

// ── Settings ──────────────────────────────────────────────────────────────────
const Settings = {
  render(){
    const s=State.get('settings'), co=s.company||{};
    const coords=State.get('coordinators')||[];
    const clients=State.get('clients')||[];
    document.getElementById('content').innerHTML=`
<div class="page-header"><div><h1>⚙️ Settings</h1><p>Configure company details, API key, coordinators and clients</p></div></div>

<div class="card">
  <div class="card-title">🔑 Anthropic API Key</div>
  <div class="alert alert-warning mb-12">Your API key is stored in this browser only. Never share it or commit it to version control.</div>
  <div class="form-row cols-2">
    <div class="form-group"><label>API Key</label><input id="cfg-apikey" type="password" value="${esc(s.apiKey||'')}" placeholder="sk-ant-..."/></div>
    <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-amber" onclick="Settings.saveKey()">💾 Save Key</button></div>
  </div>
</div>

<div class="card">
  <div class="card-title">🏢 Company Details (for Invoices & Offers)</div>
  <form id="company-form">
  <div class="form-row cols-3">
    <div class="form-group"><label>Company Name</label><input name="name" value="${esc(co.name||'')}"/></div>
    <div class="form-group"><label>VAT Reg. Number</label><input name="vatNumber" value="${esc(co.vatNumber||'')}"/></div>
    <div class="form-group"><label>CR Number</label><input name="cr" value="${esc(co.cr||'')}"/></div>
  </div>
  <div class="form-row cols-2">
    <div class="form-group"><label>Address</label><input name="address" value="${esc(co.address||'')}"/></div>
    <div class="form-group"><label>Bank Details (for invoices)</label><input name="bank" value="${esc(co.bank||'')}"/></div>
  </div>
  </form>
  <button class="btn btn-amber" onclick="Settings.saveCompany()">💾 Save Company Details</button>
</div>

<div class="card">
  <div class="tbl-header"><h3>👥 Coordinators</h3><button class="btn btn-amber btn-sm" onclick="Settings.addCoordinator()">+ Add Coordinator</button></div>
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Name</th><th>Phone</th><th>Monthly Salary (SAR)</th><th>Transport (SAR)</th><th>Commission %</th><th>Module</th><th></th></tr></thead>
    <tbody id="coords-tbody">${this.coordsRows(coords)}</tbody>
  </table></div>
</div>

<div class="card">
  <div class="tbl-header"><h3>🏭 Clients</h3><button class="btn btn-amber btn-sm" onclick="Settings.addClient()">+ Add Client</button></div>
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Client Name</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>VAT No.</th><th></th></tr></thead>
    <tbody id="clients-tbody">${this.clientsRows(clients)}</tbody>
  </table></div>
</div>`;
  },
  coordsRows(coords){
    if(!coords.length) return `<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--muted)">No coordinators yet.</td></tr>`;
    return coords.map(c=>`<tr>
      <td>${esc(c.name)}</td><td>${esc(c.phone)}</td>
      <td>${fmtSAR(c.salary)}</td><td>${fmtSAR(c.transport)}</td>
      <td><span class="badge badge-amber">${c.commissionPct}%</span></td>
      <td>${statusBadge(c.module)}</td>
      <td class="actions">
        <button class="btn btn-sm btn-ghost" onclick="Settings.editCoordinator('${c.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="Settings.deleteCoordinator('${c.id}')">🗑️</button>
      </td>
    </tr>`).join('');
  },
  clientsRows(clients){
    if(!clients.length) return `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--muted)">No clients yet.</td></tr>`;
    return clients.map(c=>`<tr>
      <td><strong>${esc(c.name)}</strong></td><td>${esc(c.contact)}</td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td><td>${esc(c.vatNumber)}</td>
      <td class="actions">
        <button class="btn btn-sm btn-ghost" onclick="Settings.editClient('${c.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="Settings.deleteClient('${c.id}')">🗑️</button>
      </td>
    </tr>`).join('');
  },
  saveKey(){
    State.set('settings.apiKey', document.getElementById('cfg-apikey').value.trim());
    Toast.show('API key saved!');
  },
  saveCompany(){
    const f=document.getElementById('company-form');
    const d=Object.fromEntries(new FormData(f));
    const s=State.get('settings'); s.company={...s.company,...d}; State.set('settings',s);
    Toast.show('Company details saved!');
  },
  addCoordinator(){
    Modal.show('Add Coordinator',`<form id="coord-form">
    <div class="form-row cols-2">
      <div class="form-group"><label>Full Name</label><input name="name" required/></div>
      <div class="form-group"><label>Phone</label><input name="phone"/></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label>Monthly Salary (SAR)</label><input name="salary" type="number" value="0"/></div>
      <div class="form-group"><label>Transport Allowance (SAR)</label><input name="transport" type="number" value="0"/></div>
      <div class="form-group"><label>Commission %</label>
        <select name="commissionPct"><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option></select></div>
    </div>
    <div class="form-group"><label>Module</label>
      <select name="module"><option>Manpower</option><option>Equipment</option><option>Both</option></select></div>
    </form>`,
    `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
     <button class="btn btn-amber btn-sm" onclick="Settings._saveCoord()">Save Coordinator</button>`);
  },
  _saveCoord(id){
    const f=document.getElementById('coord-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.name){Toast.show('Name required','error');return;}
    if(id){ State.update('coordinators',id,{...d,commissionPct:num(d.commissionPct),salary:num(d.salary),transport:num(d.transport)});}
    else { State.push('coordinators',{id:uid(),...d,commissionPct:num(d.commissionPct),salary:num(d.salary),transport:num(d.transport)}); }
    Modal.close(); Settings.render(); Toast.show('Coordinator saved!');
  },
  editCoordinator(id){
    const c=State.find('coordinators',id); if(!c) return;
    Modal.show('Edit Coordinator',`<form id="coord-form">
    <div class="form-row cols-2">
      <div class="form-group"><label>Full Name</label><input name="name" value="${esc(c.name)}" required/></div>
      <div class="form-group"><label>Phone</label><input name="phone" value="${esc(c.phone)}"/></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label>Monthly Salary (SAR)</label><input name="salary" type="number" value="${c.salary}"/></div>
      <div class="form-group"><label>Transport (SAR)</label><input name="transport" type="number" value="${c.transport}"/></div>
      <div class="form-group"><label>Commission %</label>
        <select name="commissionPct"><option value="5" ${c.commissionPct==5?'selected':''}>5%</option><option value="10" ${c.commissionPct==10?'selected':''}>10%</option><option value="15" ${c.commissionPct==15?'selected':''}>15%</option></select></div>
    </div>
    <div class="form-group"><label>Module</label>
      <select name="module"><option ${c.module==='Manpower'?'selected':''}>Manpower</option><option ${c.module==='Equipment'?'selected':''}>Equipment</option><option ${c.module==='Both'?'selected':''}>Both</option></select></div>
    </form>`,
    `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
     <button class="btn btn-amber btn-sm" onclick="Settings._saveCoord('${id}')">Save</button>`);
  },
  deleteCoordinator(id){ if(confirm('Delete this coordinator?')){State.remove('coordinators',id);Settings.render();Toast.show('Deleted','error');} },
  addClient(){
    Modal.show('Add Client',`<form id="client-form">
    <div class="form-row cols-2">
      <div class="form-group"><label>Company / Client Name</label><input name="name" required/></div>
      <div class="form-group"><label>Contact Person</label><input name="contact"/></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label>Phone</label><input name="phone"/></div>
      <div class="form-group"><label>Email</label><input name="email" type="email"/></div>
      <div class="form-group"><label>VAT Number</label><input name="vatNumber"/></div>
    </div>
    <div class="form-group"><label>Address</label><input name="address"/></div>
    </form>`,
    `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
     <button class="btn btn-amber btn-sm" onclick="Settings._saveClient()">Save Client</button>`);
  },
  _saveClient(id){
    const f=document.getElementById('client-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.name){Toast.show('Client name required','error');return;}
    if(id) State.update('clients',id,d);
    else State.push('clients',{id:uid(),...d});
    Modal.close(); Settings.render(); Toast.show('Client saved!');
  },
  editClient(id){
    const c=State.find('clients',id); if(!c) return;
    Modal.show('Edit Client',`<form id="client-form">
    <div class="form-row cols-2">
      <div class="form-group"><label>Company Name</label><input name="name" value="${esc(c.name)}" required/></div>
      <div class="form-group"><label>Contact Person</label><input name="contact" value="${esc(c.contact)}"/></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label>Phone</label><input name="phone" value="${esc(c.phone)}"/></div>
      <div class="form-group"><label>Email</label><input name="email" value="${esc(c.email)}"/></div>
      <div class="form-group"><label>VAT Number</label><input name="vatNumber" value="${esc(c.vatNumber)}"/></div>
    </div>
    <div class="form-group"><label>Address</label><input name="address" value="${esc(c.address)}"/></div>
    </form>`,
    `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
     <button class="btn btn-amber btn-sm" onclick="Settings._saveClient('${id}')">Save</button>`);
  },
  deleteClient(id){ if(confirm('Delete this client?')){State.remove('clients',id);Settings.render();Toast.show('Deleted','error');} }
};

// ── App Init ──────────────────────────────────────────────────────────────────
const App = {
  init(){
    State.init();
    if(Auth.checkSession()){
      const u=Auth.currentUser;
      document.getElementById('login-screen').style.display='none';
      document.getElementById('app-screen').style.display='flex';
      document.getElementById('sb-user-name').textContent=u.name;
      document.getElementById('sb-user-role').textContent=u.role;
      document.getElementById('sb-avatar').textContent=u.initials;
      document.getElementById('topbar-date').textContent=new Date().toLocaleDateString('en-SA',{weekday:'short',year:'numeric',month:'short',day:'numeric'});
      Nav.go('dashboard');
    }
    // Enter key on login
    document.getElementById('login-pass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') Auth.login(); });
    document.getElementById('login-email')?.addEventListener('keydown',e=>{ if(e.key==='Enter') Auth.login(); });
  }
};

/* ═══════════════════════════════════════════════════════════
   BUILDOPS — Workforce Module (workforce.js)
   Handles both Manpower Rental & Equipment Rental
   Step 1: Requirements   Step 2: Resource Pool
   Step 3: Mobilization   Step 4: Timesheets (AI)
   Step 5: Invoices ZATCA Step 6: Expenses & P&L
════════════════════════════════════════════════════════════ */

const WorkforceModule = {
  _type: 'manpower', // 'manpower' | 'equipment'
  _step: 0,

  // ─── Labels per module type ───────────────────────────────────────────────
  labels(type){
    const isEq = type==='equipment';
    return {
      type, isEq,
      Title:     isEq ? 'Equipment Rental' : 'Manpower Rental',
      icon:      isEq ? '🏗️' : '👷',
      color:     isEq ? 'var(--purple)' : 'var(--blue)',
      Resource:  isEq ? 'Equipment Unit' : 'Worker',
      Resources: isEq ? 'Equipment Units' : 'Workers',
      pool:      isEq ? 'units' : 'workers',
      tsLabel:   isEq ? 'Usage Logs' : 'Timesheets',
      rateLabel: isEq ? 'Day Rate (SAR/day)' : 'Rate (SAR/hr)',
      poRateL:   isEq ? 'PO Day Rate (SAR)' : 'PO Hourly Rate (SAR)',
      agrRateL:  isEq ? 'Agreed Day Rate (SAR)' : 'Agreed Rate (SAR)',
      hoursLabel:isEq ? 'Days Used' : 'Hours Worked',
      path:      isEq ? 'equipment' : 'manpower',
      steps:     ['Requirements','Resource Pool','Mobilization', isEq?'Usage Logs':'Timesheets','Invoices','P&L'],
      stepIcons: ['📋','🧑‍💼','🚚', isEq?'📈':'📋','🧾','💹'],
    };
  },

  // ─── Main Render ─────────────────────────────────────────────────────────
  render(type, step=0){
    this._type = type;
    this._step = step;
    const L = this.labels(type);
    const el = document.getElementById('content');
    el.innerHTML = `
<div class="module-banner ${type}">
  <div class="module-banner-icon">${L.icon}</div>
  <div>
    <h2>${L.Title}</h2>
    <p>Source · Deploy · Track · Invoice · Analyse — All in one place</p>
  </div>
  <div style="margin-left:auto;text-align:right">
    <div style="font-size:11px;opacity:.7">Active ${L.Resources}</div>
    <div style="font-size:22px;font-weight:800">${(State.get(L.path+'.mobilizations')||[]).filter(m=>m.status==='Active').length}</div>
  </div>
</div>

<div class="step-nav" id="step-nav-${type}">
  ${L.steps.map((s,i)=>`<button class="step-btn${i===step?' active':''}" onclick="WorkforceModule._goStep(${i},'${type}')" data-step="${i}">
    <span class="step-icon">${L.stepIcons[i]}</span>
    <span class="step-label">${s}</span>
  </button>`).join('')}
</div>
<div id="step-content-${type}"></div>`;
    this._renderStep(step, L);
  },

  _goStep(i, type){
    this._step = i;
    document.querySelectorAll('.step-btn').forEach((b,j)=>b.classList.toggle('active',j===i));
    this._renderStep(i, this.labels(type));
  },

  _renderStep(step, L){
    const el = document.getElementById(`step-content-${L.type}`);
    switch(step){
      case 0: el.innerHTML = this.renderRequirements(L); break;
      case 1: el.innerHTML = this.renderResourcePool(L); break;
      case 2: el.innerHTML = this.renderMobilization(L); break;
      case 3: el.innerHTML = this.renderTimesheets(L); break;
      case 4: el.innerHTML = this.renderInvoices(L); break;
      case 5: el.innerHTML = this.renderPL(L); break;
    }
  },

  // ════════════════════════════════════════════════════════════════════════
  // STEP 0 — REQUIREMENTS & COORDINATOR ASSIGNMENT
  // ════════════════════════════════════════════════════════════════════════
  renderRequirements(L){
    const reqs = State.get(L.path+'.requirements') || [];
    const clients = State.get('clients') || [];
    const coords  = State.get('coordinators') || [];
    const statuses = ['New','Assigned','Sourcing','Interview Scheduled','Workers Selected','Mobilized','Active','Completed','Cancelled'];
    const counts = {};
    statuses.slice(0,6).forEach(s=>counts[s]=(reqs.filter(r=>r.status===s).length));

    return `
<div class="tbl-header">
  <h3>📋 Client Requirements — ${L.Title}</h3>
  <div class="toolbar">
    <input class="search-input" id="req-search-${L.type}" placeholder="Search..." oninput="WorkforceModule.filterReqs('${L.type}')"/>
    <button class="btn btn-amber btn-sm" onclick="WorkforceModule.addRequirement('${L.type}')">+ New Requirement</button>
  </div>
</div>

<div class="pipeline-status" style="margin-bottom:18px">
  ${['New','Assigned','Sourcing','Interview Scheduled','Workers Selected','Active'].map(s=>`
  <div class="pipe-stage" onclick="WorkforceModule.filterByStatus('${s}','${L.type}')">
    <div class="pipe-count">${reqs.filter(r=>r.status===s).length}</div>
    <div class="pipe-label">${s}</div>
  </div>`).join('')}
</div>

<div class="table-wrap"><table class="data-table" id="reqs-table-${L.type}">
  <thead><tr><th>#</th><th>Client</th><th>${L.isEq?'Equipment Type':'Trade / Position'}</th><th>Qty</th><th>Urgency</th><th>Coordinator</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
  <tbody>
  ${reqs.length===0
    ? `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted)">No requirements yet. Click "+ New Requirement" to start.</td></tr>`
    : reqs.map((r,i)=>`<tr>
        <td>${i+1}</td>
        <td><strong>${esc(r.clientName)}</strong></td>
        <td>${esc(r.trade)}</td>
        <td style="text-align:center"><strong>${r.qty}</strong></td>
        <td>${statusBadge(r.urgency||'Medium')}</td>
        <td>${r.coordinatorName?`<span class="badge badge-blue">${esc(r.coordinatorName)}</span>`:'<span class="text-muted">—</span>'}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="text-muted">${esc(r.date)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-ghost" onclick="WorkforceModule.editRequirement('${r.id}','${L.type}')">✏️</button>
          <button class="btn btn-sm btn-blue" onclick="WorkforceModule.assignCoordinator('${r.id}','${L.type}')">👤</button>
          <button class="btn btn-sm btn-danger" onclick="WorkforceModule.deleteRequirement('${r.id}','${L.type}')">🗑️</button>
        </td>
      </tr>`).join('')}
  </tbody>
</table></div>`;
  },

  filterReqs(type){
    const q=document.getElementById(`req-search-${type}`).value.toLowerCase();
    document.querySelectorAll(`#reqs-table-${type} tbody tr`).forEach(tr=>{
      tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none';
    });
  },
  filterByStatus(status,type){
    document.querySelectorAll(`#reqs-table-${type} tbody tr`).forEach(tr=>{
      tr.style.display=(!status||tr.textContent.includes(status))?'':'none';
    });
  },

  addRequirement(type){
    const L=this.labels(type);
    const clients=State.get('clients')||[];
    const coords=State.get('coordinators')||[];
    Modal.show(`New ${L.Title} Requirement`,`
<form id="req-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Client *</label>
      <select name="clientId" onchange="WorkforceModule._updateClientName(this)" required>
        <option value="">— Select Client —</option>
        ${clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
      </select>
      <input type="hidden" name="clientName" id="req-client-name"/>
    </div>
    <div class="form-group"><label>${L.isEq?'Equipment Type / Description':'Trade / Position Required'} *</label>
      <input name="trade" placeholder="${L.isEq?'e.g. Excavator 20T, Crane 50T':'e.g. Civil Foreman, Welder 6G'}" required/>
    </div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Quantity *</label><input name="qty" type="number" value="1" min="1" required/></div>
    <div class="form-group"><label>Urgency</label>
      <select name="urgency"><option>Low</option><option selected>Medium</option><option>High</option></select></div>
    <div class="form-group"><label>Required By</label><input name="requiredBy" type="date"/></div>
  </div>
  <div class="form-row cols-2">
    <div class="form-group"><label>Assign Coordinator</label>
      <select name="coordinatorId" onchange="WorkforceModule._updateCoordName(this)">
        <option value="">— Assign Later —</option>
        ${coords.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)} (${c.commissionPct}%)</option>`).join('')}
      </select>
      <input type="hidden" name="coordinatorName" id="req-coord-name"/>
    </div>
    <div class="form-group"><label>Status</label>
      <select name="status"><option>New</option><option>Assigned</option><option>Sourcing</option></select></div>
  </div>
  <div class="form-group"><label>Client Requirements / Notes</label>
    <textarea name="notes" placeholder="Specific skills, certifications, experience required..."></textarea></div>
  <div class="form-group"><label>Source (How Received)</label>
    <select name="source"><option>Email</option><option>WhatsApp</option><option>Phone Call</option><option>Portal</option><option>Walk-in</option></select></div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._saveRequirement(null,'${type}')">Save Requirement</button>`);
  },

  _updateClientName(sel){ document.getElementById('req-client-name').value=sel.options[sel.selectedIndex]?.dataset.name||''; },
  _updateCoordName(sel){ document.getElementById('req-coord-name').value=sel.options[sel.selectedIndex]?.dataset.name||''; },

  _saveRequirement(id, type){
    const f=document.getElementById('req-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.clientId||!d.trade){Toast.show('Client and trade are required','error');return;}
    const item={...d,qty:num(d.qty),date:id?undefined:today()};
    if(id) State.update(type+'.requirements',id,item);
    else State.push(type+'.requirements',{id:uid(),date:today(),...item});
    Modal.close();
    WorkforceModule.render(type,0);
    Toast.show('Requirement saved!');
  },

  editRequirement(id,type){
    const r=State.find(type+'.requirements',id); if(!r) return;
    const L=this.labels(type), clients=State.get('clients')||[], coords=State.get('coordinators')||[];
    Modal.show('Edit Requirement',`
<form id="req-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Client</label>
      <select name="clientId" onchange="WorkforceModule._updateClientName(this)">
        ${clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}" ${c.id===r.clientId?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select><input type="hidden" name="clientName" id="req-client-name" value="${esc(r.clientName)}"/>
    </div>
    <div class="form-group"><label>${L.isEq?'Equipment Type':'Trade'}</label><input name="trade" value="${esc(r.trade)}" required/></div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Qty</label><input name="qty" type="number" value="${r.qty}"/></div>
    <div class="form-group"><label>Urgency</label>
      <select name="urgency"><option ${r.urgency==='Low'?'selected':''}>Low</option><option ${r.urgency==='Medium'?'selected':''}>Medium</option><option ${r.urgency==='High'?'selected':''}>High</option></select></div>
    <div class="form-group"><label>Status</label>
      <select name="status">${['New','Assigned','Sourcing','Interview Scheduled','Workers Selected','Mobilized','Active','Completed','Cancelled'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
  </div>
  <div class="form-row cols-2">
    <div class="form-group"><label>Coordinator</label>
      <select name="coordinatorId" onchange="WorkforceModule._updateCoordName(this)">
        <option value="">— None —</option>
        ${coords.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}" ${c.id===r.coordinatorId?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select><input type="hidden" name="coordinatorName" id="req-coord-name" value="${esc(r.coordinatorName)}"/>
    </div>
    <div class="form-group"><label>Required By</label><input name="requiredBy" type="date" value="${esc(r.requiredBy)}"/></div>
  </div>
  <div class="form-group"><label>Notes</label><textarea name="notes">${esc(r.notes)}</textarea></div>
  <div class="form-group"><label>Source</label>
    <select name="source"><option ${r.source==='Email'?'selected':''}>Email</option><option ${r.source==='WhatsApp'?'selected':''}>WhatsApp</option><option ${r.source==='Phone Call'?'selected':''}>Phone Call</option><option ${r.source==='Portal'?'selected':''}>Portal</option></select></div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._saveRequirement('${id}','${type}')">Save</button>`);
  },

  deleteRequirement(id,type){ if(confirm('Delete this requirement?')){State.remove(type+'.requirements',id);WorkforceModule.render(type,0);Toast.show('Deleted','error');} },

  assignCoordinator(reqId,type){
    const r=State.find(type+'.requirements',reqId); if(!r) return;
    const coords=State.get('coordinators')||[];
    Modal.show('Assign Coordinator',`
<p class="mb-12">Requirement: <strong>${esc(r.trade)}</strong> for <strong>${esc(r.clientName)}</strong></p>
<div class="form-group"><label>Select Coordinator</label>
  <select id="assign-coord">
    <option value="">— Unassign —</option>
    ${coords.map(c=>`<option value="${c.id}|${c.name}" ${c.id===r.coordinatorId?'selected':''}>${esc(c.name)} — ${c.commissionPct}% commission</option>`).join('')}
  </select></div>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._doAssign('${reqId}','${type}')">Assign</button>`);
  },

  _doAssign(reqId,type){
    const v=document.getElementById('assign-coord').value;
    const [coordinatorId,coordinatorName]=v.split('|');
    State.update(type+'.requirements',reqId,{coordinatorId,coordinatorName,status:coordinatorId?'Assigned':'New'});
    Modal.close(); WorkforceModule.render(type,0); Toast.show('Coordinator assigned!');
  },

  // ════════════════════════════════════════════════════════════════════════
  // STEP 1 — RESOURCE POOL & DOCUMENTS
  // ════════════════════════════════════════════════════════════════════════
  renderResourcePool(L){
    const pool = State.get(L.path+'.'+L.pool) || [];
    const reqs  = State.get(L.path+'.requirements') || [];

    return `
<div class="tbl-header">
  <h3>${L.isEq?'🏗️ Equipment Fleet':'👷 Worker Pool'} — ${pool.length} ${L.Resources}</h3>
  <div class="toolbar">
    <input class="search-input" id="pool-search-${L.type}" placeholder="Search ${L.Resources}..." oninput="WorkforceModule.filterPool('${L.type}')"/>
    <button class="btn btn-amber btn-sm" onclick="WorkforceModule.addResource('${L.type}')">+ Add ${L.Resource}</button>
  </div>
</div>
<div class="table-wrap"><table class="data-table" id="pool-table-${L.type}">
  <thead><tr>
    <th>#</th><th>${L.isEq?'Equipment Name':'Worker Name'}</th>
    <th>${L.isEq?'Make/Model':'Nationality'}</th>
    <th>${L.isEq?'Reg / Serial':'IQAMA / ID'}</th>
    <th>${L.isEq?'Type':'Trade'}</th>
    ${!L.isEq?'<th>Passport</th><th>Medical</th><th>Other Docs</th>':'<th>Ownership</th><th>Condition</th>'}
    <th>Linked Req.</th><th>Status</th><th>Actions</th>
  </tr></thead>
  <tbody>
  ${pool.length===0
    ? `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--muted)">No ${L.Resources} yet. Add them here once sourced.</td></tr>`
    : pool.map((w,i)=>`<tr>
        <td>${i+1}</td>
        <td><strong>${esc(w.name)}</strong>${w.phone?`<br><small class="text-muted">${esc(w.phone)}</small>`:''}</td>
        <td>${esc(w.nationality||w.makeModel||'—')}</td>
        <td><code style="font-size:11px">${esc(w.iqama||w.regNo||'—')}</code></td>
        <td>${esc(w.trade||w.equipType||'—')}</td>
        ${!L.isEq
          ? `<td class="text-center">${w.passport?'<span class="doc-tick" title="Verified ✅">✅</span>':'<span class="doc-tick" title="Missing ❌" style="cursor:pointer" onclick="WorkforceModule.editDoc(\'${w.id}\',\'${L.type}\',\'passport\')">❌</span>'}</td>
             <td class="text-center">${w.medical?'<span class="doc-tick">✅</span>':'<span class="doc-tick" style="cursor:pointer" onclick="WorkforceModule.editDoc(\'${w.id}\',\'${L.type}\',\'medical\')">❌</span>'}</td>
             <td class="text-center"><span class="badge badge-grey">${(w.otherDocs||[]).length} docs</span></td>`
          : `<td>${esc(w.ownership||'Own')}</td><td>${statusBadge(w.condition||'Good')}</td>`}
        <td>${w.reqId?`<span class="badge badge-blue text-sm">${esc(w.reqClientName||w.reqId)}</span>`:'<span class="text-muted">—</span>'}</td>
        <td>${statusBadge(w.status||'Available')}</td>
        <td class="actions">
          <button class="btn btn-sm btn-ghost" onclick="WorkforceModule.editResource('${w.id}','${L.type}')">✏️</button>
          <button class="btn btn-sm btn-blue" onclick="WorkforceModule.linkToReq('${w.id}','${L.type}')">🔗 Link</button>
          <button class="btn btn-sm btn-danger" onclick="WorkforceModule.deleteResource('${w.id}','${L.type}')">🗑️</button>
        </td>
      </tr>`).join('')}
  </tbody>
</table></div>`;
  },

  filterPool(type){
    const q=document.getElementById(`pool-search-${type}`).value.toLowerCase();
    document.querySelectorAll(`#pool-table-${type} tbody tr`).forEach(tr=>{
      tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none';
    });
  },

  addResource(type){
    const L=this.labels(type);
    const reqs=State.get(L.path+'.requirements')||[];
    Modal.show(`Add ${L.Resource}`,`
<form id="res-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>${L.isEq?'Equipment Name *':'Full Name *'}</label><input name="name" required/></div>
    <div class="form-group"><label>${L.isEq?'Make / Model':'Nationality'}</label><input name="${L.isEq?'makeModel':'nationality'}"/></div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>${L.isEq?'Registration / Serial No.':'IQAMA / National ID'}</label><input name="${L.isEq?'regNo':'iqama'}"/></div>
    <div class="form-group"><label>${L.isEq?'Equipment Type':'Trade / Skill'}</label><input name="${L.isEq?'equipType':'trade'}"/></div>
    <div class="form-group"><label>Phone${L.isEq?' (Operator)':''}</label><input name="phone"/></div>
  </div>
  ${!L.isEq?`
  <div class="form-row cols-3">
    <div class="form-group"><label>Passport No.</label><input name="passportNo"/></div>
    <div class="form-group"><label>Passport Expiry</label><input name="passportExpiry" type="date"/></div>
    <div class="form-group"><label>Passport Verified</label><select name="passport"><option value="">Pending</option><option value="1">✅ Verified</option></select></div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Medical Expiry</label><input name="medicalExpiry" type="date"/></div>
    <div class="form-group"><label>Medical Verified</label><select name="medical"><option value="">Pending</option><option value="1">✅ Verified</option></select></div>
    <div class="form-group"><label>Visa Type</label><select name="visaType"><option>Visit</option><option>Work</option><option>Own Sponsor</option><option>Company Sponsor</option></select></div>
  </div>`:''}
  ${L.isEq?`
  <div class="form-row cols-2">
    <div class="form-group"><label>Ownership</label><select name="ownership"><option>Own Fleet</option><option>Sub-rented</option><option>Client Owned</option></select></div>
    <div class="form-group"><label>Condition</label><select name="condition"><option>Good</option><option>Fair</option><option>Needs Service</option></select></div>
  </div>`:''}
  <div class="form-row cols-2">
    <div class="form-group"><label>Status</label>
      <select name="status"><option>Available</option><option>Assigned to Job</option><option>Inactive</option></select></div>
    <div class="form-group"><label>Notes</label><input name="notes"/></div>
  </div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._saveResource(null,'${type}')">Save ${L.Resource}</button>`);
  },

  _saveResource(id,type){
    const f=document.getElementById('res-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.name){Toast.show('Name required','error');return;}
    if(id) State.update(type+'.'+(type==='equipment'?'units':'workers'),id,d);
    else State.push(type+'.'+(type==='equipment'?'units':'workers'),{id:uid(),addedDate:today(),...d});
    Modal.close(); WorkforceModule.render(type,1); Toast.show('Saved!');
  },

  editResource(id,type){
    const pool=type==='equipment'?'units':'workers';
    const w=State.find(type+'.'+pool,id); if(!w) return;
    const L=this.labels(type);
    Modal.show(`Edit ${L.Resource}`,`
<form id="res-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Name</label><input name="name" value="${esc(w.name)}" required/></div>
    <div class="form-group"><label>${L.isEq?'Make/Model':'Nationality'}</label><input name="${L.isEq?'makeModel':'nationality'}" value="${esc(w.makeModel||w.nationality||'')}"/></div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>${L.isEq?'Reg/Serial':'IQAMA'}</label><input name="${L.isEq?'regNo':'iqama'}" value="${esc(w.regNo||w.iqama||'')}"/></div>
    <div class="form-group"><label>${L.isEq?'Type':'Trade'}</label><input name="${L.isEq?'equipType':'trade'}" value="${esc(w.equipType||w.trade||'')}"/></div>
    <div class="form-group"><label>Phone</label><input name="phone" value="${esc(w.phone||'')}"/></div>
  </div>
  ${!L.isEq?`
  <div class="form-row cols-3">
    <div class="form-group"><label>Passport No.</label><input name="passportNo" value="${esc(w.passportNo||'')}"/></div>
    <div class="form-group"><label>Passport Expiry</label><input name="passportExpiry" type="date" value="${esc(w.passportExpiry||'')}"/></div>
    <div class="form-group"><label>Passport Verified</label><select name="passport"><option value="" ${!w.passport?'selected':''}>Pending</option><option value="1" ${w.passport?'selected':''}>✅ Verified</option></select></div>
  </div>
  <div class="form-row cols-2">
    <div class="form-group"><label>Medical Expiry</label><input name="medicalExpiry" type="date" value="${esc(w.medicalExpiry||'')}"/></div>
    <div class="form-group"><label>Medical Verified</label><select name="medical"><option value="" ${!w.medical?'selected':''}>Pending</option><option value="1" ${w.medical?'selected':''}>✅ Verified</option></select></div>
  </div>`:''}
  <div class="form-row cols-2">
    <div class="form-group"><label>Status</label>
      <select name="status"><option ${w.status==='Available'?'selected':''}>Available</option><option ${w.status==='Assigned to Job'?'selected':''}>Assigned to Job</option><option ${w.status==='Inactive'?'selected':''}>Inactive</option></select></div>
    <div class="form-group"><label>Notes</label><input name="notes" value="${esc(w.notes||'')}"/></div>
  </div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._saveResource('${id}','${type}')">Save</button>`);
  },

  deleteResource(id,type){ if(confirm('Delete?')){State.remove(type+'.'+(type==='equipment'?'units':'workers'),id);WorkforceModule.render(type,1);Toast.show('Deleted','error');} },

  linkToReq(wId,type){
    const pool=type==='equipment'?'units':'workers';
    const reqs=State.get(type+'.requirements')||[];
    const w=State.find(type+'.'+pool,wId); if(!w) return;
    Modal.show('Link to Requirement',`
<p class="mb-12">Link <strong>${esc(w.name)}</strong> to a client requirement:</p>
<div class="form-group"><label>Select Requirement</label>
  <select id="link-req-sel">
    <option value="">— Select —</option>
    ${reqs.filter(r=>!['Completed','Cancelled'].includes(r.status)).map(r=>`<option value="${r.id}|${esc(r.clientName)}">${esc(r.clientName)} — ${esc(r.trade)} (${r.qty} needed)</option>`).join('')}
  </select></div>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._doLink('${wId}','${type}')">Link</button>`);
  },

  _doLink(wId,type){
    const pool=type==='equipment'?'units':'workers';
    const v=document.getElementById('link-req-sel').value;
    const [reqId,reqClientName]=v.split('|');
    if(!reqId){Toast.show('Select a requirement','error');return;}
    State.update(type+'.'+pool,wId,{reqId,reqClientName,status:'Assigned to Job'});
    Modal.close(); WorkforceModule.render(type,1); Toast.show('Linked!');
  },

  editDoc(wId,type,docType){
    Toast.show('Click ✏️ Edit on the worker row to update documents','info');
  },

  // ════════════════════════════════════════════════════════════════════════
  // STEP 2 — MOBILIZATION & RATE NEGOTIATION
  // ════════════════════════════════════════════════════════════════════════
  renderMobilization(L){
    const mobs = State.get(L.path+'.mobilizations') || [];
    const totalPORev = mobs.filter(m=>m.status==='Active').reduce((s,m)=>s+num(m.poRate)*num(m.hours||m.days||0),0);
    const totalWkCost = mobs.filter(m=>m.status==='Active').reduce((s,m)=>s+num(m.agrRate)*num(m.hours||m.days||0),0);

    return `
<div class="grid-3" style="margin-bottom:18px">
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Active Mobilizations</div><div class="stat-value" style="color:var(--blue)">${mobs.filter(m=>m.status==='Active').length}</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Total Active PO Rate Revenue</div><div class="stat-value" style="color:var(--success)">${fmtSAR(totalPORev)}</div></div>
  <div class="stat-card" style="border-left-color:var(--amber)"><div class="stat-label">Total Margin (Active)</div><div class="stat-value" style="color:var(--amber)">${fmtSAR(totalPORev-totalWkCost)}</div></div>
</div>
<div class="tbl-header">
  <h3>🚚 Mobilization Register</h3>
  <button class="btn btn-amber btn-sm" onclick="WorkforceModule.addMobilization('${L.type}')">+ Add Mobilization</button>
</div>
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>#</th><th>Client</th><th>${L.Resource}</th><th>Mob. Date</th><th>${L.poRateL}</th><th>${L.agrRateL}</th><th>Margin/Unit</th><th>${L.hoursLabel}</th><th>Status</th><th>Actions</th></tr></thead>
  <tbody>
  ${mobs.length===0
    ? `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted)">No mobilizations yet.</td></tr>`
    : mobs.map((m,i)=>{
        const margin=num(m.poRate)-num(m.agrRate);
        const units=num(m.hours||m.days||0);
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${esc(m.clientName)}</strong></td>
          <td>${esc(m.resourceName)}</td>
          <td>${esc(m.mobDate)}</td>
          <td class="text-right"><span class="rate-compare po">${fmtSAR(m.poRate)}</span></td>
          <td class="text-right"><span class="rate-compare wk">${fmtSAR(m.agrRate)}</span></td>
          <td class="text-right"><span class="rate-compare mg">${fmtSAR(margin)}</span></td>
          <td class="text-right">${units>0?units:'-'}</td>
          <td>${statusBadge(m.status)}</td>
          <td class="actions">
            <button class="btn btn-sm btn-ghost" onclick="WorkforceModule.editMobilization('${m.id}','${L.type}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="WorkforceModule.deleteMob('${m.id}','${L.type}')">🗑️</button>
          </td>
        </tr>`;
      }).join('')}
  </tbody>
</table></div>`;
  },

  addMobilization(type){
    const L=this.labels(type);
    const clients=State.get('clients')||[];
    const pool=State.get(type+'.'+(type==='equipment'?'units':'workers'))||[];
    const reqs=State.get(type+'.requirements')||[];
    Modal.show(`Add Mobilization Record`,`
<form id="mob-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Client *</label>
      <select name="clientId" onchange="WorkforceModule._setMobClient(this)" required>
        <option value="">— Select Client —</option>
        ${clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
      </select><input type="hidden" name="clientName" id="mob-cn"/>
    </div>
    <div class="form-group"><label>${L.Resource} *</label>
      <select name="resourceId" onchange="WorkforceModule._setMobResource(this)" required>
        <option value="">— Select ${L.Resource} —</option>
        ${pool.map(w=>`<option value="${w.id}" data-name="${esc(w.name)}">${esc(w.name)}</option>`).join('')}
      </select><input type="hidden" name="resourceName" id="mob-rn"/>
    </div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Mobilization Date *</label><input name="mobDate" type="date" value="${today()}" required/></div>
    <div class="form-group"><label>Expected End Date</label><input name="endDate" type="date"/></div>
    <div class="form-group"><label>Status</label>
      <select name="status"><option>Active</option><option>Completed</option><option>On Hold</option></select></div>
  </div>
  <div class="alert alert-info" style="margin:10px 0">
    <strong>Rate Negotiation:</strong> PO Rate = what client pays you. Agreed Rate = what you pay the ${L.Resource.toLowerCase()}.
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>${L.poRateL} *</label><input name="poRate" type="number" step="0.01" placeholder="Client pays..." required/></div>
    <div class="form-group"><label>${L.agrRateL} *</label><input name="agrRate" type="number" step="0.01" placeholder="${L.isEq?'You pay...':'Worker gets...'}" required oninput="WorkforceModule._calcMargin()"/></div>
    <div class="form-group"><label>Margin Preview</label><div id="mob-margin-preview" style="padding:9px 12px;background:var(--concrete);border-radius:6px;font-weight:700;color:var(--success)">Enter rates above</div></div>
  </div>
  <div class="form-row cols-2">
    <div class="form-group"><label>${L.hoursLabel} (this period)</label><input name="${L.isEq?'days':'hours'}" type="number" step="0.5" placeholder="Optional — update monthly"/></div>
    <div class="form-group"><label>Notes</label><input name="notes"/></div>
  </div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._saveMob(null,'${type}')">Save Mobilization</button>`, false);
    document.getElementById('mob-margin-preview');
  },

  _setMobClient(sel){ document.getElementById('mob-cn').value=sel.options[sel.selectedIndex]?.dataset.name||''; },
  _setMobResource(sel){ document.getElementById('mob-rn').value=sel.options[sel.selectedIndex]?.dataset.name||''; },
  _calcMargin(){
    const po=num(document.querySelector('[name="poRate"]')?.value);
    const ag=num(document.querySelector('[name="agrRate"]')?.value);
    const el=document.getElementById('mob-margin-preview');
    if(el&&po&&ag){
      const m=po-ag;
      el.textContent=fmtSAR(m)+' / unit ('+(po>0?(m/po*100).toFixed(1):0)+'%)';
      el.style.color=m>0?'var(--success)':m<0?'var(--danger)':'var(--muted)';
    }
  },

  _saveMob(id,type){
    const f=document.getElementById('mob-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.clientId||!d.resourceId){Toast.show('Client and resource required','error');return;}
    const item={...d,poRate:num(d.poRate),agrRate:num(d.agrRate),hours:num(d.hours),days:num(d.days)};
    if(id) State.update(type+'.mobilizations',id,item);
    else State.push(type+'.mobilizations',{id:uid(),addedDate:today(),...item});
    Modal.close(); WorkforceModule.render(type,2); Toast.show('Mobilization saved!');
  },

  editMobilization(id,type){
    const m=State.find(type+'.mobilizations',id); if(!m) return;
    const L=this.labels(type), clients=State.get('clients')||[], pool=State.get(type+'.'+(type==='equipment'?'units':'workers'))||[];
    Modal.show('Edit Mobilization',`
<form id="mob-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Client</label>
      <select name="clientId" onchange="WorkforceModule._setMobClient(this)">
        ${clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}" ${c.id===m.clientId?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select><input type="hidden" name="clientName" id="mob-cn" value="${esc(m.clientName)}"/>
    </div>
    <div class="form-group"><label>${L.Resource}</label>
      <select name="resourceId" onchange="WorkforceModule._setMobResource(this)">
        ${pool.map(w=>`<option value="${w.id}" data-name="${esc(w.name)}" ${w.id===m.resourceId?'selected':''}>${esc(w.name)}</option>`).join('')}
      </select><input type="hidden" name="resourceName" id="mob-rn" value="${esc(m.resourceName)}"/>
    </div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Mob. Date</label><input name="mobDate" type="date" value="${esc(m.mobDate)}"/></div>
    <div class="form-group"><label>End Date</label><input name="endDate" type="date" value="${esc(m.endDate||'')}"/></div>
    <div class="form-group"><label>Status</label>
      <select name="status"><option ${m.status==='Active'?'selected':''}>Active</option><option ${m.status==='Completed'?'selected':''}>Completed</option><option ${m.status==='On Hold'?'selected':''}>On Hold</option></select></div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>${L.poRateL}</label><input name="poRate" type="number" step="0.01" value="${m.poRate}"/></div>
    <div class="form-group"><label>${L.agrRateL}</label><input name="agrRate" type="number" step="0.01" value="${m.agrRate}"/></div>
    <div class="form-group"><label>${L.hoursLabel}</label><input name="${L.isEq?'days':'hours'}" type="number" step="0.5" value="${m.hours||m.days||''}"/></div>
  </div>
  <div class="form-group"><label>Notes</label><input name="notes" value="${esc(m.notes||'')}"/></div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._saveMob('${id}','${type}')">Save</button>`);
  },
  deleteMob(id,type){ if(confirm('Delete mobilization?')){State.remove(type+'.mobilizations',id);WorkforceModule.render(type,2);Toast.show('Deleted','error');} },

  // ════════════════════════════════════════════════════════════════════════
  // STEP 3 — TIMESHEETS / USAGE LOGS (AI)
  // ════════════════════════════════════════════════════════════════════════
  renderTimesheets(L){
    const sheets = State.get(L.path+'.timesheets') || [];
    const clients = State.get('clients') || [];

    return `
<div class="card">
  <div class="card-title">📤 Upload ${L.tsLabel} — AI Extraction</div>
  <p class="text-muted mb-12" style="font-size:12px">Upload a PDF or image of the client timesheet. AI will extract worker names, hours, and generate a summary automatically.</p>
  <div class="form-row cols-3">
    <div class="form-group"><label>Client</label>
      <select id="ts-client"><option value="">— Select Client —</option>${clients.map(c=>`<option value="${c.id}|${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Month / Period</label><input type="month" id="ts-month" value="${today().slice(0,7)}"/></div>
    <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-amber" onclick="WorkforceModule.uploadTimesheet('${L.type}')">📤 Upload & Process</button></div>
  </div>
  <input type="file" id="ts-file-input" accept=".pdf,.png,.jpg,.jpeg" style="display:none" onchange="WorkforceModule._processTimesheetFile('${L.type}')"/>
  <div class="upload-zone" onclick="document.getElementById('ts-file-input').click()" id="ts-upload-zone">
    <div class="upload-icon">📋</div>
    <p>Click or drop timesheet file here</p>
    <small>PDF, PNG, JPG supported</small>
  </div>
  <div id="ts-processing" style="display:none" class="text-center mt-12">
    <div class="loading-spinner"></div>
    <span style="margin-left:10px;font-size:13px;color:var(--amber)">AI is reading the timesheet...</span>
  </div>
  <div id="ts-result"></div>
</div>

<div class="card">
  <div class="tbl-header"><h3>📋 Processed ${L.tsLabel} (${sheets.length})</h3></div>
  ${sheets.length===0
    ? `<div class="empty-state" style="padding:24px"><div class="empty-icon">📋</div><p>No timesheets processed yet.</p></div>`
    : `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>#</th><th>Client</th><th>Period</th><th>Workers</th><th>Total Hours</th><th>Total Amount (SAR)</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${sheets.map((s,i)=>`<tr>
        <td>${i+1}</td><td><strong>${esc(s.clientName)}</strong></td><td>${esc(s.period)}</td>
        <td>${(s.workers||[]).length}</td>
        <td class="text-right">${fmtNum(s.totalHours)}</td>
        <td class="text-right">${fmtSAR(s.totalAmount)}</td>
        <td>${statusBadge(s.status||'Pending Review')}</td>
        <td class="actions">
          <button class="btn btn-sm btn-blue" onclick="WorkforceModule.viewTimesheet('${s.id}','${L.type}')">👁 View</button>
          <button class="btn btn-sm btn-success" onclick="WorkforceModule.approveTimesheet('${s.id}','${L.type}')">✅ Approve</button>
          <button class="btn btn-sm btn-amber" onclick="WorkforceModule.generateInvoiceFromTS('${s.id}','${L.type}')">🧾 Invoice</button>
          <button class="btn btn-sm btn-danger" onclick="WorkforceModule.deleteTS('${s.id}','${L.type}')">🗑️</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`}
</div>`;
  },

  uploadTimesheet(type){
    const cVal=document.getElementById('ts-client').value;
    const month=document.getElementById('ts-month').value;
    if(!cVal){Toast.show('Select a client first','error');return;}
    document.getElementById('ts-file-input').click();
  },

  async _processTimesheetFile(type){
    const file=document.getElementById('ts-file-input').files[0];
    if(!file) return;
    const cVal=document.getElementById('ts-client').value;
    const month=document.getElementById('ts-month').value;
    if(!cVal){Toast.show('Select a client first','error');return;}
    const [clientId,clientName]=cVal.split('|');
    document.getElementById('ts-processing').style.display='block';
    document.getElementById('ts-result').innerHTML='';
    try{
      const {data,type:mime}=await fileToBase64(file);
      const result=await API.processTimesheet(data,mime);
      document.getElementById('ts-processing').style.display='none';
      const L=this.labels(type);
      const mobs=State.get(type+'.mobilizations')||[];
      const clientMobs=mobs.filter(m=>m.clientId===clientId&&m.status==='Active');
      // Enrich with rates from mobilizations
      const workers=(result.workers||[]).map(w=>{
        const mob=clientMobs.find(m=>m.resourceName.toLowerCase().includes(w.name.toLowerCase().split(' ')[0]));
        return {...w,poRate:mob?.poRate||0,agrRate:mob?.agrRate||0,amount:(mob?.poRate||0)*w.totalHours};
      });
      const totalHours=workers.reduce((s,w)=>s+num(w.totalHours),0);
      const totalAmount=workers.reduce((s,w)=>s+num(w.amount),0);
      const tsId=uid();
      const tsData={id:tsId,clientId,clientName,period:result.period?.month||month,
        periodStart:result.period?.start,periodEnd:result.period?.end,
        workers,totalHours,totalAmount,status:'Pending Review',uploadDate:today(),
        fileName:file.name,notes:result.notes||''};
      State.push(type+'.timesheets',tsData);
      document.getElementById('ts-result').innerHTML=`
<div class="alert alert-success">✅ Timesheet processed! ${workers.length} workers found. Total: ${fmtSAR(totalAmount)}</div>
${this._renderTSTable(tsData,L)}`;
      Toast.show('Timesheet processed!');
    }catch(e){
      document.getElementById('ts-processing').style.display='none';
      document.getElementById('ts-result').innerHTML=`<div class="alert alert-danger">❌ ${e.message}</div>`;
      Toast.show(e.message,'error');
    }
  },

  _renderTSTable(ts,L){
    return `<div class="table-wrap mt-12"><table class="data-table">
      <thead><tr><th>${L.Resource} Name</th><th>ID</th><th>Regular ${L.hoursLabel}</th><th>Overtime</th><th>Total ${L.hoursLabel}</th><th>PO Rate (SAR)</th><th>Amount (SAR)</th></tr></thead>
      <tbody>${(ts.workers||[]).map(w=>`<tr>
        <td><strong>${esc(w.name)}</strong></td><td>${esc(w.id||'—')}</td>
        <td class="text-right">${fmtNum(w.regularHours||w.totalHours)}</td>
        <td class="text-right">${fmtNum(w.overtimeHours)}</td>
        <td class="text-right"><strong>${fmtNum(w.totalHours)}</strong></td>
        <td class="text-right">${fmtSAR(w.poRate)}</td>
        <td class="text-right"><strong>${fmtSAR(w.amount)}</strong></td>
      </tr>`).join('')}
      <tr style="background:var(--steel);color:var(--white);font-weight:700">
        <td colspan="4">TOTAL</td><td class="text-right">${fmtNum(ts.totalHours)}</td><td></td><td class="text-right">${fmtSAR(ts.totalAmount)}</td>
      </tr></tbody>
    </table></div>`;
  },

  viewTimesheet(id,type){
    const ts=State.find(type+'.timesheets',id); if(!ts) return;
    const L=this.labels(type);
    Modal.show(`Timesheet — ${ts.clientName} (${ts.period})`,this._renderTSTable(ts,L),'',true);
  },

  approveTimesheet(id,type){
    State.update(type+'.timesheets',id,{status:'Approved'});
    WorkforceModule.render(type,3);
    Toast.show('Timesheet approved!');
  },

  deleteTS(id,type){ if(confirm('Delete?')){State.remove(type+'.timesheets',id);WorkforceModule.render(type,3);} },

  generateInvoiceFromTS(tsId,type){
    const ts=State.find(type+'.timesheets',tsId); if(!ts) return;
    WorkforceModule._createInvoiceFromTS(ts,type);
  },

  // ════════════════════════════════════════════════════════════════════════
  // STEP 4 — INVOICES (ZATCA)
  // ════════════════════════════════════════════════════════════════════════
  renderInvoices(L){
    const invoices=State.get(L.path+'.invoices')||[];
    const sheets=(State.get(L.path+'.timesheets')||[]).filter(s=>s.status==='Approved'&&!s.invoiced);
    const totalInv=invoices.reduce((s,i)=>s+num(i.total),0);
    const totalPaid=invoices.filter(i=>i.status==='Paid').reduce((s,i)=>s+num(i.total),0);

    return `
<div class="grid-3" style="margin-bottom:18px">
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Total Invoiced</div><div class="stat-value" style="color:var(--blue)">${fmtSAR(totalInv)}</div><div class="stat-sub">${invoices.length} invoices</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Paid</div><div class="stat-value" style="color:var(--success)">${fmtSAR(totalPaid)}</div></div>
  <div class="stat-card" style="border-left-color:var(--danger)"><div class="stat-label">Outstanding</div><div class="stat-value" style="color:var(--danger)">${fmtSAR(totalInv-totalPaid)}</div></div>
</div>

${sheets.length>0?`<div class="alert alert-info mb-12">💡 ${sheets.length} approved timesheet(s) ready to invoice: ${sheets.map(s=>`<button class="btn btn-sm btn-blue" onclick="WorkforceModule._createInvoiceFromTS(State.find('${L.path}.timesheets','${sheets[0]?.id}'),'${L.type}')" style="margin-left:8px">${esc(s.clientName)} — ${esc(s.period)}</button>`).join('')}</div>`:''}

<div class="tbl-header">
  <h3>🧾 Invoice Register</h3>
  <button class="btn btn-amber btn-sm" onclick="WorkforceModule.newManualInvoice('${L.type}')">+ New Invoice</button>
</div>
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>#</th><th>Invoice No.</th><th>Client</th><th>Period</th><th>Date</th><th>Amount excl VAT</th><th>VAT 15%</th><th>Total (SAR)</th><th>Status</th><th>Actions</th></tr></thead>
  <tbody>
  ${invoices.length===0
    ? `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted)">No invoices yet.</td></tr>`
    : invoices.map((inv,i)=>`<tr>
        <td>${i+1}</td>
        <td><strong>${esc(inv.number)}</strong></td>
        <td>${esc(inv.clientName)}</td>
        <td>${esc(inv.period||'—')}</td>
        <td>${esc(inv.date)}</td>
        <td class="text-right">${fmtSAR(inv.subtotal)}</td>
        <td class="text-right">${fmtSAR(num(inv.subtotal)*0.15)}</td>
        <td class="text-right"><strong>${fmtSAR(inv.total)}</strong></td>
        <td>${statusBadge(inv.status)}</td>
        <td class="actions">
          <select class="btn btn-sm btn-ghost" onchange="WorkforceModule._setInvStatus('${inv.id}','${L.type}',this.value)" style="padding:3px 6px;font-size:11px">
            ${['Draft','Under Review','Approved','Sent','Paid','Overdue'].map(s=>`<option ${inv.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-blue" onclick="WorkforceModule.printInvoice('${inv.id}','${L.type}')">🖨️</button>
          <button class="btn btn-sm btn-danger" onclick="WorkforceModule.deleteInvoice('${inv.id}','${L.type}')">🗑️</button>
        </td>
      </tr>`).join('')}
  </tbody>
</table></div>`;
  },

  _setInvStatus(id,type,status){ State.update(type+'.invoices',id,{status}); WorkforceModule.render(type,4); },
  deleteInvoice(id,type){ if(confirm('Delete invoice?')){State.remove(type+'.invoices',id);WorkforceModule.render(type,4);} },

  _createInvoiceFromTS(ts,type){
    if(!ts){Toast.show('Timesheet not found','error');return;}
    const company=State.get('settings.company')||{};
    const clients=State.get('clients')||[];
    const client=clients.find(c=>c.id===ts.clientId)||{vatNumber:'',address:''};
    const subtotal=num(ts.totalAmount);
    const vat=subtotal*0.15;
    const total=subtotal+vat;
    const invNo=`INV-${type.toUpperCase().slice(0,2)}-${Date.now().toString().slice(-5)}`;
    const inv={
      id:uid(), number:invNo, clientId:ts.clientId, clientName:ts.clientName,
      period:ts.period, periodStart:ts.periodStart, periodEnd:ts.periodEnd,
      date:today(), dueDate:'', subtotal, vat, total, status:'Draft',
      workers:ts.workers||[], tsId:ts.id, type
    };
    State.push(type+'.invoices',inv);
    State.update(type+'.timesheets',ts.id,{invoiced:true,invoiceId:inv.id});
    WorkforceModule.render(type,4);
    Toast.show(`Invoice ${invNo} created!`);
  },

  newManualInvoice(type){
    const clients=State.get('clients')||[];
    const L=this.labels(type);
    Modal.show('New Invoice',`
<form id="inv-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Invoice Number</label><input name="number" value="INV-${type.toUpperCase().slice(0,2)}-${Date.now().toString().slice(-5)}" required/></div>
    <div class="form-group"><label>Client</label>
      <select name="clientId" onchange="this.nextElementSibling.value=this.options[this.selectedIndex].dataset.name||''" required>
        <option value="">— Select —</option>
        ${clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
      </select><input type="hidden" name="clientName"/>
    </div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Invoice Date</label><input name="date" type="date" value="${today()}"/></div>
    <div class="form-group"><label>Period</label><input name="period" type="month" value="${today().slice(0,7)}"/></div>
    <div class="form-group"><label>Amount excl. VAT (SAR)</label><input name="subtotal" type="number" step="0.01" oninput="WorkforceModule._calcInvVAT()" required/></div>
  </div>
  <div id="inv-vat-preview"></div>
  <div class="form-group"><label>Notes / Description</label><textarea name="notes"></textarea></div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._saveManualInv('${type}')">Create Invoice</button>`);
  },

  _calcInvVAT(){
    const sub=num(document.querySelector('[name="subtotal"]')?.value);
    const el=document.getElementById('inv-vat-preview');
    if(el&&sub) el.innerHTML=`<div class="alert alert-info">VAT 15%: ${fmtSAR(sub*0.15)} | Total: <strong>${fmtSAR(sub*1.15)}</strong></div>`;
  },

  _saveManualInv(type){
    const f=document.getElementById('inv-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.clientId||!d.subtotal){Toast.show('Client and amount required','error');return;}
    const subtotal=num(d.subtotal),vat=subtotal*0.15,total=subtotal+vat;
    State.push(type+'.invoices',{id:uid(),...d,subtotal,vat,total,status:'Draft',workers:[]});
    Modal.close(); WorkforceModule.render(type,4); Toast.show('Invoice created!');
  },

  printInvoice(id,type){
    const inv=State.find(type+'.invoices',id); if(!inv) return;
    const company=State.get('settings.company')||{};
    const clients=State.get('clients')||[];
    const client=clients.find(c=>c.id===inv.clientId)||{};
    const vat=num(inv.subtotal)*0.15, total=num(inv.subtotal)+vat;
    const qrB64=ZATCA.buildTLV(company.name||'BUILDOPS',company.vatNumber||'300000000000003',inv.date+'T00:00:00Z',total,vat);
    const qrUrl=ZATCA.qrUrl(qrB64,130);
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11pt;color:#1C2B3A;padding:48px 56px}
.logo{font-size:22pt;font-weight:900}.logo span{color:#E8A020}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:10pt}
th{background:#1C2B3A;color:#fff;padding:8px 10px;text-align:left}
td{padding:7px 10px;border-bottom:1px solid #D6CFC4}
.total-row td{background:#1C2B3A;color:#fff;font-weight:bold}
.footer{margin-top:28px;padding-top:10px;border-top:1px solid #D6CFC4;font-size:9pt;color:#7A8A99;text-align:center}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #E8A020;margin-bottom:20px">
  <div><div class="logo">BUILD<span>OPS</span></div>
  <div style="font-size:9pt;color:#7A8A99;margin-top:4px">${company.name||''}<br>VAT: ${company.vatNumber||''}<br>${company.address||''}</div></div>
  <div style="text-align:right">
    <div style="font-size:14pt;font-weight:900">TAX INVOICE</div>
    <div style="font-size:9pt;color:#7A8A99"># ${inv.number}</div>
    <div style="font-size:9pt;color:#7A8A99">Date: ${inv.date}</div>
    <div style="background:#27AE60;color:#fff;padding:2px 8px;border-radius:10px;font-size:9pt;margin-top:4px;display:inline-block">ZATCA Compliant</div>
  </div>
</div>
<div style="display:flex;justify-content:space-between;margin-bottom:20px">
  <div style="font-size:10pt"><strong>Bill To:</strong><br>${inv.clientName||''}<br>VAT: ${client.vatNumber||'—'}<br>${client.address||''}</div>
  <img src="${qrUrl}" style="width:130px;height:130px;border:1px solid #D6CFC4;border-radius:6px"/>
</div>
<p style="margin-bottom:8px;font-size:10pt"><strong>Period:</strong> ${inv.period||'—'} &nbsp; <strong>Type:</strong> ${type.charAt(0).toUpperCase()+type.slice(1)} Rental</p>
<table>
  <tr><th>Description / Worker</th><th style="text-align:right">Hours/Days</th><th style="text-align:right">Rate (SAR)</th><th style="text-align:right">Amount (SAR)</th></tr>
  ${(inv.workers||[]).length>0
    ? inv.workers.map(w=>`<tr><td>${w.name||''}</td><td style="text-align:right">${fmtNum(w.totalHours||w.days||0)}</td><td style="text-align:right">${fmtNum(w.poRate||0)}</td><td style="text-align:right">${fmtNum(w.amount||0)}</td></tr>`).join('')
    : `<tr><td>${type.charAt(0).toUpperCase()+type.slice(1)} Rental Services — ${inv.period||''}</td><td></td><td></td><td style="text-align:right">${fmtNum(inv.subtotal)}</td></tr>`}
  <tr><td colspan="3"><strong>Subtotal</strong></td><td style="text-align:right">${fmtNum(inv.subtotal)}</td></tr>
  <tr><td colspan="3">VAT 15%</td><td style="text-align:right">${fmtNum(vat)}</td></tr>
  <tr class="total-row"><td colspan="3">TOTAL DUE</td><td style="text-align:right">SAR ${fmtNum(total)}</td></tr>
</table>
<p style="margin-top:12px;font-size:10pt"><strong>Payment Terms:</strong> ${inv.paymentTerms||'30 days from invoice date'}</p>
<p style="font-size:10pt"><strong>Bank Details:</strong> ${company.bank||'—'}</p>
<div class="footer">${company.name||'BUILDOPS'} — ${company.address||''} — VAT: ${company.vatNumber||''}<br>This is a ZATCA-compliant electronic tax invoice.</div>
</body></html>`;
    const w=window.open('','_blank','width=900,height=700');
    w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600);
  },

  // ════════════════════════════════════════════════════════════════════════
  // STEP 5 — EXPENSES & P&L
  // ════════════════════════════════════════════════════════════════════════
  renderPL(L){
    const expenses=State.get(L.path+'.expenses')||[];
    const payments=State.get(L.path+'.payments')||[];
    const invoices=State.get(L.path+'.invoices')||[];
    const coords=State.get('coordinators')||[];
    const mobs=State.get(L.path+'.mobilizations')||[];

    // Monthly revenue from invoices
    const monthGroups={};
    invoices.forEach(inv=>{
      const m=(inv.date||today()).slice(0,7);
      if(!monthGroups[m]) monthGroups[m]={month:m,revenue:0,expenses:0,commissions:0};
      monthGroups[m].revenue+=num(inv.subtotal);
    });
    expenses.forEach(exp=>{
      const m=(exp.month||today().slice(0,7));
      if(!monthGroups[m]) monthGroups[m]={month:m,revenue:0,expenses:0,commissions:0};
      monthGroups[m].expenses+=num(exp.amount);
    });
    const months=Object.values(monthGroups).sort((a,b)=>a.month.localeCompare(b.month));

    const totalRev=invoices.reduce((s,i)=>s+num(i.subtotal),0);
    const totalExp=expenses.reduce((s,e)=>s+num(e.amount),0);
    const totalPaid=payments.reduce((s,p)=>s+num(p.amount),0);
    const grossProfit=totalRev-totalExp;

    // Coordinator cost breakdown
    const coordCosts=coords.filter(c=>c.module===L.Title||c.module==='Both').map(c=>{
      const rev=invoices.filter(i=>i.coordinatorId===c.id).reduce((s,i)=>s+num(i.subtotal),0);
      const comm=rev*(num(c.commissionPct)/100);
      return {...c,rev,comm,totalCost:num(c.salary)+num(c.transport)+comm};
    });

    return `
<div class="grid-3" style="margin-bottom:18px">
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Total Revenue</div><div class="stat-value" style="color:var(--success)">${fmtSAR(totalRev)}</div><div class="stat-sub">From all invoices</div></div>
  <div class="stat-card" style="border-left-color:var(--danger)"><div class="stat-label">Total Expenses</div><div class="stat-value" style="color:var(--danger)">${fmtSAR(totalExp)}</div></div>
  <div class="stat-card" style="border-left-color:${grossProfit>=0?'var(--success)':'var(--danger)'}"><div class="stat-label">Gross Profit / Loss</div><div class="stat-value" style="color:${grossProfit>=0?'var(--success)':'var(--danger)'}">${fmtSAR(grossProfit)}</div><div class="stat-sub">Margin: ${totalRev>0?((grossProfit/totalRev)*100).toFixed(1):0}%</div></div>
</div>

<div class="grid-2">
  <!-- Expenses -->
  <div class="card">
    <div class="tbl-header"><h3>💸 Monthly Expenses</h3><button class="btn btn-amber btn-sm" onclick="WorkforceModule.addExpense('${L.type}')">+ Add</button></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Month</th><th>Coordinator</th><th>Category</th><th>Description</th><th class="text-right">Amount (SAR)</th><th></th></tr></thead>
      <tbody>${expenses.length===0
        ? `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--muted)">No expenses yet.</td></tr>`
        : expenses.map(e=>`<tr>
            <td>${esc(e.month)}</td>
            <td>${esc(e.coordinatorName||'—')}</td>
            <td><span class="badge badge-grey">${esc(e.category)}</span></td>
            <td>${esc(e.description)}</td>
            <td class="text-right">${fmtSAR(e.amount)}</td>
            <td><button class="btn btn-sm btn-danger" onclick="WorkforceModule.deleteExpense('${e.id}','${L.type}')">×</button></td>
          </tr>`).join('')}
      </tbody>
    </table></div>
  </div>

  <!-- Payments Received -->
  <div class="card">
    <div class="tbl-header"><h3>💰 Payments Received</h3><button class="btn btn-amber btn-sm" onclick="WorkforceModule.addPayment('${L.type}')">+ Record</button></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Date</th><th>Client</th><th>Invoice</th><th class="text-right">Amount (SAR)</th><th>Ref</th><th></th></tr></thead>
      <tbody>${payments.length===0
        ? `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--muted)">No payments yet.</td></tr>`
        : payments.map(p=>`<tr>
            <td>${esc(p.date)}</td><td>${esc(p.clientName||'—')}</td><td>${esc(p.invoiceNo||'—')}</td>
            <td class="text-right">${fmtSAR(p.amount)}</td><td class="text-muted text-sm">${esc(p.reference||'—')}</td>
            <td><button class="btn btn-sm btn-danger" onclick="WorkforceModule.deletePayment('${p.id}','${L.type}')">×</button></td>
          </tr>`).join('')}
      </tbody>
    </table></div>
    <div class="divider"></div>
    <div class="flex-between"><span class="text-muted">Total Collected</span><strong style="color:var(--success)">${fmtSAR(totalPaid)}</strong></div>
    <div class="flex-between mt-8"><span class="text-muted">Outstanding Balance</span><strong style="color:var(--danger)">${fmtSAR(totalRev-totalPaid)}</strong></div>
  </div>
</div>

<!-- Coordinator P&L -->
${coordCosts.length>0?`<div class="card">
  <div class="card-title">👤 Coordinator P&L Breakdown</div>
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Coordinator</th><th>Commission %</th><th>Monthly Salary</th><th>Transport</th><th>Commission Earned</th><th>Total Cost</th></tr></thead>
    <tbody>${coordCosts.map(c=>`<tr>
      <td><strong>${esc(c.name)}</strong></td>
      <td><span class="badge badge-amber">${c.commissionPct}%</span></td>
      <td>${fmtSAR(c.salary)}</td><td>${fmtSAR(c.transport)}</td>
      <td style="color:var(--amber);font-weight:700">${fmtSAR(c.comm)}</td>
      <td><strong>${fmtSAR(c.totalCost)}</strong></td>
    </tr>`).join('')}</tbody>
  </table></div>
</div>`:''}

<!-- Monthly Summary Table -->
${months.length>0?`<div class="card">
  <div class="card-title">📅 Monthly Summary</div>
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Month</th><th class="text-right">Revenue (SAR)</th><th class="text-right">Expenses (SAR)</th><th class="text-right">Net (SAR)</th><th>Status</th></tr></thead>
    <tbody>${months.map(m=>{const net=m.revenue-m.expenses;return `<tr>
      <td>${esc(m.month)}</td>
      <td class="text-right">${fmtSAR(m.revenue)}</td>
      <td class="text-right">${fmtSAR(m.expenses)}</td>
      <td class="text-right" style="font-weight:700;color:${net>=0?'var(--success)':'var(--danger)'}">${fmtSAR(net)}</td>
      <td>${net>=0?'<span class="badge badge-green">Profit</span>':'<span class="badge badge-red">Loss</span>'}</td>
    </tr>`;}).join('')}
    <tr style="background:var(--steel);color:var(--white);font-weight:700">
      <td>TOTAL</td>
      <td class="text-right">${fmtSAR(totalRev)}</td>
      <td class="text-right">${fmtSAR(totalExp)}</td>
      <td class="text-right" style="color:${grossProfit>=0?'#90EE90':'#FFB3B3'}">${fmtSAR(grossProfit)}</td>
      <td>${grossProfit>=0?'<span style="color:#90EE90">📈 Profit</span>':'<span style="color:#FFB3B3">📉 Loss</span>'}</td>
    </tr>
    </tbody>
  </table></div>
</div>`:''}`;
  },

  addExpense(type){
    const coords=State.get('coordinators')||[];
    const L=this.labels(type);
    Modal.show('Add Expense',`
<form id="exp-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Month</label><input name="month" type="month" value="${today().slice(0,7)}"/></div>
    <div class="form-group"><label>Coordinator</label>
      <select name="coordinatorId" onchange="this.nextElementSibling.value=this.options[this.selectedIndex].text||''">
        <option value="">— General / Overhead —</option>
        ${coords.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select><input type="hidden" name="coordinatorName"/>
    </div>
  </div>
  <div class="form-row cols-2">
    <div class="form-group"><label>Category</label>
      <select name="category">
        <option>Coordinator Salary</option><option>Transport Allowance</option><option>Office / Admin</option>
        <option>Communication</option><option>Document Fees</option><option>Other Overhead</option>
      </select></div>
    <div class="form-group"><label>Amount (SAR)</label><input name="amount" type="number" step="0.01" required/></div>
  </div>
  <div class="form-group"><label>Description</label><input name="description"/></div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="WorkforceModule._saveExpense('${type}')">Save Expense</button>`);
  },

  _saveExpense(type){
    const f=document.getElementById('exp-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.amount){Toast.show('Amount required','error');return;}
    State.push(type+'.expenses',{id:uid(),...d,amount:num(d.amount)});
    Modal.close(); WorkforceModule.render(type,5); Toast.show('Expense saved!');
  },

  deleteExpense(id,type){ State.remove(type+'.expenses',id); WorkforceModule.render(type,5); },

  addPayment(type){
    const invoices=State.get(type+'.invoices')||[];
    Modal.show('Record Payment',`
<form id="pay-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Date</label><input name="date" type="date" value="${today()}" required/></div>
    <div class="form-group"><label>Amount (SAR)</label><input name="amount" type="number" step="0.01" required/></div>
  </div>
  <div class="form-row cols-2">
    <div class="form-group"><label>Invoice</label>
      <select name="invoiceId" onchange="WorkforceModule._setPayInv(this,'${type}')">
        <option value="">— General Payment —</option>
        ${invoices.filter(i=>i.status!=='Paid').map(i=>`<option value="${i.id}" data-client="${esc(i.clientName)}" data-no="${esc(i.number)}">${esc(i.number)} — ${esc(i.clientName)} (${fmtSAR(i.total)})</option>`).join('')}
      </select>
      <input type="hidden" name="invoiceNo" id="pay-inv-no"/>
      <input type="hidden" name="clientName" id="pay-client"/>
    </div>
    <div class="form-group"><label>Bank Reference</label><input name="reference"/></div>
  </div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-success btn-sm" onclick="WorkforceModule._savePayment('${type}')">💰 Record Payment</button>`);
  },

  _setPayInv(sel,type){
    const opt=sel.options[sel.selectedIndex];
    document.getElementById('pay-inv-no').value=opt?.dataset.no||'';
    document.getElementById('pay-client').value=opt?.dataset.client||'';
  },

  _savePayment(type){
    const f=document.getElementById('pay-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.amount){Toast.show('Amount required','error');return;}
    State.push(type+'.payments',{id:uid(),...d,amount:num(d.amount)});
    if(d.invoiceId) State.update(type+'.invoices',d.invoiceId,{status:'Paid'});
    Modal.close(); WorkforceModule.render(type,5); Toast.show('Payment recorded!');
  },

  deletePayment(id,type){ State.remove(type+'.payments',id); WorkforceModule.render(type,5); }
};

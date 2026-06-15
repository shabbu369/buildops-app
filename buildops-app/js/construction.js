/* ═══════════════════════════════════════════════════════════
   BUILDOPS — Construction Projects Module (construction.js)
   Full 8-step lifecycle: RFQ → Offer → PO → Plan →
   Track → Billing → Demob → Closeout
════════════════════════════════════════════════════════════ */

const ConstructionModule = {
  _step: 0,
  STEPS: [
    { icon:'📥', label:'RFQ' },    { icon:'📤', label:'Offer' },
    { icon:'📜', label:'PO' },     { icon:'📅', label:'Planning' },
    { icon:'📊', label:'Tracking'},{ icon:'🧾', label:'Billing' },
    { icon:'🔄', label:'Demob' },  { icon:'🏁', label:'Closeout' },
  ],

  render(step=0){
    this._step = step;
    const projects = State.get('construction.projects') || [];
    const el = document.getElementById('content');
    el.innerHTML = `
<div class="module-banner" style="background:linear-gradient(135deg,var(--steel) 0%,var(--warning) 100%)">
  <div class="module-banner-icon">📋</div>
  <div><h2>Construction Projects</h2><p>Full lifecycle: RFQ analysis · Offer · PO · Execution · Billing · Closeout</p></div>
  <div style="margin-left:auto">
    <button class="btn btn-amber" onclick="ConstructionModule.newProject()">+ New Project</button>
  </div>
</div>

<div class="grid-4" style="margin-bottom:18px">
  <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-label">Total Projects</div><div class="stat-value" style="color:var(--warning)">${projects.length}</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Active</div><div class="stat-value" style="color:var(--success)">${projects.filter(p=>p.status==='Active').length}</div></div>
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Contract Value</div><div class="stat-value" style="color:var(--blue);font-size:14px">${fmtSAR(projects.reduce((s,p)=>s+num(p.contractValue),0))}</div></div>
  <div class="stat-card" style="border-left-color:var(--purple)"><div class="stat-label">Completed</div><div class="stat-value" style="color:var(--purple)">${projects.filter(p=>p.status==='Completed').length}</div></div>
</div>

<div class="card">
  <div class="tbl-header">
    <h3>Project Register</h3>
    <div class="toolbar">
      <input class="search-input" placeholder="Search projects..." oninput="ConstructionModule.filterProjects(this.value)"/>
      <button class="btn btn-amber btn-sm" onclick="ConstructionModule.newProject()">+ New Project</button>
    </div>
  </div>
  <div class="table-wrap"><table class="data-table" id="proj-table">
    <thead><tr><th>#</th><th>Project Name</th><th>Client</th><th>Contract Value</th><th>Start Date</th><th>Progress</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody id="proj-tbody">${this.projectRows(projects)}</tbody>
  </table></div>
</div>`;
  },

  projectRows(projects){
    if(!projects.length) return `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted)">No projects yet. Click "+ New Project" to start.</td></tr>`;
    return projects.map((p,i)=>`<tr>
      <td>${i+1}</td>
      <td><strong>${esc(p.name)}</strong><br><small class="text-muted">${esc(p.description||'').slice(0,60)}</small></td>
      <td>${esc(p.clientName||'—')}</td>
      <td class="text-right"><strong>${fmtSAR(p.contractValue)}</strong></td>
      <td>${esc(p.startDate||'—')}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:var(--dust);border-radius:3px">
            <div style="width:${Math.min(100,num(p.progress||0))}%;height:100%;background:${num(p.progress||0)>=100?'var(--success)':num(p.progress||0)>=50?'var(--amber)':'var(--blue)'};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:var(--muted)">${num(p.progress||0).toFixed(0)}%</span>
        </div>
      </td>
      <td>${statusBadge(p.status||'Planning')}</td>
      <td class="actions">
        <button class="btn btn-sm btn-amber" onclick="ConstructionModule.openProject('${p.id}')">Open</button>
        <button class="btn btn-sm btn-ghost" onclick="ConstructionModule.editProject('${p.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="ConstructionModule.deleteProject('${p.id}')">🗑️</button>
      </td>
    </tr>`).join('');
  },

  filterProjects(q){
    document.querySelectorAll('#proj-table tbody tr').forEach(tr=>{
      tr.style.display=tr.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';
    });
  },

  newProject(){
    const clients=State.get('clients')||[];
    Modal.show('New Construction Project',`
<form id="proj-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Project Name *</label><input name="name" required placeholder="e.g. Al Riyadh Office Tower — Phase 2"/></div>
    <div class="form-group"><label>Client *</label>
      <select name="clientId" onchange="this.nextElementSibling.value=this.options[this.selectedIndex].dataset.name||''" required>
        <option value="">— Select Client —</option>
        ${clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
      </select><input type="hidden" name="clientName"/>
    </div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Contract Value (SAR)</label><input name="contractValue" type="number" step="0.01" placeholder="0.00"/></div>
    <div class="form-group"><label>Retention %</label><input name="retentionPct" type="number" value="10"/></div>
    <div class="form-group"><label>Status</label>
      <select name="status"><option>Planning</option><option>Active</option><option>On Hold</option><option>Completed</option></select></div>
  </div>
  <div class="form-row cols-2">
    <div class="form-group"><label>Start Date</label><input name="startDate" type="date" value="${today()}"/></div>
    <div class="form-group"><label>End Date (Planned)</label><input name="endDate" type="date"/></div>
  </div>
  <div class="form-group"><label>PO Number</label><input name="poNumber" placeholder="Client PO reference"/></div>
  <div class="form-group"><label>Project Description</label><textarea name="description" rows="2" placeholder="Brief scope of work..."></textarea></div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="ConstructionModule._saveProject(null)">Create Project</button>`);
  },

  _saveProject(id){
    const f=document.getElementById('proj-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.name||!d.clientId){Toast.show('Project name and client required','error');return;}
    const item={...d,contractValue:num(d.contractValue),retentionPct:num(d.retentionPct),progress:0};
    if(id) State.update('construction.projects',id,item);
    else State.push('construction.projects',{id:uid(),createdDate:today(),...item});
    Modal.close(); ConstructionModule.render(); Toast.show(id?'Project updated!':'Project created!');
  },

  editProject(id){
    const p=State.find('construction.projects',id); if(!p) return;
    const clients=State.get('clients')||[];
    Modal.show('Edit Project',`
<form id="proj-form">
  <div class="form-row cols-2">
    <div class="form-group"><label>Project Name</label><input name="name" value="${esc(p.name)}" required/></div>
    <div class="form-group"><label>Client</label>
      <select name="clientId" onchange="this.nextElementSibling.value=this.options[this.selectedIndex].dataset.name||''">
        ${clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}" ${c.id===p.clientId?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select><input type="hidden" name="clientName" value="${esc(p.clientName)}"/>
    </div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Contract Value (SAR)</label><input name="contractValue" type="number" value="${p.contractValue}"/></div>
    <div class="form-group"><label>Retention %</label><input name="retentionPct" type="number" value="${p.retentionPct||10}"/></div>
    <div class="form-group"><label>Progress %</label><input name="progress" type="number" min="0" max="100" value="${p.progress||0}"/></div>
  </div>
  <div class="form-row cols-3">
    <div class="form-group"><label>Start Date</label><input name="startDate" type="date" value="${esc(p.startDate||'')}"/></div>
    <div class="form-group"><label>End Date</label><input name="endDate" type="date" value="${esc(p.endDate||'')}"/></div>
    <div class="form-group"><label>Status</label>
      <select name="status">
        ${['Planning','Active','On Hold','Completed','Cancelled'].map(s=>`<option ${p.status===s?'selected':''}>${s}</option>`).join('')}
      </select></div>
  </div>
  <div class="form-group"><label>PO Number</label><input name="poNumber" value="${esc(p.poNumber||'')}"/></div>
  <div class="form-group"><label>Description</label><textarea name="description" rows="2">${esc(p.description||'')}</textarea></div>
</form>`,
`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
 <button class="btn btn-amber btn-sm" onclick="ConstructionModule._saveProject('${id}')">Save</button>`);
  },

  deleteProject(id){ if(confirm('Delete this project? This cannot be undone.')){ State.remove('construction.projects',id); ConstructionModule.render(); Toast.show('Project deleted','error'); } },

  openProject(id){
    const p=State.find('construction.projects',id); if(!p) return;
    this._activeProjectId=id;
    const el=document.getElementById('content');
    el.innerHTML=`
<div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
  <button class="btn btn-ghost btn-sm" onclick="ConstructionModule.render()">← All Projects</button>
  <h2 style="font-size:16px;font-weight:800;color:var(--steel)">${esc(p.name)}</h2>
  ${statusBadge(p.status)}
</div>

<div class="step-nav" id="proj-step-nav">
  ${this.STEPS.map((s,i)=>`<button class="step-btn${i===0?' active':''}" onclick="ConstructionModule._goProjectStep(${i},'${id}')" data-step="${i}">
    <span class="step-icon">${s.icon}</span><span class="step-label">${s.label}</span>
  </button>`).join('')}
</div>
<div id="proj-step-content"></div>`;
    this._renderProjectStep(0, id);
  },

  _goProjectStep(step, id){
    document.querySelectorAll('.step-btn').forEach((b,i)=>b.classList.toggle('active',i===step));
    this._renderProjectStep(step, id);
  },

  _renderProjectStep(step, id){
    const p=State.find('construction.projects',id)||{};
    const el=document.getElementById('proj-step-content');
    switch(step){
      case 0: el.innerHTML=this._rfqStep(p); break;
      case 1: el.innerHTML=this._offerStep(p); break;
      case 2: el.innerHTML=this._poStep(p); break;
      case 3: el.innerHTML=this._planStep(p,id); break;
      case 4: el.innerHTML=this._trackStep(p,id); break;
      case 5: el.innerHTML=this._billingStep(p,id); break;
      case 6: el.innerHTML=this._demobStep(p,id); break;
      case 7: el.innerHTML=this._closeoutStep(p,id); break;
    }
  },

  _rfqStep(p){
    return `<div class="card">
      <div class="card-title">📥 RFQ / Scope of Work</div>
      <div class="alert alert-info mb-12">Upload your RFQ document below. AI will analyze it and generate a 5-sheet cost estimate in SAR using Saudi market rates.</div>
      <div class="form-row cols-2">
        <div><div class="upload-zone" onclick="document.getElementById('rfq-file').click()" style="margin-bottom:12px">
          <div class="upload-icon">📄</div><p>Upload RFQ / Scope Document</p><small>PDF, PNG, JPG supported</small>
        </div>
        <input type="file" id="rfq-file" accept=".pdf,.png,.jpg,.jpeg" style="display:none" onchange="ConstructionModule._analyzeRFQ('${p.id}')"/>
        <button class="btn btn-amber w-full" onclick="document.getElementById('rfq-file').click()">🤖 Analyze with AI</button></div>
        <div style="background:var(--concrete);border-radius:var(--radius);padding:16px">
          <div class="card-title">Project Summary</div>
          <div class="flex-between mb-8"><span class="text-muted">Client</span><strong>${esc(p.clientName||'—')}</strong></div>
          <div class="flex-between mb-8"><span class="text-muted">Contract Value</span><strong>${fmtSAR(p.contractValue)}</strong></div>
          <div class="flex-between mb-8"><span class="text-muted">Retention</span><strong>${p.retentionPct||10}%</strong></div>
          <div class="flex-between"><span class="text-muted">Status</span>${statusBadge(p.status)}</div>
        </div>
      </div>
      <div id="rfq-result"></div>
    </div>`;
  },

  async _analyzeRFQ(projId){
    const file=document.getElementById('rfq-file').files[0]; if(!file) return;
    const el=document.getElementById('rfq-result');
    el.innerHTML=`<div class="alert alert-warning"><div class="loading-spinner" style="display:inline-block;margin-right:8px"></div>AI is analyzing the RFQ using Saudi market rates...</div>`;
    try{
      const {data,type:mime}=await fileToBase64(file);
      const parts=[];
      if(mime==='application/pdf') parts.push({type:'document',source:{type:'base64',media_type:'application/pdf',data}});
      else parts.push({type:'image',source:{type:'base64',media_type:mime,data}});
      parts.push({type:'text',text:`Saudi Arabia construction cost estimator. Analyze RFQ and return ONLY valid JSON:
{"projectName":"","client":"","description":"","materials":[{"description":"","qty":0,"unit":"m²","unitPrice":0}],"manpower":[{"position":"","days":0,"dayRate":0,"fat":0}],"equipment":[{"description":"","type":"","days":0,"dayRate":0}],"estimatedDurationMonths":3,"recommendedMarkupPct":20}
ALL prices in SAR. Saudi market rates.`});
      const raw=await API.call([{role:'user',content:parts}]);
      const result=JSON.parse(raw);
      const matTotal=r=>num(r.qty)*num(r.unitPrice);
      const mpTotal=r=>num(r.days)*(num(r.dayRate)+num(r.fat));
      const eqTotal=r=>num(r.days)*num(r.dayRate);
      const mS=(result.materials||[]).reduce((s,r)=>s+matTotal(r),0);
      const mpS=(result.manpower||[]).reduce((s,r)=>s+mpTotal(r),0);
      const eS=(result.equipment||[]).reduce((s,r)=>s+eqTotal(r),0);
      const tc=mS+mpS+eS, mk=num(result.recommendedMarkupPct||20), sp=tc*(1+mk/100);
      State.update('construction.projects',projId,{rfqResult:result,estimatedCost:tc,markup:mk,sellingPrice:sp});
      el.innerHTML=`
<div class="alert alert-success">✅ RFQ analyzed! Estimated cost: ${fmtSAR(tc)} | Selling price (${mk}% markup): ${fmtSAR(sp)} | With VAT: ${fmtSAR(sp*1.15)}</div>
<div class="grid-3">
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Materials</div><div class="stat-value" style="color:var(--blue);font-size:16px">${fmtSAR(mS)}</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Manpower</div><div class="stat-value" style="color:var(--success);font-size:16px">${fmtSAR(mpS)}</div></div>
  <div class="stat-card" style="border-left-color:var(--purple)"><div class="stat-label">Equipment</div><div class="stat-value" style="color:var(--purple);font-size:16px">${fmtSAR(eS)}</div></div>
</div>
<div style="display:flex;gap:10px;margin-top:8px">
  <button class="btn btn-blue" onclick="ConstructionModule._exportRFQExcel('${projId}')">📥 Download Excel (5 Sheets)</button>
  <button class="btn btn-amber" onclick="ConstructionModule._goProjectStep(1,'${projId}')">Next: Prepare Offer →</button>
</div>`;
      Toast.show('RFQ analyzed successfully!');
    }catch(e){el.innerHTML=`<div class="alert alert-danger">❌ ${e.message}</div>`;}
  },

  _exportRFQExcel(projId){
    const p=State.find('construction.projects',projId); if(!p?.rfqResult) {Toast.show('Analyze RFQ first','error');return;}
    const r=p.rfqResult, mk=num(p.markup||20);
    const wb=window.XLSX.utils.book_new();
    const tc=num(p.estimatedCost), sp=tc*(1+mk/100);
    // Sheet 1: Summary
    const ws1=window.XLSX.utils.aoa_to_sheet([
      [`${p.name} — COST ESTIMATION SUMMARY`],[`Client: ${p.clientName||'—'}`],[],
      ['Section','Description','Cost (SAR)','Selling Price (SAR)'],
      ['1','Bill of Materials',(r.materials||[]).reduce((s,m)=>s+num(m.qty)*num(m.unitPrice),0),(r.materials||[]).reduce((s,m)=>s+num(m.qty)*num(m.unitPrice),0)*(1+mk/100)],
      ['2','Manpower Supply',(r.manpower||[]).reduce((s,m)=>s+num(m.days)*(num(m.dayRate)+num(m.fat)),0),(r.manpower||[]).reduce((s,m)=>s+num(m.days)*(num(m.dayRate)+num(m.fat)),0)*(1+mk/100)],
      ['3','Equipment & Resources',(r.equipment||[]).reduce((s,e)=>s+num(e.days)*num(e.dayRate),0),(r.equipment||[]).reduce((s,e)=>s+num(e.days)*num(e.dayRate),0)*(1+mk/100)],
      [],[' ','Total Cost (SAR)',tc,sp],[' ',`VAT 15%`,'',sp*0.15],[' ','Grand Total','' ,sp*1.15],
      [],[`Markup: ${mk}%`],[`All prices in SAR`]
    ]);
    ws1['!cols']=[{wch:6},{wch:36},{wch:22},{wch:22}];
    window.XLSX.utils.book_append_sheet(wb,ws1,'Summary');
    // Sheet 2: BOM
    const ws2=window.XLSX.utils.aoa_to_sheet([['BILL OF MATERIALS'],[`Project: ${p.name}`],[],['No.','Description','Qty','Unit','Unit Price (SAR)','Total (SAR)'],...(r.materials||[]).map((m,i)=>[i+1,m.description,m.qty,m.unit,m.unitPrice,num(m.qty)*num(m.unitPrice)])]);
    ws2['!cols']=[{wch:6},{wch:44},{wch:10},{wch:10},{wch:18},{wch:18}];
    window.XLSX.utils.book_append_sheet(wb,ws2,'Bill of Materials');
    // Sheet 3: Manpower
    const ws3=window.XLSX.utils.aoa_to_sheet([['MANPOWER SCHEDULE'],[`Project: ${p.name}`],[],['No.','Position','Days','Day Rate (SAR)','FAT/Day (SAR)','Total (SAR)'],...(r.manpower||[]).map((m,i)=>[i+1,m.position,m.days,m.dayRate,m.fat,num(m.days)*(num(m.dayRate)+num(m.fat))])]);
    ws3['!cols']=[{wch:6},{wch:36},{wch:10},{wch:16},{wch:16},{wch:18}];
    window.XLSX.utils.book_append_sheet(wb,ws3,'Manpower');
    // Sheet 4: Equipment
    const ws4=window.XLSX.utils.aoa_to_sheet([['EQUIPMENT & RESOURCES'],[`Project: ${p.name}`],[],['No.','Description','Type','Days','Day Rate SAR','Total (SAR)'],...(r.equipment||[]).map((e,i)=>[i+1,e.description,e.type,e.days,e.dayRate,num(e.days)*num(e.dayRate)])]);
    ws4['!cols']=[{wch:6},{wch:36},{wch:18},{wch:10},{wch:18},{wch:18}];
    window.XLSX.utils.book_append_sheet(wb,ws4,'Equipment');
    // Sheet 5: Analysis
    const ws5=window.XLSX.utils.aoa_to_sheet([['PROJECT ANALYSIS'],[`Project: ${p.name}`],[],['PROFIT MARGIN'],['Total Cost (SAR)',tc],[`Markup`,`${mk}%`],['Selling Price (SAR)',sp],['VAT 15% (SAR)',sp*0.15],['Grand Total (SAR)',sp*1.15],[],['Duration (Est.)',`${r.estimatedDurationMonths||3} months`]]);
    ws5['!cols']=[{wch:36},{wch:22}];
    window.XLSX.utils.book_append_sheet(wb,ws5,'Project Analysis');
    window.XLSX.writeFile(wb,`Estimate_${p.name.replace(/\s+/g,'_')}_${today()}.xlsx`);
    Toast.show('Excel downloaded!');
  },

  _offerStep(p){
    return `<div class="card"><div class="card-title">📤 Offer Preparation</div>
<div class="alert alert-info mb-12">Generate a professional commercial & technical offer based on your RFQ analysis. The AI will draft both documents in Saudi-market format.</div>
<div class="form-row cols-2">
  <div class="form-group"><label>Offer Reference</label><input id="off-ref" value="BUILDOPS-COM-${Date.now().toString().slice(-4)}"/></div>
  <div class="form-group"><label>Validity (Days)</label><input id="off-valid" type="number" value="30"/></div>
</div>
<div id="offer-result">
  ${p.offerGenerated?`<div class="alert alert-success">✅ Offer previously generated. You can regenerate or print below.</div>`:''}
</div>
<div style="display:flex;gap:10px;flex-wrap:wrap">
  <button class="btn btn-amber" onclick="ConstructionModule._generateOffer('${p.id}')">🤖 Generate Offer with AI</button>
  ${p.offerGenerated?`<button class="btn btn-blue" onclick="ConstructionModule._printOffer('${p.id}','commercial')">📄 Commercial PDF</button>
  <button class="btn btn-purple" onclick="ConstructionModule._printOffer('${p.id}','technical')">📄 Technical PDF</button>`:''}
  <button class="btn btn-success" onclick="ConstructionModule._goProjectStep(2,'${p.id}')">Next: PO Review →</button>
</div></div>`;
  },

  async _generateOffer(projId){
    const p=State.find('construction.projects',projId); if(!p) return;
    const el=document.getElementById('offer-result');
    if(!p.rfqResult){el.innerHTML=`<div class="alert alert-danger">❌ Please analyze RFQ first (Step 1)</div>`;return;}
    el.innerHTML=`<div class="alert alert-warning"><div class="loading-spinner" style="display:inline-block;margin-right:8px"></div>AI generating offer...</div>`;
    try{
      const sp=num(p.sellingPrice), mk=num(p.markup||20);
      const raw=await API.call([{role:'user',content:`Professional commercial+technical offer for Saudi Arabia construction company.
Project: ${p.name}, Client: ${p.clientName}, Selling Price: SAR ${fmtNum(sp)}, Grand Total with VAT: SAR ${fmtNum(sp*1.15)}.
Return ONLY valid JSON:
{"commercial":{"referenceNo":"${document.getElementById('off-ref')?.value||''}","validityDays":${document.getElementById('off-valid')?.value||30},"introduction":"...","scopeSummary":"...","pricingNotes":"...","paymentTerms":"30% advance, 60% progress, 10% retention","deliverySchedule":"...","exclusions":["...","..."],"ourConditions":["...","...","..."],"closingParagraph":"..."},"technical":{"projectUnderstanding":"...","methodology":"...","manpowerStrategy":"...","equipmentStrategy":"...","qualityAndSafety":"...","projectSchedule":"...","companyStrengths":"..."}}`}],3000);
      const offer=JSON.parse(raw);
      State.update('construction.projects',projId,{offer,offerGenerated:true});
      el.innerHTML=`<div class="alert alert-success">✅ Offer generated successfully!</div>
<div class="card-sm" style="background:var(--concrete);border-radius:var(--radius);margin-top:10px">
  <strong>${esc(offer.commercial?.referenceNo)}</strong> | Valid: ${offer.commercial?.validityDays} days<br>
  <span class="text-muted text-sm">${esc((offer.commercial?.introduction||'').slice(0,120))}...</span>
</div>
<div style="display:flex;gap:10px;margin-top:10px">
  <button class="btn btn-blue" onclick="ConstructionModule._printOffer('${projId}','commercial')">📄 Commercial PDF</button>
  <button class="btn btn-purple" onclick="ConstructionModule._printOffer('${projId}','technical')">📄 Technical PDF</button>
</div>`;
      Toast.show('Offer generated!');
    }catch(e){el.innerHTML=`<div class="alert alert-danger">❌ ${e.message}</div>`;}
  },

  _printOffer(projId,type){
    const p=State.find('construction.projects',projId); if(!p?.offer) {Toast.show('Generate offer first','error');return;}
    const co=State.get('settings.company')||{}, o=p.offer, sp=num(p.sellingPrice);
    const com=o.commercial||{}, tec=o.technical||{};
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11pt;color:#1C2B3A;padding:48px 56px}.logo{font-size:22pt;font-weight:900}.logo span{color:#E8A020}h1{margin:16px 0 7px;border-left:4px solid #E8A020;padding-left:10px;font-size:12pt}p{margin-bottom:9px;line-height:1.65}ul{margin:6px 0 10px 20px}li{margin-bottom:3px}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt}th{background:#1C2B3A;color:#fff;padding:8px 10px}td{padding:7px 10px;border-bottom:1px solid #D6CFC4}.tot td{background:#1C2B3A;color:#fff;font-weight:bold}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #D6CFC4;font-size:9pt;color:#7A8A99;text-align:center}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
<body><div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #E8A020;margin-bottom:20px">
<div><div class="logo">BUILD<span>OPS</span></div><div style="font-size:9pt;color:#7A8A99">${co.name||''} | VAT: ${co.vatNumber||''}</div></div>
<div style="text-align:right"><div style="font-size:14pt;font-weight:900">${type.toUpperCase()} OFFER</div>
<div style="font-size:9pt;color:#7A8A99">Ref: ${com.referenceNo||'—'} | ${new Date().toLocaleDateString('en-SA')} | Valid: ${com.validityDays||30} days</div></div></div>
<p><strong>To:</strong> ${p.clientName||'—'} &nbsp; <strong>Project:</strong> ${p.name||'—'}</p>
${type==='commercial'?`<h1>Scope</h1><p>${com.scopeSummary||''}</p>
<h1>Pricing</h1><table><tr><th>Section</th><th style="text-align:right">SAR</th></tr>
<tr><td>Total excl. VAT</td><td style="text-align:right">${fmtNum(sp)}</td></tr>
<tr><td>VAT 15%</td><td style="text-align:right">${fmtNum(sp*0.15)}</td></tr>
<tr class="tot"><td>GRAND TOTAL</td><td style="text-align:right">SAR ${fmtNum(sp*1.15)}</td></tr></table>
<h1>Payment Terms</h1><p>${com.paymentTerms||''}</p>
<h1>Exclusions</h1><ul>${(com.exclusions||[]).map(e=>`<li>${e}</li>`).join('')}</ul>
<h1>Terms & Conditions</h1><ul>${(com.ourConditions||[]).map(c=>`<li>${c}</li>`).join('')}</ul>
<p style="margin-top:14px">${com.closingParagraph||''}</p>`
:`<h1>Project Understanding</h1><p>${tec.projectUnderstanding||''}</p>
<h1>Technical Approach</h1><p>${tec.methodology||''}</p>
<h1>Manpower Plan</h1><p>${tec.manpowerStrategy||''}</p>
<h1>Equipment Plan</h1><p>${tec.equipmentStrategy||''}</p>
<h1>Quality & Safety</h1><p>${tec.qualityAndSafety||''}</p>
<h1>Project Schedule</h1><p>${tec.projectSchedule||''}</p>
<h1>Company Qualifications</h1><p>${tec.companyStrengths||''}</p>`}
<div class="footer">${co.name||'BUILDOPS'} — ${co.address||''} — VAT: ${co.vatNumber||''}</div></body></html>`;
    const w=window.open('','_blank','width=900,height=700');
    w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600);
  },

  _poStep(p){
    return `<div class="card"><div class="card-title">📜 Purchase Order & Contract Setup</div>
<form id="po-form">
<div class="form-row cols-3">
  <div class="form-group"><label>Contract Value (SAR)</label><input name="contractValue" type="number" value="${p.contractValue||0}" required/></div>
  <div class="form-group"><label>Retention %</label><input name="retentionPct" type="number" value="${p.retentionPct||10}"/></div>
  <div class="form-group"><label>PO Number</label><input name="poNumber" value="${esc(p.poNumber||'')}"/></div>
</div>
<div class="form-row cols-2">
  <div class="form-group"><label>PO Date</label><input name="poDate" type="date" value="${esc(p.poDate||today())}"/></div>
  <div class="form-group"><label>Payment Terms</label><input name="paymentTerms" value="${esc(p.paymentTerms||'30% advance, 60% progress, 10% retention')}"/></div>
</div>
<div class="form-group"><label>Special Conditions / Notes</label><textarea name="poNotes" rows="2">${esc(p.poNotes||'')}</textarea></div>
</form>
<div style="display:flex;gap:10px;margin-top:4px">
  <button class="btn btn-amber" onclick="ConstructionModule._savePO('${p.id}')">💾 Save Contract Details</button>
  <button class="btn btn-success" onclick="ConstructionModule._goProjectStep(3,'${p.id}')">Next: Planning →</button>
</div></div>`;
  },

  _savePO(projId){
    const f=document.getElementById('po-form');
    const d=Object.fromEntries(new FormData(f));
    State.update('construction.projects',projId,{...d,contractValue:num(d.contractValue),retentionPct:num(d.retentionPct)});
    Toast.show('Contract details saved!');
  },

  _planStep(p,id){
    const phases=(p.phases||[]);
    return `<div class="card"><div class="card-title">📅 Project Planning & Phases</div>
<div class="tbl-header"><h3>Project Phases</h3>
  <button class="btn btn-amber btn-sm" onclick="ConstructionModule.addPhase('${id}')">+ Add Phase</button></div>
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>#</th><th>Phase Name</th><th>Start Date</th><th>End Date</th><th>Budget (SAR)</th><th>Status</th><th></th></tr></thead>
  <tbody>${phases.length===0?`<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--muted)">No phases defined.</td></tr>`:
    phases.map((ph,i)=>`<tr><td>${i+1}</td><td><strong>${esc(ph.name)}</strong></td><td>${esc(ph.startDate)}</td><td>${esc(ph.endDate)}</td>
      <td class="text-right">${fmtSAR(ph.budget)}</td><td>${statusBadge(ph.status||'Planning')}</td>
      <td><button class="btn btn-sm btn-danger" onclick="ConstructionModule.deletePhase('${id}','${ph.id}')">×</button></td></tr>`).join('')}
  </tbody>
</table></div>
<div style="display:flex;justify-content:flex-end;margin-top:10px">
  <button class="btn btn-success" onclick="ConstructionModule._goProjectStep(4,'${id}')">Next: Execution Tracking →</button>
</div></div>`;
  },

  addPhase(projId){
    Modal.show('Add Phase',`<form id="phase-form">
    <div class="form-row cols-2">
      <div class="form-group"><label>Phase Name</label><input name="name" required/></div>
      <div class="form-group"><label>Status</label><select name="status"><option>Planning</option><option>Active</option><option>Completed</option></select></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label>Start Date</label><input name="startDate" type="date" value="${today()}"/></div>
      <div class="form-group"><label>End Date</label><input name="endDate" type="date"/></div>
      <div class="form-group"><label>Budget (SAR)</label><input name="budget" type="number" step="0.01" value="0"/></div>
    </div></form>`,
    `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
     <button class="btn btn-amber btn-sm" onclick="ConstructionModule._savePhase('${projId}')">Add Phase</button>`);
  },

  _savePhase(projId){
    const f=document.getElementById('phase-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.name){Toast.show('Phase name required','error');return;}
    const p=State.find('construction.projects',projId); if(!p) return;
    const phases=[...(p.phases||[]),{id:uid(),...d,budget:num(d.budget)}];
    State.update('construction.projects',projId,{phases});
    Modal.close(); ConstructionModule._goProjectStep(3,projId); Toast.show('Phase added!');
  },

  deletePhase(projId,phaseId){
    const p=State.find('construction.projects',projId); if(!p) return;
    State.update('construction.projects',projId,{phases:(p.phases||[]).filter(ph=>ph.id!==phaseId)});
    ConstructionModule._goProjectStep(3,projId);
  },

  _trackStep(p,id){
    const logs=p.progressLogs||[], expenses=p.projectExpenses||[];
    return `<div class="grid-3" style="margin-bottom:14px">
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Progress</div><div class="stat-value" style="color:var(--blue)">${num(p.progress||0).toFixed(0)}%</div></div>
  <div class="stat-card" style="border-left-color:var(--danger)"><div class="stat-label">Expenses</div><div class="stat-value" style="color:var(--danger);font-size:14px">${fmtSAR(expenses.reduce((s,e)=>s+num(e.amount),0))}</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Earned Value</div><div class="stat-value" style="color:var(--success);font-size:14px">${fmtSAR(num(p.contractValue)*num(p.progress||0)/100)}</div></div>
</div>
<div class="card"><div class="tbl-header"><h3>📊 Progress Records</h3>
  <button class="btn btn-amber btn-sm" onclick="ConstructionModule.addLog('${id}')">+ Add Record</button></div>
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>Date</th><th>% Complete</th><th>Description</th><th>Phase</th><th></th></tr></thead>
  <tbody>${logs.length===0?`<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--muted)">No progress records.</td></tr>`:
    logs.map(l=>`<tr><td>${esc(l.date)}</td><td><strong>${l.pct}%</strong></td><td>${esc(l.description)}</td><td>${esc(l.phase||'—')}</td>
      <td><button class="btn btn-sm btn-danger" onclick="ConstructionModule.deleteLog('${id}','${l.id}')">×</button></td></tr>`).join('')}
  </tbody>
</table></div></div>
<div class="card"><div class="tbl-header"><h3>💸 Daily Expenses</h3>
  <button class="btn btn-amber btn-sm" onclick="ConstructionModule.addExpense('${id}')">+ Add Expense</button></div>
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="text-right">Amount (SAR)</th><th></th></tr></thead>
  <tbody>${expenses.length===0?`<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--muted)">No expenses.</td></tr>`:
    expenses.map(e=>`<tr><td>${esc(e.date)}</td><td><span class="badge badge-grey">${esc(e.category)}</span></td><td>${esc(e.description)}</td>
      <td class="text-right">${fmtSAR(e.amount)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="ConstructionModule.deleteExpenseItem('${id}','${e.id}')">×</button></td></tr>`).join('')}
  </tbody>
</table></div></div>
<div style="display:flex;justify-content:flex-end"><button class="btn btn-success" onclick="ConstructionModule._goProjectStep(5,'${id}')">Next: Billing →</button></div>`;
  },

  addLog(projId){
    const p=State.find('construction.projects',projId);
    Modal.show('Add Progress Record',`<form id="log-form">
    <div class="form-row cols-2"><div class="form-group"><label>Date</label><input name="date" type="date" value="${today()}"/></div>
      <div class="form-group"><label>% Complete</label><input name="pct" type="number" min="0" max="100" value="${p?.progress||0}"/></div></div>
    <div class="form-group"><label>Description</label><input name="description" required/></div>
    <div class="form-group"><label>Phase</label><input name="phase" list="phase-list"/><datalist id="phase-list">${(p?.phases||[]).map(ph=>`<option>${ph.name}</option>`).join('')}</datalist></div>
    </form>`,
    `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
     <button class="btn btn-amber btn-sm" onclick="ConstructionModule._saveLog('${projId}')">Save</button>`);
  },

  _saveLog(projId){
    const f=document.getElementById('log-form');
    const d=Object.fromEntries(new FormData(f));
    if(!d.description){Toast.show('Description required','error');return;}
    const p=State.find('construction.projects',projId);
    const logs=[...(p?.progressLogs||[]),{id:uid(),...d,pct:num(d.pct)}];
    State.update('construction.projects',projId,{progressLogs:logs,progress:num(d.pct)});
    Modal.close(); ConstructionModule._goProjectStep(4,projId); Toast.show('Progress saved!');
  },
  deleteLog(projId,logId){ const p=State.find('construction.projects',projId); if(!p) return; State.update('construction.projects',projId,{progressLogs:(p.progressLogs||[]).filter(l=>l.id!==logId)}); ConstructionModule._goProjectStep(4,projId); },

  addExpense(projId){
    Modal.show('Add Expense',`<form id="exp-form">
    <div class="form-row cols-2"><div class="form-group"><label>Date</label><input name="date" type="date" value="${today()}"/></div>
      <div class="form-group"><label>Category</label><select name="category"><option>Labour</option><option>Materials</option><option>Equipment</option><option>Transport</option><option>Overhead</option><option>Other</option></select></div></div>
    <div class="form-row cols-2"><div class="form-group"><label>Description</label><input name="description" required/></div>
      <div class="form-group"><label>Amount (SAR)</label><input name="amount" type="number" step="0.01" required/></div></div>
    </form>`,
    `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
     <button class="btn btn-amber btn-sm" onclick="ConstructionModule._saveExpItem('${projId}')">Save</button>`);
  },
  _saveExpItem(projId){ const f=document.getElementById('exp-form'); const d=Object.fromEntries(new FormData(f)); if(!d.amount){Toast.show('Amount required','error');return;} const p=State.find('construction.projects',projId); const exps=[...(p?.projectExpenses||[]),{id:uid(),...d,amount:num(d.amount)}]; State.update('construction.projects',projId,{projectExpenses:exps}); Modal.close(); ConstructionModule._goProjectStep(4,projId); Toast.show('Expense saved!'); },
  deleteExpenseItem(projId,expId){ const p=State.find('construction.projects',projId); if(!p) return; State.update('construction.projects',projId,{projectExpenses:(p.projectExpenses||[]).filter(e=>e.id!==expId)}); ConstructionModule._goProjectStep(4,projId); },

  _billingStep(p,id){
    const invoices=p.invoices||[], payments=p.payments||[];
    const totalInv=invoices.reduce((s,i)=>s+num(i.total),0);
    const totalPaid=payments.reduce((s,pay)=>s+num(pay.amount),0);
    return `<div class="grid-3" style="margin-bottom:14px">
  <div class="stat-card" style="border-left-color:var(--blue)"><div class="stat-label">Invoiced</div><div class="stat-value" style="color:var(--blue);font-size:15px">${fmtSAR(totalInv)}</div></div>
  <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-label">Collected</div><div class="stat-value" style="color:var(--success);font-size:15px">${fmtSAR(totalPaid)}</div></div>
  <div class="stat-card" style="border-left-color:var(--danger)"><div class="stat-label">Outstanding</div><div class="stat-value" style="color:var(--danger);font-size:15px">${fmtSAR(totalInv-totalPaid)}</div></div>
</div>
<div class="card"><div class="tbl-header"><h3>🧾 Invoices</h3><button class="btn btn-amber btn-sm" onclick="ConstructionModule.addProjectInvoice('${id}')">+ New Invoice</button></div>
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>Invoice #</th><th>Date</th><th>Description</th><th class="text-right">Subtotal</th><th class="text-right">VAT</th><th class="text-right">Total</th><th>Status</th><th>Actions</th></tr></thead>
  <tbody>${invoices.length===0?`<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--muted)">No invoices.</td></tr>`:
    invoices.map((inv,i)=>`<tr><td><strong>${esc(inv.number)}</strong></td><td>${esc(inv.date)}</td><td>${esc(inv.description||'')}</td>
      <td class="text-right">${fmtSAR(inv.subtotal)}</td><td class="text-right">${fmtSAR(num(inv.subtotal)*0.15)}</td>
      <td class="text-right"><strong>${fmtSAR(inv.total)}</strong></td><td>${statusBadge(inv.status)}</td>
      <td class="actions">
        <button class="btn btn-sm btn-blue" onclick="ConstructionModule.printProjectInvoice('${id}','${inv.id}')">🖨️</button>
        <button class="btn btn-sm btn-danger" onclick="ConstructionModule.deleteProjectInvoice('${id}','${inv.id}')">×</button>
      </td></tr>`).join('')}
  </tbody>
</table></div></div>
<div class="card"><div class="tbl-header"><h3>💰 Payments</h3><button class="btn btn-success btn-sm" onclick="ConstructionModule.addProjectPayment('${id}')">+ Record Payment</button></div>
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>Date</th><th>Amount (SAR)</th><th>Invoice</th><th>Reference</th><th></th></tr></thead>
  <tbody>${payments.length===0?`<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--muted)">No payments.</td></tr>`:
    payments.map(pay=>`<tr><td>${esc(pay.date)}</td><td class="text-right">${fmtSAR(pay.amount)}</td><td>${esc(pay.invoiceNo||'—')}</td><td class="text-muted">${esc(pay.reference||'—')}</td>
      <td><button class="btn btn-sm btn-danger" onclick="ConstructionModule.deleteProjectPayment('${id}','${pay.id}')">×</button></td></tr>`).join('')}
  </tbody>
</table></div></div>
<div style="display:flex;justify-content:flex-end"><button class="btn btn-success" onclick="ConstructionModule._goProjectStep(6,'${id}')">Next: Demobilization →</button></div>`;
  },

  addProjectInvoice(projId){
    Modal.show('New Invoice',`<form id="pinv-form">
    <div class="form-row cols-2"><div class="form-group"><label>Invoice No.</label><input name="number" value="CINV-${Date.now().toString().slice(-4)}" required/></div>
      <div class="form-group"><label>Date</label><input name="date" type="date" value="${today()}"/></div></div>
    <div class="form-group"><label>Description</label><input name="description" required/></div>
    <div class="form-row cols-2"><div class="form-group"><label>Subtotal (SAR)</label><input name="subtotal" type="number" step="0.01" required oninput="this.closest('form').querySelector('#pinv-vat').textContent='VAT: '+fmtSAR(parseFloat(this.value||0)*0.15)"/></div>
      <div id="pinv-vat" style="padding:9px 0;font-size:13px;color:var(--blue)">VAT: SAR 0.00</div></div>
    <div class="form-group"><label>Status</label><select name="status"><option>Draft</option><option>Approved</option><option>Sent</option></select></div>
    </form>`,
    `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button>
     <button class="btn btn-amber btn-sm" onclick="ConstructionModule._saveProjectInvoice('${projId}')">Create Invoice</button>`);
  },
  _saveProjectInvoice(projId){ const f=document.getElementById('pinv-form'); const d=Object.fromEntries(new FormData(f)); if(!d.subtotal){Toast.show('Amount required','error');return;} const sub=num(d.subtotal),vat=sub*0.15,total=sub+vat; const p=State.find('construction.projects',projId); State.update('construction.projects',projId,{invoices:[...(p?.invoices||[]),{id:uid(),...d,subtotal:sub,vat,total}]}); Modal.close(); ConstructionModule._goProjectStep(5,projId); Toast.show('Invoice created!'); },
  deleteProjectInvoice(projId,invId){ const p=State.find('construction.projects',projId); State.update('construction.projects',projId,{invoices:(p?.invoices||[]).filter(i=>i.id!==invId)}); ConstructionModule._goProjectStep(5,projId); },
  addProjectPayment(projId){ const p=State.find('construction.projects',projId); Modal.show('Record Payment',`<form id="ppay-form"><div class="form-row cols-2"><div class="form-group"><label>Date</label><input name="date" type="date" value="${today()}"/></div><div class="form-group"><label>Amount (SAR)</label><input name="amount" type="number" step="0.01" required/></div></div><div class="form-row cols-2"><div class="form-group"><label>Invoice Ref.</label><select name="invoiceNo"><option value="">— General —</option>${(p?.invoices||[]).map(i=>`<option>${esc(i.number)}</option>`).join('')}</select></div><div class="form-group"><label>Bank Reference</label><input name="reference"/></div></div></form>`,`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button><button class="btn btn-success btn-sm" onclick="ConstructionModule._saveProjectPayment('${projId}')">💰 Record</button>`); },
  _saveProjectPayment(projId){ const f=document.getElementById('ppay-form'); const d=Object.fromEntries(new FormData(f)); if(!d.amount){Toast.show('Amount required','error');return;} const p=State.find('construction.projects',projId); State.update('construction.projects',projId,{payments:[...(p?.payments||[]),{id:uid(),...d,amount:num(d.amount)}]}); Modal.close(); ConstructionModule._goProjectStep(5,projId); Toast.show('Payment recorded!'); },
  deleteProjectPayment(projId,payId){ const p=State.find('construction.projects',projId); State.update('construction.projects',projId,{payments:(p?.payments||[]).filter(pay=>pay.id!==payId)}); ConstructionModule._goProjectStep(5,projId); },

  printProjectInvoice(projId,invId){ const p=State.find('construction.projects',projId); const inv=(p?.invoices||[]).find(i=>i.id===invId); if(!inv) return; const co=State.get('settings.company')||{}; const vat=num(inv.subtotal)*0.15,total=num(inv.subtotal)+vat; const qrB64=ZATCA.buildTLV(co.name||'BUILDOPS',co.vatNumber||'300000000000003',inv.date+'T00:00:00Z',total,vat); const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11pt;color:#1C2B3A;padding:48px 56px}.logo{font-size:22pt;font-weight:900}.logo span{color:#E8A020}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:10pt}th{background:#1C2B3A;color:#fff;padding:8px 10px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #D6CFC4}.tr{background:#1C2B3A;color:#fff;font-weight:bold}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #D6CFC4;font-size:9pt;color:#7A8A99;text-align:center}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body><div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #E8A020;margin-bottom:20px"><div><div class="logo">BUILD<span>OPS</span></div><div style="font-size:9pt;color:#7A8A99">${co.name||''} | VAT: ${co.vatNumber||''}</div></div><div style="text-align:right"><div style="font-size:15pt;font-weight:900">TAX INVOICE</div><div style="font-size:9pt;color:#7A8A99"># ${inv.number} | ${inv.date}</div><img src="${ZATCA.qrUrl(qrB64,100)}" style="width:100px;height:100px;margin-top:4px;border:1px solid #D6CFC4;border-radius:4px"/></div></div><p><strong>To:</strong> ${p.clientName||'—'} &nbsp; <strong>Project:</strong> ${p.name||'—'}</p><table><tr><th>Description</th><th style="text-align:right">Amount (SAR)</th></tr><tr><td>${inv.description||'Construction Services'}</td><td style="text-align:right">${fmtNum(inv.subtotal)}</td></tr><tr><td>VAT 15%</td><td style="text-align:right">${fmtNum(vat)}</td></tr><tr class="tr"><td>TOTAL DUE</td><td style="text-align:right">SAR ${fmtNum(total)}</td></tr></table><p><strong>Bank:</strong> ${co.bank||'—'}</p><div class="footer">${co.name||'BUILDOPS'} — ZATCA Compliant Tax Invoice</div></body></html>`; const w=window.open('','_blank','width=900,height=700'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600); },

  _demobStep(p,id){
    const demobs=p.demobItems||[];
    return `<div class="card"><div class="card-title">🔄 Resource Demobilization</div>
<div class="tbl-header"><h3>Demobilization Register</h3><button class="btn btn-amber btn-sm" onclick="ConstructionModule.addDemob('${id}')">+ Add</button></div>
<div class="table-wrap"><table class="data-table">
  <thead><tr><th>Resource</th><th>Type</th><th>Planned End</th><th>Actual End</th><th>Daily Rate (SAR)</th><th>Days Saved</th><th>Saving (SAR)</th><th></th></tr></thead>
  <tbody>${demobs.length===0?`<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--muted)">No demobilization records.</td></tr>`:
    demobs.map(d=>{const ds=d.plannedEnd&&d.actualEnd?Math.max(0,Math.round((new Date(d.plannedEnd)-new Date(d.actualEnd))/86400000)):0; const sav=ds*num(d.dailyRate); return `<tr><td>${esc(d.resource)}</td><td>${esc(d.type)}</td><td>${esc(d.plannedEnd||'—')}</td><td>${esc(d.actualEnd||'—')}</td><td class="text-right">${fmtSAR(d.dailyRate)}</td><td class="text-right" style="color:${ds>0?'var(--success)':'var(--muted)'}">${ds}</td><td class="text-right" style="color:${ds>0?'var(--success)':'var(--muted)'}"><strong>${fmtSAR(sav)}</strong></td><td><button class="btn btn-sm btn-danger" onclick="ConstructionModule.deleteDemob('${id}','${d.id}')">×</button></td></tr>`;}).join('')}
  </tbody>
</table></div>
<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-success" onclick="ConstructionModule._goProjectStep(7,'${id}')">Next: Closeout →</button></div></div>`;
  },
  addDemob(projId){ Modal.show('Add Demob Record',`<form id="demob-form"><div class="form-row cols-2"><div class="form-group"><label>Resource Name</label><input name="resource" required/></div><div class="form-group"><label>Type</label><select name="type"><option>Manpower</option><option>Equipment</option><option>Material</option></select></div></div><div class="form-row cols-3"><div class="form-group"><label>Planned End</label><input name="plannedEnd" type="date"/></div><div class="form-group"><label>Actual End</label><input name="actualEnd" type="date"/></div><div class="form-group"><label>Daily Rate (SAR)</label><input name="dailyRate" type="number" step="0.01" value="0"/></div></div></form>`,`<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Cancel</button><button class="btn btn-amber btn-sm" onclick="ConstructionModule._saveDemob('${projId}')">Add</button>`); },
  _saveDemob(projId){ const f=document.getElementById('demob-form'); const d=Object.fromEntries(new FormData(f)); if(!d.resource){Toast.show('Resource name required','error');return;} const p=State.find('construction.projects',projId); State.update('construction.projects',projId,{demobItems:[...(p?.demobItems||[]),{id:uid(),...d,dailyRate:num(d.dailyRate)}]}); Modal.close(); ConstructionModule._goProjectStep(6,projId); Toast.show('Demob record added!'); },
  deleteDemob(projId,dId){ const p=State.find('construction.projects',projId); State.update('construction.projects',projId,{demobItems:(p?.demobItems||[]).filter(d=>d.id!==dId)}); ConstructionModule._goProjectStep(6,projId); },

  _closeoutStep(p,id){
    const invoices=p.invoices||[], payments=p.payments||[], expenses=p.projectExpenses||[], demobs=p.demobItems||[];
    const totalInv=invoices.reduce((s,i)=>s+num(i.subtotal),0);
    const totalPaid=payments.reduce((s,pay)=>s+num(pay.amount),0);
    const totalExp=expenses.reduce((s,e)=>s+num(e.amount),0);
    const demobSavings=demobs.reduce((d,item)=>{const ds=item.plannedEnd&&item.actualEnd?Math.max(0,Math.round((new Date(item.plannedEnd)-new Date(item.actualEnd))/86400000)):0; return d+ds*num(item.dailyRate);},0);
    const retPct=num(p.retentionPct||10);
    const retHeld=invoices.reduce((s,inv)=>s+num(inv.subtotal)*retPct/100,0);
    const netCost=totalExp-demobSavings;
    const grossPL=totalInv-netCost;
    const margin=totalInv>0?(grossPL/totalInv*100).toFixed(1):0;
    return `
<div class="${grossPL>=0?'profit-box green':'profit-box red'}" style="margin-bottom:18px">
  <div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Final Project Result — ${p.name}</div>
    <div class="profit-value" style="color:${grossPL>=0?'var(--success)':'var(--danger)'}">${fmtSAR(grossPL)}</div>
    <div style="font-size:12px;color:var(--muted)">Margin: ${margin}% | Progress: ${num(p.progress||0).toFixed(0)}%</div></div>
  <div style="font-size:48px">${grossPL>=0?'🏆':'⚠️'}</div>
</div>
<div class="grid-2">
  <div class="card"><div class="card-title" style="border-bottom:2px solid var(--success);padding-bottom:8px">💰 Revenue Summary</div>
    ${[['Contract Value',p.contractValue],['Total Invoiced',totalInv],['Collected',totalPaid],['Outstanding',totalInv-totalPaid]].map(([l,v],i)=>`<div class="flex-between mb-8"><span class="text-muted">${l}</span><strong style="color:${i===3&&v>0?'var(--danger)':'inherit'}">${fmtSAR(v)}</strong></div>`).join('')}
  </div>
  <div class="card"><div class="card-title" style="border-bottom:2px solid var(--danger);padding-bottom:8px">💸 Cost Summary</div>
    ${[['Original Estimate',num(p.estimatedCost)],['Actual Expenses',totalExp],['Demob Savings',-demobSavings],['Net Cost',netCost]].map(([l,v],i)=>`<div class="flex-between mb-8"><span class="text-muted">${l}</span><strong style="color:${i===2?'var(--success)':i===3?'var(--danger)':'inherit'}">${i===2?'- ':''} ${fmtSAR(Math.abs(v))}</strong></div>`).join('')}
  </div>
</div>
<div class="card" style="background:#FFFBF0;border:1px solid var(--amber)">
  <div style="color:var(--amber);font-weight:700;margin-bottom:8px">🔒 Retention: ${fmtSAR(retHeld)}</div>
  <div class="flex-between"><span class="text-muted">Gross Profit (excl. retention)</span><strong style="color:${grossPL>=0?'var(--success)':'var(--danger)'}">${fmtSAR(grossPL)}</strong></div>
  <div class="flex-between mt-8"><span class="text-muted">Net Profit (incl. retention when collected)</span><strong style="color:${(grossPL+retHeld)>=0?'var(--success)':'var(--danger)'}">${fmtSAR(grossPL+retHeld)}</strong></div>
</div>
<div style="display:flex;gap:10px;justify-content:flex-end">
  <button class="btn btn-blue" onclick="ConstructionModule.exportCloseoutReport('${id}')">📥 Export Closeout Report</button>
  <button class="btn btn-amber" onclick="ConstructionModule.markComplete('${id}')">✅ Mark Project Complete</button>
</div>`;
  },

  exportCloseoutReport(projId){
    const p=State.find('construction.projects',projId); if(!p) return;
    const wb=window.XLSX.utils.book_new();
    const totalInv=(p.invoices||[]).reduce((s,i)=>s+num(i.subtotal),0);
    const totalPaid=(p.payments||[]).reduce((s,pay)=>s+num(pay.amount),0);
    const totalExp=(p.projectExpenses||[]).reduce((s,e)=>s+num(e.amount),0);
    const ws=window.XLSX.utils.aoa_to_sheet([
      ['PROJECT CLOSEOUT SUMMARY'],[`Project: ${p.name}`],[`Client: ${p.clientName}`],[`Date: ${today()}`],[],
      ['REVENUE'],['Contract Value (SAR)',num(p.contractValue)],['Total Invoiced (SAR)',totalInv],['Collected (SAR)',totalPaid],[],
      ['COSTS'],['Total Expenses (SAR)',totalExp],[],
      ['P&L'],['Gross Profit (SAR)',totalInv-totalExp],['Margin %',`${totalInv>0?((totalInv-totalExp)/totalInv*100).toFixed(1):0}%`],[],
      ['Retention Held (SAR)',(p.invoices||[]).reduce((s,i)=>s+num(i.subtotal)*num(p.retentionPct||10)/100,0)],
      ['Progress %',`${num(p.progress||0).toFixed(0)}%`]
    ]);
    ws['!cols']=[{wch:40},{wch:22}];
    window.XLSX.utils.book_append_sheet(wb,ws,'Closeout');
    window.XLSX.writeFile(wb,`Closeout_${p.name.replace(/\s+/g,'_')}_${today()}.xlsx`);
    Toast.show('Report downloaded!');
  },

  markComplete(projId){
    if(confirm('Mark this project as Completed?')){
      State.update('construction.projects',projId,{status:'Completed',progress:100,completedDate:today()});
      ConstructionModule.render(); Toast.show('Project marked as Completed!');
    }
  }
};

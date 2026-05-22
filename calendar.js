// ── calendar.js ───────────────────────────────────────────────
// Renderizado de vistas: dashboard, calendario anual y mensual

// ── CONFLICT DETECTION ────────────────────────────────────────
function rolesAreCompatible(roleA, roleB) {
  if (!roleA || !roleB) return false;
  const a = roleA.trim().toLowerCase(), b = roleB.trim().toLowerCase();
  return (state.compatibleRoles || []).some(pair => {
    const p0 = pair[0].toLowerCase(), p1 = pair[1].toLowerCase();
    return (a === p0 && b === p1) || (a === p1 && b === p0);
  });
}

function getConflictDays(year) {
  const conflicts = [];
  const sameRoleThresh = state.conflictThreshold || 2;
  const totalThresh = state.conflictThresholdTotal || 99;

  for (const [key, marks] of Object.entries(state.marks)) {
    if (!key.startsWith(String(year))) continue;
    const vacEmpIds = Object.entries(marks)
      .filter(([,t]) => t === 'V')
      .map(([id]) => Number(id));
    if (!vacEmpIds.length) continue;

    const empObjs = vacEmpIds.map(id => state.employees.find(e => e.id === id)).filter(Boolean);
    const totalConflict = empObjs.length >= totalThresh;

    const roleCount = {};
    empObjs.forEach(e => {
      const r = (e.role||'sin-puesto').trim();
      roleCount[r] = (roleCount[r] || 0) + 1;
    });
    const sameRoleConflict = Object.values(roleCount).some(c => c >= sameRoleThresh) &&
      empObjs.some((ea, i) => empObjs.some((eb, j) => i !== j &&
        !rolesAreCompatible(ea.role||'', eb.role||'') &&
        (ea.role||'') === (eb.role||'')
      ));

    if (totalConflict || sameRoleConflict) {
      conflicts.push({ key, empIds: vacEmpIds });
    }
  }
  return conflicts;
}

function renderConflictBanner(containerId, year) {
  const conflicts = getConflictDays(year);
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!conflicts.length) { el.innerHTML = ''; return; }
  const names = [...new Set(conflicts.flatMap(c => c.empIds))]
    .map(id => state.employees.find(e => e.id === id)?.name).filter(Boolean);
  el.innerHTML = `<div class="conflict-banner">⚠️ <strong>${conflicts.length} día${conflicts.length>1?'s':''} con conflicto</strong> — Coinciden: ${names.join(', ')}</div>`;
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const y = state.currentYear;
  const emps = state.employees;
  const festivosYear = Object.keys(state.festivos).filter(k=>k.startsWith(String(y))&&state.festivos[k]);
  const totalVac = emps.reduce((a,e)=>a+countVacDays(e.id,y),0);
  const totalLeft = emps.reduce((a,e)=>a+(e.totalDays-countVacDays(e.id,y)),0);

  const today = new Date();
  const empsWithBd = emps.filter(e=>e.birthday).map(e=>{
    const b = new Date(e.birthday);
    let next = new Date(y, b.getMonth(), b.getDate());
    if (next < today) next = new Date(y+1, b.getMonth(), b.getDate());
    const diff = Math.ceil((next-today)/(1000*60*60*24));
    return {...e, nextBd: next, daysUntil: diff};
  }).sort((a,b)=>a.daysUntil-b.daysUntil);
  const nextBd = empsWithBd[0];

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-card">
      <div class="label">Año</div>
      <div class="value" style="color:var(--accent)">${y}</div>
      <div class="sub">en curso</div>
    </div>
    <div class="stat-card">
      <div class="label">Empleados</div>
      <div class="value">${emps.length}</div>
      <div class="sub">registrados</div>
    </div>
    <div class="stat-card">
      <div class="label">Días usados</div>
      <div class="value">${totalVac}</div>
      <div class="sub">vacaciones asignadas</div>
    </div>
    <div class="stat-card">
      <div class="label">Días restantes</div>
      <div class="value">${totalLeft}</div>
      <div class="sub">entre todos</div>
    </div>
    <div class="stat-card festivo-card">
      <div class="label">Festivos</div>
      <div class="value">${festivosYear.length}</div>
      <div class="sub">marcados este año</div>
    </div>
    ${nextBd ? `<div class="stat-card" style="border-color:rgba(255,182,193,.4);">
      <div class="label">🎂 Próximo cumple</div>
      <div class="value" style="font-size:1.2rem;color:#ffb6c1;">${nextBd.name}</div>
      <div class="sub">${nextBd.daysUntil===0?'¡Hoy! 🎉':nextBd.daysUntil===1?'Mañana':nextBd.daysUntil+' días'} · ${nextBd.nextBd.getDate()} ${MONTHS[nextBd.nextBd.getMonth()].slice(0,3)}</div>
    </div>` : ''}
  `;

  const festList = document.getElementById('festivos-list');
  if (!festivosYear.length) {
    festList.innerHTML = '<span class="no-festivos">Sin festivos marcados. Ábrelos desde el calendario.</span>';
  } else {
    festList.innerHTML = festivosYear.sort().map(key => {
      const p=key.split('-');
      const label=`${parseInt(p[2])} ${MONTHS[parseInt(p[1])-1].slice(0,3)} ${p[0]}`;
      return `<div class="festivo-chip">🎌 ${label}<button onclick="removeFestivo('${key}')" title="Eliminar">×</button></div>`;
    }).join('');
  }

  document.getElementById('employees-grid').innerHTML = emps.map(emp => {
    const used = countVacDays(emp.id, y);
    const past = countPastVacDays(emp.id, y);
    const future = countFutureVacDays(emp.id, y);
    const notScheduled = emp.totalDays - used;
    const pct = Math.min(100, Math.round((used/emp.totalDays)*100));
    const pastPct = Math.min(100, Math.round((past/emp.totalDays)*100));
    const futurePct = Math.min(100, Math.round((future/emp.totalDays)*100));
    const textColor = getTextColorForBg(emp.color);
    const isCurrentYear = y === new Date().getFullYear();
    return `
    <div class="emp-card" style="border-left:4px solid ${emp.color}">
      <div class="emp-header">
        <div class="emp-dot" style="background:${emp.color};color:${textColor}">${initials(emp.name)}</div>
        <div><div class="emp-name">${emp.name}</div><div class="emp-role">${emp.role||'—'}${emp.birthday?` · 🎂 ${new Date(emp.birthday).getDate()} ${MONTHS[new Date(emp.birthday).getMonth()].slice(0,3)}`:''}
        </div></div>
      </div>
      <div class="progress-wrap">
        <div class="progress-label"><span>Vacaciones planificadas</span><span>${pct}%</span></div>
        <div class="progress-bar" style="height:8px;">
          <div class="progress-fill" style="width:${pastPct}%;background:${emp.color};opacity:0.5;border-radius:99px 0 0 99px;"></div>
          <div class="progress-fill" style="width:${futurePct}%;background:${emp.color};border-radius:${pastPct===0?'99px':'0'} 99px 99px ${pastPct===0?'99px':'0'};margin-top:-8px;margin-left:${pastPct}%;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:0.7rem;color:var(--muted);">
          <span>🕐 Disfrutados: <strong style="color:var(--text)">${past}</strong></span>
          <span>📅 Pendientes: <strong style="color:${emp.color}">${future}</strong></span>
        </div>
      </div>
      <div class="days-taken" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);">
        ${isCurrentYear
          ? `<strong style="color:${emp.color};font-size:1rem;">${notScheduled}</strong> días sin asignar de <strong>${emp.totalDays}</strong>`
          : `<strong>${used}</strong> de <strong>${emp.totalDays}</strong> días · <strong style="color:${emp.color}">${emp.totalDays-used}</strong> restantes`
        }
      </div>
      <div class="emp-card-actions">
        <button class="btn-edit" onclick="openEditEmployee(${emp.id})">✏️ Editar empleado</button>
        <button class="btn-delete" onclick="deleteEmployee(${emp.id})" title="Eliminar">🗑</button>
      </div>
    </div>`;
  }).join('') + `
  <div class="emp-card" style="border:2px dashed var(--border);background:transparent;display:flex;align-items:center;justify-content:center;min-height:130px;cursor:pointer;" onclick="openAddEmployee()">
    <div style="text-align:center;color:var(--muted)">
      <div style="font-size:1.8rem;margin-bottom:5px">+</div>
      <div style="font-size:0.83rem">Añadir empleado</div>
    </div>
  </div>`;
}

function removeFestivo(key) {
  delete state.festivos[key];
  saveState();
  renderDashboard();
  showToast('🗑 Festivo eliminado');
}

// ── ANNUAL ────────────────────────────────────────────────────
function renderAnnual() {
  const y = state.currentYear;
  document.getElementById('year-label').textContent = y;
  renderFilterPills();
  renderLegend('annual-legend');
  renderConflictBanner('annual-conflict-banner', y);
  const conflictKeys = new Set(getConflictDays(y).map(c=>c.key));
  const grid = document.getElementById('annual-grid');
  grid.innerHTML = '';

  for (let m=0; m<12; m++) {
    const block = document.createElement('div');
    block.className = 'month-block';
    const days=daysInMonth(y,m), first=firstDayOfMonth(y,m);
    let html = `<div class="month-name">${MONTHS[m]}</div><div class="month-days">`;
    DAYS_SHORT.forEach(d=>html+=`<div class="day-header">${d}</div>`);
    for(let i=0;i<first;i++) html+=`<div class="day-cell empty"></div>`;

    for(let d=1;d<=days;d++){
      const key=dateKey(y,m,d);
      const marks=getDayMarks(key);
      const festivo=isFestivo(key);
      const isConflict = conflictKeys.has(key);
      const showFestivo = festivo && (state.activeFilters.includes('all')||state.activeFilters.includes('festivo'));
      const markedEmps=Object.keys(marks).map(Number).filter(id=>{
        if(state.activeFilters.includes('all')) return true;
        return state.activeFilters.includes(id);
      });
      const weekend=isWeekend(y,m,d), isToday=key===todayKey();
      let bg='transparent', cls='day-cell';
      if(weekend) cls+=' weekend';
      if(isToday) cls+=' today';
      if(showFestivo) cls+=' is-festivo';
      if(isConflict) cls+=' conflict';
      let dotsHtml='';
      if(markedEmps.length===1){
        const emp=state.employees.find(e=>e.id===markedEmps[0]);
        if(emp){ bg=emp.color; cls+=' '+colorClasses(emp.color); }
      } else if(markedEmps.length>1){
        cls+=' multi-marked';
        dotsHtml=`<div class="day-dots">${markedEmps.slice(0,4).map(id=>{
          const emp=state.employees.find(e=>e.id===id);
          return emp?`<div class="day-dot" style="background:${emp.color}"></div>`:'';
        }).join('')}</div>`;
      }
      const fCorner=showFestivo?`<div class="festivo-corner"></div>`:'';
      const conflictIcon=isConflict?`<div class="conflict-icon-annual">⚠️</div>`:'';
      const birthdays=getBirthdaysOnKey(key);
      const bdCorner=birthdays.length?`<div class="birthday-corner">🎂</div>`:'';
      const title=birthdays.length?`title="🎂 ${birthdays.map(e=>e.name).join(', ')}"`:isConflict?`title="⚠️ Conflicto"`:'';
      html+=`<div class="${cls}" style="background:${bg}" onclick="openDayModal('${key}')" ${title}>${d}${dotsHtml}${fCorner}${conflictIcon}${bdCorner}</div>`;
    }
    html+='</div>';
    block.innerHTML=html;
    grid.appendChild(block);
  }
}

function renderFilterPills() {
  const af=state.activeFilters;
  let html=`<div class="pill pill-all ${af.includes('all')?'active':''}" onclick="toggleFilter('all')">Todos</div>`;
  html+=`<div class="pill pill-festivo ${af.includes('festivo')?'active':''}" onclick="toggleFilter('festivo')">🎌 Festivos</div>`;
  state.employees.forEach(e=>{
    const isWhite = e.color==='#ffffff';
    const isBlack = e.color==='#000000';
    let pillStyle, textStyle;
    if (isWhite) { pillStyle=`background:#f0f0f0;border:2px solid #999;`; textStyle=`color:#333;`; }
    else if (isBlack) { pillStyle=`background:#222;border:2px solid #888;`; textStyle=`color:#fff;`; }
    else { pillStyle=`background:${e.color}20;border-color:${e.color}40;`; textStyle=`color:${e.color};`; }
    html+=`<div class="pill ${af.includes(e.id)?'active':''}" style="${pillStyle}${textStyle}" onclick="toggleFilter(${e.id})">${e.name}</div>`;
  });
  document.getElementById('filter-pills').innerHTML=html;
}

function toggleFilter(id) {
  if(id==='all'){ state.activeFilters=['all']; }
  else {
    state.activeFilters=state.activeFilters.filter(x=>x!=='all');
    if(state.activeFilters.includes(id)) {
      state.activeFilters=state.activeFilters.filter(x=>x!==id);
      if(!state.activeFilters.length) state.activeFilters=['all'];
    } else { state.activeFilters.push(id); }
  }
  renderAnnual();
}

function changeYear(delta) {
  state.currentYear+=delta; saveState(); renderAnnual();
}

// ── MONTHLY ───────────────────────────────────────────────────
function initMonthlySelects() {
  const ms=document.getElementById('month-select'), ys=document.getElementById('year-select-monthly');
  if(!ms.options.length){
    MONTHS.forEach((m,i)=>ms.add(new Option(m,i)));
    for(let y=2024;y<=2030;y++) ys.add(new Option(y,y));
    ms.value=new Date().getMonth(); ys.value=state.currentYear;
  }
}

function renderMonthly() {
  initMonthlySelects();
  renderLegend('monthly-legend');
  const m=parseInt(document.getElementById('month-select').value);
  const y=parseInt(document.getElementById('year-select-monthly').value);
  const conflictKeys = new Set(getConflictDays(y).map(c=>c.key));
  const days=daysInMonth(y,m), first=firstDayOfMonth(y,m);
  let html=`<div class="monthly-header">`;
  DAYS_SHORT.forEach(d=>html+=`<div>${d}</div>`);
  html+=`</div><div class="monthly-grid">`;
  for(let i=0;i<first;i++) html+=`<div class="monthly-day empty"></div>`;
  for(let d=1;d<=days;d++){
    const key=dateKey(y,m,d), marks=getDayMarks(key), festivo=isFestivo(key);
    const isConflict = conflictKeys.has(key);
    const weekend=isWeekend(y,m,d), isToday=key===todayKey();
    let cls='monthly-day';
    if(weekend) cls+=' weekend';
    if(isToday) cls+=' today';
    if(festivo) cls+=' is-festivo';
    if(isConflict) cls+=' conflict';
    const festivoHtml=festivo?`<div class="festivo-label">🎌 Festivo</div>`:'';
    const conflictHtml=isConflict?`<div class="conflict-label-monthly">⚠️ Conflicto de turno</div>`:'';
    const birthdays=getBirthdaysOnKey(key);
    const bdHtml=birthdays.map(e=>`<span class="monthly-birthday-badge">🎂 Cumple ${e.name}</span>`).join('');
    const badges=Object.entries(marks).map(([id,type])=>{
      const emp=state.employees.find(e=>e.id===Number(id));
      if(!emp) return '';
      const textColor = getTextColorForBg(emp.color);
      const border = emp.color==='#ffffff' ? 'border:1.5px solid #777;' : emp.color==='#000000' ? 'border:1.5px solid #aaa;' : '';
      return `<span class="emp-badge" style="background:${emp.color};color:${textColor};${border}">${emp.name}${type==='O'?' ✱':''}</span>`;
    }).join('');
    html+=`<div class="${cls}" onclick="openDayModal('${key}')">
      <div class="day-num">${d}</div>${festivoHtml}${conflictHtml}${bdHtml}
      <div class="day-emp-badges">${badges}</div>
    </div>`;
  }
  html+='</div>';
  document.getElementById('monthly-calendar').innerHTML=html;
}

// ── LEGEND ────────────────────────────────────────────────────
function renderLegend(id) {
  let html=state.employees.map(e=>{
    const isWhite = e.color==='#ffffff';
    const isBlack = e.color==='#000000';
    const dotBorder = isWhite ? 'border:1.5px solid #888;' : isBlack ? 'border:1.5px solid #aaa;' : '';
    return `<div class="legend-item"><div class="legend-dot" style="background:${e.color};${dotBorder}"></div>${e.name}</div>`;
  }).join('');
  html+=`<div class="legend-item"><div class="legend-festivo"></div>Festivo (no cuenta)</div>`;
  document.getElementById(id).innerHTML=html;
}

// ── DAY MODAL ─────────────────────────────────────────────────
let currentDayKey=null;

function openDayModal(key) {
  currentDayKey=key;
  const marks=getDayMarks(key), festivo=isFestivo(key);
  const p=key.split('-');
  document.getElementById('day-modal-title').textContent=`📅 ${parseInt(p[2])} de ${MONTHS[parseInt(p[1])-1]} ${p[0]}`;
  const chkF=document.getElementById('chk-festivo');
  chkF.checked=festivo;
  document.getElementById('festivo-toggle').classList.toggle('active',festivo);
  document.getElementById('day-modal-emps').innerHTML=state.employees.map(emp=>{
    const marked=marks[emp.id], type=marked||'V';
    return `<div class="day-emp-row ${marked?'selected':''}" id="row-${emp.id}" onclick="toggleDayRow(${emp.id})">
      <input type="checkbox" id="chk-${emp.id}" ${marked?'checked':''} onclick="event.stopPropagation();toggleDayRow(${emp.id})">
      <div class="emp-dot-sm" style="background:${emp.color}"></div>
      <span style="font-size:.83rem;font-weight:600">${emp.name}</span>
      <select class="day-emp-type" id="type-${emp.id}" onclick="event.stopPropagation()">
        <option value="V" ${type==='V'?'selected':''}>Vacaciones</option>
        <option value="O" ${type==='O'?'selected':''}>Otros</option>
      </select>
    </div>`;
  }).join('');
  openModal('day-modal');
}

function toggleFestivo() {
  const chk=document.getElementById('chk-festivo');
  chk.checked=!chk.checked;
  document.getElementById('festivo-toggle').classList.toggle('active',chk.checked);
}

function toggleDayRow(empId) {
  const chk=document.getElementById('chk-'+empId), row=document.getElementById('row-'+empId);
  chk.checked=!chk.checked;
  row.classList.toggle('selected',chk.checked);
}

function saveDayMarks() {
  if(document.getElementById('chk-festivo').checked) state.festivos[currentDayKey]=true;
  else delete state.festivos[currentDayKey];
  const marks={};
  state.employees.forEach(emp=>{
    const chk=document.getElementById('chk-'+emp.id);
    const type=document.getElementById('type-'+emp.id).value;
    if(chk&&chk.checked) marks[emp.id]=type;
  });
  if(Object.keys(marks).length) state.marks[currentDayKey]=marks;
  else delete state.marks[currentDayKey];
  saveState();
  closeModal('day-modal');
  showToast('✅ Guardado');
  const idx=[...document.querySelectorAll('.tab-btn')].findIndex(b=>b.classList.contains('active'));
  showView(['dashboard','annual','monthly'][idx]);
}

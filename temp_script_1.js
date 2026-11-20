
let currentData = [];
let selectedIds = new Set();

async function loadData() {
  try {
    const res = await fetch('/api/adaily', {
      headers: { 'Authorization': \`Bearer \${sessionStorage.getItem('schiller_token')}\` }
    });
    if (!res.ok) throw new Error('Failed to load');
    currentData = await res.json();
    selectedIds.clear();
    updateBulkBtn();
    renderCards();
  } catch(e) {
    console.error(e);
    document.getElementById('kb-grid').innerHTML = \`<div style="color:var(--red);padding:20px;grid-column:1/-1;">Error loading data.</div>\`;
  }
}

function renderCards() {
  const grid = document.getElementById('kb-grid');
  const fDate = document.getElementById('filter-date').value;
  const fUser = document.getElementById('filter-user').value.toLowerCase();
  const fTeam = document.getElementById('filter-team').value.toLowerCase();
  const fSource = document.getElementById('filter-source').value;

  const filtered = currentData.filter(t => {
    if (fDate && t.date !== fDate) return false;
    if (fUser && !(t.addedBy || '').toLowerCase().includes(fUser)) return false;
    if (fTeam && !(t.team || '').toLowerCase().includes(fTeam)) return false;
    if (fSource && t.sourceType !== fSource) return false;
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = \`<div style="padding:60px 20px; text-align:center; grid-column:1/-1; color:var(--muted); background:var(--card); border-radius:12px; border:1.5px dashed var(--border);">No entries found matching filters.</div>\`;
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const srcClass = t.sourceType === 'Employee' ? 'source-emp' : 'source-pt';
    const isChecked = selectedIds.has(t._id) ? 'checked' : '';
    const dateStr = t.date ? new Date(t.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '--';
    
    return \`
    <div class="kb-card">
      <div class="checkbox-wrap">
        <input type="checkbox" class="row-checkbox" data-id="\${t._id}" \${isChecked} onchange="toggleSelect(this, '\${t._id}')">
      </div>
      <div class="kb-top">
        <div class="source-badge \${srcClass}">\${t.sourceType}</div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:8px;">\${dateStr} &bull; \${t.fromTime||'--'} to \${t.toTime||'--'}</div>
      <div class="kb-activity">\${esc(t.activity||'')}</div>
      <div class="kb-foot">
        <div class="kb-user">By <span>\${esc(t.addedBy||'User')}</span></div>
        <button class="kb-view" onclick="viewDw('\${t._id}')">View</button>
      </div>
    </div>\`;
  }).join('');
}

function toggleSelect(cb, id) {
  if (cb.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBulkBtn();
}

function updateBulkBtn() {
  const btn = document.getElementById('bulk-del-btn');
  if (selectedIds.size > 0) {
    btn.style.display = 'inline-flex';
    btn.textContent = \`Delete Selected (\${selectedIds.size})\`;
  } else {
    btn.style.display = 'none';
  }
}

async function bulkDelete() {
  if(!confirm(\`Delete \${selectedIds.size} selected entries? This cannot be undone.\`)) return;
  try {
    const res = await fetch('/api/adaily/bulk-delete', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${sessionStorage.getItem('schiller_token')}\` 
      },
      body: JSON.stringify({ ids: Array.from(selectedIds) })
    });
    if(!res.ok) throw new Error('Delete failed');
    selectedIds.clear();
    updateBulkBtn();
    await loadData();
  } catch(e) {
    alert(e.message);
  }
}

function viewDw(id) {
  const entry = currentData.find(d => d._id === id);
  if(!entry) return;
  const date = entry.date ? new Date(entry.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-';
  document.getElementById('view-sub').textContent = date + ' (' + entry.sourceType + ')';
  document.getElementById('dw-view-body').innerHTML = \`
    <div class="view-detail-grid">
      <div class="view-detail"><div class="view-label">Date</div><div class="view-value">\${esc(date)}</div></div>
      <div class="view-detail"><div class="view-label">Team / Division</div><div class="view-value">\${esc(entry.team || '-')}</div></div>
      <div class="view-detail"><div class="view-label">From</div><div class="view-value">\${esc(entry.fromTime || '-')}</div></div>
      <div class="view-detail"><div class="view-label">To</div><div class="view-value">\${esc(entry.toTime || '-')}</div></div>
      <div class="view-detail"><div class="view-label">Total Day Hours</div><div class="view-value">\${esc(entry.dayTotal || '-')}</div></div>
      <div class="view-detail"><div class="view-label">Added By</div><div class="view-value">\${esc(entry.addedBy || '-')}</div></div>
      <div class="view-detail full"><div class="view-label">Activity</div><div class="view-value">\${esc(entry.activity || '-')}</div></div>
    </div>\`;
  
  const delBtn = document.getElementById('view-del-btn');
  delBtn.onclick = async () => {
    if(!confirm('Delete this entry?')) return;
    try {
      await fetch('/api/adaily/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': \`Bearer \${sessionStorage.getItem('schiller_token')}\` }
      });
      closeDwView();
      loadData();
    } catch(e) { alert(e.message); }
  };
  
  document.getElementById('dw-view-overlay').classList.add('open');
}

function closeDwView(){ document.getElementById('dw-view-overlay').classList.remove('open'); }

function exportToExcel() {
  if(!currentData.length) return alert('No data to export.');
  
  const data = currentData.map(item => {
     let mins = 0;
     if(item.fromTime && item.toTime){
        const [fh, fm] = item.fromTime.split(':').map(Number);
        const [th, tm] = item.toTime.split(':').map(Number);
        mins = (th*60+tm) - (fh*60+fm);
        if(mins < 0) mins += 24*60;
     }
     const h = Math.floor(mins/60);
     const m = mins%60;
     
     return {
        'Date': item.date,
        'Source': item.sourceType,
        'Added By': item.addedBy,
        'Team / Division': item.team || '',
        'Activity': item.activity,
        'From Time': item.fromTime,
        'To Time': item.toTime,
        'Duration': \`\${h}h \${m}m\`,
        'Day Total': item.dayTotal || ''
     };
  });
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Admin Daily Work");
  XLSX.writeFile(wb, "Admin_Daily_Work.xlsx");
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function logout(){ sessionStorage.clear(); localStorage.clear(); window.location.href='login.html'; }

window.onload = loadData;

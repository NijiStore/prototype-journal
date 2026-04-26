// ── CONFIG ──
const API_BASE = 'https://niji-proto-app-backend.onrender.com';
const API = `${API_BASE}/api/prototypes`;

// ── STATE ──
let protos       = [];
let editingId    = null;
let currentFilter = 'all';
let currentView   = 'journal';

// Temporary form state (cleared on every modal open)
let tempMaterials = [];
let tempWorked    = [];
let tempDidnt     = [];

// ── VERDICT MAPS ──
const VERDICT_LABELS  = { cut: 'In Collection', maybe: 'Needs Revision', no: 'Retired', wip: 'In Progress' };
const VERDICT_CLASSES = { cut: 'vb-cut', maybe: 'vb-maybe', no: 'vb-no', wip: 'vb-wip' };

// =============================================================================
// API HELPERS
// =============================================================================

async function apiGetAll() {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function apiCreate(proto) {
  const res = await fetch(API, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(proto),
  });
  return res.json();
}

async function apiUpdate(id, proto) {
  const res = await fetch(`${API}/${id}`, {
	method: 'PATCH',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(proto),
  });
  return res.json();
}

async function apiDelete(id) {
  await fetch(`${API}/${id}`, { method: 'DELETE' });
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadAll() {
  try {
	protos = await apiGetAll();
  } catch (e) {
	console.error(e);
	protos = [];
  }
  render();
}

// =============================================================================
// ID GENERATION
// =============================================================================

function genId() {
  return 'P' + (protos.length + 1).toString().padStart(3, '0');
}

// =============================================================================
// MODAL — open / close
// =============================================================================

function openModal(id = null) {
  editingId     = id;
  tempMaterials = [];
  tempWorked    = [];
  tempDidnt     = [];

  document.getElementById('proto-form').reset();
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];

  if (id) {
	// Edit mode — populate fields from existing prototype
	const p = protos.find(x => x.id === id);
	document.getElementById('modal-title').textContent       = 'Edit Prototype';
	document.getElementById('edit-id').value                 = id;
	document.getElementById('f-name').value                  = p.name        || '';
	document.getElementById('f-category').value              = p.category     || '';
	document.getElementById('f-date').value                  = p.date         || '';
	document.getElementById('f-iteration').value             = p.iteration    || '';
	document.getElementById('f-time').value                  = p.time         || '';
	document.getElementById('f-difficulty').value            = p.difficulty   || '';
	document.getElementById('f-cost').value                  = p.cost         || '';
	document.getElementById('f-verdict').value               = p.verdict      || 'wip';
	document.getElementById('f-price').value                 = p.price        || '';
	document.getElementById('f-verdict-note').value          = p.verdictNote  || '';
	tempMaterials = p.materials ? [...p.materials] : [];
	tempWorked    = p.worked    ? [...p.worked]    : [];
	tempDidnt     = p.didnt     ? [...p.didnt]     : [];
  } else {
	// Create mode
	document.getElementById('modal-title').textContent = 'New Prototype';
	document.getElementById('edit-id').value           = '';
  }

  renderMatChips();
  renderWorkedList();
  renderDidntList();
  document.getElementById('overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}

// Close modal when clicking the backdrop
document.getElementById('overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// =============================================================================
// FORM — materials
// =============================================================================

function addPrimary() {
  const val = document.getElementById('mat-primary-input').value.trim();
  if (!val) return;
  tempMaterials = tempMaterials.filter(m => !m.primary); // only one primary
  tempMaterials.unshift({ label: val, primary: true });
  document.getElementById('mat-primary-input').value = '';
  renderMatChips();
}

function addMaterial() {
  const val = document.getElementById('mat-extra-input').value.trim();
  if (!val) return;
  tempMaterials.push({ label: val, primary: false });
  document.getElementById('mat-extra-input').value = '';
  renderMatChips();
}

function removeMaterial(i) {
  tempMaterials.splice(i, 1);
  renderMatChips();
}

function renderMatChips() {
  document.getElementById('mat-chips').innerHTML = tempMaterials
	.map((m, i) => `
	  <div class="mat-chip ${m.primary ? 'primary-chip' : ''}">
		${m.label}
		<button type="button" onclick="removeMaterial(${i})">✕</button>
	  </div>`)
	.join('');
}

// =============================================================================
// FORM — worked / didn't work lists
// =============================================================================

function addWorked() {
  const val = document.getElementById('worked-input').value.trim();
  if (!val) return;
  tempWorked.push(val);
  document.getElementById('worked-input').value = '';
  renderWorkedList();
}

function removeWorked(i) {
  tempWorked.splice(i, 1);
  renderWorkedList();
}

function renderWorkedList() {
  document.getElementById('worked-list').innerHTML = tempWorked
	.map((w, i) => `<li>${w}<button type="button" onclick="removeWorked(${i})">✕</button></li>`)
	.join('');
}

function addDidnt() {
  const val = document.getElementById('didnt-input').value.trim();
  if (!val) return;
  tempDidnt.push(val);
  document.getElementById('didnt-input').value = '';
  renderDidntList();
}

function removeDidnt(i) {
  tempDidnt.splice(i, 1);
  renderDidntList();
}

function renderDidntList() {
  document.getElementById('didnt-list').innerHTML = tempDidnt
	.map((d, i) => `<li>${d}<button type="button" onclick="removeDidnt(${i})">✕</button></li>`)
	.join('');
}

// Enter key shortcuts inside list inputs
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'worked-input')    { e.preventDefault(); addWorked(); }
  if (e.target.id === 'didnt-input')     { e.preventDefault(); addDidnt(); }
  if (e.target.id === 'mat-extra-input') { e.preventDefault(); addMaterial(); }
});

// =============================================================================
// FORM — save (create or update)
// =============================================================================

async function saveProto(e) {
  e.preventDefault();

  const id = editingId || genId();
  const proto = {
	id,
	name:        document.getElementById('f-name').value,
	category:    document.getElementById('f-category').value,
	date:        document.getElementById('f-date').value,
	iteration:   document.getElementById('f-iteration').value,
	time:        document.getElementById('f-time').value,
	difficulty:  document.getElementById('f-difficulty').value,
	cost:        document.getElementById('f-cost').value,
	verdict:     document.getElementById('f-verdict').value,
	price:       document.getElementById('f-price').value,
	verdictNote: document.getElementById('f-verdict-note').value,
	materials:   [...tempMaterials],
	worked:      [...tempWorked],
	didnt:       [...tempDidnt],
	createdAt:   editingId
	  ? (protos.find(x => x.id === editingId)?.createdAt || Date.now())
	  : Date.now(),
  };

  if (editingId) {
	protos = protos.map(x => x.id === editingId ? proto : x);
	render();
	await apiUpdate(editingId, proto);
  } else {
	protos.push(proto);
	render();
	await apiCreate(proto);
  }

  closeModal();
  render();
}

// =============================================================================
// DELETE
// =============================================================================

async function deleteProto(id) {
  if (!confirm('Remove this prototype from the journal?')) return;
  await apiDelete(id);
  protos = protos.filter(x => x.id !== id);
  render();
}

// =============================================================================
// FILTER & VIEW SWITCHING
// =============================================================================

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function setView(v, btn) {
  currentView = v;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('journal-view').style.display = v === 'journal' ? 'block' : 'none';
  document.getElementById('grid-view').style.display    = v === 'grid'    ? 'block' : 'none';
  render();
}

// =============================================================================
// EXPAND / COLLAPSE journal page body
// =============================================================================

function togglePage(id) {
  const body = document.getElementById('body-' + id);
  if (!body) return;

  const isOpening = !body.classList.contains('open');
  body.classList.toggle('open');

  if (isOpening) {
    setTimeout(() => {
      body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
  }
}

// =============================================================================
// RENDER HELPERS
// =============================================================================

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[parseInt(m) - 1]} ${y}`;
}

function buildPricingHTML(p) {
  if (!p.time && !p.cost && !p.price) return '';
  return `
	<div class="pricing-block" style="margin-top:0;">
	  ${p.cost  ? `<div class="pricing-row"><span class="plabel">Material Cost</span><span class="pval">${p.cost}</span></div>` : ''}
	  ${p.time  ? `<div class="pricing-row"><span class="plabel">Time</span><span class="pval">${p.time}h</span></div>` : ''}
	  ${p.price ? `<div class="pricing-row total"><span class="plabel">Suggested Retail</span><span class="pval">${p.price}</span></div>` : ''}
	</div>`;
}

function buildEmptyState() {
  return `
	<div class="empty-state">
	  <div class="empty-icon">◎</div>
	  <div class="empty-title">${protos.length === 0 ? 'No prototypes yet' : 'Nothing matches this filter'}</div>
	  <div class="empty-sub">${protos.length === 0 ? 'Press + New Prototype to begin the journal' : 'Try a different filter above'}</div>
	</div>`;
}

// =============================================================================
// RENDER — journal view
// =============================================================================

function renderJournal(filtered) {
  const wrap = document.getElementById('journal-pages');

  if (filtered.length === 0) { wrap.innerHTML = buildEmptyState(); return; }

  wrap.innerHTML = filtered.map((p, i) => {
	const vClass  = 'verdict-' + (p.verdict || 'wip');
	const vbClass = VERDICT_CLASSES[p.verdict] || 'vb-wip';
	const vLabel  = VERDICT_LABELS[p.verdict]  || 'In Progress';
	const pageNum = protos.findIndex(x => x.id === p.id) + 1;

	const matHTML    = (p.materials || []).map(m => `<span class="mat-tag ${m.primary ? 'primary' : ''}">${m.label}</span>`).join('');
	const workedHTML = (p.worked || []).map(w => `<li>${w}</li>`).join('');
	const didntHTML  = (p.didnt  || []).map(d => `<li>${d}</li>`).join('');

	return `
	  <div class="proto-page style="animation: fadeUp .4s ease both; animation-delay:${i * 0.05}s;" ${vClass}" id="page-${p.id}">
		<div class="page-header" onclick="togglePage('${p.id}')">
		  <div class="page-num">P${pageNum.toString().padStart(3, '0')}</div>
		  <div class="page-title-block">
			<div class="page-name">${p.name || 'Unnamed prototype'}</div>
			<div class="page-category">${p.category || ''}${p.iteration ? ' · ' + p.iteration : ''}${p.date ? ' · ' + fmtDate(p.date) : ''}</div>
		  </div>
		  <div class="page-time-block">
			<div class="page-time-num">${p.time || '—'}</div>
			<div class="page-time-label">hours</div>
		  </div>
		  <span class="verdict-badge ${vbClass}">${vLabel}</span>
		</div>

		<div class="page-body" id="body-${p.id}">
		  <div class="body-section">
			<div class="body-label">Materials Used</div>
			<div class="material-tags">${matHTML || '<span style="color:var(--muted);font-size:13px;font-style:italic;">None logged</span>'}</div>
			${workedHTML ? `<div class="body-label" style="margin-top:20px;">What Worked</div><ul class="worked-list">${workedHTML}</ul>` : ''}
			${didntHTML  ? `<div class="body-label" style="margin-top:20px;">What Didn't Work</div><ul class="didnt-list">${didntHTML}</ul>` : ''}
		  </div>

		  <div class="body-section">
			${p.difficulty ? `<div class="body-label">Difficulty</div><div class="body-text">${p.difficulty}</div>` : ''}
			${buildPricingHTML(p) ? `<div class="body-label" style="margin-top:${p.difficulty ? '20px' : '0'};">Pricing</div>${buildPricingHTML(p)}` : ''}
			${p.verdictNote ? `<div class="body-label" style="margin-top:20px;">Verdict Note</div><div class="verdict-note">${p.verdictNote}</div>` : ''}
		  </div>

		  <div class="page-actions">
			<button class="btn-sm btn-sm-edit"   onclick="openModal('${p.id}')">Edit</button>
			<button class="btn-sm btn-sm-delete" onclick="deleteProto('${p.id}')">Delete</button>
		  </div>
		</div>
	  </div>`;
  }).join('');
}

// =============================================================================
// RENDER — grid view
// =============================================================================

function renderGrid(filtered) {
  const wrap = document.getElementById('grid-pages');

  if (filtered.length === 0) { wrap.innerHTML = buildEmptyState(); return; }

  wrap.innerHTML = filtered.map(p => {
	const vClass  = 'verdict-' + (p.verdict || 'wip');
	const vbClass = VERDICT_CLASSES[p.verdict] || 'vb-wip';
	const vLabel  = VERDICT_LABELS[p.verdict]  || 'In Progress';
	const pageNum = protos.findIndex(x => x.id === p.id) + 1;
	const primary = (p.materials || []).find(m => m.primary);

	return `
	  <div class="grid-card ${vClass}" onclick="openModal('${p.id}')">
		<div class="gc-num">P${pageNum.toString().padStart(3, '0')}</div>
		<div class="gc-name">${p.name || 'Unnamed'}</div>
		<div class="gc-cat">${p.category || '—'}${p.iteration ? ' · ' + p.iteration : ''}</div>
		${primary ? `<div style="font-family:'Space Mono',monospace;font-size:8px;color:var(--accent);letter-spacing:.08em;text-transform:uppercase;margin-top:4px;">${primary.label}</div>` : ''}
		<div class="gc-meta">
		  <span class="gc-time">${p.time ? p.time + 'h' : '—'}</span>
		  <span class="gc-badge ${vbClass}">${vLabel}</span>
		</div>
	  </div>`;
  }).join('');
}

// =============================================================================
// RENDER — stats bar
// =============================================================================

function renderStats() {
  document.getElementById('total-count').textContent = protos.length;
  document.getElementById('stat-total').textContent  = protos.length;
  document.getElementById('stat-cut').textContent    = protos.filter(p => p.verdict === 'cut').length;
  document.getElementById('stat-maybe').textContent  = protos.filter(p => p.verdict === 'maybe').length;
  document.getElementById('stat-no').textContent     = protos.filter(p => p.verdict === 'no').length;
  document.getElementById('stat-wip').textContent    = protos.filter(p => p.verdict === 'wip').length;
}

// =============================================================================
// RENDER — main entry point
// =============================================================================

function render() {
  const filtered = currentFilter === 'all'
	? [...protos].reverse()
	: protos.filter(p => p.verdict === currentFilter).reverse();

  renderStats();
  renderJournal(filtered);
  renderGrid(filtered);
}

// =============================================================================
// INIT
// =============================================================================

loadAll();
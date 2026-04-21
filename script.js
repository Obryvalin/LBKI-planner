/**
 * LBKI Backlog Planner - Core Script (Fixed v2)
 * Исправления: статус в модалке, многоколоночный поиск, фильтр по ресурсу.
 */

// ==========================================
// 1. STATE MANAGEMENT (Immutable)
// ==========================================
const initialState = () => ({
  project: { name: 'Новый проект', description: '', startDate: '2026-01-01', endDate: '2026-12-31' },
  epics: [], features: [], resources: [], tasks: [], logs: [], nextId: 1
});

let state = initialState();

const updateState = (current, updates) => {
  console.log(`[STATE] Обновление: ${Object.keys(updates).join(', ')}`);
  addLog(`Обновление состояния: ${Object.keys(updates).join(', ')}`);
  return { ...current, ...updates };
};

// ==========================================
// 2. LOGGING SYSTEM
// ==========================================
const addLog = (message) => {
  const entry = { time: new Date().toLocaleTimeString(), message };
  state.logs = [...state.logs, entry];
  console.log(`[LOG ${entry.time}]`, message);
  renderLogs();
};

const renderLogs = () => {
  const container = document.getElementById('log-content');
  if (!container) return;
  container.innerHTML = state.logs.map(l => 
    `<div class="log-entry"><span class="log-time">${l.time}</span> ${l.message}</div>`
  ).join('');
  container.scrollTop = container.scrollHeight;
};

// ==========================================
// 3. UI & MODAL MANAGEMENT (FIXED STATUS)
// ==========================================
const openModal = (type, data = null) => {
  addLog(`Открыто модальное окно: ${type} ${data ? `(id: ${data.id})` : '(новый)'}`);
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = data ? `Редактировать ${type}` : `Создать ${type}`;
  document.getElementById('modal-form-container').innerHTML = generateFormHTML(type, data);
  overlay.classList.remove('hidden');
  
  document.getElementById('modal-save').onclick = () => saveModalData(type, data);
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
};

/**
 * Генерирует HTML форму. ИСПРАВЛЕНО: корректная обработка select options.
 */
const generateFormHTML = (type, data) => {
  const fields = {
    project: [
      { key: 'name', label: 'Название' },
      { key: 'description', label: 'Описание', type: 'textarea', full: true },
      { key: 'startDate', label: 'Дата начала', type: 'date' },
      { key: 'endDate', label: 'Дата окончания', type: 'date', full: true }
    ],
    epic: [
      { key: 'name', label: 'Наименование' },
      { key: 'priority', label: 'Приоритет (1-10)', type: 'number' },
      { key: 'description', label: 'Описание', type: 'textarea', full: true }
    ],
    feature: [
      { key: 'name', label: 'Наименование' },
      { key: 'epicId', label: 'Эпик', type: 'select', options: state.epics.map(e => ({v: e.id, t: e.name})) },
      { key: 'priority', label: 'Приоритет (1-10)', type: 'number' }
    ],
    resource: [
      { key: 'name', label: 'Наименование' },
      { key: 'capacity', label: 'Емкость (задач)', type: 'number', step: 1, min: 1 },
      { key: 'multiplier', label: 'Множитель длительности', type: 'number', step: 0.1, min: 0.1 }
    ],
    task: [
      { key: 'name', label: 'Наименование', full: true },
      { key: 'epicId', label: 'Эпик', type: 'select', options: state.epics.map(e => ({v: e.id, t: e.name})) },
      { key: 'featureId', label: 'Фича', type: 'select', options: state.features.map(f => ({v: f.id, t: f.name})) },
      { key: 'resourceId', label: 'Ресурс', type: 'select', options: state.resources.map(r => ({v: r.id, t: r.name})) },
      { key: 'duration', label: 'Длительность (дней)', type: 'number', min: 1 },
      { key: 'priority', label: 'Приоритет (1-10)', type: 'number', min: 1, max: 10 },
      { key: 'startNoEarlier', label: 'Начало не ранее', type: 'date' },
      { key: 'finishNoLater', label: 'Окончание не позднее', type: 'date' },
      { key: 'prerequisites', label: 'Пререквизиты (ID через запятую)', full: true },
      { key: 'status', label: 'Статус', type: 'select', options: [
        {v: 'new', t: 'Новая'}, {v: 'planned', t: 'Запланирована'},
        {v: 'in-progress', t: 'В работе'}, {v: 'done', t: 'Готово'}
      ]}
    ]
  };

  return (fields[type] || []).map(f => {
    const val = data ? (data[f.key] ?? '') : (f.type === 'number' ? 1 : '');
    const fullClass = f.full ? 'full' : '';
    let input = '';
    if (f.type === 'select') {
      const opts = (f.options || []).map(o => `<option value="${o.v}" ${String(val) === String(o.v) ? 'selected' : ''}>${o.t}</option>`).join('');
      input = `<select id="input-${f.key}">${opts}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="input-${f.key}">${val}</textarea>`;
    } else {
      input = `<input type="${f.type || 'text'}" id="input-${f.key}" value="${val}" ${f.step ? `step="${f.step}"` : ''} ${f.min ? `min="${f.min}"` : ''}>`;
    }
    return `<div class="form-group ${fullClass}"><label>${f.label}</label>${input}</div>`;
  }).join('');
};

const saveModalData = (type, oldData) => {
  const collect = () => {
    const res = oldData ? { ...oldData } : { id: state.nextId++ };
    const fieldKeys = type === 'project' ? ['name','description','startDate','endDate'] :
                      type === 'task' ? ['name','epicId','featureId','resourceId','duration','priority','startNoEarlier','finishNoLater','prerequisites','status'] :
                      type === 'resource' ? ['name','capacity','multiplier'] :
                      type === 'feature' ? ['name','epicId','priority'] : ['name','priority','description'];

    fieldKeys.forEach(k => {
      const el = document.getElementById(`input-${k}`);
      if (!el) return;
      let val = el.value;
      if (k.endsWith('Id')) val = val ? parseInt(val) : null;
      if (['duration','priority','capacity','multiplier'].includes(k)) val = parseFloat(val) || 0;
      res[k] = val;
    });
    if (type === 'task') res.prerequisites = res.prerequisites ? res.prerequisites.split(',').map(s=>parseInt(s.trim())).filter(Boolean) : [];
    return res;
  };

  const newData = collect();
  addLog(`💾 Сохранение ${type} ID: ${newData.id}`);
  
  let newState = { ...state };
  if (type === 'project') newState.project = newData;
  else {
    const key = type + 's';
    const arr = [...newState[key]];
    const idx = arr.findIndex(i => i.id === newData.id);
    if (idx >= 0) arr[idx] = newData; else arr.push(newData);
    newState[key] = arr;
  }
  state = updateState(state, newState);
  closeModal();
  renderTable();
};

const closeModal = () => document.getElementById('modal-overlay').classList.add('hidden');

// ==========================================
// 4. TABLE RENDERING (FIXED SEARCH & RESOURCE FILTER)
// ==========================================
const renderTable = () => {
  const tbody = document.getElementById('tasks-body');
  const filterText = document.getElementById('filter-search').value.toLowerCase().trim();
  const filterStatus = document.getElementById('filter-status').value;
  const filterResEl = document.getElementById('filter-resource');
  const filterResId = filterResEl.value;

  // Динамическое обновление списка ресурсов в фильтре
  const currentResOptions = Array.from(filterResEl.options).map(o => String(o.value));
  state.resources.forEach(r => {
    if (!currentResOptions.includes(String(r.id))) {
      const opt = document.createElement('option');
      opt.value = r.id; opt.textContent = r.name;
      filterResEl.appendChild(opt);
    }
  });

  // Pure filter function
  const matches = (task) => {
    if (filterStatus && task.status !== filterStatus) return false;
    if (filterResId && String(task.resourceId) !== filterResId) return false;
    if (filterText) {
      const epic = state.epics.find(e => e.id == task.epicId)?.name || '';
      const feat = state.features.find(f => f.id == task.featureId)?.name || '';
      const res = state.resources.find(r => r.id == task.resourceId)?.name || '';
      // Явный поиск по всем ключевым полям
      const searchable = [
        task.id, task.name, task.status, res, epic, feat, 
        task.priority, task.actualStartDate, task.actualEndDate, task.duration
      ].join(' ').toLowerCase();
      return searchable.includes(filterText);
    }
    return true;
  };

  let filtered = state.tasks.filter(matches);
  if (window.currentSort) {
    const { key, asc } = window.currentSort;
    filtered.sort((a, b) => {
      let va = a[key] ?? ''; let vb = b[key] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return asc ? va - vb : vb - va;
      return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  tbody.innerHTML = filtered.map(task => {
    const epic = state.epics.find(e => e.id == task.epicId)?.name || '-';
    const feat = state.features.find(f => f.id == task.featureId)?.name || '-';
    const res = state.resources.find(r => r.id == task.resourceId)?.name || '-';
    const cls = task.isViolated ? 'violation' : '';
    return `
      <tr class="${cls}">
        <td>${task.id}</td><td>${task.name}</td><td>${task.status}</td><td>${res}</td>
        <td>${task.duration}</td><td>${task.startNoEarlier || '-'}</td><td>${task.finishNoLater || '-'}</td>
        <td>${task.actualStartDate || '-'}</td><td>${task.actualEndDate || '-'}</td>
        <td>${epic}</td><td>${feat}</td><td>${task.priority}</td>
        <td><button class="btn small" onclick="openModal('task', state.tasks.find(t=>t.id===${task.id}))">✏️</button></td>
      </tr>`;
  }).join('') || '<tr><td colspan="13" style="text-align:center;padding:20px;">Нет задач</td></tr>';
};

// Event Listeners
document.getElementById('tasks-table').querySelector('thead').addEventListener('click', (e) => {
  if (e.target.tagName === 'TH' && e.target.dataset.sort) {
    window.currentSort = { key: e.target.dataset.sort, asc: window.currentSort?.key === e.target.dataset.sort ? !window.currentSort.asc : true };
    renderTable();
  }
});
['filter-search', 'filter-status', 'filter-resource'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderTable);
  document.getElementById(id).addEventListener('change', renderTable);
});

// ==========================================
// 5. PLANNING ENGINE
// ==========================================
const generatePlan = () => {
  addLog('🚀 Запуск планировщика Waterfall...');
  if (state.tasks.length === 0) { addLog('⚠️ Нет задач для планирования.'); return; }

  const sortedTasks = resolveTaskOrder(state.tasks, state.epics, state.features);
  let resourceCalendar = {};
  const projectStart = new Date(state.project.startDate);

  const plannedTasks = sortedTasks.map(task => {
    if (!task.resourceId) return { ...task, actualStartDate: '-', actualEndDate: '-', status: 'no_resource', isViolated: false };
    const res = state.resources.find(r => r.id == task.resourceId);
    if (!res) return { ...task, actualStartDate: '-', actualEndDate: '-', status: 'missing_resource', isViolated: false };

    const effDuration = Math.ceil((task.duration || 1) * (res.multiplier || 1));
    let candidate = new Date(task.startNoEarlier || projectStart);
    
    // Учет пререквизитов
    const prereqEnds = (task.prerequisites || [])
      .map(pid => state.tasks.find(t => t.id === pid)?.actualEndDate)
      .filter(Boolean).map(d => new Date(d));
    if (prereqEnds.length) {
      const latest = new Date(Math.max(...prereqEnds.map(d => d.getTime())));
      if (latest >= candidate) candidate = new Date(latest.getTime() + 86400000);
    }

    const finalStart = findAvailableSlot(resourceCalendar, task.resourceId, candidate, effDuration, res.capacity || 1);
    const finalEnd = new Date(finalStart.getTime() + (effDuration - 1) * 86400000);
    allocateResource(resourceCalendar, task.resourceId, finalStart, effDuration);

    const deadline = task.finishNoLater ? new Date(task.finishNoLater) : null;
    const isViolated = deadline && finalEnd > deadline;
    addLog(`✅ ${task.id}: ${formatDate(finalStart)} → ${formatDate(finalEnd)} ${isViolated ? '⚠️ СРЫВ' : ''}`);
    
    return {
      ...task, actualStartDate: formatDate(finalStart), actualEndDate: formatDate(finalEnd),
      status: isViolated ? 'risk' : (task.status === 'new' ? 'planned' : task.status), isViolated
    };
  });

  state = updateState(state, { tasks: plannedTasks });
  renderTable();
  addLog('🏁 Планирование завершено.');
};

const findAvailableSlot = (cal, resId, start, duration, capacity) => {
  let cur = new Date(start);
  for (let attempts = 0; attempts < 2000; attempts++) {
    let fits = true;
    for (let d = 0; d < duration; d++) {
      let check = new Date(cur.getTime() + d * 86400000);
      if ((cal[resId]?.[check.toISOString().split('T')[0]] || 0) >= capacity) { fits = false; break; }
    }
    if (fits) return cur;
    cur.setDate(cur.getDate() + 1);
  }
  return cur;
};

const allocateResource = (cal, resId, start, duration) => {
  if (!cal[resId]) cal[resId] = {};
  for (let d = 0; d < duration; d++) {
    let slot = new Date(start.getTime() + d * 86400000);
    let key = slot.toISOString().split('T')[0];
    cal[resId][key] = (cal[resId][key] || 0) + 1;
  }
};

const resolveTaskOrder = (tasks, epics, features) => {
  const getScore = t => (epics.find(e=>e.id==t.epicId)?.priority||5)*100 + (features.find(f=>f.id==t.featureId)?.priority||5)*10 + (t.priority||5);
  const inDeg = {}, adj = {};
  tasks.forEach(t => { inDeg[t.id] = 0; adj[t.id] = []; });
  tasks.forEach(t => (t.prerequisites||[]).forEach(p => { if(adj[p]) adj[p].push(t.id); inDeg[t.id]++; }));
  
  const q = tasks.filter(t => inDeg[t.id]===0).map(t=>t.id);
  const res = [];
  while(q.length) {
    q.sort((a,b) => getScore(tasks.find(t=>t.id==a)) - getScore(tasks.find(t=>t.id==b)));
    const u = q.shift(); res.push(u);
    adj[u].forEach(v => { if(--inDeg[v]===0) q.push(v); });
  }
  return res.map(id => tasks.find(t=>t.id===id));
};

const formatDate = d => d.toISOString().split('T')[0];

// ==========================================
// 6. SAVE / LOAD & INIT
// ==========================================
const saveJSON = () => {
  addLog('💾 Экспорт JSON...');
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `lbki-plan-${formatDate(new Date())}.json`; a.click();
};

const loadJSON = (file) => {
  if (!file) return;
  addLog('📂 Импорт JSON...');
  const reader = new FileReader();
  reader.onload = e => {
    try { state = {...initialState(), ...JSON.parse(e.target.result)}; addLog('✅ Загружено.'); renderTable(); }
    catch(err) { addLog('❌ Ошибка парсинга: ' + err.message); }
  };
  reader.readAsText(file);
};

// ==========================================
// 7. GANTT CHART ENGINE (Mermaid)
// ==========================================

/**
 * Санитизирует строку для безопасного использования в синтаксисе Mermaid.
 * Удаляет двоеточия, кавычки, переносы строк и обрезает до 50 символов.
 * @param {string} str - Исходная строка
 * @returns {string} Безопасная строка для Mermaid
 */
const sanitizeForMermaid = (str) => String(str || '').replace(/[:\n\r",']/g, ' ').substring(0, 50).trim();

/**
 * Генерирует синтаксис Mermaid Gantt на основе текущего плана и отрисовывает его.
 * Группирует задачи по эпикам, использует рассчитанные даты начала/окончания.
 * @returns {Promise<void>}
 */
const generateGanttChart = async () => {
  addLog('📊 Генерация диаграммы Ганта (Mermaid)...');
  
  const plannedTasks = state.tasks.filter(t => 
    t.actualStartDate && t.actualEndDate && t.actualStartDate !== '-' && t.actualEndDate !== '-'
  );

  if (plannedTasks.length === 0) {
    addLog('⚠️ Нет задач с рассчитанными датами. Сначала нажмите "Сформировать план".');
    return;
  }

  // Формируем валидный Mermaid Gantt синтаксис
  let syntax = `gantt\n`;
  syntax += `    title LBKI Project Roadmap\n`;
  syntax += `    dateFormat  YYYY-MM-DD\n`;
  syntax += `    axisFormat  %d.%m\n`;
  syntax += `    excludes    weekends\n`;

  // Группировка по эпикам для читаемости
  const epicGroups = {};
  plannedTasks.forEach(t => {
    const eId = t.epicId || 'none';
    if (!epicGroups[eId]) epicGroups[eId] = [];
    epicGroups[eId].push(t);
  });

  for (const [epicId, tasks] of Object.entries(epicGroups)) {
    const epicName = epicId === 'none' 
      ? 'Без эпика / Общие задачи' 
      : (state.epics.find(e => e.id == epicId)?.name || `Эпик ${epicId}`);
      
    syntax += `    section ${sanitizeForMermaid(epicName)}\n`;
    tasks.forEach(t => {
      syntax += `    ${sanitizeForMermaid(t.name)} :task_${t.id}, ${t.actualStartDate}, ${t.actualEndDate}\n`;
    });
  }

  addLog('✅ Mermaid-синтаксис сформирован. Запуск рендеринга...');
  const container = document.getElementById('gantt-output');
  const card = document.getElementById('gantt-card');
  card.classList.remove('hidden');
  container.innerHTML = '<p style="text-align:center; color:var(--text-light);">⏳ Рендеринг диаграммы...</p>';

  try {
    // Инициализация Mermaid при первом вызове
    if (!window._mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral' });
      window._mermaidInitialized = true;
    }

    // Уникальный ID для рендеринга
    const renderId = `gantt-render-${Date.now()}`;
    const { svg } = await mermaid.render(renderId, syntax);
    container.innerHTML = svg;
    addLog('🖼️ Диаграмма успешно отрисована.');
  } catch (err) {
    addLog(`❌ Ошибка рендеринга Mermaid: ${err.message}`);
    console.error('Mermaid render error:', err);
    container.innerHTML = `<div style="color:var(--danger); padding:10px;">Ошибка генерации. Проверьте консоль.</div>`;
  }
};

/**
 * Копирует текущий синтаксис Mermaid в буфер обмена.
 */
const copyMermaidSyntax = async () => {
  const output = document.getElementById('gantt-output');
  const rawText = state.tasks
    .filter(t => t.actualStartDate !== '-')
    .map(t => `${sanitizeForMermaid(t.name)} :task_${t.id}, ${t.actualStartDate}, ${t.actualEndDate}`)
    .join('\n');
    
  const fullSyntax = `gantt\ntitle LBKI Plan\ndateFormat YYYY-MM-DD\naxisFormat %d.%m\n${rawText}`;
  
  try {
    await navigator.clipboard.writeText(fullSyntax);
    addLog('📋 Mermaid-код скопирован в буфер обмена.');
  } catch (err) {
    addLog('⚠️ Не удалось скопировать в буфер.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  addLog('🟢 LBKI Planner v2 инициализирован.');
  document.getElementById('btn-add-task').onclick = () => openModal('task');
  document.getElementById('btn-add-epic').onclick = () => openModal('epic');
  document.getElementById('btn-add-feature').onclick = () => openModal('feature');
  document.getElementById('btn-add-resource').onclick = () => openModal('resource');
  document.getElementById('btn-project').onclick = () => openModal('project', state.project);
  document.getElementById('btn-generate').onclick = generatePlan;
  document.getElementById('btn-save').onclick = saveJSON;
  document.getElementById('btn-load').onclick = () => document.getElementById('file-input').click();
  document.getElementById('file-input').onchange = e => loadJSON(e.target.files[0]);
  document.getElementById('btn-clear-log').onclick = () => { state.logs = []; renderLogs(); };
  document.getElementById('btn-gantt').onclick = generateGanttChart;
  document.getElementById('btn-copy-mermaid').onclick = copyMermaidSyntax;
  document.getElementById('btn-close-gantt').onclick = () => {
    document.getElementById('gantt-card').classList.add('hidden');
    addLog('📊 Окно диаграммы Ганта скрыто.');
  }
  renderTable(); renderLogs();
});
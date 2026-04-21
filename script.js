/**
 * LBKI Backlog Planner - Core Script (v3)
 * Убран системный журнал, даты в ДД.ММ.ГГГГ в одну строку.
 * Все важные шаги логируются через console.log для отладки.
 */

// ==========================================
// 1. STATE MANAGEMENT (Immutable)
// ==========================================

/**
 * Инициализирует начальное состояние приложения.
 * @returns {Object} Чистое состояние приложения
 */
const initialState = () => ({
  project: { name: 'Новый проект', description: '', startDate: '2026-01-01', endDate: '2026-12-31' },
  epics: [],
  features: [],
  resources: [],
  tasks: [],
  nextId: 1
});

let state = initialState();

/**
 * Безопасное обновление состояния. Возвращает новый объект.
 * @param {Object} current - Текущее состояние
 * @param {Object} updates - Частичное обновление
 * @returns {Object} Новое состояние
 */
const updateState = (current, updates) => {
  console.log(`[STATE] Обновление: ${Object.keys(updates).join(', ')}`);
  return { ...current, ...updates };
};

// ==========================================
// 2. FORMATTING HELPERS
// ==========================================

/**
 * Форматирует дату из ISO (YYYY-MM-DD) в DD.MM.YYYY.
 * @param {string|null|undefined} dateStr - Строка даты
 * @returns {string} Отформатированная дата или "-"
 */
const formatDMY = (dateStr) => {
  if (!dateStr || dateStr === '-') return '-';
  const parts = String(dateStr).split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
};

// ==========================================
// 3. UI & MODAL MANAGEMENT
// ==========================================

/**
 * Управляет модальными окнами.
 * @param {string} type - Тип сущности ('task', 'epic', 'feature', 'resource', 'project')
 * @param {Object|null} data - Существующие данные или null для создания
 */
const openModal = (type, data = null) => {
  console.log(`[UI] Открыто модальное окно: ${type} ${data ? `(id: ${data.id})` : '(новый)'}`);
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const formContainer = document.getElementById('modal-form-container');
  
  overlay.classList.remove('hidden');
  title.textContent = data ? `Редактировать ${type}` : `Создать ${type}`;
  formContainer.innerHTML = generateFormHTML(type, data);
  
  document.getElementById('modal-save').onclick = () => saveModalData(type, data);
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
};

/**
 * Генерирует HTML форму для модального окна.
 * @param {string} type - Тип сущности
 * @param {Object|null} data - Данные для заполнения
 * @returns {string} HTML строка
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

/**
 * Сохраняет данные из модального окна в состояние.
 * @param {string} type - Тип сущности
 * @param {Object|null} oldData - Старые данные
 */
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
  console.log(`[STATE] Сохранение ${type} ID: ${newData.id}`);
  
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

/**
 * Закрывает модальное окно.
 */
const closeModal = () => document.getElementById('modal-overlay').classList.add('hidden');

// ==========================================
// 4. TABLE RENDERING (Dates DMY, 1 line)
// ==========================================

/**
 * Отрисовывает таблицу задач с учетом сортировки и фильтрации.
 */
const renderTable = () => {
  console.log('[RENDER] Перерисовка таблицы...');
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

  const matches = (task) => {
    if (filterStatus && task.status !== filterStatus) return false;
    if (filterResId && String(task.resourceId) !== filterResId) return false;
    if (filterText) {
      const epic = state.epics.find(e => e.id == task.epicId)?.name || '';
      const feat = state.features.find(f => f.id == task.featureId)?.name || '';
      const res = state.resources.find(r => r.id == task.resourceId)?.name || '';
      const searchable = `${task.id} ${task.name} ${task.status} ${res} ${epic} ${feat} ${task.priority}`.toLowerCase();
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
        <td>${task.id}</td>
        <td>${task.name}</td>
        <td>${task.status}</td>
        <td>${res}</td>
        <td>${task.duration}</td>
        <td>${formatDMY(task.startNoEarlier)}</td>
        <td>${formatDMY(task.finishNoLater)}</td>
        <td>${formatDMY(task.actualStartDate)}</td>
        <td>${formatDMY(task.actualEndDate)}</td>
        <td>${epic}</td>
        <td>${feat}</td>
        <td>${task.priority}</td>
        <td><button class="btn small" onclick="openModal('task', state.tasks.find(t=>t.id===${task.id}))">✏️</button></td>
      </tr>`;
  }).join('') || '<tr><td colspan="13" style="text-align:center;padding:20px;">Нет задач</td></tr>';
};

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

/**
 * Формирует Waterfall дорожную карту.
 */
const generatePlan = () => {
  console.log('[PLAN] 🚀 Запуск планировщика Waterfall...');
  if (state.tasks.length === 0) { console.warn('[PLAN] Нет задач.'); return; }

  const sortedTasks = resolveTaskOrder(state.tasks, state.epics, state.features);
  let resourceCalendar = {};
  const projectStart = new Date(state.project.startDate);

  const plannedTasks = sortedTasks.map(task => {
    if (!task.resourceId) return { ...task, actualStartDate: '-', actualEndDate: '-', status: 'no_resource', isViolated: false };
    const res = state.resources.find(r => r.id == task.resourceId);
    if (!res) return { ...task, actualStartDate: '-', actualEndDate: '-', status: 'missing_resource', isViolated: false };

    const effDuration = Math.ceil((task.duration || 1) * (res.multiplier || 1));
    let candidate = new Date(task.startNoEarlier || projectStart);
    
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
    console.log(`[PLAN] ✅ ${task.id}: ${formatDMY(finalStart)} → ${formatDMY(finalEnd)} ${isViolated ? '⚠️ СРЫВ' : ''}`);
    
    return {
      ...task, actualStartDate: finalStart.toISOString().split('T')[0], actualEndDate: finalEnd.toISOString().split('T')[0],
      status: isViolated ? 'risk' : (task.status === 'new' ? 'planned' : task.status), isViolated
    };
  });

  state = updateState(state, { tasks: plannedTasks });
  renderTable();
  console.log('[PLAN] 🏁 Планирование завершено.');
};

/**
 * Находит первый доступный временной слот для ресурса.
 */
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

/**
 * Выделяет дни в календаре ресурса.
 */
const allocateResource = (cal, resId, start, duration) => {
  if (!cal[resId]) cal[resId] = {};
  for (let d = 0; d < duration; d++) {
    let slot = new Date(start.getTime() + d * 86400000);
    let key = slot.toISOString().split('T')[0];
    cal[resId][key] = (cal[resId][key] || 0) + 1;
  }
};

/**
 * Сортирует задачи по зависимостям и composite priority.
 */
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
  console.log(`[PLAN] 📊 Отсортировано ${res.length} задач (топология + приоритет)`);
  return res.map(id => tasks.find(t=>t.id===id));
};

// ==========================================
// 6. GANTT CHART (Mermaid)
// ==========================================
const sanitizeForMermaid = (str) => String(str || '').replace(/[:\n\r",']/g, ' ').substring(0, 50).trim();

const generateGanttChart = async () => {
  console.log('[GANTT] 📊 Генерация диаграммы...');
  const plannedTasks = state.tasks.filter(t => t.actualStartDate && t.actualStartDate !== '-');
  if (plannedTasks.length === 0) { console.warn('[GANTT] Нет задач с датами.'); return; }

  let syntax = `gantt\n    title LBKI Roadmap\n    dateFormat YYYY-MM-DD\n    axisFormat %d.%m\n    excludes weekends\n`;
  const epicGroups = {};
  plannedTasks.forEach(t => {
    const eId = t.epicId || 'none';
    if (!epicGroups[eId]) epicGroups[eId] = [];
    epicGroups[eId].push(t);
  });

  for (const [epicId, tasks] of Object.entries(epicGroups)) {
    const name = epicId === 'none' ? 'Общие задачи' : (state.epics.find(e => e.id == epicId)?.name || `Эпик ${epicId}`);
    syntax += `    section ${sanitizeForMermaid(name)}\n`;
    tasks.forEach(t => syntax += `    ${sanitizeForMermaid(t.name)} :task_${t.id}, ${t.actualStartDate}, ${t.actualEndDate}\n`);
  }

  const container = document.getElementById('gantt-output');
  document.getElementById('gantt-card').classList.remove('hidden');
  container.innerHTML = '⏳ Рендеринг...';

  try {
    if (!window._mermaidInitialized) { mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral' }); window._mermaidInitialized = true; }
    const { svg } = await mermaid.render(`gantt-${Date.now()}`, syntax);
    container.innerHTML = svg;
    console.log('[GANTT] ✅ Диаграмма отрисована.');
  } catch (err) {
    console.error('[GANTT] ❌ Ошибка:', err);
    container.innerHTML = `<div style="color:red; padding:10px;">Ошибка рендеринга. Проверьте консоль.</div>`;
  }
};

const copyMermaidSyntax = async () => {
  const rawText = state.tasks.filter(t => t.actualStartDate !== '-').map(t => `${sanitizeForMermaid(t.name)} :task_${t.id}, ${t.actualStartDate}, ${t.actualEndDate}`).join('\n');
  const fullSyntax = `gantt\ntitle LBKI Plan\ndateFormat YYYY-MM-DD\naxisFormat %d.%m\n${rawText}`;
  try {
    await navigator.clipboard.writeText(fullSyntax);
    console.log('[GANTT] 📋 Код скопирован.');
  } catch (err) { console.error('[GANTT] ⚠️ Буфер недоступен'); }
};

// ==========================================
// 7. SAVE / LOAD & INIT
// ==========================================
const saveJSON = () => {
  console.log('[IO] 💾 Экспорт JSON...');
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `lbki-plan-${new Date().toISOString().split('T')[0]}.json`; a.click();
};

const loadJSON = (file) => {
  if (!file) return;
  console.log('[IO] 📂 Импорт JSON...');
  const reader = new FileReader();
  reader.onload = e => {
    try { state = {...initialState(), ...JSON.parse(e.target.result)}; console.log('[IO] ✅ Загружено.'); renderTable(); }
    catch(err) { console.error('[IO] ❌ Ошибка парсинга:', err); }
  };
  reader.readAsText(file);
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('[INIT] 🟢 LBKI Planner v3 запущен.');
  document.getElementById('btn-add-task').onclick = () => openModal('task');
  document.getElementById('btn-add-epic').onclick = () => openModal('epic');
  document.getElementById('btn-add-feature').onclick = () => openModal('feature');
  document.getElementById('btn-add-resource').onclick = () => openModal('resource');
  document.getElementById('btn-project').onclick = () => openModal('project', state.project);
  document.getElementById('btn-generate').onclick = generatePlan;
  document.getElementById('btn-gantt').onclick = generateGanttChart;
  document.getElementById('btn-copy-mermaid').onclick = copyMermaidSyntax;
  document.getElementById('btn-close-gantt').onclick = () => document.getElementById('gantt-card').classList.add('hidden');
  document.getElementById('btn-save').onclick = saveJSON;
  document.getElementById('btn-load').onclick = () => document.getElementById('file-input').click();
  document.getElementById('file-input').onchange = e => loadJSON(e.target.files[0]);
  renderTable();
});
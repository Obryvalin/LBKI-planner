/**
 * LBKI Backlog Planner - Core Script (v4)
 * Добавлен менеджер сущностей (Эпики/Фичи/Ресурсы) с возможностью редактирования и создания.
 * Даты в формате ДД.ММ.ГГГГ. Системный журнал удалён.
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
  epics: [], features: [], resources: [], tasks: [], nextId: 1
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
  const newState = { ...current, ...updates };
  saveToLocalStorage(); // Автосохранение при любом изменении
  return newState;
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
// 2.1 DATE & WEEKEND HELPERS
// ==========================================

/**
 * Проверяет, является ли дата выходным (Сб или Вс).
 * @param {Date} date - Объект даты
 * @returns {boolean} true, если выходной
 */
const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/**
 * Возвращает массив рабочих дат, начиная с startDate, длительностью duration дней.
 * Пропускает субботу и воскресенье.
 * @param {Date} startDate - Дата начала
 * @param {number} duration - Количество рабочих дней
 * @returns {Date[]} Массив рабочих дат
 */
const getWorkingDates = (startDate, duration) => {
  const dates = [];
  let current = new Date(startDate);
  while (dates.length < duration) {
    if (!isWeekend(current)) dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Сдвигает дату на следующий рабочий день.
 * @param {Date} date - Исходная дата
 * @returns {Date} Следующий рабочий день
 */
const advanceToNextWorkingDay = (date) => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (isWeekend(next)) next.setDate(next.getDate() + 1);
  return next;
};

// ==========================================
// 2.2 LOCAL STORAGE & SESSION PROTECTION
// ==========================================
const STORAGE_KEY = 'lbki-backup-v4';

/**
 * Сохраняет текущее состояние в localStorage.
 * @returns {void}
 */
const saveToLocalStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[STORAGE] ✅ Автосохранение выполнено');
  } catch (e) {
    console.error('[STORAGE] ❌ Ошибка localStorage:', e);
  }
};

/**
 * Загружает состояние из localStorage.
 * @returns {Object|null} Восстановленное состояние или null
 */
const loadFromLocalStorage = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('[STORAGE] ❌ Ошибка парсинга localStorage:', e);
    return null;
  }
};

/**
 * Очищает резервную копию из localStorage.
 * @returns {void}
 */
const clearLocalStorage = () => {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[STORAGE] 🗑️ Резервная копия очищена');
};

// ==========================================
// 3. MODAL MANAGEMENT & ENTITY MANAGER
// ==========================================

/**
 * Открывает менеджер сущности (список с возможностью редактирования/создания).
 * @param {string} type - Тип сущности ('epic', 'feature', 'resource')
 */
const openManagerModal = (type) => {
  console.log(`[MANAGER] Открыт менеджер: ${type}`);
  const overlay = document.getElementById('modal-overlay');
  const collectionKey = type + 's';
  const items = state[collectionKey] || [];
  
  document.getElementById('modal-title').textContent = `Управление: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  
  let listHtml = `<div class="manager-list">`;
  if (items.length === 0) {
    listHtml += `<p class="empty-msg">Созданные элементы отсутствуют. Нажмите кнопку ниже, чтобы добавить первый.</p>`;
  } else {
    items.forEach(item => {
      let meta = '';
      if (type === 'epic') meta = `Приоритет: ${item.priority || '-'}`;
      if (type === 'feature') meta = `Эпик: ${state.epics.find(e => e.id == item.epicId)?.name || '-'} | Приоритет: ${item.priority || '-'}`;
      if (type === 'resource') meta = `Емкость: ${item.capacity || 1} | Множитель: ${item.multiplier || 1}`;
      
      listHtml += `
        <div class="manager-item">
          <div class="item-info">
            <span class="item-name">${item.name}</span>
            <span class="item-meta">${meta}</span>
          </div>
          <div class="item-actions">
            <button class="btn small btn-edit" data-id="${item.id}">✏️ Изменить</button>
            <button class="btn small btn-delete" data-id="${item.id}">🗑️</button>
          </div>
        </div>`;
    });
  }
  listHtml += `</div>
    <button id="btn-add-new-${type}" class="btn primary" style="margin-top:15px;">➕ Создать новый</button>`;

  document.getElementById('modal-form-container').innerHTML = listHtml;
  overlay.classList.remove('hidden');

  // Привязка событий
  document.getElementById(`btn-add-new-${type}`).onclick = () => {
    closeModal();
    openModal(type, null);
  };

  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.dataset.id);
      const item = items.find(i => i.id === id);
      closeModal();
      setTimeout(() => openModal(type, item), 50);
    };
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.dataset.id);
      console.log(`[MANAGER] Удаление ${type} ID: ${id}`);
      let newState = { ...state };
      newState[collectionKey] = newState[collectionKey].filter(i => i.id !== id);
      state = updateState(state, newState);
      renderTable();
      openManagerModal(type); // Перерисовка менеджера
    };
  });
  
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
};

/**
 * Открывает модальное окно формы для создания/редактирования.
 * @param {string} type - Тип сущности
 * @param {Object|null} data - Данные или null для создания
 */
const openModal = (type, data = null) => {
  console.log(`[UI] Открыта форма: ${type} ${data ? `(id: ${data.id})` : '(новый)'}`);
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
 */
const generateFormHTML = (type, data) => {
  const fields = {
    project: [
      { key: 'name', label: 'Название' }, { key: 'description', label: 'Описание', type: 'textarea', full: true },
      { key: 'startDate', label: 'Дата начала', type: 'date' }, { key: 'endDate', label: 'Дата окончания', type: 'date', full: true }
    ],
    epic: [
      { key: 'name', label: 'Наименование' }, { key: 'priority', label: 'Приоритет (1-10)', type: 'number' },
      { key: 'description', label: 'Описание', type: 'textarea', full: true }
    ],
    feature: [
      { key: 'name', label: 'Наименование' }, { key: 'epicId', label: 'Эпик', type: 'select', options: state.epics.map(e => ({v: e.id, t: e.name})) },
      { key: 'priority', label: 'Приоритет (1-10)', type: 'number' }
    ],
    resource: [
      { key: 'name', label: 'Наименование' }, { key: 'capacity', label: 'Емкость (задач)', type: 'number', step: 1, min: 1 },
      { key: 'multiplier', label: 'Множитель длительности', type: 'number', step: 0.1, min: 0.1 }
    ],
    task: [
      { key: 'name', label: 'Наименование', full: true }, { key: 'epicId', label: 'Эпик', type: 'select', options: state.epics.map(e => ({v: e.id, t: e.name})) },
      { key: 'featureId', label: 'Фича', type: 'select', options: state.features.map(f => ({v: f.id, t: f.name})) }, { key: 'resourceId', label: 'Ресурс', type: 'select', options: state.resources.map(r => ({v: r.id, t: r.name})) },
      { key: 'duration', label: 'Длительность (дней)', type: 'number', min: 1 }, { key: 'priority', label: 'Приоритет (1-10)', type: 'number', min: 1, max: 10 },
      { key: 'startNoEarlier', label: 'Начало не ранее', type: 'date' }, { key: 'finishNoLater', label: 'Окончание не позднее', type: 'date' },
      { key: 'prerequisites', label: 'Пререквизиты (ID через запятую)', full: true }, { key: 'status', label: 'Статус', type: 'select', options: [
        {v: 'new', t: 'Новая'}, {v: 'planned', t: 'Запланирована'}, {v: 'in-progress', t: 'В работе'}, {v: 'done', t: 'Готово'}
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
 * Сохраняет данные из модального окна.
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
// 4. TABLE RENDERING
// ==========================================
/**
 * Отрисовывает таблицу задач без кнопки действий. Названия задач кликабельны.
 */
const renderTable = () => {
  console.log('[RENDER] Перерисовка таблицы...');
  const tbody = document.getElementById('tasks-body');
  const filterText = document.getElementById('filter-search').value.toLowerCase().trim();
  const filterStatus = document.getElementById('filter-status').value;
  const filterResEl = document.getElementById('filter-resource');
  const filterResId = filterResEl.value;

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
        <td class="task-name-cell" data-task-id="${task.id}">${task.name}</td>
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
      </tr>`;
  }).join('') || '<tr><td colspan="12" style="text-align:center;padding:20px;">Нет задач</td></tr>';
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
// 5. PLANNING ENGINE (Weekend-Aware)
// ==========================================

/**
 * Формирует Waterfall дорожную карту с учётом рабочих дней (Пн-Пт).
 */
const generatePlan = () => {
  console.log('[PLAN] 🚀 Запуск планировщика (рабочие дни Пн-Пт)...');
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
    
    // Если startNoEarlier выпадает на выходной, сдвигаем на понедельник
    while (isWeekend(candidate)) candidate.setDate(candidate.getDate() + 1);
    
    const prereqEnds = (task.prerequisites || [])
      .map(pid => state.tasks.find(t => t.id === pid)?.actualEndDate)
      .filter(Boolean).map(d => new Date(d));
      
    if (prereqEnds.length) {
      const latest = new Date(Math.max(...prereqEnds.map(d => d.getTime())));
      const nextAvail = advanceToNextWorkingDay(latest);
      if (nextAvail > candidate) {
        console.log(`[PLAN] 📅 Задача ${task.id}: сдвиг на ${formatDMY(nextAvail)} из-за пререквизитов (пропуск выходных)`);
        candidate = nextAvail;
      }
    }

    const finalStart = findAvailableSlot(resourceCalendar, task.resourceId, candidate, effDuration, res.capacity || 1);
    const workingDays = getWorkingDates(finalStart, effDuration);
    const finalEnd = workingDays[workingDays.length - 1];
    
    allocateResource(resourceCalendar, task.resourceId, finalStart, effDuration);

    const deadline = task.finishNoLater ? new Date(task.finishNoLater) : null;
    const isViolated = deadline && finalEnd > deadline;
    console.log(`[PLAN] ✅ ${task.id}: ${formatDMY(finalStart)} → ${formatDMY(finalEnd)} (${effDuration} р.д.) ${isViolated ? '⚠️ СРЫВ' : ''}`);
    
    return {
      ...task, 
      actualStartDate: finalStart.toISOString().split('T')[0], 
      actualEndDate: finalEnd.toISOString().split('T')[0],
      status: isViolated ? 'risk' : (task.status === 'new' ? 'planned' : task.status), 
      isViolated
    };
  });

  state = updateState(state, { tasks: plannedTasks });
  renderTable();
  console.log('[PLAN] 🏁 Планирование завершено.');
};

/**
 * Находит первый доступный временной слот для ресурса (только рабочие дни).
 */
const findAvailableSlot = (cal, resId, start, duration, capacity) => {
  let cur = new Date(start);
  // Гарантируем, что поиск начинается с рабочего дня
  while (isWeekend(cur)) cur.setDate(cur.getDate() + 1);

  for (let attempts = 0; attempts < 3000; attempts++) {
    const checkDates = getWorkingDates(cur, duration);
    const fits = checkDates.every(d => (cal[resId]?.[d.toISOString().split('T')[0]] || 0) < capacity);
    if (fits) return cur;
    // Сдвигаем на следующий рабочий день
    do { cur.setDate(cur.getDate() + 1); } while (isWeekend(cur));
  }
  console.warn(`[PLAN] ⚠️ Ресурс ${resId} перегружен, задача назначена на ${formatDMY(cur)}`);
  return cur;
};

/**
 * Выделяет дни в календаре ресурса (только рабочие дни).
 */
const allocateResource = (cal, resId, start, duration) => {
  if (!cal[resId]) cal[resId] = {};
  const dates = getWorkingDates(start, duration);
  dates.forEach(d => {
    const key = d.toISOString().split('T')[0];
    cal[resId][key] = (cal[resId][key] || 0) + 1;
  });
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
  console.log(`[PLAN] 📊 Отсортировано ${res.length} задач`);
  return res.map(id => tasks.find(t=>t.id===id));
};

// ==========================================
// 6. GANTT CHART
// ==========================================
const sanitizeForMermaid = (str) => String(str || '').replace(/[:\n\r",']/g, ' ').substring(0, 50).trim();

/**
 * Генерирует диаграмму Ганта с иерархией (Эпик/Фича) и цветовым кодированием статусов.
 * @returns {Promise<void>}
 */
const generateGanttChart = async () => {
  console.log('[GANTT] 📊 Генерация диаграммы (Epic+Feature, Status)...');
  const plannedTasks = state.tasks.filter(t => t.actualStartDate && t.actualStartDate !== '-');
  if (plannedTasks.length === 0) { console.warn('[GANTT] Нет задач с датами.'); return; }

  let syntax = `gantt\n    title LBKI Roadmap\n    dateFormat YYYY-MM-DD\n    axisFormat %d.%m\n    excludes weekends\n`;

  // 1. Группировка по Эпикам
  const epicGroups = {};
  plannedTasks.forEach(t => {
      const eId = t.epicId || 'none';
      if (!epicGroups[eId]) epicGroups[eId] = [];
      epicGroups[eId].push(t);
  });

  // 2. Итерация по Эпикам и вложенная группировка по Фичам
  for (const [epicId, tasks] of Object.entries(epicGroups)) {
      const featureGroups = {};
      tasks.forEach(t => {
          const fId = t.featureId || 'none';
          if (!featureGroups[fId]) featureGroups[fId] = [];
          featureGroups[fId].push(t);
      });

      for (const [featureId, featTasks] of Object.entries(featureGroups)) {
          // Формируем имя секции: "Эпик / Фича"
          const epicName = epicId === 'none' ? 'Без Эпика' : (state.epics.find(e => e.id == epicId)?.name || 'Unknown Epic');
          const featName = featureId === 'none' ? 'Общие задачи' : (state.features.find(f => f.id == featureId)?.name || 'Unknown Feature');
          const sectionTitle = `${epicName} / ${featName}`;
          
          syntax += `    section ${sanitizeForMermaid(sectionTitle)}\n`;

          featTasks.forEach(t => {
              // Определяем модификаторы статуса
              // :crit - красный (срыв сроков)
              // :done - серый (завершено)
              // :active - синий (в работе)
              let mods = [];
              
              if (t.isViolated) mods.push('crit');
              if (t.status === 'done') mods.push('done');
              else if (t.status === 'in-progress') mods.push('active');
              
              // Формируем строку модификаторов (e.g., "crit,active,")
              const modStr = mods.length > 0 ? mods.join(',') + ',' : '';
              
              // Синтаксис: Задача :modifiers,id,start,end
              syntax += `    ${sanitizeForMermaid(t.name)} :${modStr}task_${t.id}, ${t.actualStartDate}, ${t.actualEndDate}\n`;
          });
      }
  }

  // Отрисовка
  document.getElementById('gantt-card').classList.remove('hidden');
  document.getElementById('gantt-output').innerHTML = '⏳ Рендеринг...';
  try {
    if (!window._mermaidInitialized) { mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral' }); window._mermaidInitialized = true; }
    const { svg } = await mermaid.render(`gantt-${Date.now()}`, syntax);
    document.getElementById('gantt-output').innerHTML = svg;
    console.log('[GANTT] ✅ Отрисовано.');
  } catch (err) {
    console.error('[GANTT] ❌ Ошибка:', err);
    document.getElementById('gantt-output').innerHTML = `<div style="color:red; padding:10px;">Ошибка рендеринга. Проверьте консоль.</div>`;
  }
};

const copyMermaidSyntax = async () => {
  // Простая генерация с модификаторами для копирования
  const rawText = state.tasks
    .filter(t => t.actualStartDate !== '-')
    .map(t => {
        let mods = [];
        if (t.isViolated) mods.push('crit');
        if (t.status === 'done') mods.push('done');
        else if (t.status === 'in-progress') mods.push('active');
        const modStr = mods.length > 0 ? mods.join(',') + ',' : '';
        return `${sanitizeForMermaid(t.name)} :${modStr}task_${t.id}, ${t.actualStartDate}, ${t.actualEndDate}`;
    })
    .join('\n');
    
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

// ==========================================
// 8. DEPENDENCY FLOWCHART (Mermaid)
// ==========================================

/**
 * Строит чистый Mermaid-синтаксис для блок-схемы зависимостей.
 * @param {Array} tasks - Массив задач из состояния
 * @returns {string} Готовый синтаксис flowchart
 */
const buildDepsSyntax = (tasks) => {
    let syntax = `flowchart TD\n`;
    // Классы для стилизации узлов согласно UI-палитре
    syntax += `    classDef default fill:#f5f7fa,stroke:#e1e5eb,stroke-width:2px,color:#2d3748;\n`;
    syntax += `    classDef crit fill:#ffeaea,stroke:#e74c3c,stroke-width:2px,color:#c0392b;\n`;
    syntax += `    classDef done fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#155724;\n`;
    syntax += `    classDef active fill:#cce5ff,stroke:#007bff,stroke-width:2px,color:#004085;\n\n`;

    // Объявляем все узлы с применением классов статуса
    tasks.forEach(t => {
        let cls = 'default';
        if (t.isViolated) cls = 'crit';
        else if (t.status === 'done') cls = 'done';
        else if (t.status === 'in-progress') cls = 'active';
        syntax += `    task_${t.id}["${sanitizeForMermaid(t.name)}"]:::${cls}\n`;
    });

    syntax += `\n`;
    // Рисуем стрелки зависимостей
    tasks.forEach(t => {
        (t.prerequisites || []).forEach(pid => {
            syntax += `    task_${pid} --> task_${t.id}\n`;
        });
    });
    return syntax;
};

/**
 * Генерирует и отрисовывает блок-схему зависимостей задач.
 * @returns {Promise<void>}
 */
const generateDependencyGraph = async () => {
    console.log('[DEPS] 🕸️ Генерация схемы зависимостей...');
    const tasks = state.tasks;
    
    if (tasks.length === 0 || !tasks.some(t => (t.prerequisites || []).length > 0)) {
        console.warn('[DEPS] Нет задач с пререквизитами для построения схемы.');
        alert('Нет зависимостей между задачами. Укажите пререквизиты в редакторе задач.');
        return;
    }

    const syntax = buildDepsSyntax(tasks);
    console.log('[DEPS] Синтаксис сформирован. Запуск рендеринга...');

    const container = document.getElementById('deps-card');
    const output = document.getElementById('deps-output');
    container.classList.remove('hidden');
    output.innerHTML = '<p style="text-align:center; color:var(--text-light);">⏳ Рендеринг графа...</p>';

    try {
        if (!window._mermaidInitialized) {
            mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral' });
            window._mermaidInitialized = true;
        }

        const renderId = `deps-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, syntax);
        output.innerHTML = svg;
        console.log('[DEPS] ✅ Блок-схема успешно отрисована.');
    } catch (err) {
        console.error('[DEPS] ❌ Ошибка рендеринга Mermaid:', err.message);
        output.innerHTML = `<div style="color:var(--text-light); padding:10px; text-align:center;">⚠️ Ошибка визуализации. Проверьте консоль (F12).</div>`;
    }
};

/**
 * Копирует сырой Mermaid-код схемы зависимостей в буфер обмена.
 */
const copyDependencySyntax = async () => {
    const syntax = buildDepsSyntax(state.tasks);
    try {
        await navigator.clipboard.writeText(syntax);
        console.log('[DEPS] 📋 Код схемы скопирован в буфер.');
    } catch (err) {
        console.error('[DEPS] ⚠️ Не удалось скопировать в буфер:', err);
    }
};


// ========================================================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[INIT] 🟢 LBKI Planner v5 запущен.');

  // 🔹 Восстановление сессии из localStorage
  const saved = loadFromLocalStorage();
  const hasData = saved && (saved.tasks.length > 0 || saved.epics.length > 0 || saved.resources.length > 0);
  
  if (hasData) {
    if (confirm('💾 Найдена сохранённая сессия. Восстановить предыдущие данные?')) {
      state = { ...initialState(), ...saved };
      console.log('[INIT] 📥 Данные успешно восстановлены из localStorage.');
    } else {
      clearLocalStorage();
      console.log('[INIT] 🗑️ Пользователь отклонил восстановление. Начинаем с чистого листа.');
    }
  }

  // 🔹 Привязка кнопок (менеджеры, задачи, проект)
  document.getElementById('btn-manage-epic').onclick = () => openManagerModal('epic');
  document.getElementById('btn-manage-feature').onclick = () => openManagerModal('feature');
  document.getElementById('btn-manage-resource').onclick = () => openManagerModal('resource');
  document.getElementById('btn-add-task').onclick = () => openModal('task');
  document.getElementById('btn-project').onclick = () => openModal('project', state.project);

  // 🔹 План, экспорт и Gantt
  document.getElementById('btn-generate').onclick = generatePlan;
  document.getElementById('btn-gantt').onclick = generateGanttChart;
  document.getElementById('btn-copy-mermaid').onclick = copyMermaidSyntax;
  document.getElementById('btn-deps-graph').onclick = generateDependencyGraph;
  document.getElementById('btn-copy-deps').onclick = copyDependencySyntax;
  document.getElementById('btn-close-gantt').onclick = () => document.getElementById('gantt-card').classList.add('hidden');
    document.getElementById('btn-close-deps').onclick = () => document.getElementById('deps-card').classList.add('hidden');
  
  document.getElementById('btn-save').onclick = saveJSON;
  document.getElementById('btn-load').onclick = () => document.getElementById('file-input').click();
  document.getElementById('file-input').onchange = e => loadJSON(e.target.files[0]);

  

  // 🔹 Делегирование кликов по задачам
  document.getElementById('tasks-body').addEventListener('click', (e) => {
    const cell = e.target.closest('.task-name-cell');
    if (!cell) return;
    const taskId = parseInt(cell.dataset.taskId);
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
      console.log(`[UI] Клик по задаче ID: ${taskId}. Открытие редактора.`);
      openModal('task', task);
    }
  });

  // 🔹 Защита от случайного закрытия/обновления страницы
  window.addEventListener('beforeunload', (e) => {
    // Данные уже сохранены в localStorage, но браузер покажет стандартное предупреждение
    // Это даёт пользователю секунду на отмену действия
    e.preventDefault();
    e.returnValue = ''; 
    console.log('[PAGE] ⚠️ Сработало событие beforeunload. Данные сохранены.');
  });

  // Первичная отрисовка
  renderTable();
});
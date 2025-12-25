
// ====== DOM ELEMENTS ======
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const dueDateInput = document.getElementById("dueDate");
const categoryInput = document.getElementById("categoryInput");
const recurrenceSelect = document.getElementById("recurrenceSelect");

const taskList = document.getElementById("taskList");

const filterStatus = document.getElementById("filterStatus");
const filterPriority = document.getElementById("filterPriority");
const filterCategory = document.getElementById("filterCategory");
const searchInput = document.getElementById("searchInput");

const sortBy = document.getElementById("sortBy");

const selectAll = document.getElementById("selectAll");
const bulkCompleteBtn = document.getElementById("bulkCompleteBtn");
const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
const clearCompletedBtn = document.getElementById("clearCompletedBtn");

const darkModeToggle = document.getElementById("darkModeToggle");
const pendingCount = document.getElementById("pendingCount");
const completedCount = document.getElementById("completedCount");
const themeIcon = document.getElementById('themeIcon');
const themeText = document.getElementById('themeText');
// auth UI
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const authForm = document.getElementById('authForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const authTitle = document.getElementById('authTitle');
const closeAuth = document.getElementById('closeAuth');
const currentUserDisplay = document.getElementById('currentUser');
// calendar UI
const toggleCalendarBtn = document.getElementById('toggleCalendarBtn');
const calendarContainer = document.getElementById('calendarContainer');
// reset/change password elements
const sendResetBtn = document.getElementById('sendResetBtn');
const resetArea = document.getElementById('resetArea');
const resetCodeInput = document.getElementById('resetCodeInput');
const resetNewPassword = document.getElementById('resetNewPassword');
const resetConfirmPassword = document.getElementById('resetConfirmPassword');
const resetSubmit = document.getElementById('resetSubmit');




// ====== DATA ======
let currentUser = localStorage.getItem('currentUser') || null;
let tasks = [];

function getTasksKey(user) {
  return `tasks_${user}`;
}

function getUsers() {
  return JSON.parse(localStorage.getItem('users')) || [];
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

// Hash password with SHA-256 and return hex string
async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = enc.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

function setCurrentUser(username) {
  currentUser = username;
  if (username) localStorage.setItem('currentUser', username);
  else localStorage.removeItem('currentUser');
  updateAuthUI();
  loadTasks();
}

function updateAuthUI() {
  if (!currentUser) {
    currentUserDisplay.textContent = '—';
    logoutBtn.style.display = 'none';
    loginBtn.style.display = '';
  } else {
    currentUserDisplay.textContent = currentUser;
    logoutBtn.style.display = '';
    loginBtn.style.display = 'none';
  }
}

function openAuthModal(mode = 'login') {
  authModal.classList.add('open');
  authTitle.textContent = mode === 'login' ? 'Login' : 'Signup';
  const radio = document.querySelector(`input[name="authMode"][value="${mode}"]`);
  if (radio) radio.checked = true;
  usernameInput.focus();
  // hide reset area initially
  if (resetArea) resetArea.style.display = 'none';
}

function closeAuthModal() {
  authModal.classList.remove('open');
  authForm.reset();
}

function migrateLegacyTasks() {
  // If there are tasks in the old 'tasks' key and no users, prompt to migrate them to a guest account
  const legacy = JSON.parse(localStorage.getItem('tasks')) || [];
  const users = getUsers();
  if (legacy.length && users.length === 0) {
    const migrate = confirm('Found existing tasks saved before accounts were enabled. Move them into a local "guest" account? Click Cancel to keep them in place.');
    if (migrate) {
      const guest = 'guest';
      saveUsers([{ username: guest, passwordHash: '' }]);
      localStorage.setItem(getTasksKey(guest), JSON.stringify(legacy));
      localStorage.removeItem('tasks');
      setCurrentUser(guest);
    }
  }
}

// ====== SAVE & LOAD ======
function saveTasks() {
  if (!currentUser) return;
  localStorage.setItem(getTasksKey(currentUser), JSON.stringify(tasks));
}

function loadTasks() {
  taskList.innerHTML = "";
  if (!currentUser) {
    updateCounts();
    return;
  }
  const raw = JSON.parse(localStorage.getItem(getTasksKey(currentUser)) || '[]');
  tasks = Array.isArray(raw) ? raw : [];
  getFilteredTasks().forEach(renderTask);
  updateCounts(); // ✅ Count update
  // update calendar view if present
  if (typeof renderCalendar === 'function' && calendarContainer) renderCalendar();
}


// ====== ADD TASK ======
taskForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const task = {
    id: Date.now(),
    text: taskInput.value,
    priority: prioritySelect.value,
    dueDate: dueDateInput.value,
    category: categoryInput.value,
    recurrence: recurrenceSelect.value,
    completed: false,
    createdAt: new Date().toISOString()
  };

  tasks.push(task);
  saveTasks();
  loadTasks();
  taskForm.reset();
});

// ====== RENDER TASK ======
function renderTask(task) {
  const li = document.createElement("li");

  li.innerHTML = `
    <label>
      <input type="checkbox" class="selectTask" data-id="${task.id}">
      <span class="task-text ${task.completed ? "done" : ""}">
        ${task.text}
      </span>
    </label>
    <div class="meta">
      <small>${task.priority}</small>
      <small>${task.dueDate || ""}</small>
      <small>${task.category || ""}</small>
    </div>
    <div class="actions">
      <button onclick="toggleComplete(${task.id})">✔</button>
      <button onclick="startEdit(${task.id})">✎</button>
      <button onclick="deleteTask(${task.id})">🗑</button>
    </div>
  `;

  li.dataset.id = task.id;
  taskList.appendChild(li);
}

// ====== INLINE EDIT ======
function startEdit(id) {
  const li = taskList.querySelector(`li[data-id="${id}"]`);
  if (!li) return;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  // Build inline edit form with fields for text, dueDate, priority, category, recurrence
  li.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'task-card';

  const main = document.createElement('div');
  main.className = 'task-main';

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'edit-input';
  textInput.value = task.text;

  const row = document.createElement('div');
  row.className = 'form-row';

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = task.dueDate || '';

  const prioritySel = document.createElement('select');
  ['Low','Medium','High'].forEach(p => {
    const opt = document.createElement('option'); opt.value = p; opt.textContent = p; if (task.priority === p) opt.selected = true; prioritySel.appendChild(opt);
  });

  const categoryInp = document.createElement('input');
  categoryInp.type = 'text';
  categoryInp.placeholder = 'Category';
  categoryInp.value = task.category || '';

  const recurSel = document.createElement('select');
  [['none','No Recurrence'],['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']].forEach(([v,label])=>{
    const o = document.createElement('option'); o.value = v; o.textContent = label; if (task.recurrence === v) o.selected = true; recurSel.appendChild(o);
  });

  row.appendChild(dateInput);
  row.appendChild(prioritySel);
  row.appendChild(categoryInp);
  row.appendChild(recurSel);

  main.appendChild(textInput);
  main.appendChild(row);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const saveBtn = document.createElement('button'); saveBtn.className = 'save-btn'; saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'cancel-btn'; cancelBtn.textContent = 'Cancel';
  actions.appendChild(saveBtn); actions.appendChild(cancelBtn);

  container.appendChild(main); container.appendChild(actions);
  li.appendChild(container);

  textInput.focus(); textInput.select();

  function cleanup() {
    saveBtn.removeEventListener('click', onSave);
    cancelBtn.removeEventListener('click', onCancel);
    textInput.removeEventListener('keydown', keyHandler);
  }

  function onCancel() { cleanup(); loadTasks(); }

  function onSave() {
    const newText = textInput.value.trim();
    if (newText === '') { alert('Task cannot be empty'); textInput.focus(); return; }
    const updated = {
      ...task,
      text: newText,
      dueDate: dateInput.value || '',
      priority: prioritySel.value,
      category: categoryInp.value || '',
      recurrence: recurSel.value
    };
    tasks = tasks.map(t => (t.id === id ? updated : t));
    saveTasks();
    cleanup();
    loadTasks();
  }

  function keyHandler(e) { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }

  saveBtn.addEventListener('click', onSave);
  cancelBtn.addEventListener('click', onCancel);
}

// ====== TOGGLE COMPLETE ======
function toggleComplete(id) {
  // Mark task completed and celebrate
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  if (!tasks[idx].completed) {
    tasks[idx].completed = true;
    saveTasks();
    loadTasks();
    showCelebration();
  } else {
    // toggle back to not completed
    tasks[idx].completed = false;
    saveTasks();
    loadTasks();
  }
}

// ====== DELETE TASK ======
function deleteTask(id) {
  scheduleDeletion([id], 'Task removed — undo?');
}

// ====== FILTER & SEARCH ======
function getFilteredTasks() {
  return tasks
    .filter(task => {
      if (filterStatus.value === "completed") return task.completed;
      if (filterStatus.value === "pending") return !task.completed;
      return true;
    })
    .filter(task =>
      filterPriority.value === "all" ||
      task.priority === filterPriority.value
    )
    .filter(task =>
      task.category.toLowerCase().includes(filterCategory.value.toLowerCase())
    )
    .filter(task =>
      task.text.toLowerCase().includes(searchInput.value.toLowerCase())
    )
    .sort(sortTasks);
}

// ====== SORT ======
function sortTasks(a, b) {
  switch (sortBy.value) {
    case "due":
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    case "priority":
      const order = { High: 1, Medium: 2, Low: 3 };
      return order[a.priority] - order[b.priority];
    case "status":
      return a.completed - b.completed;
    default:
      return new Date(a.createdAt) - new Date(b.createdAt);
  }
}

// ====== BULK ACTIONS ======
selectAll.addEventListener("change", function () {
  document.querySelectorAll(".selectTask").forEach(cb => {
    cb.checked = selectAll.checked;
  });
});

bulkCompleteBtn.addEventListener("click", function () {
  const ids = [...document.querySelectorAll('.selectTask:checked')].map(cb => Number(cb.dataset.id));
  if (ids.length === 0) return;
  // Mark selected tasks completed and celebrate once
  let changed = 0;
  ids.forEach(id => {
    const t = tasks.find(x => x.id === id);
    if (t && !t.completed) { t.completed = true; changed++; }
  });
  if (changed > 0) {
    saveTasks();
    loadTasks();
    showCelebration();
  }
});

bulkDeleteBtn.addEventListener("click", function () {
  // Collect checkboxes scoped to the task list for reliability
  const allBoxes = taskList ? Array.from(taskList.querySelectorAll('.selectTask')) : Array.from(document.querySelectorAll('.selectTask'));
  const selectedBoxes = allBoxes.filter(cb => cb.checked);
  const ids = selectedBoxes.map(cb => {
    const raw = (cb.dataset && cb.dataset.id != null) ? cb.dataset.id : cb.getAttribute('data-id');
    return Number(raw);
  }).filter(id => !Number.isNaN(id));

  console.log('Bulk delete clicked, selectedBoxesCount=', selectedBoxes.length, 'ids=', ids);
  if (ids.length === 0) {
    alert('Please select one or more tasks to delete.');
    return;
  }
  try {
    scheduleDeletion(ids, `Deleted ${ids.length} task(s) — undo?`);
  } catch (err) {
    console.error('Bulk delete failed', err);
    alert('Bulk delete failed: ' + (err && err.message ? err.message : String(err)));
  }
});

// ====== BULK EDIT ======
const bulkEditBtn = document.getElementById('bulkEditBtn');
if (bulkEditBtn) {
  bulkEditBtn.addEventListener('click', function () {
    const selected = [...document.querySelectorAll('.selectTask:checked')].map(cb => Number(cb.dataset.id));
    if (selected.length === 0) {
      alert('Please select a task to edit.');
      return;
    }
    if (selected.length > 1) {
      if (!confirm('Multiple tasks selected. Edit the first selected task?')) return;
    }
    const id = selected[0];
    // ensure the task row is rendered and then start inline edit
    startEdit(id);
  });
}

// clear completed now schedules deletion with undo
clearCompletedBtn.addEventListener("click", function () {
  const ids = tasks.filter(t => t.completed).map(t => t.id);
  if (ids.length === 0) return;
  scheduleDeletion(ids, `Cleared ${ids.length} completed task(s) — undo?`);
});

// ====== FILTER EVENTS ======
[
  filterStatus,
  filterPriority,
  filterCategory,
  searchInput,
  sortBy
].forEach(el => el.addEventListener("input", loadTasks));

// ====== THEME TOGGLE (dark by default, `light` class for light theme) ======
darkModeToggle.addEventListener("change", function () {
  if (darkModeToggle.checked) {
    document.body.classList.add('light');
    localStorage.setItem('theme', 'light');
  } else {
    document.body.classList.remove('light');
    localStorage.setItem('theme', 'dark');
  }
  setThemeUI();
});

// ====== LOAD THEME ======
if (localStorage.getItem('theme') === 'light') {
  darkModeToggle.checked = true;
  document.body.classList.add('light');
}

function setThemeUI() {
  const isLight = document.body.classList.contains('light');
  if (!themeIcon || !themeText) return;
  if (isLight) {
    themeIcon.textContent = '☀️';
    themeText.textContent = 'Light';
  } else {
    themeIcon.textContent = '🌙';
    themeText.textContent = 'Dark';
  }
}

setThemeUI();
// Auth handlers
loginBtn.addEventListener('click', () => openAuthModal('login'));
logoutBtn.addEventListener('click', () => {
  setCurrentUser(null);
});
closeAuth.addEventListener('click', closeAuthModal);

  authForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const mode = document.querySelector('input[name="authMode"]:checked').value;
    const username = usernameInput.value.trim();
    const password = passwordInput.value || '';
    if (!username) return alert('Enter a username');
    const users = getUsers();
    if (mode === 'signup') {
      if (users.find(u => u.username === username)) return alert('User exists');
      const passwordHash = password ? await hashPassword(password) : '';
      users.push({ username, passwordHash });
      saveUsers(users);
      setCurrentUser(username);
      closeAuthModal();
      return;
    }
    // login
    const passwordHash = password ? await hashPassword(password) : '';
    const user = users.find(u => u.username === username && (u.passwordHash || '') === passwordHash);
    if (!user) return alert('Invalid credentials');
    setCurrentUser(username);
    closeAuthModal();
  });

  // Send reset code (demo: stores code in localStorage and shows it via alert)
  if (sendResetBtn) sendResetBtn.addEventListener('click', function () {
    const username = usernameInput.value.trim();
    if (!username) return alert('Enter username to send reset code');
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return alert('User not found');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    localStorage.setItem(`reset_${username}`, code);
    // For demo: show code to user. In real app you'd email it.
    alert('Reset code: ' + code + '\n(For demo stored in localStorage under reset_' + username + ')');
    if (resetArea) resetArea.style.display = 'block';
  });

  if (resetSubmit) resetSubmit.addEventListener('click', async function () {
    const username = usernameInput.value.trim();
    const code = (resetCodeInput && resetCodeInput.value.trim()) || '';
    const np = (resetNewPassword && resetNewPassword.value) || '';
    const cp = (resetConfirmPassword && resetConfirmPassword.value) || '';
    if (!username || !code) return alert('Enter username and reset code');
    if (!np) return alert('Enter new password');
    if (np !== cp) return alert('Passwords do not match');
    const stored = localStorage.getItem(`reset_${username}`);
    if (!stored || stored !== code) return alert('Invalid or expired reset code');
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return alert('User not found');
    user.passwordHash = await hashPassword(np);
    saveUsers(users);
    localStorage.removeItem(`reset_${username}`);
    alert('Password reset successful. You can now login.');
    resetArea.style.display = 'none';
    authForm.reset();
  });

function initAuth() {
  migrateLegacyTasks();
  updateAuthUI();
  if (!currentUser) {
    openAuthModal('login');
  } else {
    loadTasks();
  }
  // ensure reminders state
  updateRemindersStateFromSettings();
}

// ====== INITIAL LOAD ======
initAuth();
function updateCounts() {
  let completed = 0;
  let pending = 0;

  tasks.forEach(task => {
    if (task.completed) completed++;
    else pending++;
  });

  pendingCount.textContent = `Pending: ${pending}`;
  completedCount.textContent = `Completed: ${completed}`;
}

// ====== SCHEDULED DELETION + UNDO (snackbar) ======
var pendingDeletion = null; // { ids: [], backup: [], timer } — use var to avoid TDZ runtime errors

function scheduleDeletion(ids, message) {
  if (!ids || ids.length === 0) return;
  // If there's an existing pending deletion, finalize it immediately
  if (pendingDeletion) {
    finalizeDeletion(pendingDeletion.ids);
  }

  // Backup tasks to allow undo
  const backup = tasks.filter(t => ids.includes(t.id));

  // Remove tasks from current state (immediate UI feedback)
  tasks = tasks.filter(t => !ids.includes(t.id));
  saveTasks();
  loadTasks();

  // Start timer to finalize deletion
  const timer = setTimeout(() => finalizeDeletion(ids), 5000);
  pendingDeletion = { ids, backup, timer };
  showSnackbar(message);
}

function finalizeDeletion(ids) {
  if (!pendingDeletion) return;
  try { clearTimeout(pendingDeletion.timer); } catch (e) {}
  // Already removed from `tasks`; finalize by clearing pending state
  pendingDeletion = null;
  hideSnackbar();
  saveTasks();
  loadTasks();
}

function undoDeletion() {
  if (!pendingDeletion) return;
  // Restore backed-up tasks
  try {
    tasks = tasks.concat(pendingDeletion.backup);
    // Keep consistent ordering by createdAt
    tasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    try { clearTimeout(pendingDeletion.timer); } catch (e) {}
  } catch (err) {
    console.error('Undo deletion failed', err);
  }
  pendingDeletion = null;
  hideSnackbar();
  saveTasks();
  loadTasks();
}

// simple snackbar with undo button
function showSnackbar(message) {
  hideSnackbar();
  const sb = document.createElement('div');
  sb.className = 'snackbar';
  sb.id = 'snackbar';
  sb.innerHTML = `<div style="max-width:360px;">${message}</div>`;
  const undoBtn = document.createElement('button'); undoBtn.textContent = 'Undo';
  undoBtn.addEventListener('click', () => { undoDeletion(); });
  sb.appendChild(undoBtn);
  document.body.appendChild(sb);
}

function hideSnackbar() {
  const s = document.getElementById('snackbar');
  if (s) s.remove();
}

// ====== CALENDAR VIEW ======
let calDate = new Date();

function formatDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function renderCalendar() {
  if (!calendarContainer) return;
  calendarContainer.innerHTML = '';

  const monthStart = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
  const month = calDate.getMonth();
  const year = calDate.getFullYear();

  const header = document.createElement('div');
  header.className = 'calendar-header';
  header.innerHTML = `
    <div><button id="prevMonth">◀</button></div>
    <div><strong>${monthStart.toLocaleString(undefined,{month:'long'})} ${year}</strong></div>
    <div><button id="nextMonth">▶</button></div>
  `;
  calendarContainer.appendChild(header);

  const weekdays = document.createElement('div');
  weekdays.className = 'calendar-weekdays';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(w => {
    const d = document.createElement('div'); d.textContent = w; weekdays.appendChild(d);
  });
  calendarContainer.appendChild(weekdays);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid calendar';

  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // fill blanks for previous month
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div'); blank.className = 'calendar-cell'; grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    const key = formatDateYYYYMMDD(cellDate);
    const cell = document.createElement('div');
    cell.className = 'calendar-cell' + (formatDateYYYYMMDD(new Date()) === key ? ' today' : '');
    const dateNum = document.createElement('div'); dateNum.className = 'date-num'; dateNum.textContent = d; cell.appendChild(dateNum);

    const tasksForDay = tasks.filter(t => t.dueDate === key);
    tasksForDay.slice(0,3).forEach(t => {
      const tEl = document.createElement('span');
      tEl.className = 'calendar-task';
      tEl.textContent = t.text;
      tEl.title = t.text;
      tEl.addEventListener('click', ev => {
        ev.stopPropagation();
        // focus the task in the list if possible
        const li = document.querySelector(`li[data-id="${t.id}"]`);
        if (li) li.scrollIntoView({behavior:'smooth',block:'center'});
      });
      cell.appendChild(tEl);
    });

    cell.addEventListener('click', () => {
      dueDateInput.value = key;
      taskInput.focus();
    });

    grid.appendChild(cell);
  }

  calendarContainer.appendChild(grid);

  // prev/next handlers
  document.getElementById('prevMonth').addEventListener('click', () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); });
  document.getElementById('nextMonth').addEventListener('click', () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); });
}

if (toggleCalendarBtn) toggleCalendarBtn.addEventListener('click', () => {
  if (!calendarContainer) return;
  calendarContainer.style.display = calendarContainer.style.display === 'none' ? 'block' : 'none';
  if (calendarContainer.style.display === 'block') renderCalendar();
});

// Celebration UI
function showCelebration(count = 28) {
  // remove existing
  const existing = document.querySelector('.celebrate-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'celebrate-overlay';
  document.body.appendChild(overlay);

  const colors = ['#FF6B6B','#6C8CFF','#7EE7C7','#FFD166','#FF9F1C'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.left = Math.floor(Math.random()*100) + '%';
    el.style.top = Math.floor(Math.random()*10) + '%';
    const dur = 1200 + Math.random()*1600;
    el.style.width = (6 + Math.random()*12) + 'px';
    el.style.height = (8 + Math.random()*18) + 'px';
    el.style.transform = `translateY(-20vh) rotate(${Math.random()*360}deg)`;
    el.style.animation = `confetti-fall ${dur}ms linear ${Math.random()*300}ms both`;
    overlay.appendChild(el);
  }
  // small celebratory toast
  const toast = document.createElement('div');
  toast.style.position = 'fixed'; toast.style.left = '50%'; toast.style.top = '14%'; toast.style.transform = 'translateX(-50%)';
  toast.style.background = 'linear-gradient(90deg,#6C8CFF,#7EE7C7)'; toast.style.color='#041223';
  toast.style.padding = '10px 16px'; toast.style.borderRadius = '12px'; toast.style.fontWeight = 700; toast.style.zIndex = 3010;
  toast.textContent = '🎉 Task completed! Great job!';
  document.body.appendChild(toast);

  setTimeout(()=>{ overlay.remove(); toast.remove(); }, 2500);
  // sound (if enabled)
  if (celebrateSounds) playCelebrationSound();
}

// ====== USER DASHBOARD ======
const dashboardBtn = document.getElementById('dashboardBtn');
const dashboardModal = document.getElementById('dashboardModal');
const closeDashboard = document.getElementById('closeDashboard');
const closeDashboardBottom = document.getElementById('closeDashboardBottom');
const dashUser = document.getElementById('dashUser');
const dashPending = document.getElementById('dashPending');
const dashCompleted = document.getElementById('dashCompleted');
const dueTodayList = document.getElementById('dueTodayList');
const exportTasksBtn = document.getElementById('exportTasksBtn');
const importTasksInput = document.getElementById('importTasksInput');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const confirmNewPassword = document.getElementById('confirmNewPassword');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const celebrateSoundsToggle = document.getElementById('celebrateSoundsToggle');
const enableRemindersEl = document.getElementById('enableReminders');
const reminderOffsetEl = document.getElementById('reminderOffset');

// celebration sound preference (default on)
let celebrateSounds = localStorage.getItem('celebrateSounds');
if (celebrateSounds === null) celebrateSounds = 'true';
celebrateSounds = celebrateSounds === 'true';

function openDashboard() {
  if (!dashboardModal) return;
  dashboardModal.classList.add('open');
  renderDashboard();
  applyDashboardSettingsToUI();
}

function closeDashboardModal() {
  if (!dashboardModal) return;
  dashboardModal.classList.remove('open');
}

function renderDashboard() {
  if (!currentUser) {
    dashUser.textContent = '—';
    dashPending.textContent = '0';
    dashCompleted.textContent = '0';
    dueTodayList.innerHTML = '';
    return;
  }
  dashUser.textContent = currentUser;
  const todayKey = formatDateYYYYMMDD(new Date());
  const pending = tasks.filter(t => !t.completed).length;
  const completed = tasks.filter(t => t.completed).length;
  dashPending.textContent = pending;
  dashCompleted.textContent = completed;

  const dueToday = tasks.filter(t => t.dueDate === todayKey);
  dueTodayList.innerHTML = '';
  if (dueToday.length === 0) {
    const li = document.createElement('li'); li.textContent = 'No tasks due today'; dueTodayList.appendChild(li);
  } else {
    dueToday.forEach(t => {
      const li = document.createElement('li');
      li.textContent = `${t.text} (${t.priority || '—'})`;
      li.addEventListener('click', () => {
        // scroll to task
        const row = document.querySelector(`li[data-id="${t.id}"]`);
        if (row) { row.scrollIntoView({behavior:'smooth', block:'center'}); }
        closeDashboardModal();
      });
      dueTodayList.appendChild(li);
    });
  }
}

// per-user settings helpers
function getUserSettings(user) {
  if (!user) return { enableReminders: false, reminderOffset: 0 };
  const key = `settings_${user}`;
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
}

function saveUserSettings(user, settings) {
  if (!user) return;
  const key = `settings_${user}`;
  localStorage.setItem(key, JSON.stringify(settings));
}

function applyDashboardSettingsToUI() {
  const s = getUserSettings(currentUser);
  if (enableRemindersEl) enableRemindersEl.checked = !!s.enableReminders;
  if (reminderOffsetEl) reminderOffsetEl.value = (s.reminderOffset != null) ? String(s.reminderOffset) : '0';
}

function persistDashboardSettingsFromUI() {
  const s = getUserSettings(currentUser) || {};
  s.enableReminders = !!(enableRemindersEl && enableRemindersEl.checked);
  s.reminderOffset = Number((reminderOffsetEl && reminderOffsetEl.value) || 0);
  saveUserSettings(currentUser, s);
}

if (dashboardBtn) dashboardBtn.addEventListener('click', openDashboard);
if (closeDashboard) closeDashboard.addEventListener('click', closeDashboardModal);
if (closeDashboardBottom) closeDashboardBottom.addEventListener('click', closeDashboardModal);

if (exportTasksBtn) exportTasksBtn.addEventListener('click', () => {
  if (!currentUser) return alert('No user');
  const data = JSON.stringify(tasks, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `tasks_${currentUser}.json`; a.click();
  URL.revokeObjectURL(url);
});

// persist settings when changed in dashboard UI
if (enableRemindersEl) enableRemindersEl.addEventListener('change', () => { persistDashboardSettingsFromUI(); updateRemindersStateFromSettings(); });
if (reminderOffsetEl) reminderOffsetEl.addEventListener('change', () => { persistDashboardSettingsFromUI(); });

if (importTasksInput) importTasksInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!Array.isArray(parsed)) throw new Error('Invalid format');
      if (confirm('Replace current tasks with imported tasks? Click Cancel to abort.')) {
        tasks = parsed;
        saveTasks();
        loadTasks();
        closeDashboardModal();
      }
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    importTasksInput.value = '';
  };
  reader.readAsText(f);
});

    // Change password (from dashboard) — requires current password
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', async () => {
      if (!currentUser) return alert('Not signed in');
      const curr = (currentPassword && currentPassword.value) || '';
      const np = (newPassword && newPassword.value) || '';
      const cp = (confirmNewPassword && confirmNewPassword.value) || '';
      if (!curr) return alert('Enter current password');
      if (!np) return alert('Enter new password');
      if (np !== cp) return alert('Passwords do not match');
      const users = getUsers();
      const user = users.find(u => u.username === currentUser);
      if (!user) return alert('User not found');
      const currHash = await hashPassword(curr);
      if ((user.passwordHash || '') !== currHash) return alert('Current password incorrect');
      user.passwordHash = await hashPassword(np);
      saveUsers(users);
      alert('Password changed');
      // clear fields
      if (currentPassword) currentPassword.value = '';
      if (newPassword) newPassword.value = '';
      if (confirmNewPassword) confirmNewPassword.value = '';
      closeDashboardModal();
    });

    // celebration sound toggle
    if (celebrateSoundsToggle) {
      celebrateSoundsToggle.checked = celebrateSounds;
      celebrateSoundsToggle.addEventListener('change', () => {
        celebrateSounds = !!celebrateSoundsToggle.checked;
        localStorage.setItem('celebrateSounds', celebrateSounds ? 'true' : 'false');
      });
    }

    // Play a short celebratory sound using WebAudio API
    function playCelebrationSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        const freqs = [880, 660, 990, 1320];
        freqs.forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, now + i * 0.05);
          g.gain.setValueAtTime(0, now + i * 0.05);
          g.gain.linearRampToValueAtTime(0.12, now + i * 0.05 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.5 + 0.05 + i * 0.02);
          o.connect(g); g.connect(ctx.destination);
          o.start(now + i * 0.05);
          o.stop(now + i * 0.6 + i * 0.02);
        });
        // close context after short delay
        setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, 1200);
      } catch (err) {
        // ignore audio errors
        console.warn('Audio error', err);
      }

      // ====== REMINDERS CHECKER ======
      // Check reminders every minute
      let remindersIntervalId = null;

      function shouldNotifyTask(task, settings) {
        if (task.completed) return false;
        const due = task.dueDate;
        if (!due) return false;
        const now = Date.now();
        const dueDateStart = new Date(due + 'T00:00:00');
        // compute remindAt = dueDateStart - offset minutes
        const offset = (settings && Number(settings.reminderOffset)) || 0;
        const remindAt = dueDateStart.getTime() - offset * 60000;
        // if snoozed until present, skip
        if (task.snoozedUntil && Number(task.snoozedUntil) > now) return false;
        // don't notify if already notified
        if (task.notifiedAt && Number(task.notifiedAt) >= remindAt) return false;
        return now >= remindAt;
      }

      function requestNotificationPermissionIfNeeded() {
        if (!('Notification' in window)) return Promise.resolve(false);
        if (Notification.permission === 'granted') return Promise.resolve(true);
        if (Notification.permission === 'denied') return Promise.resolve(false);
        return Notification.requestPermission().then(p => p === 'granted');
      }

      async function checkReminders() {
        if (!currentUser) return;
        const settings = getUserSettings(currentUser);
        if (!settings || !settings.enableReminders) return;
        const canNotify = await requestNotificationPermissionIfNeeded();
        tasks.forEach(async (task) => {
          if (shouldNotifyTask(task, settings)) {
            // show notification
            if (canNotify) {
              const n = new Notification(task.text || 'Task due', { body: `Due: ${task.dueDate}${task.priority ? ' • ' + task.priority : ''}` });
              n.onclick = () => {
                window.focus();
                const li = document.querySelector(`li[data-id="${task.id}"]`);
                if (li) li.scrollIntoView({ behavior:'smooth', block:'center' });
                // ask for snooze
                const sno = confirm('Snooze reminder for 10 minutes?');
                if (sno) {
                  task.snoozedUntil = Date.now() + 10 * 60 * 1000;
                  saveTasks();
                  loadTasks();
                }
              };
            } else {
              // fallback: alert + snooze
              const sno = confirm(`Reminder: ${task.text}\nDue ${task.dueDate}\nSnooze for 10 minutes?`);
              if (sno) {
                task.snoozedUntil = Date.now() + 10 * 60 * 1000;
              }
            }
            task.notifiedAt = Date.now();
            saveTasks();
            loadTasks();
          }
        });
      }

      function startRemindersChecker() {
        if (remindersIntervalId) clearInterval(remindersIntervalId);
        remindersIntervalId = setInterval(checkReminders, 60 * 1000);
        // run immediately
        checkReminders();
      }

      function stopRemindersChecker() {
        if (remindersIntervalId) { clearInterval(remindersIntervalId); remindersIntervalId = null; }
      }

      // start checker if settings enabled when auth initializes
      function updateRemindersStateFromSettings() {
        const s = getUserSettings(currentUser);
        if (s && s.enableReminders) startRemindersChecker(); else stopRemindersChecker();
      }

    }
  // ===== END OF SCRIPT =====





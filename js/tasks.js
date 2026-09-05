/* ==========================================================================
   Mission Board — task board logic
   ========================================================================== */

(function () {
  const user = Session.get();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  let currentFilter = 'active';
  let deleteTargetId = null;
  let lastLoadedTasks = []; // combined active + inactive, refreshed on every loadTasks()

  const listRegion = document.getElementById('task-list-region');
  const countActiveEl = document.getElementById('count-active');
  const countInactiveEl = document.getElementById('count-inactive');

  /* ---------------- Header ---------------- */

  document.getElementById('user-name-label').textContent =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  document.getElementById('board-date').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  document.getElementById('signout-btn').addEventListener('click', () => {
    Session.clear();
    window.location.href = 'index.html';
  });

  /* ---------------- Icons ---------------- */

  const ICONS = {
    check: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>',
    pencil: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"/></svg>',
    trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,4 13,4"/><path d="M6 4V2h4v2"/><rect x="4" y="4" width="8" height="10" rx="1"/></svg>',
    toggle: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="14" height="6" rx="3"/><circle cx="11" cy="8" r="2" fill="currentColor"/></svg>',
    empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16"/><path d="M9 13h6"/><path d="M9 16.5h4"/></svg>',
  };

  /* ---------------- Data loading ---------------- */

  async function loadTasks() {
    listRegion.innerHTML = '<div class="loading-state">Loading your missions…</div>';
    try {
      const [activeRes, inactiveRes] = await Promise.all([
        Api.getItems({ status: 'active', userId: user.id }),
        Api.getItems({ status: 'inactive', userId: user.id }),
      ]);

      const activeTasks = normalizeItems(activeRes);
      const inactiveTasks = normalizeItems(inactiveRes);

      lastLoadedTasks = activeTasks.concat(inactiveTasks);

      countActiveEl.textContent = activeTasks.length;
      countInactiveEl.textContent = inactiveTasks.length;

      const tasks = currentFilter === 'active' ? activeTasks : inactiveTasks;
      renderTasks(tasks);
    } catch (err) {
      listRegion.innerHTML = `<div class="empty-state">
        <p class="empty-title">Couldn't load your tasks</p>
        <p class="empty-sub">${escapeHtml(err.message)}</p>
      </div>`;
    }
  }

  function normalizeItems(res) {
    if (!res || !res.data) return [];
    return Object.values(res.data);
  }

  /* ---------------- Rendering ---------------- */

  function renderTasks(tasks) {
    if (tasks.length === 0) {
      listRegion.innerHTML = `
        <div class="empty-state">
        <div class="empty-icon">${ICONS.empty}</div>
          <p class="empty-title">No ${currentFilter} tasks</p>
          <p class="empty-sub">${currentFilter === 'active' ? 'Add a new task to get started.' : 'All tasks are still in play.'}</p>
        </div>`;
      return;
    }

    listRegion.innerHTML = `<div class="task-list">${tasks.map(taskCardHtml).join('')}</div>`;

    // Wire up per-card actions
    listRegion.querySelectorAll('[data-toggle-id]').forEach((btn) => {
      btn.addEventListener('click', () => toggleTaskStatus(btn.dataset.toggleId, btn.dataset.currentStatus));
    });
    listRegion.querySelectorAll('[data-edit-id]').forEach((btn) => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.editId, tasks));
    });
    listRegion.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.deleteId));
    });
  }

  function taskCardHtml(task) {
    const isActive = task.status === 'active';
    const dateLabel = task.timemodified
      ? new Date(task.timemodified.replace(' ', 'T')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    return `
      <div class="task-card ${isActive ? 'is-active' : ''}">
        <button class="task-toggle" data-toggle-id="${task.item_id}" data-current-status="${task.status}" title="${isActive ? 'Mark as inactive' : 'Mark as active'}">
          ${isActive ? ICONS.check : ''}
        </button>
        <div class="task-body">
          <div class="task-top-row">
            <h3 class="task-title">${escapeHtml(task.item_name)}</h3>
            <span class="task-status-pill">${isActive ? 'Active' : 'Inactive'}</span>
          </div>
          ${task.item_description ? `<p class="task-desc">${escapeHtml(task.item_description)}</p>` : ''}
          ${dateLabel ? `<p class="task-date">${dateLabel}</p>` : ''}
        </div>
        <div class="task-actions">
          <button class="action-btn" data-edit-id="${task.item_id}" title="Edit task">${ICONS.pencil}</button>
          <button class="action-btn" data-toggle-id="${task.item_id}" data-current-status="${task.status}" title="${isActive ? 'Set inactive' : 'Set active'}">${ICONS.toggle}</button>
          <button class="action-btn danger" data-delete-id="${task.item_id}" title="Delete task">${ICONS.trash}</button>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * The server's CORS setup sometimes blocks us from reading a PUT/DELETE
   * response even though the request itself succeeded — and the change can
   * take a moment to actually land before a fresh fetch reflects it. So
   * after an error, re-check reality a few times with short pauses instead
   * of giving up after a single immediate re-fetch.
   */
  async function verifyChangeLanded(checkFn, attempts = 4, delayMs = 500) {
    for (let i = 0; i < attempts; i++) {
      await sleep(delayMs);
      await loadTasks();
      if (checkFn()) return true;
    }
    return false;
  }

  /* ---------------- Filter tabs ---------------- */

  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.toggle('active', t === tab));
      loadTasks();
    });
  });

  /* ---------------- Modal helpers ---------------- */

  function openModal(id) { document.getElementById(id).classList.add('is-open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('is-open'); }

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  function setStatus(el, message, type) {
    el.innerHTML = message ? `<div class="form-status ${type}">${escapeHtml(message)}</div>` : '';
  }

  /* ---------------- Toast (shows the API's own message text) ---------------- */

  const toastStack = document.getElementById('toast-stack');

  function showToast(message, type) {
    if (!message) return;
    const el = document.createElement('div');
    el.className = `toast ${type || ''}`;
    el.textContent = message;
    toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  /* ---------------- Add Task ---------------- */

  const addForm = document.getElementById('add-form');
  const addStatus = document.getElementById('add-status');
  const addSubmit = document.getElementById('add-submit');

  document.getElementById('open-add-modal').addEventListener('click', () => {
    addForm.reset();
    setStatus(addStatus, '', null);
    openModal('add-modal-overlay');
    document.getElementById('add-title').focus();
  });

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('add-title').value.trim();
    const desc = document.getElementById('add-desc').value.trim();
    if (!title) return;

    addSubmit.disabled = true;
    addSubmit.textContent = 'Adding…';
    try {
      const res = await Api.addItem({ itemName: title, itemDescription: desc, userId: user.id });
      closeModal('add-modal-overlay');
      currentFilter = 'active';
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.toggle('active', t.dataset.filter === 'active'));
      await loadTasks();
      showToast(res.message, 'success');
    } catch (err) {
      setStatus(addStatus, err.message, 'error');
      await loadTasks(); // resync in case the item actually saved despite the error
    } finally {
      addSubmit.disabled = false;
      addSubmit.textContent = 'Add Task';
    }
  });

  /* ---------------- Edit Task ---------------- */

  const editForm = document.getElementById('edit-form');
  const editStatus = document.getElementById('edit-status');
  const editSubmit = document.getElementById('edit-submit');

  function openEditModal(itemId, tasks) {
    const task = tasks.find((t) => String(t.item_id) === String(itemId));
    if (!task) return;
    document.getElementById('edit-item-id').value = task.item_id;
    document.getElementById('edit-title').value = task.item_name;
    document.getElementById('edit-desc').value = task.item_description || '';
    setStatus(editStatus, '', null);
    openModal('edit-modal-overlay');
  }

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemId = document.getElementById('edit-item-id').value;
    const title = document.getElementById('edit-title').value.trim();
    const desc = document.getElementById('edit-desc').value.trim();
    if (!title) return;

    editSubmit.disabled = true;
    editSubmit.textContent = 'Saving…';
    try {
      const res = await Api.editItem({ itemId, itemName: title, itemDescription: desc });
      closeModal('edit-modal-overlay');
      await loadTasks();
      showToast(res.message, 'success'); // "Item updated"
    } catch (err) {
      const landed = await verifyChangeLanded(() => {
        const t = lastLoadedTasks.find((t) => String(t.item_id) === String(itemId));
        return t && t.item_name === title;
      });
      if (landed) {
        closeModal('edit-modal-overlay');
        showToast('Item updated', 'success');
      } else {
        setStatus(editStatus, err.message, 'error');
      }
    } finally {
      editSubmit.disabled = false;
      editSubmit.textContent = 'Save Changes';
    }
  });

  /* ---------------- Toggle status ---------------- */

  async function toggleTaskStatus(itemId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const docSuccessMessage = newStatus === 'active' ? 'To do item activated.' : 'To do item done.';
    try {
      const res = await Api.setItemStatus({ itemId, status: newStatus });
      await loadTasks();
      showToast(res.message, 'success');
    } catch (err) {
      const landed = await verifyChangeLanded(() => {
        const t = lastLoadedTasks.find((t) => String(t.item_id) === String(itemId));
        return t && t.status === newStatus;
      });
      if (landed) {
        showToast(docSuccessMessage, 'success');
      } else {
        showToast(err.message, 'error');
      }
    }
  }

  /* ---------------- Delete Task ---------------- */

  const deleteStatus = document.getElementById('delete-status');
  const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

  function openDeleteModal(itemId) {
    deleteTargetId = itemId;
    setStatus(deleteStatus, '', null);
    openModal('delete-modal-overlay');
  }

  deleteConfirmBtn.addEventListener('click', async () => {
    if (!deleteTargetId) return;
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Deleting…';
    try {
      const res = await Api.deleteItem({ itemId: deleteTargetId });
      closeModal('delete-modal-overlay');
      deleteTargetId = null;
      await loadTasks();
      showToast(res.message, 'success'); // "Item deleted"
    } catch (err) {
      const targetId = deleteTargetId;
      const landed = await verifyChangeLanded(() => {
        return !lastLoadedTasks.some((t) => String(t.item_id) === String(targetId));
      });
      if (landed) {
        closeModal('delete-modal-overlay');
        deleteTargetId = null;
        showToast('Item deleted', 'success');
      } else {
        setStatus(deleteStatus, err.message, 'error');
      }
    } finally {
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = 'Delete';
    }
  });

  /* ---------------- Init ---------------- */

  loadTasks();
})();
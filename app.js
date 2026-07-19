(() => {
  const STORAGE_KEY = 'keepwarm-data-v1';
  let state = loadState();
  let editingProjectId = null;
  let activeHistoryProjectId = null;
  let showArchived = false;
  let pendingConfirmAction = null;

  const els = {
    todayTotal: document.querySelector('#todayTotal'),
    yesterdayTotal: document.querySelector('#yesterdayTotal'),
    allProjectsTotal: document.querySelector('#allProjectsTotal'),
    projectList: document.querySelector('#projectList'),
    emptyState: document.querySelector('#emptyState'),
    newProjectBtn: document.querySelector('#newProjectBtn'),
    emptyNewProjectBtn: document.querySelector('#emptyNewProjectBtn'),
    showArchivedBtn: document.querySelector('#showArchivedBtn'),
    projectDialog: document.querySelector('#projectDialog'),
    projectDialogTitle: document.querySelector('#projectDialogTitle'),
    projectForm: document.querySelector('#projectForm'),
    projectNameInput: document.querySelector('#projectNameInput'),
    startingCountInput: document.querySelector('#startingCountInput'),
    projectFormError: document.querySelector('#projectFormError'),
    historyDialog: document.querySelector('#historyDialog'),
    historyTitle: document.querySelector('#historyTitle'),
    historyTotal: document.querySelector('#historyTotal'),
    historyList: document.querySelector('#historyList'),
    confirmDialog: document.querySelector('#confirmDialog'),
    confirmTitle: document.querySelector('#confirmTitle'),
    confirmMessage: document.querySelector('#confirmMessage'),
    confirmActionBtn: document.querySelector('#confirmActionBtn'),
    confirmCancelBtn: document.querySelector('#confirmCancelBtn')
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.projects)) return saved;
    } catch (error) {
      console.warn('Could not load saved Keepwarm data.', error);
    }
    return { projects: [] };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function id() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDateKey(d);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('en-GB').format(value);
  }

  function formatChange(value) {
    if (value > 0) return `+${formatNumber(value)}`;
    return formatNumber(value).replace('-', '−');
  }

  function formatDate(dateKey) {
    if (!dateKey) return 'No entries';
    if (dateKey === localDateKey()) return 'Today';
    if (dateKey === yesterdayKey()) return 'Yesterday';
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(`${dateKey}T12:00:00`));
  }

  function projectTotal(project) {
    return project.startingCount + project.entries.reduce((sum, entry) => sum + entry.change, 0);
  }

  function dailyTotal(dateKey) {
    return state.projects.reduce((projectSum, project) => {
      return projectSum + project.entries
        .filter(entry => entry.date === dateKey)
        .reduce((sum, entry) => sum + entry.change, 0);
    }, 0);
  }

  function lastEntryDate(project) {
    if (!project.entries.length) return null;
    return [...project.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].date;
  }

  function render() {
    els.todayTotal.textContent = formatNumber(dailyTotal(localDateKey()));
    els.yesterdayTotal.textContent = formatNumber(dailyTotal(yesterdayKey()));
    els.allProjectsTotal.textContent = formatNumber(state.projects.reduce((sum, p) => sum + projectTotal(p), 0));

    const visibleProjects = state.projects
      .filter(project => showArchived || !project.archived)
      .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));

    els.emptyState.hidden = visibleProjects.length !== 0;
    els.projectList.innerHTML = '';

    visibleProjects.forEach(project => {
      els.projectList.appendChild(buildProjectCard(project));
    });

    const archivedCount = state.projects.filter(p => p.archived).length;
    els.showArchivedBtn.hidden = archivedCount === 0;
    els.showArchivedBtn.textContent = showArchived ? 'Hide archived' : `Show archived (${archivedCount})`;
  }

  function buildProjectCard(project) {
    const card = document.createElement('article');
    card.className = `project-card${project.archived ? ' archived' : ''}`;
    card.dataset.projectId = project.id;

    const nameWrap = document.createElement('div');
    nameWrap.className = 'project-name';
    nameWrap.innerHTML = `<h3>${escapeHtml(project.name)}</h3><p class="project-status">${project.archived ? 'Archived' : 'Current project'}</p>`;

    const form = document.createElement('form');
    form.className = 'change-form';
    form.innerHTML = `
      <input class="change-input" type="number" step="1" min="1" inputmode="numeric" aria-label="Number of words for ${escapeHtml(project.name)}" placeholder="Words" ${project.archived ? 'disabled' : ''} required>
      <button class="button add-button" type="submit" data-direction="add" ${project.archived ? 'disabled' : ''}>Add</button>
      <button class="button remove-button" type="button" data-direction="remove" ${project.archived ? 'disabled' : ''}>Remove</button>
    `;

    const recordChange = direction => {
      const input = form.querySelector('input');
      const amount = Number(input.value);
      if (!Number.isInteger(amount) || amount <= 0) {
        input.setCustomValidity('Enter a positive whole number.');
        input.reportValidity();
        input.setCustomValidity('');
        return;
      }
      const change = direction === 'remove' ? -amount : amount;
      project.entries.push({ id: id(), change, date: localDateKey(), createdAt: new Date().toISOString() });
      saveState();
      input.value = '';
      render();
    };

    form.addEventListener('submit', event => {
      event.preventDefault();
      recordChange('add');
    });
    form.querySelector('.remove-button').addEventListener('click', () => recordChange('remove'));

    const total = document.createElement('div');
    total.className = 'project-total';
    total.innerHTML = `<span class="metric-label">Total words</span><span class="metric-value">${formatNumber(projectTotal(project))}</span>`;

    const last = document.createElement('div');
    last.className = 'project-last';
    last.innerHTML = `<span class="metric-label">Last entry</span><span class="metric-value">${formatDate(lastEntryDate(project))}</span>`;

    const menuWrap = document.createElement('div');
    menuWrap.className = 'menu-wrap';
    const menuId = `menu-${project.id}`;
    menuWrap.innerHTML = `
      <button class="menu-button" type="button" aria-label="Project options" aria-expanded="false" aria-controls="${menuId}">⋯</button>
      <div class="menu" id="${menuId}" hidden>
        <button type="button" data-action="history">View history</button>
        <button type="button" data-action="rename">Rename</button>
        <button type="button" data-action="archive">${project.archived ? 'Restore' : 'Archive'}</button>
        <button type="button" data-action="delete">Delete</button>
      </div>
    `;

    const menuButton = menuWrap.querySelector('.menu-button');
    const menu = menuWrap.querySelector('.menu');
    menuButton.addEventListener('click', () => {
      document.querySelectorAll('.menu').forEach(other => { if (other !== menu) other.hidden = true; });
      menu.hidden = !menu.hidden;
      menuButton.setAttribute('aria-expanded', String(!menu.hidden));
    });

    menu.addEventListener('click', event => {
      const action = event.target.dataset.action;
      if (!action) return;
      menu.hidden = true;
      if (action === 'history') openHistory(project.id);
      if (action === 'rename') openProjectDialog(project.id);
      if (action === 'archive') {
        project.archived = !project.archived;
        saveState();
        render();
      }
      if (action === 'delete') {
        askConfirm(
          'Delete project',
          `Delete “${project.name}” and all its entries?`,
          () => {
            state.projects = state.projects.filter(p => p.id !== project.id);
            saveState();
            render();
          }
        );
      }
    });

    card.append(nameWrap, form, total, last, menuWrap);
    return card;
  }

  function openProjectDialog(projectId = null) {
    editingProjectId = projectId;
    const project = state.projects.find(p => p.id === projectId);
    els.projectDialogTitle.textContent = project ? 'Rename project' : 'New project';
    els.projectNameInput.value = project?.name ?? '';
    els.startingCountInput.value = project ? String(project.startingCount) : '';
    els.startingCountInput.closest('label').hidden = Boolean(project);
    els.projectFormError.textContent = '';
    els.projectDialog.showModal();
    setTimeout(() => els.projectNameInput.focus(), 0);
  }

  els.projectForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = els.projectNameInput.value.trim();
    const duplicate = state.projects.some(p => p.name.toLowerCase() === name.toLowerCase() && p.id !== editingProjectId);
    if (!name) {
      els.projectFormError.textContent = 'Enter a project name.';
      return;
    }
    if (duplicate) {
      els.projectFormError.textContent = 'A project with that name already exists.';
      return;
    }

    if (editingProjectId) {
      state.projects.find(p => p.id === editingProjectId).name = name;
    } else {
      const startingCount = Number(els.startingCountInput.value || 0);
      if (!Number.isInteger(startingCount) || startingCount < 0) {
        els.projectFormError.textContent = 'Starting word count must be zero or a positive whole number.';
        return;
      }
      state.projects.push({ id: id(), name, startingCount, archived: false, createdAt: new Date().toISOString(), entries: [] });
    }

    saveState();
    els.projectDialog.close();
    render();
  });

  function openHistory(projectId) {
    activeHistoryProjectId = projectId;
    const project = state.projects.find(p => p.id === projectId);
    els.historyTitle.textContent = project.name;
    els.historyTotal.textContent = `${formatNumber(projectTotal(project))} words in total`;
    els.historyList.innerHTML = '';

    if (!project.entries.length) {
      els.historyList.innerHTML = '<p>No changes have been recorded yet.</p>';
    } else {
      let running = project.startingCount;
      const chronological = [...project.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const runningById = new Map();
      chronological.forEach(entry => {
        running += entry.change;
        runningById.set(entry.id, running);
      });

      [...project.entries]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .forEach(entry => {
          const row = document.createElement('div');
          row.className = 'history-entry';
          row.innerHTML = `
            <span class="history-date">${formatDate(entry.date)}</span>
            <span class="history-change">${formatChange(entry.change)}</span>
            <span class="history-running">${formatNumber(runningById.get(entry.id))}</span>
            <button class="history-delete" type="button">Delete entry</button>
          `;
          row.querySelector('button').addEventListener('click', () => {
            askConfirm('Delete entry', `Delete the ${formatChange(entry.change)} word entry from ${formatDate(entry.date)}?`, () => {
              project.entries = project.entries.filter(e => e.id !== entry.id);
              saveState();
              render();
              openHistory(project.id);
            });
          });
          els.historyList.appendChild(row);
        });
    }
    els.historyDialog.showModal();
  }

  function askConfirm(title, message, action) {
    pendingConfirmAction = action;
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmDialog.showModal();
  }

  els.confirmActionBtn.addEventListener('click', () => {
    els.confirmDialog.close();
    const action = pendingConfirmAction;
    pendingConfirmAction = null;
    action?.();
  });
  els.confirmCancelBtn.addEventListener('click', () => {
    pendingConfirmAction = null;
    els.confirmDialog.close();
  });

  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
  });

  els.newProjectBtn.addEventListener('click', () => openProjectDialog());
  els.emptyNewProjectBtn.addEventListener('click', () => openProjectDialog());
  els.showArchivedBtn.addEventListener('click', () => { showArchived = !showArchived; render(); });

  document.addEventListener('click', event => {
    if (!event.target.closest('.menu-wrap')) {
      document.querySelectorAll('.menu').forEach(menu => { menu.hidden = true; });
    }
  });

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  }

  render();
})();

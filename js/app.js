import {
  deleteProject as deleteProjectRecord,
  getAllProjects,
  getProjectById,
  getSettings,
  openDatabase,
  saveProject,
  saveSettings,
  updateProject,
} from "./db.js";
import { addExpense, deleteExpense, filterExpenses, getLinkedExpenses } from "./expenses.js";
import { buildProjectExport } from "./export.js";
import { addPhase, deletePhase, ensureProjectPhases, renamePhase } from "./phases.js";
import { createProject, filterProjects, getProgress, getProjectTotal, getRemainingBudget, normalizeProject } from "./projects.js";
import { applyTheme, DEFAULT_SETTINGS, normalizeSettings } from "./settings.js";
import { answerProjectQuestion, getAiWelcomeMessage } from "./ai.js";
import {
  confirmAction,
  downloadJson,
  escapeHtml,
  formatDate,
  formatMoney,
  normalizeName,
  parseAmount,
  promptText,
  showActionSheet,
  showInfoAlert,
  showToast,
} from "./utils.js";

(function () {
  "use strict";

  const app = document.getElementById("app");

  const state = {
    appReady: false,
    labels: {},
    projects: [],
    settings: { ...DEFAULT_SETTINGS },
    projectFilter: "active",
    expenseSearch: "",
    expenseModalOpen: false,
    selectedLinkedExpenseIds: [],
    aiModalOpen: false,
    aiProjectId: "",
    aiQuestion: "",
    aiMessages: [],
    savingProject: false,
    savingExpense: false,
  };

  function t(key) {
    return state.labels[key] || key;
  }

  async function loadLanguage(languageCode) {
    const response = await fetch(`langs/${languageCode}.json`);
    if (!response.ok) {
      throw new Error(`Unable to load language: ${languageCode}`);
    }

    return response.json();
  }

  function getRoute() {
    const hash = location.hash.replace(/^#\/?/, "");

    if (!hash) {
      return { view: "home" };
    }

    if (hash === "add") {
      return { view: "add-project" };
    }

    if (hash === "settings") {
      return { view: "settings" };
    }

    if (hash.startsWith("project/")) {
      const parts = hash.split("/");
      if (parts[2] === "phases") {
        return { view: "phases", id: parts[1] };
      }

      return { view: "details", id: parts[1] };
    }

    return { view: "home" };
  }

  function navigate(view, projectId) {
    state.expenseModalOpen = false;
    state.aiModalOpen = false;
    state.expenseSearch = "";
    state.selectedLinkedExpenseIds = [];

    if (view === "home") {
      location.hash = "#/";
      return;
    }

    if (view === "add-project") {
      location.hash = "#/add";
      return;
    }

    if (view === "settings") {
      location.hash = "#/settings";
      return;
    }

    if (view === "details") {
      location.hash = `#/project/${projectId}`;
      return;
    }

    if (view === "phases") {
      location.hash = `#/project/${projectId}/phases`;
    }
  }

  async function refreshProjects() {
    state.projects = (await getAllProjects()).map(normalizeProject);
  }

  async function initializeApp() {
    try {
      renderLoadingView();
      await openDatabase();
      state.settings = normalizeSettings(await getSettings());
      state.labels = await loadLanguage(state.settings.language);
      document.documentElement.lang = state.settings.language;
      applyTheme(state.settings);
      await refreshProjects();
      state.appReady = true;
      render();
    } catch (error) {
      console.error("App initialization failed.", error);
      renderLoadingView("Erreur de chargement");
    }
  }

  function getCurrentProject(projectId) {
    const routeProjectId = projectId || getRoute().id;
    return state.projects.find((project) => project.id === routeProjectId) || null;
  }

  function renderLoadingView(title) {
    app.innerHTML = `
      <section class="page">
        <div class="empty-state">
          <ion-icon name="sync-outline"></ion-icon>
          <h2>${escapeHtml(title || "Chargement...")}</h2>
          <p>Initialisation des données locales.</p>
        </div>
      </section>
    `;
  }

  function render() {
    if (!state.appReady) {
      renderLoadingView();
      return;
    }

    const route = getRoute();

    if (route.view === "add-project") {
      renderAddProjectView();
      return;
    }

    if (route.view === "details") {
      renderProjectDetailsView(route.id);
      return;
    }

    if (route.view === "phases") {
      renderPhasesView(route.id);
      return;
    }

    if (route.view === "settings") {
      renderSettingsView();
      return;
    }

    renderHomeView();
  }

  function renderHomeView() {
    const filteredProjects = filterProjects(state.projects, state.projectFilter);

    app.innerHTML = `
      <section class="page">
        <header class="topbar">
          <div class="title-block">
            <h1>${escapeHtml(t("appTitle"))}</h1>
          </div>
          <button class="circle-button" type="button" aria-label="${escapeHtml(t("settings"))}" data-action="go-settings">
            <ion-icon name="settings-outline"></ion-icon>
          </button>
        </header>

        <div class="segmented-tabs" role="tablist">
          <button class="${state.projectFilter === "active" ? "active" : ""}" type="button" data-action="set-filter" data-filter="active">${escapeHtml(t("inProgress"))}</button>
          <button class="${state.projectFilter === "completed" ? "active" : ""}" type="button" data-action="set-filter" data-filter="completed">${escapeHtml(t("completed"))}</button>
        </div>

        ${renderProjectList(filteredProjects)}

        <button class="fab-button" type="button" aria-label="${escapeHtml(t("addProject"))}" data-action="go-add-project">
          <ion-icon name="add-outline"></ion-icon>
        </button>
      </section>
    `;
  }

  function renderProjectList(projects) {
    if (projects.length === 0) {
      return `
        <div class="empty-state">
          <ion-icon name="folder-open-outline"></ion-icon>
          <h2>${escapeHtml(t("noProject"))}</h2>
          <p>${escapeHtml(t("noProjectDescription"))}</p>
        </div>
      `;
    }

    return `
      <section class="project-list">
        ${projects
          .map((project) => {
            const total = getProjectTotal(project);
            const progress = getProgress(project);
            const remaining = getRemainingBudget(project);
            const statusClass = project.status === "completed" ? "completed" : "active";
            return `
              <article class="project-card" data-action="open-project" data-id="${project.id}">
                <div class="project-ring" style="--ring-progress:${progress * 3.6}deg; --ring-color:${remaining < 0 ? "var(--color-danger)" : "var(--color-success)"}"></div>
                <div class="project-copy">
                  <h2>${escapeHtml(project.name)}</h2>
                  <p>${formatMoney(total, state.settings.currency)} / ${formatMoney(project.estimatedBudget, state.settings.currency)}</p>
                  <div class="project-meta">
                    <span class="status-badge ${statusClass}">${project.status === "completed" ? escapeHtml(t("completed")) : escapeHtml(t("inProgress"))}</span>
                    <span class="mini-badge">${project.phases.length} ${escapeHtml(t("phases"))}</span>
                  </div>
                </div>
                <button class="card-menu" type="button" aria-label="Projet menu" data-action="project-card-menu" data-id="${project.id}">
                  <ion-icon name="ellipsis-horizontal-outline"></ion-icon>
                </button>
              </article>
            `;
          })
          .join("")}
      </section>
    `;
  }

  function renderAddProjectView() {
    app.innerHTML = `
      <section class="page">
        <header class="subtopbar">
          <button class="ghost-button" type="button" aria-label="${escapeHtml(t("back"))}" data-action="go-home">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <h1 class="title-center">${escapeHtml(t("addProject"))}</h1>
          <span></span>
        </header>

        <section class="form-card">
          <form id="project-form" class="line-form">
            <label>
              <span>${escapeHtml(t("projectName"))}</span>
              <input id="project-name" class="line-input" type="text" autocomplete="off" placeholder="${escapeHtml(t("projectNamePlaceholder"))}" />
            </label>

            <label>
              <span>${escapeHtml(t("budget"))}</span>
              <input id="project-budget" class="line-input" type="text" inputmode="decimal" autocomplete="off" placeholder="${escapeHtml(t("budgetPlaceholder"))}" />
            </label>

            <ion-button class="primary-button" expand="block" type="submit">${escapeHtml(t("add"))}</ion-button>
          </form>
        </section>
      </section>
    `;
  }

  function renderProjectDetailsView(projectId) {
    const project = getCurrentProject(projectId);

    if (!project) {
      navigate("home");
      return;
    }

    const total = getProjectTotal(project);
    const progress = getProgress(project);
    const remaining = getRemainingBudget(project);
    const filteredExpenses = filterExpenses(project, state.expenseSearch);
    const selectedLinkedExpenses = getSelectedLinkedExpenses(project);

    app.innerHTML = `
      <section class="page">
        <header class="subtopbar">
          <button class="ghost-button" type="button" aria-label="${escapeHtml(t("back"))}" data-action="go-home">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <h1 class="title-center detail-title">${escapeHtml(project.name)}</h1>
          <button class="circle-button" type="button" aria-label="Menu projet" data-action="project-details-menu" data-id="${project.id}">
            <ion-icon name="ellipsis-vertical-outline"></ion-icon>
          </button>
        </header>

        <section class="panel detail-budget">
          <div class="detail-budget-top">
            <strong>${formatMoney(total, state.settings.currency)} / ${formatMoney(project.estimatedBudget, state.settings.currency)}</strong>
            <span class="remaining-badge ${remaining >= 0 ? "positive" : "negative"}">${escapeHtml(t("remainingBudget"))}: ${formatMoney(Math.abs(remaining), state.settings.currency)}</span>
          </div>
          <div class="progress-track">
            <span style="width:${progress}%"></span>
          </div>
        </section>

        <div class="section-header">
          <h2>${escapeHtml(t("expenses"))}</h2>
        </div>

        ${renderLinkedSelectionInfo(selectedLinkedExpenses)}

        ${state.expenseSearch ? `<button class="search-chip" type="button" data-action="clear-expense-search">${escapeHtml(state.expenseSearch)} <ion-icon name="close-outline"></ion-icon></button>` : ""}

        ${renderExpenseList(project, filteredExpenses)}

        <div class="detail-fab-stack">
          <button class="fab-button fab-button-secondary" type="button" aria-label="${escapeHtml(t("aiAssistant"))}" data-action="open-ai">
            <ion-icon name="sparkles-outline"></ion-icon>
          </button>
          <button class="fab-button" type="button" aria-label="${escapeHtml(t("addExpense"))}" data-action="open-expense-modal">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </div>

        ${state.expenseModalOpen ? renderExpenseModal(project) : ""}
        ${state.aiModalOpen ? renderAiModal() : ""}
      </section>
    `;
  }

  function renderExpenseList(project, expenses) {
    if (project.expenses.length === 0) {
      return `
        <div class="empty-state">
          <ion-icon name="receipt-outline"></ion-icon>
          <h2>${escapeHtml(t("noExpense"))}</h2>
          <p>${escapeHtml(t("noExpenseDescription"))}</p>
        </div>
      `;
    }

    if (expenses.length === 0) {
      return `
        <div class="empty-state">
          <ion-icon name="search-outline"></ion-icon>
          <h2>${escapeHtml(t("noResult"))}</h2>
          <p>${escapeHtml(t("noResultDescription"))}</p>
        </div>
      `;
    }

    return `
      <section class="expense-list">
        ${expenses
          .map((expense) => {
            return `
              <article class="expense-item">
                <button class="expense-select-button ${state.selectedLinkedExpenseIds.includes(expense.id) ? "active" : ""}" type="button" data-action="toggle-linked-expense" data-id="${expense.id}" aria-label="${escapeHtml(t("linkedExpenses"))}" aria-pressed="${state.selectedLinkedExpenseIds.includes(expense.id)}">
                  <ion-icon name="${state.selectedLinkedExpenseIds.includes(expense.id) ? "checkmark-outline" : "add-outline"}"></ion-icon>
                </button>
                <div>
                  <h3>${escapeHtml(expense.name)}</h3>
                  <p>${formatDate(expense.date)} · ${escapeHtml(expense.phase)}</p>
                  ${expense.supplier ? `<p>${escapeHtml(expense.supplier)}</p>` : ""}
                  ${expense.note ? `<p>${escapeHtml(expense.note)}</p>` : ""}
                </div>
                <div class="expense-side">
                  <strong>${formatMoney(expense.amount, state.settings.currency)}</strong>
                  ${expense.linkedExpenseIds.length ? `
                    <button class="linked-badge" type="button" data-action="show-linked-expenses" data-id="${expense.id}">
                      <ion-icon name="link-outline"></ion-icon>
                      ${escapeHtml(t("linkedExpenses"))}
                    </button>
                  ` : ""}
                  <button class="mini-icon-button danger" type="button" data-action="delete-expense" data-project-id="${project.id}" data-id="${expense.id}">
                    <ion-icon name="trash-outline"></ion-icon>
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </section>
    `;
  }

  function getSelectedLinkedExpenses(project) {
    return project.expenses.filter((expense) => state.selectedLinkedExpenseIds.includes(expense.id));
  }

  function renderLinkedSelectionInfo(expenses) {
    if (!expenses.length) {
      return "";
    }

    return `
      <section class="linked-selection">
        <div>
          <strong>${expenses.length} ${escapeHtml(t("selectedLinkedExpenses"))}</strong>
          <p>${escapeHtml(t("willBeLinked"))}</p>
        </div>
        <button class="mini-icon-button" type="button" data-action="clear-linked-selection" aria-label="${escapeHtml(t("clearSelection"))}">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </section>
    `;
  }

  function renderExpenseModal(project) {
    const selectedLinkedExpenses = getSelectedLinkedExpenses(project);

    return `
      <div class="modal-screen">
        <button class="modal-backdrop" type="button" data-action="close-expense-modal"></button>
        <section class="modal-card" data-modal-panel>
          <div class="modal-header">
            <h2>${escapeHtml(t("addExpense"))}</h2>
            <button class="ghost-button" type="button" aria-label="${escapeHtml(t("close"))}" data-action="close-expense-modal">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <form id="expense-form" class="line-form">
            <label>
              <span>${escapeHtml(t("name"))}</span>
              <input id="expense-name" class="line-input" type="text" autocomplete="off" placeholder="${escapeHtml(t("expenseNamePlaceholder"))}" />
            </label>
            <label>
              <span>${escapeHtml(t("amount"))}</span>
              <input id="expense-amount" class="line-input" type="text" inputmode="decimal" autocomplete="off" placeholder="${escapeHtml(t("amountPlaceholder"))}" />
            </label>
            <label>
              <span>${escapeHtml(t("supplier"))}</span>
              <input id="expense-supplier" class="line-input" type="text" autocomplete="off" placeholder="${escapeHtml(t("supplierPlaceholder"))}" />
            </label>
            <label>
              <span>${escapeHtml(t("date"))}</span>
              <input id="expense-date" class="line-input" type="date" value="${new Date().toISOString().substring(0, 10)}" />
            </label>
            <label>
              <span>${escapeHtml(t("phase"))}</span>
              <select id="expense-phase" class="line-select">
                ${ensureProjectPhases(project).map((phase) => `<option value="${escapeHtml(phase)}">${escapeHtml(phase)}</option>`).join("")}
              </select>
            </label>
            ${selectedLinkedExpenses.length ? `
              <section class="linked-preview">
                <span>${escapeHtml(t("linkedExpenses"))}</span>
                <div class="linked-preview-list">
                  ${selectedLinkedExpenses
                    .map((expense) => `<strong>${escapeHtml(expense.name)}</strong>`)
                    .join("")}
                </div>
              </section>
            ` : ""}
            <ion-button class="primary-button" expand="block" type="submit">${escapeHtml(t("add"))}</ion-button>
          </form>
        </section>
      </div>
    `;
  }

  function renderAiModal() {
    const project = getCurrentProject();

    return `
      <div class="modal-screen">
        <button class="modal-backdrop" type="button" data-action="close-ai-modal"></button>
        <section class="modal-card large ai-chat-modal" data-modal-panel>
          <div class="modal-header ai-chat-header">
            <div>
              <h2>${escapeHtml(t("aiAssistant"))}</h2>
              <p class="muted">${project ? `Analyse budgétaire et suivi du projet ${escapeHtml(project.name)}.` : "Analyse budgétaire et suivi du projet."}</p>
            </div>
            <button class="ghost-button ai-close-button" type="button" aria-label="${escapeHtml(t("close"))}" data-action="close-ai-modal">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <div class="ai-chat-body">
            ${renderAiMessages()}
          </div>
          <form id="ai-form" class="ai-chat-form">
            <label class="ai-input-wrap">
              <span class="eyebrow">Question</span>
              <textarea id="ai-question" class="line-textarea ai-chat-input" rows="3" placeholder="Ex: Quel est le budget restant ?">${escapeHtml(state.aiQuestion)}</textarea>
            </label>
            <ion-button class="primary-button" expand="block" type="submit">Envoyer</ion-button>
          </form>
        </section>
      </div>
    `;
  }

  function renderAiMessages() {
    const messages = state.aiMessages.length
      ? state.aiMessages
      : [
          { role: "assistant", ...getAiWelcomeMessage(getCurrentProject(), state.settings.currency) },
        ];

    return `
      <div class="ai-messages">
        ${messages
          .map((message) => {
            return `
              <article class="ai-message ai-message-${message.role}">
                <div class="ai-bubble-group">
                  <div class="ai-bubble">${escapeHtml(message.text)}</div>
                  ${message.options && message.options.length ? `
                    <div class="ai-option-list">
                      ${message.options
                        .map((option) => {
                          return `<button class="ai-option-chip" type="button" data-action="ai-suggestion" data-query="${escapeHtml(option.query)}">${escapeHtml(option.label)}</button>`;
                        })
                        .join("")}
                    </div>
                  ` : ""}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderPhasesView(projectId) {
    const project = getCurrentProject(projectId);

    if (!project) {
      navigate("home");
      return;
    }

    const phases = ensureProjectPhases(project);

    app.innerHTML = `
      <section class="page">
        <header class="subtopbar">
          <button class="ghost-button" type="button" aria-label="${escapeHtml(t("back"))}" data-action="go-details" data-id="${project.id}">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <h1 class="title-center">${escapeHtml(t("projectPhases"))}</h1>
          <button class="circle-button" type="button" aria-label="${escapeHtml(t("addPhase"))}" data-action="add-phase" data-id="${project.id}">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </header>

        <section class="phase-list">
          ${phases
            .map((phase) => {
              return `
                <article class="phase-item">
                  <div>
                    <h3>${escapeHtml(phase)}</h3>
                    <p class="muted">${project.expenses.filter((expense) => expense.phase === phase).length} dépense(s)</p>
                  </div>
                  <div class="phase-actions">
                    <button class="mini-icon-button" type="button" data-action="edit-phase" data-id="${project.id}" data-phase="${escapeHtml(phase)}">
                      <ion-icon name="create-outline"></ion-icon>
                    </button>
                    <button class="mini-icon-button danger" type="button" data-action="delete-phase" data-id="${project.id}" data-phase="${escapeHtml(phase)}">
                      <ion-icon name="trash-outline"></ion-icon>
                    </button>
                  </div>
                </article>
              `;
            })
            .join("")}
        </section>
      </section>
    `;
  }

  function renderSettingsView() {
    app.innerHTML = `
      <section class="page">
        <header class="subtopbar">
          <button class="ghost-button" type="button" aria-label="${escapeHtml(t("back"))}" data-action="go-home">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <h1 class="title-center">${escapeHtml(t("settings"))}</h1>
          <span></span>
        </header>

        <section class="settings-list">
          <article class="settings-item panel">
            <div>
              <h2>${escapeHtml(t("currency"))}</h2>
              <p class="muted">${escapeHtml(t("settingsDescription"))}</p>
            </div>
            <div class="currency-options">
              ${["DH", "EUR", "$", "GBP"]
                .map((currency) => {
                  return `<button class="currency-button ${state.settings.currency === currency ? "active" : ""}" type="button" data-action="set-currency" data-currency="${currency}">${currency}</button>`;
                })
                .join("")}
            </div>
          </article>

          <article class="settings-item panel">
            <div>
              <h2>${escapeHtml(t("darkMode"))}</h2>
              <p class="muted">${escapeHtml(t("darkModeDescription"))}</p>
            </div>
            <ion-toggle ${state.settings.darkMode ? "checked" : ""} data-action="toggle-dark-mode"></ion-toggle>
          </article>

          <article class="settings-item settings-item-stack panel">
            <div>
              <h2>${escapeHtml(t("language"))}</h2>
              <p class="muted">${escapeHtml(t("languageDescription"))}</p>
            </div>
            <div class="language-options">
              ${[
                { code: "fr", label: "Français", short: "FR" },
                { code: "en", label: "English", short: "EN" },
                { code: "ar", label: "العربية", short: "AR" },
              ]
                .map((language) => {
                  return `
                    <button class="language-button ${state.settings.language === language.code ? "active" : ""}" type="button" data-action="set-language" data-language="${language.code}">
                      <span>${language.short}</span>
                      <strong>${language.label}</strong>
                      <ion-icon name="${state.settings.language === language.code ? "checkmark-circle-outline" : "ellipse-outline"}"></ion-icon>
                    </button>
                  `;
                })
                .join("")}
            </div>
          </article>
        </section>
      </section>
    `;
  }

  async function persistProject(project) {
    const normalizedProject = normalizeProject(project);
    const existingIndex = state.projects.findIndex((item) => item.id === normalizedProject.id);

    if (existingIndex >= 0) {
      state.projects.splice(existingIndex, 1, normalizedProject);
    } else {
      state.projects.unshift(normalizedProject);
    }

    await updateProject(normalizedProject);
  }

  async function handleProjectSubmit(event) {
    event.preventDefault();

    if (state.savingProject) {
      return;
    }

    state.savingProject = true;
    const name = normalizeName(document.getElementById("project-name")?.value);
    const estimatedBudget = parseAmount(document.getElementById("project-budget")?.value);

    if (!name || estimatedBudget <= 0) {
      state.savingProject = false;
      showToast(t("invalidProjectToast"), "warning");
      return;
    }

    const project = createProject(name, estimatedBudget);
    state.projects.unshift(project);
    await saveProject(project);
    state.savingProject = false;
    showToast(t("projectCreatedToast"), "success");
    navigate("home");
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();

    if (state.savingExpense) {
      return;
    }

    const project = getCurrentProject();
    if (!project) {
      return;
    }

    state.savingExpense = true;

    const name = normalizeName(document.getElementById("expense-name")?.value);
    const amount = parseAmount(document.getElementById("expense-amount")?.value);
    const supplier = normalizeName(document.getElementById("expense-supplier")?.value);
    const date = document.getElementById("expense-date")?.value || "";
    const phase = document.getElementById("expense-phase")?.value || "Général";
    const linkedExpenseIds = state.selectedLinkedExpenseIds.filter((expenseId) => {
      return project.expenses.some((expense) => expense.id === expenseId);
    });

    if (!name || amount <= 0 || !date) {
      state.savingExpense = false;
      showToast(t("invalidExpenseToast"), "warning");
      return;
    }

    addExpense(project, {
      name,
      amount,
      supplier,
      date,
      phase,
      note: "",
      linkedExpenseIds,
    });

    await persistProject(project);
    state.expenseModalOpen = false;
    state.selectedLinkedExpenseIds = [];
    state.savingExpense = false;
    showToast(t("expenseCreatedToast"), "success");
    renderProjectDetailsView(project.id);
  }

  async function handleAiSubmit(event) {
    event.preventDefault();
    const question = (document.getElementById("ai-question")?.value || "").trim();
    await handleAiQuestion(question);
  }

  async function handleAiQuestion(question, visibleText) {
    const project = getCurrentProject();

    if (!project) {
      return;
    }

    state.aiQuestion = String(question || "").trim();

    if (!state.aiQuestion) {
      showToast("Écrivez une question pour l'assistant.", "warning");
      return;
    }

    const answer = answerProjectQuestion(project, state.aiQuestion, state.settings.currency);
    state.aiMessages = [
      ...state.aiMessages,
      { role: "user", text: visibleText || state.aiQuestion },
      { role: "assistant", text: answer.text, options: answer.options || [] },
    ];
    state.aiQuestion = "";
    renderProjectDetailsView(project.id);
  }

  async function openProjectActions(projectId) {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }

    await showActionSheet(project.name, [
      { text: t("open"), icon: "open-outline", handler: () => navigate("details", project.id) },
      { text: t("projectPhases"), icon: "layers-outline", handler: () => navigate("phases", project.id) },
      {
        text: project.status === "completed" ? t("inProgress") : t("completed"),
        icon: "checkmark-circle-outline",
        handler: async () => {
          project.status = project.status === "completed" ? "active" : "completed";
          await persistProject(project);
          render();
        },
      },
      { text: t("exportJson"), icon: "download-outline", handler: () => exportCurrentProject(project.id) },
      {
        text: t("delete"),
        role: "destructive",
        icon: "trash-outline",
        handler: async () => {
          const confirmed = await confirmAction(t("deleteProject"), `${t("delete")} "${project.name}" ?`);
          if (!confirmed) {
            return;
          }
          state.projects = state.projects.filter((item) => item.id !== project.id);
          await deleteProjectRecord(project.id);
          render();
        },
      },
    ]);
  }

  async function openDetailsActions(projectId) {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }

    await showActionSheet(project.name, [
      { text: t("projectPhases"), icon: "layers-outline", handler: () => navigate("phases", project.id) },
      {
        text: t("searchExpense"),
        icon: "search-outline",
        handler: async () => {
          const query = await promptText({
            header: t("search"),
            value: state.expenseSearch,
            placeholder: t("searchPlaceholder"),
            confirmText: t("search"),
          });

          if (query === null) {
            return;
          }

          state.expenseSearch = normalizeName(query);
          renderProjectDetailsView(project.id);
        },
      },
      { text: t("exportJson"), icon: "download-outline", handler: () => exportCurrentProject(project.id) },
      { text: t("aiAssistant"), icon: "sparkles-outline", handler: () => openAiModal(project.id) },
      {
        text: project.status === "completed" ? t("inProgress") : t("completed"),
        icon: "checkmark-circle-outline",
        handler: async () => {
          project.status = project.status === "completed" ? "active" : "completed";
          await persistProject(project);
          renderProjectDetailsView(project.id);
        },
      },
      {
        text: t("delete"),
        role: "destructive",
        icon: "trash-outline",
        handler: async () => {
          const confirmed = await confirmAction(t("deleteProject"), `${t("delete")} "${project.name}" ?`);
          if (!confirmed) {
            return;
          }
          state.projects = state.projects.filter((item) => item.id !== project.id);
          await deleteProjectRecord(project.id);
          navigate("home");
        },
      },
    ]);
  }

  async function openAiModal(projectId) {
    const project = getCurrentProject(projectId);
    if (!project) {
      return;
    }

    if (state.aiProjectId !== project.id) {
      state.aiProjectId = project.id;
      state.aiMessages = [];
    }

    state.aiModalOpen = true;
    state.aiQuestion = "";
    if (!state.aiMessages.length) {
      state.aiMessages = [{ role: "assistant", ...getAiWelcomeMessage(project, state.settings.currency) }];
    }
    renderProjectDetailsView(project.id);
  }

  function exportCurrentProject(projectId) {
    const project = getCurrentProject(projectId);
    if (!project) {
      return;
    }

    const data = buildProjectExport(project, state.settings.currency);
    downloadJson(`${project.name.replace(/\s+/g, "-").toLowerCase()}-budget.json`, data);
  }

  async function handleAddPhase(projectId) {
    const project = await getProjectById(projectId);
    if (!project) {
      return;
    }

    const value = await promptText({
      header: t("addPhase"),
      subHeader: ensureProjectPhases(project).join(" • "),
      placeholder: t("phasePlaceholder"),
      confirmText: t("add"),
    });

    if (value === null) {
      return;
    }

    const result = addPhase(project, value);
    if (result.reason === "empty") {
      showToast("Le nom de la phase est obligatoire.", "warning");
      return;
    }

    if (result.reason === "duplicate") {
      showToast("Cette phase existe déjà.", "warning");
      return;
    }

    await persistProject(project);
    renderPhasesView(project.id);
  }

  async function handleEditPhase(projectId, phaseName) {
    const project = await getProjectById(projectId);
    if (!project) {
      return;
    }

    const value = await promptText({
      header: t("editPhase"),
      value: phaseName,
      placeholder: t("phasePlaceholder"),
      confirmText: t("save"),
    });

    if (value === null) {
      return;
    }

    const result = renamePhase(project, phaseName, value);
    if (result.reason === "empty") {
      showToast("Le nom de la phase est obligatoire.", "warning");
      return;
    }

    if (result.reason === "duplicate") {
      showToast("Cette phase existe déjà.", "warning");
      return;
    }

    if (result.reason === "protected") {
      showToast("La phase Général ne peut pas être renommée.", "warning");
      return;
    }

    await persistProject(project);
    renderPhasesView(project.id);
  }

  async function handleDeletePhase(projectId, phaseName) {
    const project = await getProjectById(projectId);
    if (!project) {
      return;
    }

    const confirmed = await confirmAction(
      t("deletePhase"),
      phaseName === "Général"
        ? "La phase Général ne peut pas être supprimée."
        : `Les dépenses de "${phaseName}" seront déplacées vers Général.`,
      "Confirmer"
    );

    if (!confirmed || phaseName === "Général") {
      return;
    }

    deletePhase(project, phaseName);
    await persistProject(project);
    renderPhasesView(project.id);
  }

  async function handleDeleteExpense(projectId, expenseId) {
    const project = await getProjectById(projectId);
    if (!project) {
      return;
    }

    const expense = project.expenses.find((item) => item.id === expenseId);
    if (!expense) {
      return;
    }

    const confirmed = await confirmAction(t("deleteExpense"), `${t("delete")} "${expense.name}" ?`);
    if (!confirmed) {
      return;
    }

    deleteExpense(project, expenseId);
    state.selectedLinkedExpenseIds = state.selectedLinkedExpenseIds.filter((id) => id !== expenseId);
    await persistProject(project);
    renderProjectDetailsView(project.id);
  }

  async function handleShowLinkedExpenses(projectId, expenseId) {
    const project = await getProjectById(projectId);
    if (!project) {
      return;
    }

    const expense = project.expenses.find((item) => item.id === expenseId);
    if (!expense) {
      return;
    }

    const linkedExpenses = getLinkedExpenses(project, expense);
    const message = linkedExpenses.length
      ? linkedExpenses.map((item) => `${item.name} • ${formatMoney(item.amount, state.settings.currency)}`).join("<br>")
      : t("noLinkedExpense");

    await showInfoAlert(t("linkedExpenses"), message);
  }

  async function handleSettingsUpdate(type, value) {
    if (type === "currency") {
      state.settings.currency = value;
    }

    if (type === "darkMode") {
      state.settings.darkMode = Boolean(value);
    }

    if (type === "language") {
      state.settings.language = ["fr", "en", "ar"].includes(value) ? value : "fr";
    }

    state.settings = normalizeSettings(state.settings);
    if (type === "language") {
      state.labels = await loadLanguage(state.settings.language);
      document.documentElement.lang = state.settings.language;
    }
    applyTheme(state.settings);
    await saveSettings(state.settings);
    renderSettingsView();
  }

  app.addEventListener("click", async (event) => {
    const actionElement = event.target.closest("[data-action]");
    const modalPanel = event.target.closest("[data-modal-panel]");
    const formElement = event.target.closest("form");

    if (modalPanel && !actionElement) {
      event.stopPropagation();
      return;
    }

    if (formElement && !actionElement) {
      event.stopPropagation();
      return;
    }

    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.action;

    if (action === "go-home") {
      navigate("home");
    }

    if (action === "go-settings") {
      navigate("settings");
    }

    if (action === "go-add-project") {
      navigate("add-project");
    }

    if (action === "go-details") {
      navigate("details", actionElement.dataset.id);
    }

    if (action === "go-phases") {
      navigate("phases", actionElement.dataset.id);
    }

    if (action === "set-filter") {
      state.projectFilter = actionElement.dataset.filter || "active";
      renderHomeView();
    }

    if (action === "open-project") {
      navigate("details", actionElement.dataset.id);
    }

    if (action === "project-card-menu") {
      event.stopPropagation();
      openProjectActions(actionElement.dataset.id);
    }

    if (action === "project-details-menu") {
      openDetailsActions(actionElement.dataset.id);
    }

    if (action === "manage-parts" || action === "add-phase") {
      handleAddPhase(actionElement.dataset.id);
    }

    if (action === "edit-phase") {
      handleEditPhase(actionElement.dataset.id, actionElement.dataset.phase);
    }

    if (action === "delete-phase") {
      handleDeletePhase(actionElement.dataset.id, actionElement.dataset.phase);
    }

    if (action === "open-expense-modal") {
      state.expenseModalOpen = true;
      renderProjectDetailsView(getCurrentProject()?.id);
      setTimeout(() => document.getElementById("expense-name")?.focus(), 80);
    }

    if (action === "close-expense-modal") {
      state.expenseModalOpen = false;
      renderProjectDetailsView(getCurrentProject()?.id);
    }

    if (action === "clear-expense-search") {
      state.expenseSearch = "";
      renderProjectDetailsView(getCurrentProject()?.id);
    }

    if (action === "toggle-linked-expense") {
      event.stopPropagation();
      const expenseId = actionElement.dataset.id;
      if (state.selectedLinkedExpenseIds.includes(expenseId)) {
        state.selectedLinkedExpenseIds = state.selectedLinkedExpenseIds.filter((id) => id !== expenseId);
      } else {
        state.selectedLinkedExpenseIds = [...state.selectedLinkedExpenseIds, expenseId];
      }
      renderProjectDetailsView(getCurrentProject()?.id);
    }

    if (action === "clear-linked-selection") {
      state.selectedLinkedExpenseIds = [];
      renderProjectDetailsView(getCurrentProject()?.id);
    }

    if (action === "delete-expense") {
      handleDeleteExpense(actionElement.dataset.projectId, actionElement.dataset.id);
    }

    if (action === "show-linked-expenses") {
      handleShowLinkedExpenses(getCurrentProject()?.id, actionElement.dataset.id);
    }

    if (action === "open-ai") {
      openAiModal(getCurrentProject()?.id);
    }

    if (action === "ai-suggestion") {
      event.stopPropagation();
      handleAiQuestion(actionElement.dataset.query, actionElement.textContent?.trim());
    }

    if (action === "close-ai-modal") {
      state.aiModalOpen = false;
      state.aiQuestion = "";
      renderProjectDetailsView(getCurrentProject()?.id);
    }

    if (action === "set-currency") {
      handleSettingsUpdate("currency", actionElement.dataset.currency);
    }

    if (action === "set-language") {
      handleSettingsUpdate("language", actionElement.dataset.language);
    }
  });

  app.addEventListener("ionChange", (event) => {
    const toggle = event.target.closest('[data-action="toggle-dark-mode"]');

    if (toggle) {
      handleSettingsUpdate("darkMode", event.detail.checked);
    }
  });

  app.addEventListener("submit", (event) => {
    if (event.target.id === "project-form") {
      handleProjectSubmit(event);
    }

    if (event.target.id === "expense-form") {
      handleExpenseSubmit(event);
    }

    if (event.target.id === "ai-form") {
      handleAiSubmit(event);
    }
  });

  window.addEventListener("hashchange", render);
  initializeApp();
})();

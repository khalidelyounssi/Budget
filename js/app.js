(function () {
  "use strict";

  const STORAGE_KEY = "budget-projects-manager-projects";
  const NOTES_KEY = "budget-projects-manager-notes";
  const app = document.getElementById("app");

  let projects = loadProjects();
  let notes = loadNotes();
  let currentProjectId = null;
  let expenseFormVisible = false;
  let noteFormVisible = false;

  function loadProjects() {
    try {
      const savedProjects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(savedProjects) ? savedProjects.map(normalizeProject) : [];
    } catch (error) {
      console.warn("Unable to read projects from LocalStorage.", error);
      return [];
    }
  }

  function normalizeProject(project) {
    return {
      id: project.id || createId(),
      name: project.name || "Projet sans nom",
      description: project.description || "",
      estimatedBudget: parseAmount(project.estimatedBudget),
      createdAt: project.createdAt || new Date().toISOString(),
      expenses: Array.isArray(project.expenses) ? project.expenses.map(normalizeExpense) : [],
    };
  }

  function normalizeExpense(expense) {
    return {
      id: expense.id || createId(),
      name: expense.name || "Dépense sans nom",
      amount: parseAmount(expense.amount),
      date: expense.date || new Date().toISOString().substring(0, 10),
      note: expense.note || expense.category || "",
    };
  }

  function loadNotes() {
    try {
      const savedNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
      return Array.isArray(savedNotes) ? savedNotes.map(normalizeNote) : [];
    } catch (error) {
      console.warn("Unable to read notes from LocalStorage.", error);
      return [];
    }
  }

  function normalizeNote(note) {
    return {
      id: note.id || createId(),
      title: note.title || "Note sans titre",
      content: note.content || "",
      createdAt: note.createdAt || new Date().toISOString(),
    };
  }

  function saveProjects() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  function saveNotes() {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatMoney(amount) {
    return `${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0)} DH`;
  }

  function parseAmount(value) {
    const normalizedValue = String(value || "")
      .replace(/\s/g, "")
      .replace(",", ".");

    return Number(normalizedValue) || 0;
  }

  function formatDate(dateValue) {
    return new Date(dateValue).toLocaleDateString("fr-FR");
  }

  function getProjectTotal(project) {
    return project.expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  }

  function getRemainingBudget(project) {
    return Number(project.estimatedBudget || 0) - getProjectTotal(project);
  }

  function getAllEstimatedBudget() {
    return projects.reduce((total, project) => total + Number(project.estimatedBudget || 0), 0);
  }

  function getAllExpensesTotal() {
    return projects.reduce((total, project) => total + getProjectTotal(project), 0);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function navigate(view, id) {
    if (view === "home") {
      location.hash = "#/";
      return;
    }

    if (view === "add") {
      location.hash = "#/add";
      return;
    }

    if (view === "stats") {
      location.hash = "#/stats";
      return;
    }

    if (view === "notes") {
      location.hash = "#/notes";
      return;
    }

    if (view === "details") {
      location.hash = `#/project/${id}`;
    }
  }

  function getRoute() {
    const hash = location.hash.replace(/^#\/?/, "");

    if (!hash) {
      return { view: "home" };
    }

    if (hash === "add") {
      return { view: "add" };
    }

    if (hash === "stats") {
      return { view: "stats" };
    }

    if (hash === "notes") {
      return { view: "notes" };
    }

    if (hash.startsWith("project/")) {
      return { view: "details", id: hash.split("/")[1] };
    }

    return { view: "home" };
  }

  function render() {
    const route = getRoute();
    expenseFormVisible = false;
    noteFormVisible = false;

    if (route.view === "add") {
      renderAddProjectView();
      return;
    }

    if (route.view === "details") {
      renderProjectDetailsView(route.id);
      return;
    }

    if (route.view === "stats") {
      renderStatsView();
      return;
    }

    if (route.view === "notes") {
      renderNotesView();
      return;
    }

    renderHomeView();
  }

  function renderHomeView() {
    currentProjectId = null;
    const totalBudget = getAllEstimatedBudget();
    const totalSpent = getAllExpensesTotal();

    app.innerHTML = `
      <section class="page">
        <div class="top-bar">
          <div class="logo-mark" aria-hidden="true"></div>
          <div class="top-copy">
            <span>Espace de gestion</span>
            <strong>Budget Manager</strong>
          </div>
          <button class="round-button" type="button" aria-label="Ajouter un projet" data-action="go-add">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </div>

        <ion-card class="hero-card">
          <ion-card-content>
            <span class="eyebrow">Dashboard</span>
            <h1>Suivi budgétaire des projets.</h1>
            <p>Gardez une vue claire sur les budgets, les dépenses et les dépassements.</p>
          </ion-card-content>
        </ion-card>

        <div class="summary-grid">
          <div class="summary-card">
            <span>Projets</span>
            <strong>${projects.length}</strong>
          </div>
          <div class="summary-card">
            <span>Budget</span>
            <strong>${formatMoney(totalBudget)}</strong>
          </div>
          <div class="summary-card">
            <span>Dépensé</span>
            <strong>${formatMoney(totalSpent)}</strong>
          </div>
        </div>

        <div class="toolbar-row">
          <h2>Projets</h2>
          <ion-button data-action="go-add">
            <ion-icon name="add-outline" slot="start"></ion-icon>
            Add Project
          </ion-button>
        </div>

        ${renderProjectList()}
        ${renderBottomNav("home")}
      </section>
    `;
  }

  function renderBottomNav(activeView) {
    return `
      <nav class="bottom-nav" aria-label="Navigation principale">
        <button class="nav-item ${activeView === "home" ? "active" : ""}" type="button" data-action="go-home">
          <ion-icon name="home-outline"></ion-icon>
          <span>Accueil</span>
        </button>
        <button class="nav-item ${activeView === "stats" ? "active" : ""}" type="button" data-action="go-stats">
          <ion-icon name="analytics-outline"></ion-icon>
          <span>Stats</span>
        </button>
        <button class="nav-add" type="button" data-action="go-add" aria-label="Ajouter un projet">
          <ion-icon name="add-outline"></ion-icon>
        </button>
        <button class="nav-item ${activeView === "notes" ? "active" : ""}" type="button" data-action="go-notes">
          <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
          <span>Notes</span>
        </button>
      </nav>
    `;
  }

  function renderProjectList() {
    if (projects.length === 0) {
      return `
        <div class="empty-card">
          <ion-icon name="folder-open-outline"></ion-icon>
          <h3>Aucun projet</h3>
          <p>Créez votre premier projet pour commencer le suivi du budget.</p>
        </div>
      `;
    }

    return `
      <div class="project-list">
        ${projects
          .map((project) => {
            const total = getProjectTotal(project);
            const remaining = getRemainingBudget(project);
            const usedWidth = project.estimatedBudget > 0 ? Math.min((total / project.estimatedBudget) * 100, 100) : 0;
            const exceededWidth = total > project.estimatedBudget && total > 0
              ? ((total - project.estimatedBudget) / total) * 100
              : 0;

            return `
              <ion-card class="project-card" data-action="open-project" data-id="${project.id}">
                <ion-card-content>
                  <div class="card-header">
                    <div>
                      <h3>${escapeHtml(project.name)}</h3>
                      <p>${escapeHtml(project.description || "Description non renseignée")}</p>
                    </div>
                    <button class="small-icon-button delete-button" type="button" aria-label="Supprimer le projet" data-action="delete-project" data-id="${project.id}">
                      <ion-icon name="trash-outline"></ion-icon>
                    </button>
                  </div>
                  <div class="money-grid">
                    <div class="money-box">
                      <span>Budget</span>
                      <strong>${formatMoney(project.estimatedBudget)}</strong>
                    </div>
                    <div class="money-box">
                      <span>Dépenses</span>
                      <strong>${formatMoney(total)}</strong>
                    </div>
                  </div>
                  <div class="budget-message ${remaining < 0 ? "exceeded" : ""}">
                    <span>${remaining < 0 ? "Dépassement" : "Disponible"}</span>
                    <strong>${formatMoney(Math.abs(remaining))}</strong>
                  </div>
                  <div class="progress-track" aria-label="Budget utilisé">
                    <span class="progress-used" style="width: ${usedWidth}%"></span>
                    <span class="progress-over" style="width: ${exceededWidth}%"></span>
                  </div>
                </ion-card-content>
              </ion-card>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderAddProjectView() {
    app.innerHTML = `
      <section class="page">
        <div class="top-bar">
          <button class="round-button" type="button" aria-label="Retour" data-action="go-home">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <div class="top-copy">
            <span>Nouveau projet</span>
            <strong>Créer un budget</strong>
          </div>
          <div class="logo-mark" aria-hidden="true"></div>
        </div>

        <ion-card class="form-card">
          <ion-card-content>
            <span class="eyebrow">Création</span>
            <h1>Nouveau projet</h1>
            <p>Ajoutez les informations principales et le budget estimé.</p>

            <form id="projectForm" class="form-actions">
              <div class="field-group">
                <label class="field-label" for="projectName">Project name *</label>
                <ion-item class="input-item">
                  <ion-input id="projectName" name="name" placeholder="Ex: Rénovation bureau"></ion-input>
                </ion-item>
              </div>

              <div class="field-group">
                <label class="field-label" for="projectDescription">Description</label>
                <ion-item class="input-item">
                  <ion-textarea id="projectDescription" name="description" rows="4" placeholder="Ex: Peinture, portes, transport..."></ion-textarea>
                </ion-item>
              </div>

              <div class="field-group">
                <label class="field-label" for="projectBudget">Estimated budget in DH *</label>
                <ion-item class="input-item">
                  <ion-input id="projectBudget" name="estimatedBudget" type="text" inputmode="decimal" placeholder="Ex: 30000,00"></ion-input>
                  <span class="amount-suffix" slot="end">DH</span>
                </ion-item>
              </div>

              <ion-button expand="block" type="submit">
                <ion-icon name="save-outline" slot="start"></ion-icon>
                Create Project
              </ion-button>
              <ion-button expand="block" fill="clear" type="button" data-action="go-home">Back</ion-button>
            </form>
          </ion-card-content>
        </ion-card>
        ${renderBottomNav("add")}
      </section>
    `;
  }

  function renderProjectDetailsView(projectId) {
    currentProjectId = projectId;
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      showToast("Projet introuvable.", "danger");
      navigate("home");
      return;
    }

    const total = getProjectTotal(project);
    const remaining = getRemainingBudget(project);
    const usedWidth = project.estimatedBudget > 0 ? Math.min((total / project.estimatedBudget) * 100, 100) : 0;
    const exceededWidth = total > project.estimatedBudget && total > 0
      ? ((total - project.estimatedBudget) / total) * 100
      : 0;

    app.innerHTML = `
      <section class="page">
        <div class="top-bar">
          <button class="round-button" type="button" aria-label="Retour" data-action="go-home">
            <ion-icon name="arrow-back-outline"></ion-icon>
          </button>
          <div class="top-copy">
            <span>Projet</span>
            <strong>${escapeHtml(project.name)}</strong>
          </div>
          <button class="round-button" type="button" aria-label="Ajouter une dépense" data-action="show-expense-form">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </div>

        <ion-card class="details-card">
          <ion-card-content>
            <span class="eyebrow">Budget details</span>
            <h1>${escapeHtml(project.name)}</h1>
            <p>${escapeHtml(project.description || "Description non renseignée")}</p>

            <div class="money-grid">
              <div class="money-box">
                <span>Budget estimé</span>
                <strong>${formatMoney(project.estimatedBudget)}</strong>
              </div>
              <div class="money-box">
                <span>Total dépenses</span>
                <strong>${formatMoney(total)}</strong>
              </div>
            </div>

            <div class="budget-message ${remaining < 0 ? "exceeded" : ""}">
              <span>${remaining < 0 ? "Budget dépassé" : remaining === 0 ? "Budget utilisé" : "Budget restant"}</span>
              <strong>${remaining === 0 ? "0 DH" : formatMoney(Math.abs(remaining))}</strong>
            </div>

            <div class="progress-track" aria-label="Consommation du budget">
              <span class="progress-used" style="width: ${usedWidth}%"></span>
              <span class="progress-over" style="width: ${exceededWidth}%"></span>
            </div>
          </ion-card-content>
        </ion-card>

        <div class="section-row">
          <div>
            <h2>Dépenses</h2>
            <p class="muted">${project.expenses.length} dépense(s)</p>
          </div>
          <ion-button data-action="show-expense-form">
            <ion-icon name="add-circle-outline" slot="start"></ion-icon>
            Add Expense
          </ion-button>
        </div>

        <div id="expenseFormSlot"></div>

        ${renderExpenses(project)}
        ${renderBottomNav("home")}
      </section>
    `;

    if (expenseFormVisible) {
      showExpenseForm();
    }
  }

  function renderExpenseForm() {
    return `
      <ion-card class="expense-form-card">
        <ion-card-content>
          <span class="eyebrow">Nouvelle dépense</span>
          <h2>Ajouter une dépense</h2>
          <p class="muted">Le formulaire se ferme automatiquement après la sauvegarde.</p>

          <form id="expenseForm" class="form-actions">
            <div class="field-group">
              <label class="field-label" for="expenseName">Expense name *</label>
              <ion-item class="input-item">
                <ion-input id="expenseName" name="name" placeholder="Ex: Peinture"></ion-input>
              </ion-item>
            </div>

            <div class="expense-form-grid">
              <div class="field-group">
                <label class="field-label" for="expenseAmount">Amount in DH *</label>
                <ion-item class="input-item">
                  <ion-input id="expenseAmount" name="amount" type="text" inputmode="decimal" placeholder="Ex: 500,00"></ion-input>
                  <span class="amount-suffix" slot="end">DH</span>
                </ion-item>
              </div>

              <div class="field-group">
                <label class="field-label" for="expenseDate">Date *</label>
                <ion-item class="input-item">
                  <ion-input id="expenseDate" name="date" type="date" value="${new Date().toISOString().substring(0, 10)}"></ion-input>
                </ion-item>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label" for="expenseNote">Note</label>
              <ion-item class="input-item">
                <ion-textarea id="expenseNote" name="note" rows="3" placeholder="Ex: fournisseur, facture, remarque..."></ion-textarea>
              </ion-item>
            </div>

            <ion-button expand="block" type="submit">
              <ion-icon name="save-outline" slot="start"></ion-icon>
              Save Expense
            </ion-button>
            <ion-button expand="block" fill="clear" type="button" data-action="hide-expense-form">Cancel</ion-button>
          </form>
        </ion-card-content>
      </ion-card>
    `;
  }

  function renderExpenses(project) {
    if (project.expenses.length === 0) {
      return `
        <div class="empty-card">
          <ion-icon name="receipt-outline"></ion-icon>
          <h3>Aucune dépense</h3>
          <p>Cliquez sur Add Expense pour ajouter la première dépense.</p>
        </div>
      `;
    }

    return `
      <div class="expense-list">
        ${project.expenses
          .map(
            (expense) => `
              <ion-card class="expense-card">
                <ion-card-content>
                  <div class="expense-row">
                    <div>
                      <h3>${escapeHtml(expense.name)}</h3>
                      <p class="date-text">${formatDate(expense.date)}</p>
                      ${expense.note ? `<p class="note-text">${escapeHtml(expense.note)}</p>` : ""}
                    </div>
                    <div>
                      <strong>${formatMoney(expense.amount)}</strong>
                      <button class="small-icon-button delete-button" type="button" aria-label="Supprimer la dépense" data-action="delete-expense" data-id="${expense.id}">
                        <ion-icon name="trash-outline"></ion-icon>
                      </button>
                    </div>
                  </div>
                </ion-card-content>
              </ion-card>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderStatsView() {
    currentProjectId = null;
    const totalBudget = getAllEstimatedBudget();
    const totalSpent = getAllExpensesTotal();
    const remaining = totalBudget - totalSpent;
    const overBudgetProjects = projects.filter((project) => getRemainingBudget(project) < 0).length;
    const latestExpenses = projects
      .flatMap((project) =>
        project.expenses.map((expense) => ({
          ...expense,
          projectName: project.name,
        }))
      )
      .sort((firstExpense, secondExpense) => new Date(secondExpense.date).getTime() - new Date(firstExpense.date).getTime())
      .slice(0, 4);

    app.innerHTML = `
      <section class="page">
        <div class="top-bar">
          <button class="round-button" type="button" aria-label="Accueil" data-action="go-home">
            <ion-icon name="home-outline"></ion-icon>
          </button>
          <div class="top-copy">
            <span>Statistiques</span>
            <strong>Vue globale</strong>
          </div>
          <div class="logo-mark" aria-hidden="true"></div>
        </div>

        <ion-card class="hero-card">
          <ion-card-content>
            <span class="eyebrow">Performance</span>
            <h1>${formatMoney(totalSpent)}</h1>
            <p>Dépenses engagées sur ${formatMoney(totalBudget)} de budget total.</p>
            <div class="budget-message ${remaining < 0 ? "exceeded" : ""}">
              <span>${remaining < 0 ? "Dépassement total" : "Budget disponible"}</span>
              <strong>${formatMoney(Math.abs(remaining))}</strong>
            </div>
          </ion-card-content>
        </ion-card>

        <div class="summary-grid stats-grid">
          <div class="summary-card">
            <span>Projets</span>
            <strong>${projects.length}</strong>
          </div>
          <div class="summary-card">
            <span>Dépassés</span>
            <strong class="${overBudgetProjects > 0 ? "danger" : ""}">${overBudgetProjects}</strong>
          </div>
          <div class="summary-card">
            <span>Notes</span>
            <strong>${notes.length}</strong>
          </div>
        </div>

        <div class="toolbar-row">
          <h2>Dernières dépenses</h2>
        </div>

        ${
          latestExpenses.length === 0
            ? `<div class="empty-card"><ion-icon name="analytics-outline"></ion-icon><h3>Aucune dépense</h3><p>Ajoutez des dépenses pour alimenter les statistiques.</p></div>`
            : `<div class="expense-list">
                ${latestExpenses
                  .map(
                    (expense) => `
                      <ion-card class="expense-card">
                        <ion-card-content>
                          <div class="expense-row">
                            <div>
                              <h3>${escapeHtml(expense.name)}</h3>
                              <p class="date-text">${escapeHtml(expense.projectName)} · ${formatDate(expense.date)}</p>
                            </div>
                            <strong>${formatMoney(expense.amount)}</strong>
                          </div>
                        </ion-card-content>
                      </ion-card>
                    `
                  )
                  .join("")}
              </div>`
        }

        ${renderBottomNav("stats")}
      </section>
    `;
  }

  function renderNotesView() {
    currentProjectId = null;
    const sortedNotes = [...notes].sort((firstNote, secondNote) => {
      return new Date(secondNote.createdAt).getTime() - new Date(firstNote.createdAt).getTime();
    });

    app.innerHTML = `
      <section class="page">
        <div class="top-bar">
          <button class="round-button" type="button" aria-label="Accueil" data-action="go-home">
            <ion-icon name="home-outline"></ion-icon>
          </button>
          <div class="top-copy">
            <span>Carnet</span>
            <strong>Notes</strong>
          </div>
          <button class="round-button" type="button" aria-label="Nouvelle note" data-action="show-note-form">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </div>

        <ion-card class="hero-card note-hero-card">
          <ion-card-content>
            <span class="eyebrow">Notion simple</span>
            <h1>Notes</h1>
            <p>Écrivez vos remarques, décisions et idées importantes.</p>
            <ion-button class="hero-action" data-action="show-note-form">
              <ion-icon name="add-outline" slot="start"></ion-icon>
              Add Note
            </ion-button>
          </ion-card-content>
        </ion-card>

        <div id="noteFormSlot"></div>

        <div class="toolbar-row">
          <h2>Mes notes</h2>
          <span class="muted">${notes.length} note(s)</span>
        </div>

        ${
          sortedNotes.length === 0
            ? `<div class="empty-card"><ion-icon name="chatbubble-ellipses-outline"></ion-icon><h3>Aucune note</h3><p>Ajoutez une note pour garder vos remarques.</p></div>`
            : `<div class="note-list">
                ${sortedNotes
                  .map(
                    (note) => `
                      <ion-card class="note-card">
                        <ion-card-content>
                          <div class="card-header">
                            <div>
                              <h3>${escapeHtml(note.title)}</h3>
                              <p class="date-text">${formatDate(note.createdAt)}</p>
                            </div>
                            <button class="small-icon-button delete-button" type="button" aria-label="Supprimer la note" data-action="delete-note" data-id="${note.id}">
                              <ion-icon name="trash-outline"></ion-icon>
                            </button>
                          </div>
                          <p class="note-text">${escapeHtml(note.content)}</p>
                        </ion-card-content>
                      </ion-card>
                    `
                  )
                  .join("")}
              </div>`
        }

        ${renderBottomNav("notes")}
      </section>
    `;

    if (noteFormVisible) {
      showNoteForm();
    }
  }

  function renderNoteForm() {
    return `
      <ion-card class="form-card note-editor-card">
        <ion-card-content>
          <span class="eyebrow">Nouvelle note</span>
          <h2>Ajouter une note</h2>
          <p class="muted">Le formulaire se ferme automatiquement après la sauvegarde.</p>
            <form id="noteForm" class="form-actions">
              <div class="field-group">
                <label class="field-label" for="noteTitle">Titre</label>
                <ion-item class="input-item">
                  <ion-input id="noteTitle" placeholder="Ex: Achat matériel"></ion-input>
                </ion-item>
              </div>
              <div class="field-group">
                <label class="field-label" for="noteContent">Molahaḍat</label>
                <ion-item class="input-item">
                  <ion-textarea id="noteContent" rows="5" placeholder="Écrivez votre note ici..."></ion-textarea>
                </ion-item>
              </div>
              <ion-button expand="block" type="submit">
                <ion-icon name="save-outline" slot="start"></ion-icon>
                Save Note
              </ion-button>
              <ion-button expand="block" fill="clear" type="button" data-action="hide-note-form">Cancel</ion-button>
            </form>
        </ion-card-content>
      </ion-card>
    `;
  }

  function showNoteForm() {
    noteFormVisible = true;
    const slot = document.getElementById("noteFormSlot");

    if (slot) {
      slot.innerHTML = renderNoteForm();
      setTimeout(() => document.getElementById("noteTitle")?.setFocus?.(), 100);
    }
  }

  function hideNoteForm() {
    noteFormVisible = false;
    const slot = document.getElementById("noteFormSlot");

    if (slot) {
      slot.innerHTML = "";
    }
  }

  function showExpenseForm() {
    expenseFormVisible = true;
    const slot = document.getElementById("expenseFormSlot");

    if (slot) {
      slot.innerHTML = renderExpenseForm();
      setTimeout(() => document.getElementById("expenseName")?.setFocus?.(), 100);
    }
  }

  function hideExpenseForm() {
    expenseFormVisible = false;
    const slot = document.getElementById("expenseFormSlot");

    if (slot) {
      slot.innerHTML = "";
    }
  }

  async function showToast(message, color) {
    const toast = document.createElement("ion-toast");
    toast.message = message;
    toast.duration = 1400;
    toast.color = color || "primary";
    document.body.appendChild(toast);
    await toast.present();
  }

  async function confirmAction(header, message) {
    return new Promise((resolve) => {
      const alert = document.createElement("ion-alert");
      alert.header = header;
      alert.message = message;
      alert.buttons = [
        {
          text: "Annuler",
          role: "cancel",
          handler: () => resolve(false),
        },
        {
          text: "Supprimer",
          role: "destructive",
          handler: () => resolve(true),
        },
      ];
      document.body.appendChild(alert);
      alert.present();
    });
  }

  async function getIonValue(selector) {
    const element = document.querySelector(selector);

    if (!element) {
      return "";
    }

    if (typeof element.getInputElement === "function") {
      const input = await element.getInputElement();
      return input.value || "";
    }

    return element.value || "";
  }

  async function handleProjectFormSubmit(event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('ion-button[type="submit"]');
    submitButton.disabled = true;

    const name = (await getIonValue("#projectName")).trim();
    const description = (await getIonValue("#projectDescription")).trim();
    const estimatedBudget = parseAmount(await getIonValue("#projectBudget"));

    if (!name || !estimatedBudget || estimatedBudget <= 0) {
      submitButton.disabled = false;
      showToast("Ajoutez un nom et un budget positif.", "warning");
      return;
    }

    projects.unshift({
      id: createId(),
      name,
      description,
      estimatedBudget,
      createdAt: new Date().toISOString(),
      expenses: [],
    });

    saveProjects();
    showToast("Projet créé.", "success");
    navigate("home");
  }

  async function handleExpenseFormSubmit(event) {
    event.preventDefault();

    const project = projects.find((item) => item.id === currentProjectId);

    if (!project) {
      showToast("Projet introuvable.", "danger");
      navigate("home");
      return;
    }

    const submitButton = event.target.querySelector('ion-button[type="submit"]');
    submitButton.disabled = true;

    const name = (await getIonValue("#expenseName")).trim();
    const amount = parseAmount(await getIonValue("#expenseAmount"));
    const date = await getIonValue("#expenseDate");
    const note = (await getIonValue("#expenseNote")).trim();

    if (!name || !amount || amount <= 0 || !date) {
      submitButton.disabled = false;
      showToast("Complétez le nom, le montant positif et la date.", "warning");
      return;
    }

    project.expenses.unshift({
      id: createId(),
      name,
      amount,
      date,
      note,
    });

    saveProjects();
    expenseFormVisible = false;
    showToast("Dépense sauvegardée.", "success");
    renderProjectDetailsView(project.id);
  }

  async function handleNoteFormSubmit(event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('ion-button[type="submit"]');
    submitButton.disabled = true;

    const title = (await getIonValue("#noteTitle")).trim() || "Note sans titre";
    const content = (await getIonValue("#noteContent")).trim();

    if (!content) {
      submitButton.disabled = false;
      showToast("Écrivez le contenu de la note.", "warning");
      return;
    }

    notes.unshift({
      id: createId(),
      title,
      content,
      createdAt: new Date().toISOString(),
    });

    saveNotes();
    noteFormVisible = false;
    showToast("Note sauvegardée.", "success");
    renderNotesView();
  }

  app.addEventListener("click", async (event) => {
    const actionElement = event.target.closest("[data-action]");

    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.action;

    if (action === "go-home") {
      navigate("home");
    }

    if (action === "go-add") {
      navigate("add");
    }

    if (action === "go-stats") {
      navigate("stats");
    }

    if (action === "go-notes") {
      navigate("notes");
    }

    if (action === "show-note-form") {
      showNoteForm();
    }

    if (action === "hide-note-form") {
      hideNoteForm();
    }

    if (action === "open-project") {
      navigate("details", actionElement.dataset.id);
    }

    if (action === "delete-project") {
      event.stopPropagation();
      const projectId = actionElement.dataset.id;
      const project = projects.find((item) => item.id === projectId);

      if (!project) {
        return;
      }

      const confirmed = await confirmAction("Supprimer le projet", `Voulez-vous supprimer "${escapeHtml(project.name)}" ?`);

      if (confirmed) {
        projects = projects.filter((item) => item.id !== projectId);
        saveProjects();
        showToast("Projet supprimé.", "success");
        renderHomeView();
      }
    }

    if (action === "show-expense-form") {
      showExpenseForm();
    }

    if (action === "hide-expense-form") {
      hideExpenseForm();
    }

    if (action === "delete-expense") {
      event.stopPropagation();
      const project = projects.find((item) => item.id === currentProjectId);

      if (!project) {
        return;
      }

      const expense = project.expenses.find((item) => item.id === actionElement.dataset.id);

      if (!expense) {
        return;
      }

      const confirmed = await confirmAction("Supprimer la dépense", `Voulez-vous supprimer "${escapeHtml(expense.name)}" ?`);

      if (confirmed) {
        project.expenses = project.expenses.filter((item) => item.id !== expense.id);
        saveProjects();
        showToast("Dépense supprimée.", "success");
        renderProjectDetailsView(project.id);
      }
    }

    if (action === "delete-note") {
      event.stopPropagation();
      const note = notes.find((item) => item.id === actionElement.dataset.id);

      if (!note) {
        return;
      }

      const confirmed = await confirmAction("Supprimer la note", `Voulez-vous supprimer "${escapeHtml(note.title)}" ?`);

      if (confirmed) {
        notes = notes.filter((item) => item.id !== note.id);
        saveNotes();
        showToast("Note supprimée.", "success");
        renderNotesView();
      }
    }
  });

  app.addEventListener("submit", (event) => {
    if (event.target.id === "projectForm") {
      handleProjectFormSubmit(event);
    }

    if (event.target.id === "expenseForm") {
      handleExpenseFormSubmit(event);
    }

    if (event.target.id === "noteForm") {
      handleNoteFormSubmit(event);
    }
  });

  window.addEventListener("hashchange", render);
  render();
})();

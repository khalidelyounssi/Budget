(function () {
  "use strict";

  const DB_NAME = "BudgetManagerDB";
  const DB_VERSION = 1;
  const PROJECT_STORE = "projects";
  const NOTE_STORE = "notes";
  const app = document.getElementById("app");

  let databasePromise = null;
  let projects = [];
  let notes = [];
  let appReady = false;
  let currentProjectId = null;
  let projectFilter = "active";
  let expenseModalOpen = false;
  let noteFormVisible = false;
  let expenseSearch = "";
  let projectSaving = false;
  let expenseSaving = false;
  let noteSaving = false;

  // IndexedDB is the app's only storage layer.
  // We keep one store for projects and one for notes so the app stays simple.
  function openDatabase() {
    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(PROJECT_STORE)) {
          database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        }

        if (!database.objectStoreNames.contains(NOTE_STORE)) {
          database.createObjectStore(NOTE_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Impossible d'ouvrir IndexedDB."));
    });

    return databasePromise;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Erreur IndexedDB."));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Transaction IndexedDB échouée."));
      transaction.onabort = () => reject(transaction.error || new Error("Transaction IndexedDB annulée."));
    });
  }

  async function getAllProjects() {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const done = transactionDone(transaction);
    const request = transaction.objectStore(PROJECT_STORE).getAll();
    const storedProjects = await requestToPromise(request);
    await done;
    return Array.isArray(storedProjects) ? storedProjects.map(normalizeProject) : [];
  }

  async function getProjectById(id) {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const done = transactionDone(transaction);
    const request = transaction.objectStore(PROJECT_STORE).get(id);
    const storedProject = await requestToPromise(request);
    await done;
    return storedProject ? normalizeProject(storedProject) : null;
  }

  async function saveProject(project) {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(PROJECT_STORE).put(normalizeProject(project));
    await done;
  }

  async function updateProject(project) {
    await saveProject(project);
  }

  async function deleteProject(id) {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(PROJECT_STORE).delete(id);
    await done;
  }

  async function clearAllProjects() {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(PROJECT_STORE).clear();
    await done;
  }

  async function getAllNotes() {
    const database = await openDatabase();
    const transaction = database.transaction(NOTE_STORE, "readonly");
    const done = transactionDone(transaction);
    const request = transaction.objectStore(NOTE_STORE).getAll();
    const storedNotes = await requestToPromise(request);
    await done;
    return Array.isArray(storedNotes) ? storedNotes.map(normalizeNote) : [];
  }

  async function saveNoteRecord(note) {
    const database = await openDatabase();
    const transaction = database.transaction(NOTE_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(NOTE_STORE).put(normalizeNote(note));
    await done;
  }

  async function deleteNoteRecord(id) {
    const database = await openDatabase();
    const transaction = database.transaction(NOTE_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(NOTE_STORE).delete(id);
    await done;
  }

  function normalizeProject(project) {
    return {
      id: project.id || createId(),
      name: project.name || "Projet sans nom",
      description: project.description || "",
      estimatedBudget: parseAmount(project.estimatedBudget),
      createdAt: project.createdAt || new Date().toISOString(),
      status: project.status === "completed" ? "completed" : "active",
      parts: buildProjectParts(project.parts),
      expenses: Array.isArray(project.expenses) ? project.expenses.map(normalizeExpense) : [],
    };
  }

  function normalizeExpense(expense) {
    return {
      id: expense.id || createId(),
      name: expense.name || "Dépense sans nom",
      amount: parseAmount(expense.amount),
      date: expense.date || new Date().toISOString().substring(0, 10),
      supplier: expense.supplier || "",
      part: expense.part || expense.partId || "",
      note: expense.note || expense.category || "",
      linkedExpenseIds: Array.isArray(expense.linkedExpenseIds) ? expense.linkedExpenseIds : [],
    };
  }

  function normalizeNote(note) {
    return {
      id: note.id || createId(),
      title: note.title || "Note sans titre",
      content: note.content || "",
      createdAt: note.createdAt || new Date().toISOString(),
    };
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function parseAmount(value) {
    const normalizedValue = String(value || "")
      .replace(/\s/g, "")
      .replace(",", ".");

    return Number(normalizedValue) || 0;
  }

  function formatMoney(amount) {
    return `${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0)} DH`;
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

  function getProgress(project) {
    if (!project.estimatedBudget) {
      return 0;
    }

    return Math.min(Math.round((getProjectTotal(project) / project.estimatedBudget) * 100), 100);
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

  function normalizePartName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function buildProjectParts(parts) {
    const sourceParts = Array.isArray(parts) ? parts : [];
    const uniqueParts = [];
    const seen = new Set();

    ["Général", ...sourceParts].forEach((part) => {
      const cleanPart = normalizePartName(part);
      const partKey = cleanPart.toLowerCase();

      if (!cleanPart || seen.has(partKey)) {
        return;
      }

      seen.add(partKey);
      uniqueParts.push(cleanPart);
    });

    return uniqueParts;
  }

  function ensureProjectParts(project) {
    project.parts = buildProjectParts(project.parts);
    return project.parts;
  }

  function addProjectPart(project, rawPart) {
    const newPart = normalizePartName(rawPart);

    if (!newPart) {
      return { ok: false, reason: "empty" };
    }

    const currentParts = ensureProjectParts(project);
    const exists = currentParts.some((part) => part.toLowerCase() === newPart.toLowerCase());

    if (exists) {
      return { ok: false, reason: "duplicate" };
    }

    project.parts = [...currentParts, newPart];
    return { ok: true };
  }

  function navigate(view, id) {
    expenseModalOpen = false;
    expenseSearch = "";

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

  function renderLoadingView(message) {
    app.innerHTML = `
      <section class="phone-page home-view">
        <div class="empty-state">
          <ion-icon name="sync-outline"></ion-icon>
          <h2>${escapeHtml(message || "Chargement...")}</h2>
          <p>Initialisation des donnees locales.</p>
        </div>
      </section>
    `;
  }

  function render() {
    if (!appReady) {
      renderLoadingView("Chargement...");
      return;
    }

    const route = getRoute();
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

  async function initializeApp() {
    try {
      renderLoadingView("Ouverture de la base...");
      await openDatabase();
      projects = await getAllProjects();
      notes = await getAllNotes();
      appReady = true;
      render();
    } catch (error) {
      console.error("Impossible de charger les donnees IndexedDB.", error);
      renderLoadingView("Impossible de charger les donnees.");
      showToast("Erreur IndexedDB.", "danger");
    }
  }

  function renderHomeView() {
    currentProjectId = null;
    const filteredProjects = projects.filter((project) => {
      return projectFilter === "completed" ? project.status === "completed" : project.status !== "completed";
    });

    app.innerHTML = `
      <section class="phone-page home-view">
        <header class="simple-header">
          <div></div>
          <button class="icon-button" type="button" aria-label="Menu" data-action="open-main-menu">
            <ion-icon name="settings-outline"></ion-icon>
          </button>
        </header>

        <div class="segmented-tabs" role="tablist" aria-label="Filtre projets">
          <button class="${projectFilter === "active" ? "is-active" : ""}" type="button" data-action="set-project-filter" data-filter="active">En cours</button>
          <button class="${projectFilter === "completed" ? "is-active" : ""}" type="button" data-action="set-project-filter" data-filter="completed">Terminés</button>
        </div>

        <div class="compact-stats">
          <span>${projects.length} projet(s)</span>
          <strong>${formatMoney(getAllExpensesTotal())} / ${formatMoney(getAllEstimatedBudget())}</strong>
        </div>

        ${renderProjectRows(filteredProjects)}

        <button class="green-fab" type="button" aria-label="Ajouter un projet" data-action="go-add">
          <ion-icon name="add-outline"></ion-icon>
        </button>
      </section>
    `;
  }

  function renderProjectRows(projectList) {
    if (projectList.length === 0) {
      return `
        <div class="empty-state">
          <ion-icon name="folder-open-outline"></ion-icon>
          <h2>Aucun projet</h2>
          <p>${projectFilter === "completed" ? "Les projets terminés seront affichés ici." : "Cliquez sur + pour créer votre premier projet."}</p>
        </div>
      `;
    }

    return `
      <div class="row-list">
        ${projectList
          .map((project) => {
            const total = getProjectTotal(project);
            const remaining = getRemainingBudget(project);
            const progress = getProgress(project);
            const progressColor = remaining < 0 ? "#ef4444" : "#6fbd50";

            return `
              <article class="project-row" data-action="open-project" data-id="${project.id}">
                <div class="circle-progress" style="--progress:${progress * 3.6}deg; --progress-color:${progressColor}">
                  <span>${progress}</span>
                </div>
                <div class="project-row-copy">
                  <h2>${escapeHtml(project.name)}</h2>
                  <p>${formatMoney(total)} / ${formatMoney(project.estimatedBudget)}</p>
                </div>
                <button class="row-delete" type="button" aria-label="Supprimer le projet" data-action="delete-project" data-id="${project.id}">
                  <ion-icon name="trash-outline"></ion-icon>
                </button>
                <ion-icon class="row-chevron" name="chevron-forward-outline"></ion-icon>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderAddProjectView() {
    app.innerHTML = `
      <section class="phone-page form-view">
        <header class="title-header">
          <button class="back-link" type="button" data-action="go-home">
            <ion-icon name="chevron-back-outline"></ion-icon>
            Back
          </button>
          <h1>Ajouter un projet</h1>
          <span></span>
        </header>

        <form id="projectForm" class="line-form">
          <label>
            <span>Nom du projet</span>
            <input id="projectName" class="line-control native-input" type="text" autocomplete="off" placeholder="Ex: Projet #1" />
          </label>

          <label>
            <span>Description</span>
            <textarea id="projectDescription" class="line-control native-input" rows="2" placeholder="Ex: Travaux, achat matériel..."></textarea>
          </label>

          <label>
            <span>Budget</span>
            <input id="projectBudget" class="line-control native-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex: 3000,00" />
          </label>

          <label>
            <span>Parties optionnelles</span>
            <input id="projectParts" class="line-control native-input" type="text" autocomplete="off" placeholder="Ex: Salon, Cuisine, Transport" />
          </label>

          <ion-button class="green-button" expand="block" type="submit">Ajouter</ion-button>
        </form>
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
    const progress = getProgress(project);
    const filteredExpenses = getVisibleExpenses(project);

    app.innerHTML = `
      <section class="phone-page details-view">
        <header class="detail-header">
          <button class="back-link" type="button" data-action="go-home">
            <ion-icon name="chevron-back-outline"></ion-icon>
            Back
          </button>
          <h1>${escapeHtml(project.name)}</h1>
          <button class="kebab-button" type="button" aria-label="Options du projet" data-action="project-menu" data-id="${project.id}">
            <ion-icon name="ellipsis-vertical"></ion-icon>
          </button>
        </header>

        <section class="budget-strip">
          <p>${formatMoney(total)} / ${formatMoney(project.estimatedBudget)}</p>
          <div class="thin-progress" aria-label="Progression du budget">
            <span style="width:${progress}%"></span>
          </div>
          ${renderRemainingMessage(project)}
        </section>

        ${renderProjectParts(project)}

        ${expenseSearch ? `<button class="search-chip" type="button" data-action="clear-expense-search">Recherche: ${escapeHtml(expenseSearch)} <ion-icon name="close-outline"></ion-icon></button>` : ""}

        ${renderExpenseRows(project, filteredExpenses)}

        <button class="green-fab" type="button" aria-label="Ajouter une dépense" data-action="show-expense-modal">
          <ion-icon name="add-outline"></ion-icon>
        </button>

        ${expenseModalOpen ? renderExpenseModal(project) : ""}
      </section>
    `;
  }

  function renderRemainingMessage(project) {
    const remaining = getRemainingBudget(project);

    if (remaining > 0) {
      return `<strong class="success">Il reste ${formatMoney(remaining)}</strong>`;
    }

    if (remaining === 0) {
      return `<strong>Budget exactement utilisé</strong>`;
    }

    return `<strong class="danger">Budget dépassé de ${formatMoney(Math.abs(remaining))}</strong>`;
  }

  function getVisibleExpenses(project) {
    if (!expenseSearch) {
      return project.expenses;
    }

    const query = expenseSearch.toLowerCase();

    return project.expenses.filter((expense) => {
      return [expense.name, expense.supplier, expense.part, expense.note]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function renderExpenseRows(project, expenseList) {
    if (project.expenses.length === 0) {
      return `
        <div class="empty-state">
          <ion-icon name="receipt-outline"></ion-icon>
          <h2>Aucune dépense</h2>
          <p>Cliquez sur + pour ajouter une dépense.</p>
        </div>
      `;
    }

    if (expenseList.length === 0) {
      return `
        <div class="empty-state">
          <ion-icon name="search-outline"></ion-icon>
          <h2>Aucun résultat</h2>
          <p>Essayez une autre recherche.</p>
        </div>
      `;
    }

    return `
      <div class="expense-row-list">
        ${expenseList
          .map((expense, index) => {
            const linkedText = expense.linkedExpenseIds.length
              ? `<small>Liée à ${expense.linkedExpenseIds.length} dépense(s)</small>`
              : "";

            return `
              <article class="expense-line">
                <div>
                  <h2>${escapeHtml(expense.name || `Dépense #${index + 1}`)}</h2>
                  <p>${formatDate(expense.date)}${expense.part ? ` · ${escapeHtml(expense.part)}` : ""}</p>
                  ${expense.supplier ? `<small>${escapeHtml(expense.supplier)}</small>` : ""}
                  ${linkedText}
                </div>
                <div class="expense-line-side">
                  <strong>${formatMoney(expense.amount)}</strong>
                  <button class="row-delete" type="button" aria-label="Supprimer la dépense" data-action="delete-expense" data-id="${expense.id}">
                    <ion-icon name="trash-outline"></ion-icon>
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderExpenseModal(project) {
    const today = new Date().toISOString().substring(0, 10);
    const parts = ensureProjectParts(project);

    return `
      <div class="modal-screen" data-modal-root>
        <button class="modal-backdrop" type="button" aria-label="Fermer la fenêtre" data-action="close-expense-modal"></button>
        <section class="expense-modal" role="dialog" aria-modal="true" aria-label="Ajouter une dépense" data-modal-panel>
          <header class="modal-header">
            <h2>Ajouter une dépense</h2>
            <button type="button" aria-label="Fermer" data-action="close-expense-modal">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </header>

          <form id="expenseForm" class="line-form modal-form">
            <label>
              <span>Nom de la dépense</span>
              <input id="expenseName" class="line-control native-input" type="text" autocomplete="off" placeholder="Ex: Peinture" />
            </label>

            <label>
              <span>Montant</span>
              <input id="expenseAmount" class="line-control native-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex: 1000,00" />
            </label>

            <label>
              <span>Fournisseur</span>
              <input id="expenseSupplier" class="line-control native-input" type="text" autocomplete="off" placeholder="Ex: Magasin Atlas" />
            </label>

            <label>
              <span>Date</span>
              <input id="expenseDate" class="line-control native-input" type="date" value="${today}" />
            </label>

            <label>
              <span>Partie</span>
              <select id="expensePart" class="native-select">
                ${parts.map((part) => `<option value="${escapeHtml(part)}">${escapeHtml(part)}</option>`).join("")}
              </select>
            </label>

            ${renderLinkedExpenseChoices(project)}

            <label>
              <span>Note</span>
              <textarea id="expenseNote" class="line-control native-input" rows="2" placeholder="Remarque optionnelle"></textarea>
            </label>

            <ion-button class="green-button" expand="block" type="submit">Ajouter</ion-button>
          </form>
        </section>
      </div>
    `;
  }

  function renderLinkedExpenseChoices(project) {
    if (project.expenses.length === 0) {
      return "";
    }

    return `
      <fieldset class="link-fieldset">
        <legend>Lier à une dépense</legend>
        ${project.expenses
          .map(
            (expense) => `
              <label class="check-row">
                <input type="checkbox" name="linkedExpense" value="${expense.id}" />
                <span>${escapeHtml(expense.name)} · ${formatMoney(expense.amount)}</span>
              </label>
            `
          )
          .join("")}
      </fieldset>
    `;
  }

  function renderProjectParts(project) {
    const parts = ensureProjectParts(project);

    return `
      <section class="parts-panel">
        <div class="parts-panel-header">
          <h2>Parties du projet</h2>
          <button class="parts-add-button" type="button" data-action="manage-parts" data-id="${project.id}">
            <ion-icon name="add-outline"></ion-icon>
            Ajouter
          </button>
        </div>
        <div class="parts-list">
          ${parts.map((part) => `<span class="part-chip">${escapeHtml(part)}</span>`).join("")}
        </div>
      </section>
    `;
  }

  function renderStatsView() {
    currentProjectId = null;
    const totalBudget = getAllEstimatedBudget();
    const totalSpent = getAllExpensesTotal();
    const completedProjects = projects.filter((project) => project.status === "completed").length;

    app.innerHTML = `
      <section class="phone-page stats-view">
        <header class="title-header">
          <button class="back-link" type="button" data-action="go-home">
            <ion-icon name="chevron-back-outline"></ion-icon>
            Back
          </button>
          <h1>Statistiques</h1>
          <span></span>
        </header>

        <div class="stats-cards">
          <div><span>Projets</span><strong>${projects.length}</strong></div>
          <div><span>Terminés</span><strong>${completedProjects}</strong></div>
          <div><span>Budget</span><strong>${formatMoney(totalBudget)}</strong></div>
          <div><span>Dépensé</span><strong>${formatMoney(totalSpent)}</strong></div>
        </div>
      </section>
    `;
  }

  function renderNotesView() {
    currentProjectId = null;
    const sortedNotes = [...notes].sort((firstNote, secondNote) => {
      return new Date(secondNote.createdAt).getTime() - new Date(firstNote.createdAt).getTime();
    });

    app.innerHTML = `
      <section class="phone-page notes-view">
        <header class="title-header">
          <button class="back-link" type="button" data-action="go-home">
            <ion-icon name="chevron-back-outline"></ion-icon>
            Back
          </button>
          <h1>Notes</h1>
          <button class="icon-button" type="button" data-action="show-note-form" aria-label="Nouvelle note">
            <ion-icon name="add-outline"></ion-icon>
          </button>
        </header>

        <div id="noteFormSlot"></div>

        ${sortedNotes.length === 0
          ? `<div class="empty-state"><ion-icon name="chatbubble-ellipses-outline"></ion-icon><h2>Aucune note</h2><p>Cliquez sur + pour écrire une note.</p></div>`
          : `<div class="note-list">${sortedNotes.map(renderNoteRow).join("")}</div>`}
      </section>
    `;

    if (noteFormVisible) {
      showNoteForm();
    }
  }

  function renderNoteRow(note) {
    return `
      <article class="note-row">
        <div>
          <h2>${escapeHtml(note.title)}</h2>
          <p>${formatDate(note.createdAt)}</p>
          <small>${escapeHtml(note.content)}</small>
        </div>
        <button class="row-delete" type="button" aria-label="Supprimer la note" data-action="delete-note" data-id="${note.id}">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </article>
    `;
  }

  function renderNoteForm() {
    return `
      <form id="noteForm" class="line-form note-form">
        <label>
          <span>Titre</span>
          <input id="noteTitle" class="line-control native-input" type="text" autocomplete="off" placeholder="Ex: Achat matériel" />
        </label>
        <label>
          <span>Votre note</span>
          <textarea id="noteContent" class="line-control native-input" rows="4" placeholder="Écrivez votre note..."></textarea>
        </label>
        <ion-button class="green-button" expand="block" type="submit">Enregistrer</ion-button>
        <ion-button fill="clear" expand="block" type="button" data-action="hide-note-form">Annuler</ion-button>
      </form>
    `;
  }

  function showNoteForm() {
    noteFormVisible = true;
    const slot = document.getElementById("noteFormSlot");

    if (slot) {
      slot.innerHTML = renderNoteForm();
      setTimeout(() => document.getElementById("noteTitle")?.focus(), 100);
    }
  }

  function hideNoteForm() {
    noteFormVisible = false;
    const slot = document.getElementById("noteFormSlot");

    if (slot) {
      slot.innerHTML = "";
    }
  }

  async function showToast(message, color) {
    const toast = document.createElement("ion-toast");
    toast.message = message;
    toast.duration = 1500;
    toast.color = color || "primary";
    document.body.appendChild(toast);
    await toast.present();
  }

  async function confirmAction(header, message, confirmText) {
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
          text: confirmText || "Supprimer",
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

    if (projectSaving) {
      return;
    }

    projectSaving = true;
    const submitButton = event.target.querySelector('ion-button[type="submit"]');
    submitButton.disabled = true;

    const name = (await getIonValue("#projectName")).trim();
    const description = (await getIonValue("#projectDescription")).trim();
    const estimatedBudget = parseAmount(await getIonValue("#projectBudget"));
    const parts = (await getIonValue("#projectParts"))
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (!name || estimatedBudget <= 0) {
      submitButton.disabled = false;
      projectSaving = false;
      showToast("Ajoutez un nom et un budget positif.", "warning");
      return;
    }

    const newProject = {
      id: createId(),
      name,
      description,
      estimatedBudget,
      createdAt: new Date().toISOString(),
      status: "active",
      parts: buildProjectParts(parts),
      expenses: [],
    };

    projects.unshift(newProject);

    await saveProject(newProject);
    showToast("Projet créé.", "success");
    projectSaving = false;
    navigate("home");
  }

  async function handleExpenseFormSubmit(event) {
    event.preventDefault();

    if (expenseSaving) {
      return;
    }

    expenseSaving = true;
    const project = projects.find((item) => item.id === currentProjectId);

    if (!project) {
      expenseSaving = false;
      showToast("Projet introuvable.", "danger");
      navigate("home");
      return;
    }

    const submitButton = event.target.querySelector('ion-button[type="submit"]');
    submitButton.disabled = true;

    const name = (await getIonValue("#expenseName")).trim();
    const amount = parseAmount(await getIonValue("#expenseAmount"));
    const supplier = (await getIonValue("#expenseSupplier")).trim();
    const date = await getIonValue("#expenseDate");
    const part = document.getElementById("expensePart")?.value || "";
    const note = (await getIonValue("#expenseNote")).trim();
    const linkedExpenseIds = [...document.querySelectorAll('input[name="linkedExpense"]:checked')].map((input) => input.value);

    if (!name || amount <= 0 || !date) {
      submitButton.disabled = false;
      expenseSaving = false;
      showToast("Complétez le nom, le montant positif et la date.", "warning");
      return;
    }

    project.expenses.unshift({
      id: createId(),
      name,
      amount,
      supplier,
      date,
      part,
      note,
      linkedExpenseIds,
    });

    await updateProject(project);
    expenseModalOpen = false;
    expenseSaving = false;
    showToast("Dépense ajoutée.", "success");
    renderProjectDetailsView(project.id);
  }

  async function handleNoteFormSubmit(event) {
    event.preventDefault();

    if (noteSaving) {
      return;
    }

    noteSaving = true;
    const submitButton = event.target.querySelector('ion-button[type="submit"]');
    submitButton.disabled = true;

    const title = (await getIonValue("#noteTitle")).trim() || "Note sans titre";
    const content = (await getIonValue("#noteContent")).trim();

    if (!content) {
      submitButton.disabled = false;
      noteSaving = false;
      showToast("Écrivez le contenu de la note.", "warning");
      return;
    }

    const newNote = {
      id: createId(),
      title,
      content,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);

    await saveNoteRecord(newNote);
    noteFormVisible = false;
    noteSaving = false;
    showToast("Note enregistrée.", "success");
    renderNotesView();
  }

  async function showMainMenu() {
    const sheet = document.createElement("ion-action-sheet");
    sheet.header = "Menu";
    sheet.buttons = [
      { text: "Statistiques", icon: "analytics-outline", handler: () => navigate("stats") },
      { text: "Notes", icon: "chatbubble-ellipses-outline", handler: () => navigate("notes") },
      { text: "Annuler", role: "cancel" },
    ];
    document.body.appendChild(sheet);
    await sheet.present();
  }

  async function showProjectMenu(projectId) {
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      return;
    }

    const sheet = document.createElement("ion-action-sheet");
    sheet.header = project.name;
    sheet.buttons = [
      { text: "Gérer les parties", icon: "layers-outline", handler: () => editProjectParts(project.id) },
      { text: "Rechercher une dépense", icon: "search-outline", handler: () => promptExpenseSearch(project.id) },
      {
        text: project.status === "completed" ? "Rouvrir le projet" : "Terminer le projet",
        icon: "checkmark-circle-outline",
        handler: () => toggleProjectStatus(project.id),
      },
      {
        text: "Supprimer le projet",
        role: "destructive",
        icon: "trash-outline",
        handler: () => removeProject(project.id),
      },
      { text: "Annuler", role: "cancel" },
    ];
    document.body.appendChild(sheet);
    await sheet.present();
  }

  async function editProjectParts(projectId) {
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      return;
    }

    const currentParts = ensureProjectParts(project);
    const alert = document.createElement("ion-alert");
    alert.header = "Parties du projet";
    alert.subHeader = currentParts.join(" • ");
    alert.inputs = [
      {
        name: "part",
        type: "text",
        placeholder: "Ex: Électricité",
      },
    ];
    alert.buttons = [
      { text: "Annuler", role: "cancel" },
      {
        text: "Ajouter",
        handler: (data) => {
          const result = addProjectPart(project, data.part);

          if (result.reason === "empty") {
            showToast("Le nom de la partie est obligatoire.", "warning");
            return false;
          }

          if (result.reason === "duplicate") {
            showToast("Cette partie existe déjà.", "warning");
            return false;
          }

          updateProject(project)
            .then(() => {
              showToast("Partie ajoutée.", "success");
              renderProjectDetailsView(project.id);
            })
            .catch((error) => {
              console.error("Impossible de sauvegarder la partie.", error);
              showToast("Erreur lors de la sauvegarde.", "danger");
            });
        },
      },
    ];
    document.body.appendChild(alert);
    await alert.present();
  }

  async function promptExpenseSearch(projectId) {
    const alert = document.createElement("ion-alert");
    alert.header = "Rechercher";
    alert.inputs = [
      {
        name: "query",
        type: "text",
        value: expenseSearch,
        placeholder: "Nom, fournisseur, partie...",
      },
    ];
    alert.buttons = [
      {
        text: "Annuler",
        role: "cancel",
      },
      {
        text: "Chercher",
        handler: (data) => {
          expenseSearch = String(data.query || "").trim();
          renderProjectDetailsView(projectId);
        },
      },
    ];
    document.body.appendChild(alert);
    await alert.present();
  }

  async function toggleProjectStatus(projectId) {
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      return;
    }

    project.status = project.status === "completed" ? "active" : "completed";
    await updateProject(project);
    showToast(project.status === "completed" ? "Projet terminé." : "Projet rouvert.", "success");
    renderProjectDetailsView(project.id);
  }

  async function removeProject(projectId) {
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      return;
    }

    const confirmed = await confirmAction("Supprimer le projet", `Voulez-vous supprimer "${escapeHtml(project.name)}" ?`);

    if (confirmed) {
      projects = projects.filter((item) => item.id !== projectId);
      await deleteProject(projectId);
      showToast("Projet supprimé.", "success");
      navigate("home");
    }
  }

  app.addEventListener("click", async (event) => {
    const modalPanel = event.target.closest("[data-modal-panel]");
    const actionElement = event.target.closest("[data-action]");
    const formElement = event.target.closest("form");

    // Les clics dans le contenu du modal restent dans le modal.
    if (modalPanel && !actionElement) {
      event.stopPropagation();
      return;
    }

    // Les clics dans un formulaire ne doivent pas déclencher la navigation globale.
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

    if (action === "go-add") {
      navigate("add");
    }

    if (action === "go-stats") {
      navigate("stats");
    }

    if (action === "go-notes") {
      navigate("notes");
    }

    if (action === "open-main-menu") {
      showMainMenu();
    }

    if (action === "set-project-filter") {
      projectFilter = actionElement.dataset.filter || "active";
      renderHomeView();
    }

    if (action === "open-project") {
      navigate("details", actionElement.dataset.id);
    }

    if (action === "manage-parts") {
      editProjectParts(actionElement.dataset.id);
    }

    if (action === "delete-project") {
      event.stopPropagation();
      await removeProject(actionElement.dataset.id);
    }

    if (action === "project-menu") {
      showProjectMenu(actionElement.dataset.id);
    }

    if (action === "clear-expense-search") {
      expenseSearch = "";
      renderProjectDetailsView(currentProjectId);
    }

    if (action === "show-expense-modal") {
      expenseModalOpen = true;
      renderProjectDetailsView(currentProjectId);
      setTimeout(() => document.getElementById("expenseName")?.focus(), 100);
    }

    if (action === "close-expense-modal") {
      expenseModalOpen = false;
      renderProjectDetailsView(currentProjectId);
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
        await updateProject(project);
        showToast("Dépense supprimée.", "success");
        renderProjectDetailsView(project.id);
      }
    }

    if (action === "show-note-form") {
      showNoteForm();
    }

    if (action === "hide-note-form") {
      hideNoteForm();
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
        await deleteNoteRecord(note.id);
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
  initializeApp();
})();

import { Injectable } from '@angular/core';

import { AppProfile } from '../models/app-profile';
import { Expense } from '../models/expense';
import { Project } from '../models/project';
import { ProjectNote } from '../models/project-note';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly storageKey = 'budget-projects-manager-projects';
  private readonly userNotesStorageKey = 'budget-projects-manager-user-notes';
  private readonly profileStorageKey = 'budget-projects-manager-profile';
  private readonly defaultProfile: AppProfile = {
    name: 'Budget Manager',
    initials: 'BM',
  };

  private projects: Project[] = [];
  private userNotes: ProjectNote[] = [];
  private profile: AppProfile = this.defaultProfile;

  constructor() {
    this.loadFromStorage();
    this.loadUserNotesFromStorage();
    this.loadProfileFromStorage();
  }

  getProjects(): Project[] {
    return this.projects;
  }

  getProjectById(id: string): Project | undefined {
    return this.projects.find((project) => project.id === id);
  }

  getUserNotes(): ProjectNote[] {
    return this.userNotes;
  }

  getProfile(): AppProfile {
    return this.profile;
  }

  updateProfile(profile: AppProfile): void {
    this.profile = {
      name: profile.name.trim() || this.defaultProfile.name,
      initials: (profile.initials.trim() || this.defaultProfile.initials).substring(0, 3).toUpperCase(),
    };
    this.saveProfileToStorage();
  }

  addProject(project: Project): void {
    this.projects.push(project);
    this.saveToStorage();
  }

  updateProject(updatedProject: Project): void {
    this.projects = this.projects.map((project) => (project.id === updatedProject.id ? updatedProject : project));
    this.saveToStorage();
  }

  deleteProject(id: string): void {
    this.projects = this.projects.filter((project) => project.id !== id);
    this.saveToStorage();
  }

  updateProjectNote(projectId: string, note: string): void {
    const project = this.getProjectById(projectId);

    if (!project) {
      return;
    }

    project.note = note;
    this.saveToStorage();
  }

  addProjectNote(projectId: string, note: ProjectNote): void {
    const project = this.getProjectById(projectId);

    if (!project) {
      return;
    }

    project.notes = project.notes ?? [];
    project.notes.unshift(note);
    this.saveToStorage();
  }

  updateProjectNoteItem(projectId: string, updatedNote: ProjectNote): void {
    const project = this.getProjectById(projectId);

    if (!project || !project.notes) {
      return;
    }

    project.notes = project.notes.map((note) => (note.id === updatedNote.id ? updatedNote : note));
    this.saveToStorage();
  }

  deleteProjectNote(projectId: string, noteId: string): void {
    const project = this.getProjectById(projectId);

    if (!project || !project.notes) {
      return;
    }

    project.notes = project.notes.filter((note) => note.id !== noteId);
    this.saveToStorage();
  }

  addUserNote(note: ProjectNote): void {
    this.userNotes.unshift(note);
    this.saveUserNotesToStorage();
  }

  updateUserNote(updatedNote: ProjectNote): void {
    this.userNotes = this.userNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note));
    this.saveUserNotesToStorage();
  }

  deleteUserNote(noteId: string): void {
    this.userNotes = this.userNotes.filter((note) => note.id !== noteId);
    this.saveUserNotesToStorage();
  }

  addExpense(projectId: string, expense: Expense): void {
    const project = this.getProjectById(projectId);

    if (!project) {
      return;
    }

    project.expenses.push(expense);
    this.saveToStorage();
  }

  updateExpense(projectId: string, updatedExpense: Expense): void {
    const project = this.getProjectById(projectId);

    if (!project) {
      return;
    }

    project.expenses = project.expenses.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense));
    this.saveToStorage();
  }

  deleteExpense(projectId: string, expenseId: string): void {
    const project = this.getProjectById(projectId);

    if (!project) {
      return;
    }

    project.expenses = project.expenses.filter((expense) => expense.id !== expenseId);
    this.saveToStorage();
  }

  saveToStorage(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.projects));
  }

  saveUserNotesToStorage(): void {
    localStorage.setItem(this.userNotesStorageKey, JSON.stringify(this.userNotes));
  }

  saveProfileToStorage(): void {
    localStorage.setItem(this.profileStorageKey, JSON.stringify(this.profile));
  }

  loadFromStorage(): void {
    const storedProjects = localStorage.getItem(this.storageKey);

    // Si aucune donnee n'existe encore, l'application demarre avec une liste vide.
    if (!storedProjects) {
      this.projects = [];
      return;
    }

    try {
      this.projects = JSON.parse(storedProjects).map((project: Project) => ({
        ...project,
        note: project.note ?? '',
        notes: project.notes ?? this.createNotesFromLegacyNote(project),
        expenses: (project.expenses ?? []).map((expense) => ({
          ...expense,
          category: expense.category ?? '',
          note: expense.note ?? '',
        })),
      }));
    } catch {
      this.projects = [];
    }
  }

  calculateTotalExpenses(project: Project): number {
    return project.expenses.reduce((total, expense) => total + Number(expense.amount), 0);
  }

  calculateRemainingBudget(project: Project): number {
    return Number(project.estimatedBudget) - this.calculateTotalExpenses(project);
  }

  formatMoney(amount: number): string {
    return `${Math.round(Number(amount)).toLocaleString('fr-FR')} DH`;
  }

  exportBackup(): void {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: this.profile,
      projects: this.projects,
      userNotes: this.userNotes,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `budget-projects-backup-${new Date().toISOString().substring(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  restoreBackup(fileContent: string): void {
    const backup = JSON.parse(fileContent) as {
      profile?: AppProfile;
      projects?: Project[];
      userNotes?: ProjectNote[];
    };

    if (!Array.isArray(backup.projects) || !Array.isArray(backup.userNotes)) {
      throw new Error('Fichier backup invalide.');
    }

    this.projects = backup.projects.map((project) => ({
      ...project,
      note: project.note ?? '',
      notes: project.notes ?? [],
      expenses: (project.expenses ?? []).map((expense) => ({
        ...expense,
        category: expense.category ?? '',
        note: expense.note ?? '',
      })),
    }));
    this.userNotes = backup.userNotes;
    this.profile = backup.profile
      ? {
          name: backup.profile.name?.trim() || this.defaultProfile.name,
          initials: (backup.profile.initials?.trim() || this.defaultProfile.initials).substring(0, 3).toUpperCase(),
        }
      : this.defaultProfile;

    this.saveToStorage();
    this.saveUserNotesToStorage();
    this.saveProfileToStorage();
  }

  exportProjectToPdf(project: Project): void {
    const totalExpenses = this.calculateTotalExpenses(project);
    const remainingBudget = this.calculateRemainingBudget(project);
    const expensesRows = project.expenses
      .map(
        (expense) => `
          <tr>
            <td>${this.escapeHtml(expense.name)}</td>
            <td>${this.formatMoney(expense.amount)}</td>
            <td>${new Date(expense.date).toLocaleDateString('fr-FR')}</td>
            <td>${this.escapeHtml(expense.category || '-')}</td>
            <td>${this.escapeHtml(expense.note || '')}</td>
          </tr>
        `,
      )
      .join('');
    const notesRows = (project.notes ?? [])
      .map(
        (note) => `
          <article class="note">
            <h3>${this.escapeHtml(note.title)}</h3>
            <small>${new Date(note.updatedAt).toLocaleString('fr-FR')}</small>
            <p>${this.escapeHtml(note.content || '')}</p>
          </article>
        `,
      )
      .join('');

    const pdfWindow = window.open('', '_blank');

    if (!pdfWindow) {
      return;
    }

    pdfWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${this.escapeHtml(project.name)} - Rapport budgétaire</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            h1 { font-size: 34px; margin-bottom: 8px; }
            .muted { color: #6b7280; }
            .brand { color: #2563eb; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 24px 0; }
            .box { padding: 18px; border-radius: 14px; background: #f3f4f6; }
            .box strong { display: block; margin-top: 8px; font-size: 22px; }
            .danger { color: #e11d48; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
            th { background: #f9fafb; }
            .note { margin-top: 14px; padding: 16px; border-radius: 14px; background: #fff9cf; }
            .note h3 { margin: 0 0 6px; }
            .note p { white-space: pre-wrap; }
            @media print { button { display: none; } body { margin: 20px; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
          <p class="brand">Rapport budgétaire</p>
          <h1>${this.escapeHtml(project.name)}</h1>
          <p class="muted">${this.escapeHtml(project.description || 'Description non renseignée')}</p>
          <p class="muted">Créé le ${new Date(project.createdAt).toLocaleDateString('fr-FR')}</p>
          <div class="grid">
            <div class="box">Budget prévu<strong>${this.formatMoney(project.estimatedBudget)}</strong></div>
            <div class="box">Dépenses engagées<strong>${this.formatMoney(totalExpenses)}</strong></div>
            <div class="box">Budget disponible<strong class="${remainingBudget < 0 ? 'danger' : ''}">${this.formatMoney(remainingBudget)}</strong></div>
          </div>
          <h2>Dépenses</h2>
          <table>
            <thead>
              <tr><th>Nom</th><th>Montant</th><th>Date</th><th>Catégorie</th><th>Note</th></tr>
            </thead>
            <tbody>
              ${expensesRows || '<tr><td colspan="5">Aucune dépense.</td></tr>'}
            </tbody>
          </table>
          <h2>Notes</h2>
          ${notesRows || '<p class="muted">Aucune note pour ce projet.</p>'}
          <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
        </body>
      </html>
    `);
    pdfWindow.document.close();
  }

  private loadUserNotesFromStorage(): void {
    const storedNotes = localStorage.getItem(this.userNotesStorageKey);

    if (!storedNotes) {
      this.userNotes = [];
      return;
    }

    try {
      this.userNotes = JSON.parse(storedNotes);
    } catch {
      this.userNotes = [];
    }
  }

  private loadProfileFromStorage(): void {
    const storedProfile = localStorage.getItem(this.profileStorageKey);

    if (!storedProfile) {
      this.profile = this.defaultProfile;
      return;
    }

    try {
      const profile = JSON.parse(storedProfile) as AppProfile;
      this.profile = {
        name: profile.name?.trim() || this.defaultProfile.name,
        initials: (profile.initials?.trim() || this.defaultProfile.initials).substring(0, 3).toUpperCase(),
      };
    } catch {
      this.profile = this.defaultProfile;
    }
  }

  private createNotesFromLegacyNote(project: Project): ProjectNote[] {
    if (!project.note?.trim()) {
      return [];
    }

    return [
      {
        id: crypto.randomUUID(),
        title: 'Note de suivi',
        content: project.note,
        createdAt: project.createdAt,
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

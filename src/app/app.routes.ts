import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'add-project',
    loadComponent: () => import('./add-project/add-project.page').then((m) => m.AddProjectPage),
  },
  {
    path: 'edit-project/:id',
    loadComponent: () => import('./edit-project/edit-project.page').then((m) => m.EditProjectPage),
  },
  {
    path: 'project-details/:id',
    loadComponent: () =>
      import('./project-details/project-details.page').then((m) => m.ProjectDetailsPage),
  },
  {
    path: 'project-notes/:id',
    loadComponent: () => import('./project-notes/project-notes.page').then((m) => m.ProjectNotesPage),
  },
  {
    path: 'notes',
    loadComponent: () => import('./notes/notes.page').then((m) => m.NotesPage),
  },
  {
    path: 'stats',
    loadComponent: () => import('./stats/stats.page').then((m) => m.StatsPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'note-editor/new',
    loadComponent: () => import('./note-editor/note-editor.page').then((m) => m.NoteEditorPage),
  },
  {
    path: 'note-editor/new/:projectId',
    loadComponent: () => import('./note-editor/note-editor.page').then((m) => m.NoteEditorPage),
  },
  {
    path: 'note-editor/user/:noteId',
    loadComponent: () => import('./note-editor/note-editor.page').then((m) => m.NoteEditorPage),
  },
  {
    path: 'note-editor/:projectId/:noteId',
    loadComponent: () => import('./note-editor/note-editor.page').then((m) => m.NoteEditorPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];

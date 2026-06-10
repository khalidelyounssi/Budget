import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, saveOutline } from 'ionicons/icons';

import { Project } from '../models/project';
import { ProjectNote } from '../models/project-note';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-note-editor',
  templateUrl: './note-editor.page.html',
  styleUrls: ['./note-editor.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
  ],
})
export class NoteEditorPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);

  projects: Project[] = [];
  selectedProjectId = '';
  selectedNote?: ProjectNote;
  isUserNote = true;
  isSaving = false;
  noteTitle = '';
  noteContent = '';
  returnTo: 'notes' | 'project' = 'notes';
  private originalProjectId = '';
  private originalTitle = '';
  private originalContent = '';

  constructor() {
    addIcons({ arrowBackOutline, saveOutline });
  }

  ionViewWillEnter(): void {
    this.projects = this.projectService.getProjects();
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo') === 'project' ? 'project' : 'notes';
    this.isSaving = false;

    const projectId = this.route.snapshot.paramMap.get('projectId');
    const noteId = this.route.snapshot.paramMap.get('noteId');
    this.isUserNote = !projectId;
    this.selectedProjectId = projectId || '';

    if (noteId && this.isUserNote) {
      this.selectedNote = this.projectService.getUserNotes().find((note) => note.id === noteId);

      if (!this.selectedNote) {
        this.router.navigateByUrl(this.notesListLink);
        return;
      }

      this.noteTitle = this.selectedNote.title;
      this.noteContent = this.selectedNote.content;
      this.storeOriginalValues();
      return;
    }

    if (noteId && this.selectedProjectId) {
      const project = this.projectService.getProjectById(this.selectedProjectId);
      this.selectedNote = project?.notes?.find((note) => note.id === noteId);

      if (!this.selectedNote) {
        this.router.navigateByUrl(this.notesListLink);
        return;
      }

      this.noteTitle = this.selectedNote.title;
      this.noteContent = this.selectedNote.content;
      this.storeOriginalValues();
      return;
    }

    this.selectedNote = undefined;
    this.noteTitle = '';
    this.noteContent = '';
    this.storeOriginalValues();
  }

  get backLink(): string {
    return this.notesListLink;
  }

  get notesListLink(): string {
    if ((!this.isUserNote || this.returnTo === 'project') && this.selectedProjectId) {
      return `/project-notes/${this.selectedProjectId}`;
    }

    return '/notes';
  }

  get pageTitle(): string {
    return 'Note de suivi';
  }

  async saveNote(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    if (!this.isUserNote && !this.selectedProjectId) {
      const toast = await this.toastController.create({
        message: 'Sélectionnez un projet avant de sauvegarder la note.',
        duration: 1400,
        color: 'warning',
      });

      await toast.present();
      return;
    }

    if (!this.isUserNote && !this.projectService.getProjectById(this.selectedProjectId)) {
      const toast = await this.toastController.create({
        message: "Ce projet n'existe plus. La note n'a pas été sauvegardée.",
        duration: 1600,
        color: 'warning',
      });

      await toast.present();
      await this.router.navigateByUrl('/notes');
      return;
    }

    const title = this.noteTitle.trim() || 'Note sans titre';
    const content = this.noteContent.trim();

    if (!content) {
      const toast = await this.toastController.create({
        message: 'Ajoutez un contenu avant de sauvegarder la note.',
        duration: 1400,
        color: 'warning',
      });

      await toast.present();
      return;
    }

    const now = new Date().toISOString();
    this.isSaving = true;

    if (this.isUserNote && this.selectedNote) {
      this.projectService.updateUserNote({
        ...this.selectedNote,
        title,
        content,
        updatedAt: now,
      });
    } else if (this.isUserNote) {
      this.projectService.addUserNote({
        id: crypto.randomUUID(),
        title,
        content,
        createdAt: now,
        updatedAt: now,
      });
    } else if (this.selectedNote) {
      this.projectService.updateProjectNoteItem(this.selectedProjectId, {
        ...this.selectedNote,
        title,
        content,
        updatedAt: now,
      });
    } else {
      this.projectService.addProjectNote(this.selectedProjectId, {
        id: crypto.randomUUID(),
        title,
        content,
        createdAt: now,
        updatedAt: now,
      });
    }

    this.noteTitle = title;
    this.noteContent = content;
    this.storeOriginalValues();

    const toast = await this.toastController.create({
      message: 'Note sauvegardée.',
      duration: 1200,
      color: 'success',
    });

    await toast.present();
    await this.router.navigateByUrl(this.notesListLink, { replaceUrl: true });
  }

  async confirmLeave(): Promise<void> {
    if (!this.hasUnsavedChanges()) {
      await this.router.navigateByUrl(this.backLink);
      return;
    }

    const alert = await this.alertController.create({
      header: 'Quitter sans sauvegarder ?',
      message: 'Vous avez des changements non sauvegardés.',
      buttons: [
        {
          text: 'Rester',
          role: 'cancel',
        },
        {
          text: 'Quitter',
          role: 'destructive',
          handler: () => {
            this.router.navigateByUrl(this.backLink);
          },
        },
      ],
    });

    await alert.present();
  }

  private hasUnsavedChanges(): boolean {
    return (
      this.selectedProjectId !== this.originalProjectId ||
      this.noteTitle !== this.originalTitle ||
      this.noteContent !== this.originalContent
    );
  }

  private storeOriginalValues(): void {
    this.originalProjectId = this.selectedProjectId;
    this.originalTitle = this.noteTitle;
    this.originalContent = this.noteContent;
  }
}

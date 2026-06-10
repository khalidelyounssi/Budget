import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonItem,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  analyticsOutline,
  chatbubbleEllipsesOutline,
  homeOutline,
  personCircleOutline,
  trashOutline,
} from 'ionicons/icons';

import { ProjectNote } from '../models/project-note';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-notes',
  templateUrl: './notes.page.html',
  styleUrls: ['./notes.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonItem,
    IonSelect,
    IonSelectOption,
  ],
})
export class NotesPage {
  notes: ProjectNote[] = [];
  noteSortMode: 'updated-desc' | 'created-desc' | 'title' = 'updated-desc';

  constructor(
    private projectService: ProjectService,
    private alertController: AlertController,
  ) {
    addIcons({
      addOutline,
      analyticsOutline,
      chatbubbleEllipsesOutline,
      homeOutline,
      personCircleOutline,
      trashOutline,
    });
  }

  ionViewWillEnter(): void {
    this.notes = this.projectService.getUserNotes();
  }

  getSortedNotes(): ProjectNote[] {
    return [...this.notes].sort((firstNote, secondNote) => {
      if (this.noteSortMode === 'created-desc') {
        return new Date(secondNote.createdAt).getTime() - new Date(firstNote.createdAt).getTime();
      }

      if (this.noteSortMode === 'title') {
        return firstNote.title.localeCompare(secondNote.title, 'fr');
      }

      return new Date(secondNote.updatedAt).getTime() - new Date(firstNote.updatedAt).getTime();
    });
  }

  async confirmDeleteNote(note: ProjectNote, event: Event): Promise<void> {
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: 'Supprimer la note',
      message: `Voulez-vous supprimer "${note.title}" ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.projectService.deleteUserNote(note.id);
            this.notes = this.projectService.getUserNotes();
          },
        },
      ],
    });

    await alert.present();
  }
}

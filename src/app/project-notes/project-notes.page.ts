import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { IonCard, IonCardContent, IonContent, IonIcon, IonItem, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, arrowBackOutline, trashOutline } from 'ionicons/icons';

import { Project } from '../models/project';
import { ProjectNote } from '../models/project-note';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-project-notes',
  templateUrl: './project-notes.page.html',
  styleUrls: ['./project-notes.page.scss'],
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
export class ProjectNotesPage {
  project?: Project;
  noteSortMode: 'updated-desc' | 'created-desc' | 'title' = 'updated-desc';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private alertController: AlertController,
  ) {
    addIcons({ addOutline, arrowBackOutline, trashOutline });
  }

  ionViewWillEnter(): void {
    const projectId = this.route.snapshot.paramMap.get('id');

    if (!projectId) {
      this.router.navigateByUrl('/home');
      return;
    }

    this.project = this.projectService.getProjectById(projectId);

    if (!this.project) {
      this.router.navigateByUrl('/home');
      return;
    }
  }

  get notes(): ProjectNote[] {
    return this.project?.notes ?? [];
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

    if (!this.project) {
      return;
    }

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
            if (!this.project) {
              return;
            }

            this.projectService.deleteProjectNote(this.project.id, note.id);
            this.project = this.projectService.getProjectById(this.project.id);
          },
        },
      ],
    });

    await alert.present();
  }
}

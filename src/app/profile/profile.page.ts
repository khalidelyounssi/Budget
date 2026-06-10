import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonInput, IonItem } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  analyticsOutline,
  chatbubbleEllipsesOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  homeOutline,
  personCircleOutline,
  saveOutline,
} from 'ionicons/icons';

import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [CommonModule, FormsModule, RouterLink, IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonInput, IonItem],
})
export class ProfilePage {
  projectService = inject(ProjectService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);

  profileName = '';

  constructor() {
    addIcons({
      addOutline,
      analyticsOutline,
      chatbubbleEllipsesOutline,
      cloudDownloadOutline,
      cloudUploadOutline,
      homeOutline,
      personCircleOutline,
      saveOutline,
    });
  }

  ionViewWillEnter(): void {
    const profile = this.projectService.getProfile();
    this.profileName = profile.name;
  }

  get projectsCount(): number {
    return this.projectService.getProjects().length;
  }

  get notesCount(): number {
    return this.projectService.getUserNotes().length;
  }

  async saveProfile(): Promise<void> {
    this.projectService.updateProfile({
      name: this.profileName,
      initials: this.createInitials(this.profileName),
    });
    this.ionViewWillEnter();
    await this.showToast('Profil sauvegardé.', 'success');
  }

  exportBackup(): void {
    this.projectService.exportBackup();
  }

  async restoreBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Restaurer backup',
      message: 'Cette action remplace tous les projets, dépenses, notes et le profil par le contenu du fichier JSON.',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
          handler: () => {
            input.value = '';
          },
        },
        {
          text: 'Restaurer',
          role: 'destructive',
          handler: () => {
            void this.restoreBackupFile(file, input);
          },
        },
      ],
    });

    await alert.present();
  }

  private async restoreBackupFile(file: File, input: HTMLInputElement): Promise<void> {
    try {
      const content = await file.text();
      this.projectService.restoreBackup(content);
      this.ionViewWillEnter();
      await this.showToast('Backup restauré.', 'success');
    } catch {
      await this.showToast('Fichier backup invalide.', 'danger');
    } finally {
      input.value = '';
    }
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 1600,
      color,
    });

    await toast.present();
  }

  private createInitials(name: string): string {
    const initials = name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();

    return initials || 'BM';
  }
}

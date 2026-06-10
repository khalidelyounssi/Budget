import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonText,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, saveOutline } from 'ionicons/icons';

import { Project } from '../models/project';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-add-project',
  templateUrl: './add-project.page.html',
  styleUrls: ['./add-project.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonText,
    IonTextarea,
  ],
})
export class AddProjectPage {
  private formBuilder = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private toastController = inject(ToastController);
  isSavingProject = false;

  projectForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    estimatedBudget: [0, [Validators.required, Validators.min(0.01)]],
  });

  constructor() {
    addIcons({ arrowBackOutline, saveOutline });
  }

  async addProject(): Promise<void> {
    if (this.isSavingProject) {
      return;
    }

    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const formValue = this.projectForm.getRawValue();
    this.isSavingProject = true;
    this.projectForm.disable();

    // Le projet contient déjà un tableau de dépenses vide pour faciliter les calculs.
    const project: Project = {
      id: crypto.randomUUID(),
      name: formValue.name.trim(),
      description: formValue.description.trim(),
      estimatedBudget: Number(formValue.estimatedBudget),
      createdAt: new Date().toISOString(),
      note: '',
      expenses: [],
    };

    this.projectService.addProject(project);

    const toast = await this.toastController.create({
      message: 'Projet ajouté avec succès.',
      duration: 1600,
      color: 'success',
    });

    await toast.present();
    await this.router.navigateByUrl('/home', { replaceUrl: true });
  }
}

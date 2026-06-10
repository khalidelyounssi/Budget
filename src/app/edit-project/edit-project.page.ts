import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  selector: 'app-edit-project',
  templateUrl: './edit-project.page.html',
  styleUrls: ['./edit-project.page.scss'],
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
export class EditProjectPage {
  project?: Project;

  projectForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    estimatedBudget: [0, [Validators.required, Validators.min(0.01)]],
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private projectService: ProjectService,
    private toastController: ToastController,
  ) {
    addIcons({ arrowBackOutline, saveOutline });
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

    this.projectForm.patchValue({
      name: this.project.name,
      description: this.project.description,
      estimatedBudget: this.project.estimatedBudget,
    });
  }

  async updateProject(): Promise<void> {
    if (!this.project) {
      return;
    }

    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const formValue = this.projectForm.getRawValue();

    this.projectService.updateProject({
      ...this.project,
      name: formValue.name.trim(),
      description: formValue.description.trim(),
      estimatedBudget: Number(formValue.estimatedBudget),
    });

    const toast = await this.toastController.create({
      message: 'Projet modifié avec succès.',
      duration: 1400,
      color: 'success',
    });

    await toast.present();
    await this.router.navigate(['/project-details', this.project.id]);
  }
}

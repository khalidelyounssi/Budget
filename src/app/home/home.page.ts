import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  analyticsOutline,
  arrowForwardOutline,
  cashOutline,
  chatbubbleEllipsesOutline,
  homeOutline,
  notificationsOutline,
  optionsOutline,
  documentTextOutline,
  personCircleOutline,
  searchOutline,
  trashOutline,
  walletOutline,
} from 'ionicons/icons';

import { Project } from '../models/project';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonSelect,
    IonSelectOption,
  ],
})
export class HomePage {
  projects: Project[] = [];
  searchTerm = '';
  activeFilter: 'all' | 'available' | 'over' = 'all';
  sortMode: 'newest' | 'budget-desc' | 'expenses-desc' | 'remaining-asc' | 'name' = 'newest';

  constructor(
    public projectService: ProjectService,
    private router: Router,
    private alertController: AlertController,
  ) {
    addIcons({
      addOutline,
      analyticsOutline,
      arrowForwardOutline,
      cashOutline,
      chatbubbleEllipsesOutline,
      documentTextOutline,
      homeOutline,
      notificationsOutline,
      optionsOutline,
      personCircleOutline,
      searchOutline,
      trashOutline,
      walletOutline,
    });
  }

  ionViewWillEnter(): void {
    this.projects = this.projectService.getProjects();
  }

  getTotalExpenses(project: Project): number {
    return this.projectService.calculateTotalExpenses(project);
  }

  getRemainingBudget(project: Project): number {
    return this.projectService.calculateRemainingBudget(project);
  }

  getTotalEstimatedBudget(): number {
    return this.projects.reduce((total, project) => total + Number(project.estimatedBudget), 0);
  }

  getAllExpensesTotal(): number {
    return this.projects.reduce((total, project) => total + this.getTotalExpenses(project), 0);
  }

  getFilteredProjects(): Project[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();

    return this.projects
      .filter((project) => {
        const matchesSearch =
          !normalizedSearch ||
          project.name.toLowerCase().includes(normalizedSearch) ||
          project.description.toLowerCase().includes(normalizedSearch);

        const remainingBudget = this.getRemainingBudget(project);
        const matchesFilter =
          this.activeFilter === 'all' ||
          (this.activeFilter === 'available' && remainingBudget >= 0) ||
          (this.activeFilter === 'over' && remainingBudget < 0);

        return matchesSearch && matchesFilter;
      })
      .sort((firstProject, secondProject) => this.sortProjects(firstProject, secondProject));
  }

  getBudgetMessage(project: Project): string {
    const remainingBudget = this.getRemainingBudget(project);

    if (remainingBudget > 0) {
      return `Il reste ${this.formatMoney(remainingBudget)}`;
    }

    if (remainingBudget === 0) {
      return 'Le budget est exactement utilisé';
    }

    return `Budget dépassé de ${this.formatMoney(Math.abs(remainingBudget))}`;
  }

  formatMoney(amount: number): string {
    return this.projectService.formatMoney(amount);
  }

  getProfileInitials(): string {
    return this.projectService.getProfile().initials;
  }

  getProfileName(): string {
    return this.projectService.getProfile().name;
  }

  getBudgetUsedWidth(project: Project): number {
    const totalExpenses = this.getTotalExpenses(project);

    if (project.estimatedBudget <= 0 || totalExpenses <= 0) {
      return 0;
    }

    if (totalExpenses > project.estimatedBudget) {
      return (project.estimatedBudget / totalExpenses) * 100;
    }

    return Math.min((totalExpenses / project.estimatedBudget) * 100, 100);
  }

  getBudgetExceededWidth(project: Project): number {
    const totalExpenses = this.getTotalExpenses(project);

    if (project.estimatedBudget <= 0 || totalExpenses <= project.estimatedBudget) {
      return 0;
    }

    return ((totalExpenses - project.estimatedBudget) / totalExpenses) * 100;
  }

  openProject(projectId: string): void {
    this.router.navigate(['/project-details', projectId]);
  }

  setFilter(filter: 'all' | 'available' | 'over'): void {
    this.activeFilter = filter;
  }

  exportProject(project: Project, event: Event): void {
    event.stopPropagation();
    this.projectService.exportProjectToPdf(project);
  }

  async confirmDeleteProject(project: Project, event?: Event): Promise<void> {
    // La carte complète est cliquable, donc on stoppe le clic du bouton supprimer.
    event?.stopPropagation();

    const alert = await this.alertController.create({
      header: 'Supprimer le projet',
      message: `Voulez-vous supprimer "${project.name}" ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.projectService.deleteProject(project.id);
            this.projects = this.projectService.getProjects();
          },
        },
      ],
    });

    await alert.present();
  }

  private sortProjects(firstProject: Project, secondProject: Project): number {
    if (this.sortMode === 'budget-desc') {
      return Number(secondProject.estimatedBudget) - Number(firstProject.estimatedBudget);
    }

    if (this.sortMode === 'expenses-desc') {
      return this.getTotalExpenses(secondProject) - this.getTotalExpenses(firstProject);
    }

    if (this.sortMode === 'remaining-asc') {
      return this.getRemainingBudget(firstProject) - this.getRemainingBudget(secondProject);
    }

    if (this.sortMode === 'name') {
      return firstProject.name.localeCompare(secondProject.name, 'fr');
    }

    return new Date(secondProject.createdAt).getTime() - new Date(firstProject.createdAt).getTime();
  }
}

import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonCardContent, IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, analyticsOutline, chatbubbleEllipsesOutline, homeOutline, personCircleOutline, walletOutline } from 'ionicons/icons';

import { Project } from '../models/project';
import { ProjectService } from '../services/project.service';

interface ExpenseSummary {
  projectName: string;
  name: string;
  amount: number;
  date: string;
  category?: string;
}

@Component({
  selector: 'app-stats',
  templateUrl: './stats.page.html',
  styleUrls: ['./stats.page.scss'],
  imports: [CommonModule, RouterLink, IonCard, IonCardContent, IonContent, IonIcon],
})
export class StatsPage {
  private projectService = inject(ProjectService);

  projects: Project[] = [];

  constructor() {
    addIcons({ addOutline, analyticsOutline, chatbubbleEllipsesOutline, homeOutline, personCircleOutline, walletOutline });
  }

  ionViewWillEnter(): void {
    this.projects = this.projectService.getProjects();
  }

  get totalBudget(): number {
    return this.projects.reduce((total, project) => total + project.estimatedBudget, 0);
  }

  get totalExpenses(): number {
    return this.projects.reduce((total, project) => total + this.projectService.calculateTotalExpenses(project), 0);
  }

  get remaining(): number {
    return this.totalBudget - this.totalExpenses;
  }

  get overBudgetProjects(): number {
    return this.projects.filter((project) => this.projectService.calculateRemainingBudget(project) < 0).length;
  }

  get usedWidth(): number {
    if (this.totalBudget <= 0) {
      return 0;
    }

    return Math.min((this.totalExpenses / this.totalBudget) * 100, 100);
  }

  get topSpentProject(): Project | undefined {
    return [...this.projects].sort((firstProject, secondProject) => {
      return this.projectService.calculateTotalExpenses(secondProject) - this.projectService.calculateTotalExpenses(firstProject);
    })[0];
  }

  get bestRemainingProject(): Project | undefined {
    return [...this.projects].sort((firstProject, secondProject) => {
      return this.projectService.calculateRemainingBudget(secondProject) - this.projectService.calculateRemainingBudget(firstProject);
    })[0];
  }

  get topCategory(): { name: string; amount: number } | undefined {
    const totals = new Map<string, number>();

    this.projects.forEach((project) => {
      project.expenses.forEach((expense) => {
        const category = expense.category || 'Sans catégorie';
        totals.set(category, (totals.get(category) ?? 0) + Number(expense.amount));
      });
    });

    return [...totals.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((firstCategory, secondCategory) => secondCategory.amount - firstCategory.amount)[0];
  }

  get latestExpenses(): ExpenseSummary[] {
    const expenses: ExpenseSummary[] = [];

    this.projects.forEach((project) => {
      project.expenses.forEach((expense) => {
        expenses.push({
          projectName: project.name,
          name: expense.name,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
        });
      });
    });

    return expenses
      .sort((firstExpense, secondExpense) => new Date(secondExpense.date).getTime() - new Date(firstExpense.date).getTime())
      .slice(0, 5);
  }

  getProjectExpenses(project: Project | undefined): number {
    return project ? this.projectService.calculateTotalExpenses(project) : 0;
  }

  getProjectRemaining(project: Project | undefined): number {
    return project ? this.projectService.calculateRemainingBudget(project) : 0;
  }

  formatMoney(amount: number): string {
    return this.projectService.formatMoney(amount);
  }
}

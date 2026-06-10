import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  arrowBackOutline,
  calendarOutline,
  closeCircleOutline,
  createOutline,
  documentTextOutline,
  pencilOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';

import { Expense } from '../models/expense';
import { Project } from '../models/project';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-project-details',
  templateUrl: './project-details.page.html',
  styleUrls: ['./project-details.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonText,
    IonTextarea,
  ],
})
export class ProjectDetailsPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);

  project?: Project;
  showExpenseForm = false;
  editingExpenseId?: string;
  expenseSearchTerm = '';
  expenseSortMode: 'newest' | 'oldest' | 'amount-desc' | 'amount-asc' | 'name' = 'newest';
  expenseCategories = ['Peinture', 'Tissu', 'Portes', 'Transport', "Main d'oeuvre", 'Matériel', 'Autre'];

  expenseForm = this.formBuilder.group({
    name: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    date: [this.getTodayDate(), Validators.required],
    category: [''],
    note: [''],
  });

  constructor() {
    addIcons({
      addCircleOutline,
      arrowBackOutline,
      calendarOutline,
      closeCircleOutline,
      createOutline,
      documentTextOutline,
      pencilOutline,
      searchOutline,
      trashOutline,
    });
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

  get totalExpenses(): number {
    return this.project ? this.projectService.calculateTotalExpenses(this.project) : 0;
  }

  get remainingBudget(): number {
    return this.project ? this.projectService.calculateRemainingBudget(this.project) : 0;
  }

  get budgetMessage(): string {
    if (this.remainingBudget > 0) {
      return `Il reste ${this.formatMoney(this.remainingBudget)}`;
    }

    if (this.remainingBudget === 0) {
      return 'Le budget est exactement utilisé';
    }

    return `Budget dépassé de ${this.formatMoney(Math.abs(this.remainingBudget))}`;
  }

  get budgetUsedWidth(): number {
    if (!this.project || this.project.estimatedBudget <= 0 || this.totalExpenses <= 0) {
      return 0;
    }

    if (this.totalExpenses > this.project.estimatedBudget) {
      return (this.project.estimatedBudget / this.totalExpenses) * 100;
    }

    return Math.min((this.totalExpenses / this.project.estimatedBudget) * 100, 100);
  }

  get budgetExceededWidth(): number {
    if (!this.project || this.project.estimatedBudget <= 0 || this.totalExpenses <= this.project.estimatedBudget) {
      return 0;
    }

    return ((this.totalExpenses - this.project.estimatedBudget) / this.totalExpenses) * 100;
  }

  toggleExpenseForm(): void {
    this.showExpenseForm = !this.showExpenseForm;

    if (!this.showExpenseForm) {
      this.cancelEditExpense();
    }
  }

  get filteredExpenses(): Expense[] {
    const normalizedSearch = this.expenseSearchTerm.trim().toLowerCase();
    const expenses = this.project?.expenses ?? [];

    return expenses
      .filter((expense) => {
        return (
          !normalizedSearch ||
          expense.name.toLowerCase().includes(normalizedSearch) ||
          expense.date.includes(normalizedSearch) ||
          (expense.category ?? '').toLowerCase().includes(normalizedSearch) ||
          (expense.note ?? '').toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((firstExpense, secondExpense) => this.sortExpenses(firstExpense, secondExpense));
  }

  formatMoney(amount: number): string {
    return this.projectService.formatMoney(amount);
  }

  exportProject(): void {
    if (!this.project) {
      return;
    }

    this.projectService.exportProjectToPdf(this.project);
  }

  editExpense(expense: Expense): void {
    this.editingExpenseId = expense.id;
    this.showExpenseForm = true;
    this.expenseForm.patchValue({
      name: expense.name,
      amount: expense.amount,
      date: expense.date,
      category: expense.category ?? '',
      note: expense.note ?? '',
    });
  }

  cancelEditExpense(): void {
    this.editingExpenseId = undefined;
    this.resetExpenseForm();
  }

  async addExpense(): Promise<void> {
    if (!this.project) {
      return;
    }

    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const formValue = this.expenseForm.getRawValue();
    const isEditing = Boolean(this.editingExpenseId);

    const expense: Expense = {
      id: this.editingExpenseId ?? crypto.randomUUID(),
      name: formValue.name?.trim() ?? '',
      amount: Number(formValue.amount),
      date: formValue.date ?? this.getTodayDate(),
      category: formValue.category?.trim() || undefined,
      note: formValue.note?.trim() || undefined,
    };

    if (isEditing) {
      this.projectService.updateExpense(this.project.id, expense);
    } else {
      this.projectService.addExpense(this.project.id, expense);
    }

    // On recharge la référence du projet pour afficher tout de suite les nouveaux calculs.
    this.project = this.projectService.getProjectById(this.project.id);
    this.resetExpenseForm();
    this.showExpenseForm = false;
    this.editingExpenseId = undefined;

    const toast = await this.toastController.create({
      message: isEditing ? 'Dépense modifiée.' : 'Dépense sauvegardée.',
      duration: 1400,
      color: 'success',
    });

    await toast.present();
  }

  async confirmDeleteExpense(expense: Expense): Promise<void> {
    if (!this.project) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Supprimer la dépense',
      message: `Voulez-vous supprimer "${expense.name}" ?`,
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

            this.projectService.deleteExpense(this.project.id, expense.id);
            this.project = this.projectService.getProjectById(this.project.id);
          },
        },
      ],
    });

    await alert.present();
  }

  private resetExpenseForm(): void {
    this.expenseForm.reset({
      name: '',
      amount: null,
      date: this.getTodayDate(),
      category: '',
      note: '',
    });
  }

  private getTodayDate(): string {
    return new Date().toISOString().substring(0, 10);
  }

  private sortExpenses(firstExpense: Expense, secondExpense: Expense): number {
    if (this.expenseSortMode === 'oldest') {
      return new Date(firstExpense.date).getTime() - new Date(secondExpense.date).getTime();
    }

    if (this.expenseSortMode === 'amount-desc') {
      return Number(secondExpense.amount) - Number(firstExpense.amount);
    }

    if (this.expenseSortMode === 'amount-asc') {
      return Number(firstExpense.amount) - Number(secondExpense.amount);
    }

    if (this.expenseSortMode === 'name') {
      return firstExpense.name.localeCompare(secondExpense.name, 'fr');
    }

    return new Date(secondExpense.date).getTime() - new Date(firstExpense.date).getTime();
  }
}

import { Expense } from './expense';
import { ProjectNote } from './project-note';

export interface Project {
  id: string;
  name: string;
  description: string;
  estimatedBudget: number;
  createdAt: string;
  note?: string;
  notes?: ProjectNote[];
  expenses: Expense[];
}

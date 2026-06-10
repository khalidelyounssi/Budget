export interface Expense {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: string;
  note?: string;
}

import { createId, normalizeName, parseAmount } from "./utils.js";

export function normalizeExpense(expense) {
  return {
    id: expense.id || createId(),
    name: normalizeName(expense.name) || "Dépense sans nom",
    amount: parseAmount(expense.amount),
    date: expense.date || new Date().toISOString().substring(0, 10),
    supplier: normalizeName(expense.supplier),
    phase: normalizeName(expense.phase || expense.part || expense.partId) || "Général",
    note: expense.note || "",
    linkedExpenseIds: Array.isArray(expense.linkedExpenseIds) ? expense.linkedExpenseIds : [],
  };
}

export function addExpense(project, expenseData) {
  const expense = normalizeExpense({
    id: createId(),
    ...expenseData,
  });

  project.expenses.unshift(expense);
  return expense;
}

export function deleteExpense(project, expenseId) {
  project.expenses = project.expenses.filter((expense) => expense.id !== expenseId);
}

export function filterExpenses(project, query) {
  if (!query) {
    return project.expenses;
  }

  const normalizedQuery = query.toLowerCase();
  return project.expenses.filter((expense) => {
    return [expense.name, expense.supplier, expense.phase, expense.note]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function getLinkedExpenses(project, expense) {
  return project.expenses.filter((item) => expense.linkedExpenseIds.includes(item.id));
}

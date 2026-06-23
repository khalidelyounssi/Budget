import { buildProjectPhases, createId, normalizeName, parseAmount } from "./utils.js";
import { normalizeExpense } from "./expenses.js";

export function normalizeProject(project) {
  return {
    id: project.id || createId(),
    name: normalizeName(project.name) || "Projet sans nom",
    description: project.description || "",
    estimatedBudget: parseAmount(project.estimatedBudget),
    createdAt: project.createdAt || new Date().toISOString(),
    status: project.status === "completed" ? "completed" : "active",
    phases: buildProjectPhases(project.phases || project.parts),
    expenses: Array.isArray(project.expenses) ? project.expenses.map(normalizeExpense) : [],
  };
}

export function createProject(name, estimatedBudget) {
  return normalizeProject({
    id: createId(),
    name,
    estimatedBudget,
    createdAt: new Date().toISOString(),
    status: "active",
    phases: ["Général"],
    expenses: [],
  });
}

export function getProjectTotal(project) {
  return project.expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
}

export function getRemainingBudget(project) {
  return Number(project.estimatedBudget || 0) - getProjectTotal(project);
}

export function hasProjectBudget(project) {
  return Number(project.estimatedBudget || 0) > 0;
}

export function getProgress(project) {
  if (!hasProjectBudget(project)) {
    return 0;
  }

  return Math.min(Math.round((getProjectTotal(project) / project.estimatedBudget) * 100), 100);
}

export function filterProjects(projects, filterName) {
  return projects.filter((project) => {
    return filterName === "completed" ? project.status === "completed" : project.status !== "completed";
  });
}

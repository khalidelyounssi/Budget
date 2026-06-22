import { getProjectTotal, getRemainingBudget } from "./projects.js";

export function buildProjectExport(project, currency) {
  return {
    exportDate: new Date().toISOString(),
    currency,
    project: {
      id: project.id,
      name: project.name,
      description: project.description || "",
      estimatedBudget: project.estimatedBudget,
      totalExpenses: getProjectTotal(project),
      remainingBudget: getRemainingBudget(project),
      createdAt: project.createdAt,
      status: project.status,
      phases: project.phases,
      expenses: project.expenses,
    },
  };
}

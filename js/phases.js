import { buildProjectPhases, normalizeName } from "./utils.js";

export function ensureProjectPhases(project) {
  project.phases = buildProjectPhases(project.phases || project.parts);
  delete project.parts;
  return project.phases;
}

export function addPhase(project, rawPhase) {
  const phaseName = normalizeName(rawPhase);

  if (!phaseName) {
    return { ok: false, reason: "empty" };
  }

  const phases = ensureProjectPhases(project);
  const exists = phases.some((phase) => phase.toLowerCase() === phaseName.toLowerCase());

  if (exists) {
    return { ok: false, reason: "duplicate" };
  }

  project.phases = [...phases, phaseName];
  return { ok: true, phaseName };
}

export function renamePhase(project, oldPhaseName, newRawPhaseName) {
  const newPhaseName = normalizeName(newRawPhaseName);

  if (!newPhaseName) {
    return { ok: false, reason: "empty" };
  }

  if (oldPhaseName === "Général") {
    return { ok: false, reason: "protected" };
  }

  const phases = ensureProjectPhases(project);
  const duplicate = phases.some((phase) => phase.toLowerCase() === newPhaseName.toLowerCase() && phase !== oldPhaseName);

  if (duplicate) {
    return { ok: false, reason: "duplicate" };
  }

  project.phases = phases.map((phase) => (phase === oldPhaseName ? newPhaseName : phase));
  project.expenses = project.expenses.map((expense) => {
    return expense.phase === oldPhaseName ? { ...expense, phase: newPhaseName } : expense;
  });

  return { ok: true, phaseName: newPhaseName };
}

export function deletePhase(project, phaseName) {
  if (phaseName === "Général") {
    return { ok: false, reason: "protected" };
  }

  const phases = ensureProjectPhases(project);
  project.phases = phases.filter((phase) => phase !== phaseName);
  project.expenses = project.expenses.map((expense) => {
    return expense.phase === phaseName ? { ...expense, phase: "Général" } : expense;
  });

  return { ok: true };
}

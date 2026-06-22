import { getProjectTotal, getRemainingBudget } from "./projects.js";
import { formatDate, formatMoney } from "./utils.js";

function normalizeQuestion(question) {
  return String(question || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.,;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createOption(label, query) {
  return { label, query: query || label };
}

function createResponse(text, options) {
  return {
    text,
    options: Array.isArray(options) ? options : [],
  };
}

function getQuickOptions() {
  return [
    createOption("Résumé du projet", "Faites un résumé du projet"),
    createOption("Budget restant", "Quel est le budget restant ?"),
    createOption("Plus grande dépense", "Quelle est la plus grande dépense ?"),
    createOption("Dépenses par phase", "Montrez les dépenses par phase"),
  ];
}

function getBudgetOptions() {
  return [
    createOption("Budget restant", "Quel est le budget restant ?"),
    createOption("Total dépensé", "Quel est le total dépensé ?"),
    createOption("Dépassement", "Le projet dépasse-t-il le budget ?"),
    createOption("Résumé du projet", "Faites un résumé du projet"),
  ];
}

function getPhaseOptions() {
  return [
    createOption("Dépenses par phase", "Montrez les dépenses par phase"),
    createOption("Phase la plus coûteuse", "Quelle est la phase la plus coûteuse ?"),
    createOption("Liste des phases", "Quelles sont les phases du projet ?"),
  ];
}

function getExpenseOptions() {
  return [
    createOption("Total dépensé", "Quel est le total dépensé ?"),
    createOption("Plus grande dépense", "Quelle est la plus grande dépense ?"),
    createOption("Dernière dépense", "Quelle est la dernière dépense ?"),
    createOption("Nombre de dépenses", "Combien de dépenses sont enregistrées ?"),
  ];
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function scoreIntent(text, keywords) {
  return keywords.reduce((score, keyword) => {
    if (!text.includes(keyword)) {
      return score;
    }

    return score + (keyword.includes(" ") ? 2 : 1);
  }, 0);
}

function getBiggestExpense(project) {
  return [...project.expenses].sort((firstItem, secondItem) => secondItem.amount - firstItem.amount)[0] || null;
}

function getLatestExpense(project) {
  return [...project.expenses].sort((firstItem, secondItem) => {
    return new Date(secondItem.date).getTime() - new Date(firstItem.date).getTime();
  })[0] || null;
}

function getPhaseTotals(project) {
  return project.phases.map((phase) => {
    const matchingExpenses = project.expenses.filter((expense) => expense.phase === phase);

    return {
      phase,
      total: matchingExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      count: matchingExpenses.length,
    };
  });
}

function buildSummaryAnswer(project, currency) {
  const total = getProjectTotal(project);
  const remaining = getRemainingBudget(project);
  const biggestExpense = getBiggestExpense(project);
  const latestExpense = getLatestExpense(project);
  const summaryLines = [
    `Voici le résumé du projet ${project.name}.`,
    `Budget total: ${formatMoney(project.estimatedBudget, currency)}.`,
    `Dépenses enregistrées: ${project.expenses.length}.`,
    `Montant dépensé: ${formatMoney(total, currency)}.`,
  ];

  if (remaining >= 0) {
    summaryLines.push(`Budget restant: ${formatMoney(remaining, currency)}.`);
  } else {
    summaryLines.push(`Le budget est dépassé de ${formatMoney(Math.abs(remaining), currency)}.`);
  }

  if (biggestExpense) {
    summaryLines.push(`La dépense la plus élevée est ${biggestExpense.name} pour ${formatMoney(biggestExpense.amount, currency)}.`);
  }

  if (latestExpense) {
    summaryLines.push(`Dernière dépense enregistrée: ${latestExpense.name} le ${formatDate(latestExpense.date)}.`);
  }

  return createResponse(summaryLines.join(" "), getQuickOptions());
}

function buildBudgetAnswer(project, currency) {
  const total = getProjectTotal(project);
  const remaining = getRemainingBudget(project);

  if (remaining >= 0) {
    return createResponse(
      `Le projet a consommé ${formatMoney(total, currency)} sur ${formatMoney(project.estimatedBudget, currency)}. Le budget restant est de ${formatMoney(remaining, currency)}.`,
      getBudgetOptions()
    );
  }

  return createResponse(
    `Le projet a dépassé son budget de ${formatMoney(Math.abs(remaining), currency)}. Le total dépensé atteint ${formatMoney(total, currency)} pour un budget initial de ${formatMoney(project.estimatedBudget, currency)}.`,
    getBudgetOptions()
  );
}

function buildTotalSpentAnswer(project, currency) {
  return createResponse(
    `Le total des dépenses enregistrées est de ${formatMoney(getProjectTotal(project), currency)}.`,
    getExpenseOptions()
  );
}

function buildBiggestExpenseAnswer(project, currency) {
  const biggestExpense = getBiggestExpense(project);

  if (!biggestExpense) {
    return createResponse("Aucune dépense n'est encore enregistrée pour ce projet.", getExpenseOptions());
  }

  return createResponse(
    `La plus grande dépense est ${biggestExpense.name} pour ${formatMoney(biggestExpense.amount, currency)} dans la phase ${biggestExpense.phase}.`,
    getExpenseOptions()
  );
}

function buildLatestExpenseAnswer(project, currency) {
  const latestExpense = getLatestExpense(project);

  if (!latestExpense) {
    return createResponse("Aucune dépense n'est encore enregistrée pour ce projet.", getExpenseOptions());
  }

  return createResponse(
    `La dernière dépense enregistrée est ${latestExpense.name}, le ${formatDate(latestExpense.date)}, pour ${formatMoney(latestExpense.amount, currency)}.`,
    getExpenseOptions()
  );
}

function buildAverageExpenseAnswer(project, currency) {
  if (!project.expenses.length) {
    return createResponse("Aucune dépense n'est encore enregistrée pour calculer une moyenne.", getExpenseOptions());
  }

  const average = getProjectTotal(project) / project.expenses.length;
  return createResponse(
    `La dépense moyenne est de ${formatMoney(average, currency)} sur ${project.expenses.length} dépense(s).`,
    getExpenseOptions()
  );
}

function buildExpenseCountAnswer(project) {
  return createResponse(
    `${project.expenses.length} dépense(s) sont enregistrées dans ce projet.`,
    getExpenseOptions()
  );
}

function buildPhaseAnswer(project, currency) {
  const phaseTotals = getPhaseTotals(project).filter((item) => item.total > 0);

  if (!phaseTotals.length) {
    return createResponse("Aucune dépense n'est encore ventilée par phase.", getPhaseOptions());
  }

  const topPhase = [...phaseTotals].sort((firstItem, secondItem) => secondItem.total - firstItem.total)[0];
  const details = phaseTotals
    .map((item) => `${item.phase}: ${formatMoney(item.total, currency)} (${item.count} dépense${item.count > 1 ? "s" : ""})`)
    .join(" • ");

  return createResponse(
    `Répartition par phase: ${details}. La phase la plus coûteuse est ${topPhase.phase} avec ${formatMoney(topPhase.total, currency)}.`,
    getPhaseOptions()
  );
}

function buildPhaseListAnswer(project) {
  return createResponse(
    `Les phases du projet sont: ${project.phases.join(" • ")}.`,
    getPhaseOptions()
  );
}

function buildSupplierAnswer(project, currency) {
  const supplierTotals = new Map();

  project.expenses.forEach((expense) => {
    if (!expense.supplier) {
      return;
    }

    supplierTotals.set(expense.supplier, (supplierTotals.get(expense.supplier) || 0) + expense.amount);
  });

  if (!supplierTotals.size) {
    return createResponse("Aucun fournisseur n'est renseigné pour le moment.", [
      createOption("Dernière dépense", "Quelle est la dernière dépense ?"),
      createOption("Dépenses par phase", "Montrez les dépenses par phase"),
    ]);
  }

  const topSupplier = [...supplierTotals.entries()].sort((firstItem, secondItem) => secondItem[1] - firstItem[1])[0];
  return createResponse(
    `Le fournisseur le plus coûteux est ${topSupplier[0]} avec ${formatMoney(topSupplier[1], currency)}.`,
    [
      createOption("Plus grande dépense", "Quelle est la plus grande dépense ?"),
      createOption("Budget restant", "Quel est le budget restant ?"),
    ]
  );
}

function buildWelcomeMessage(project, currency) {
  if (!project) {
    return createResponse(
      "Bonjour. Je peux vous aider à analyser un budget de projet, les dépenses, les phases et les écarts.",
      getQuickOptions()
    );
  }

  return createResponse(
    `Bonjour. Je peux vous aider à analyser le projet ${project.name}. Posez une question claire ou choisissez un sujet ci-dessous pour obtenir une réponse précise sur le budget, les dépenses ou les phases.`,
    [
      createOption("Résumé du projet", "Faites un résumé du projet"),
      createOption("Budget restant", "Quel est le budget restant ?"),
      createOption("Total dépensé", "Quel est le total dépensé ?"),
      createOption("Dépenses par phase", "Montrez les dépenses par phase"),
    ]
  );
}

function buildClarificationResponse(text) {
  if (hasAny(text, ["budget", "solde", "restant", "reste", "combien"])) {
    return createResponse(
      "Je veux être précis. Souhaitez-vous connaître le budget restant, le total dépensé, le dépassement ou un résumé global du projet ?",
      getBudgetOptions()
    );
  }

  if (hasAny(text, ["phase", "phases", "repartition"])) {
    return createResponse(
      "Votre demande sur les phases peut vouloir dire plusieurs choses. Voulez-vous la répartition des dépenses, la phase la plus coûteuse ou la liste complète des phases ?",
      getPhaseOptions()
    );
  }

  if (hasAny(text, ["depense", "depenses", "expense", "expenses"])) {
    return createResponse(
      "Je peux analyser les dépenses sous plusieurs angles. Voulez-vous le total dépensé, la plus grande dépense, la dernière dépense ou le nombre de dépenses ?",
      getExpenseOptions()
    );
  }

  return createResponse(
    "Je n'ai pas encore bien identifié votre demande. Voulez-vous parler du résumé du projet, du budget restant, des dépenses par phase ou de la plus grande dépense ?",
    getQuickOptions()
  );
}

function hasOnlyGreeting(text) {
  const greetingWords = ["bonjour", "salut", "hello", "hi", "hey", "bonsoir", "salam", "slm"];
  return greetingWords.includes(text);
}

function isGenericQuestion(text) {
  const genericQuestions = [
    "aide",
    "analyse",
    "question",
    "info",
    "informations",
    "detail",
    "details",
    "budget",
    "depenses",
    "depense",
    "phases",
    "phase",
    "combien",
  ];

  return genericQuestions.includes(text);
}

export function getAiWelcomeMessage(project, currency) {
  return buildWelcomeMessage(project, currency);
}

export function answerProjectQuestion(project, question, currency) {
  const text = normalizeQuestion(question);

  if (hasOnlyGreeting(text)) {
    return buildWelcomeMessage(project, currency);
  }

  if (!text || isGenericQuestion(text)) {
    return buildClarificationResponse(text || "budget");
  }

  const intents = [
    {
      id: "summary",
      score: scoreIntent(text, ["resume", "summary", "overview", "apercu", "situation", "rapport global", "projet", "project"]),
      handler: () => buildSummaryAnswer(project, currency),
    },
    {
      id: "budget",
      score: scoreIntent(text, ["budget restant", "solde", "restant", "reste", "remaining", "bqa", "b9a", "disponible"]),
      handler: () => buildBudgetAnswer(project, currency),
    },
    {
      id: "spent",
      score: scoreIntent(text, ["total depense", "total des depenses", "depense totale", "spent", "consomme", "montant depense", "srafna"]),
      handler: () => buildTotalSpentAnswer(project, currency),
    },
    {
      id: "biggest",
      score: scoreIntent(text, ["plus grande", "plus grosse", "plus couteuse", "biggest", "largest", "max"]),
      handler: () => buildBiggestExpenseAnswer(project, currency),
    },
    {
      id: "latest",
      score: scoreIntent(text, ["derniere", "plus recente", "recente", "latest", "last"]),
      handler: () => buildLatestExpenseAnswer(project, currency),
    },
    {
      id: "average",
      score: scoreIntent(text, ["moyenne", "average", "moyen"]),
      handler: () => buildAverageExpenseAnswer(project, currency),
    },
    {
      id: "count",
      score: scoreIntent(text, ["nombre de depenses", "combien de depenses", "count", "nb depenses"]),
      handler: () => buildExpenseCountAnswer(project),
    },
    {
      id: "phases",
      score: scoreIntent(text, ["par phase", "repartition", "phases", "phase", "phase la plus couteuse"]),
      handler: () => {
        if (hasAny(text, ["liste", "quelles", "noms des phases"])) {
          return buildPhaseListAnswer(project);
        }

        return buildPhaseAnswer(project, currency);
      },
    },
    {
      id: "supplier",
      score: scoreIntent(text, ["fournisseur", "supplier", "vendor"]),
      handler: () => buildSupplierAnswer(project, currency),
    },
    {
      id: "overBudget",
      score: scoreIntent(text, ["depassement", "depasse", "exceeded", "over budget", "tjawz"]),
      handler: () => buildBudgetAnswer(project, currency),
    },
  ]
    .filter((intent) => intent.score > 0)
    .sort((firstItem, secondItem) => secondItem.score - firstItem.score);

  if (!intents.length) {
    return buildClarificationResponse(text);
  }

  if (intents.length > 1 && intents[0].score === intents[1].score && intents[0].score < 3) {
    return buildClarificationResponse(text);
  }

  return intents[0].handler();
}

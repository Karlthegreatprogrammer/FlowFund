const core = require("../data.js");

const requiredExports = [
  "TRANSACTION_TYPES",
  "PERIODS",
  "createDefaultState",
  "createDashboard",
  "addTransaction",
  "updateTransaction",
  "deleteTransaction",
  "addAllocation",
  "updateAllocation",
  "deleteAllocation",
  "calculateSummary",
  "getTransactionsForPeriod",
  "getTransactionsForDate",
  "generateInsights",
];

for (const name of requiredExports) {
  if (!(name in core)) {
    throw new Error(`Missing FlowFund core export: ${name}`);
  }
}

for (const type of ["income", "expense", "loss", "investment", "debt_payment"]) {
  if (!core.TRANSACTION_TYPES[type]) {
    throw new Error(`Missing transaction type: ${type}`);
  }
}

let state = core.createDefaultState();
state = core.createDashboard(state, "Typecheck Dashboard");
const dashboardId = state.selectedDashboardId;
const result = core.addTransaction(state, {
  dashboardId,
  type: "income",
  amount: 100,
  date: "2026-05-25",
});

if (result.errors.length) {
  throw new Error(result.errors.join(" "));
}

const summary = core.calculateSummary(result.state, dashboardId);
if (summary.totalIncome !== 100 || summary.currentBalance !== 100) {
  throw new Error("Summary contract returned unexpected values.");
}

console.log("FlowFund type contract checks passed");

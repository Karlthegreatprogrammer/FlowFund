const assert = require("assert");
const core = require("../data.js");

const fixedToday = new Date(2026, 4, 25);
let state = core.createDefaultState();

state = core.createDashboard(state, "Clothing Store");
const dashboardId = state.selectedDashboardId;

for (const transaction of [
  { dashboardId, type: "income", amount: 10000, date: "2026-05-25", category: "Sales" },
  { dashboardId, type: "expense", amount: 2500, date: "2026-05-25", category: "Supplies" },
  { dashboardId, type: "loss", amount: 500, date: "2026-05-24", category: "Stock Loss" },
  { dashboardId, type: "investment", amount: 3000, date: "2026-05-23", category: "Capital Deposit" },
  { dashboardId, type: "debt_payment", amount: 1200, date: "2026-05-22", category: "Loan" },
]) {
  const result = core.addTransaction(state, transaction);
  assert.deepStrictEqual(result.errors, []);
  state = result.state;
}

let summary = core.calculateSummary(state, dashboardId);
assert.strictEqual(summary.totalIncome, 10000);
assert.strictEqual(summary.totalExpenses, 2500);
assert.strictEqual(summary.totalLosses, 500);
assert.strictEqual(summary.investmentCapital, 3000);
assert.strictEqual(summary.totalDebt, 1200);
assert.strictEqual(summary.netEarnings, 7000);
assert.strictEqual(summary.currentBalance, 8800);
assert.strictEqual(summary.cashflowHealth.status, "Healthy");

let allocationResult = core.addAllocation(state, dashboardId, { name: "Operations", percentage: 40 });
assert.deepStrictEqual(allocationResult.errors, []);
state = allocationResult.state;
allocationResult = core.addAllocation(state, dashboardId, { name: "Savings", percentage: 60 });
assert.deepStrictEqual(allocationResult.errors, []);
state = allocationResult.state;
assert.strictEqual(core.calculateAllocationTotal(core.getAllocationsForDashboard(state, dashboardId)), 100);

const todayRecords = core.getTransactionsForDate(state, dashboardId, "2026-05-25");
assert.strictEqual(todayRecords.length, 2);

const monthRecords = core.getTransactionsForPeriod(state, dashboardId, "month", fixedToday);
assert.strictEqual(monthRecords.length, 5);

const firstTransactionId = state.transactions[0].id;
const updateResult = core.updateTransaction(state, firstTransactionId, {
  dashboardId,
  type: "income",
  amount: 12000,
  date: "2026-05-25",
  category: "Sales",
  notes: "Updated",
});
assert.deepStrictEqual(updateResult.errors, []);
state = updateResult.state;
summary = core.calculateSummary(state, dashboardId);
assert.strictEqual(summary.totalIncome, 12000);
assert.strictEqual(summary.netEarnings, 9000);

state = core.deleteTransaction(state, firstTransactionId);
summary = core.calculateSummary(state, dashboardId);
assert.strictEqual(summary.totalIncome, 0);
assert.strictEqual(summary.cashflowHealth.status, "Critical");

const insights = core.generateInsights(state, dashboardId, fixedToday);
assert.ok(insights.some((insight) => insight.title.includes("critical") || insight.title.includes("losing")));

const invalid = core.addTransaction(state, {
  dashboardId,
  type: "expense",
  amount: 0,
  date: "2026-05-25",
});
assert.ok(invalid.errors.includes("Amount must be greater than 0."));

console.log("FlowFund model checks passed");

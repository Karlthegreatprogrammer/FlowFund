(function flowFundCoreFactory(root, factory) {
  var api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.FlowFundCore = api;
})(typeof window !== "undefined" ? window : globalThis, function createFlowFundCore() {
  "use strict";

  var STORAGE_KEY = "flowfund:data:v1";

  var TRANSACTION_TYPES = {
    income: {
      label: "Income",
      shortLabel: "Income",
      tone: "green",
      categories: ["Sales", "Service", "Payment", "Refund", "Other"],
    },
    expense: {
      label: "Expense",
      shortLabel: "Expenses",
      tone: "red",
      categories: ["Payment", "Supplies", "Salary", "Utilities", "Rent", "Other"],
    },
    loss: {
      label: "Loss",
      shortLabel: "Losses",
      tone: "amber",
      categories: ["Stock Loss", "Damage", "Refund", "Shortage", "Other"],
    },
    investment: {
      label: "Investment Capital",
      shortLabel: "Investment",
      tone: "blue",
      categories: ["Capital Deposit", "Owner Fund", "Partner Fund", "Reinvestment", "Other"],
    },
    debt_payment: {
      label: "Debt Payment",
      shortLabel: "Debt",
      tone: "purple",
      categories: ["Loan", "Credit", "Installment", "Supplier Debt", "Other"],
    },
  };

  var PERIODS = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time",
  };

  function createDefaultState() {
    return {
      dashboards: [],
      transactions: [],
      allocations: [],
      selectedDashboardId: null,
      updatedAt: nowIso(),
    };
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    return [
      prefix || "id",
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 9),
    ].join("_");
  }

  function toAmount(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function todayKey(date) {
    var source = date instanceof Date ? date : new Date();
    var year = source.getFullYear();
    var month = String(source.getMonth() + 1).padStart(2, "0");
    var day = String(source.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function monthKey(date) {
    var source = date instanceof Date ? date : new Date();
    return source.getFullYear() + "-" + String(source.getMonth() + 1).padStart(2, "0");
  }

  function parseDateKey(dateKey) {
    if (!isValidDateKey(dateKey)) {
      return null;
    }

    var parts = dateKey.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isValidDateKey(dateKey) {
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return false;
    }

    var parts = dateKey.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return (
      date.getFullYear() === parts[0] &&
      date.getMonth() === parts[1] - 1 &&
      date.getDate() === parts[2]
    );
  }

  function addDays(date, days) {
    var next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  function addMonths(monthValue, amount) {
    var parts = monthValue.split("-").map(Number);
    var next = new Date(parts[0], parts[1] - 1, 1);
    next.setMonth(next.getMonth() + amount);
    return monthKey(next);
  }

  function getDateRange(period, today) {
    var current = today instanceof Date ? today : new Date();
    var start;
    var end;

    if (period === "today") {
      start = new Date(current.getFullYear(), current.getMonth(), current.getDate());
      end = start;
    } else if (period === "week") {
      var day = current.getDay();
      var mondayOffset = day === 0 ? -6 : 1 - day;
      start = addDays(current, mondayOffset);
      end = addDays(start, 6);
    } else if (period === "month") {
      start = new Date(current.getFullYear(), current.getMonth(), 1);
      end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    } else {
      return { start: null, end: null };
    }

    return {
      start: todayKey(start),
      end: todayKey(end),
    };
  }

  function normalizeState(input) {
    var raw = input && typeof input === "object" ? input : createDefaultState();
    var seenDashboards = {};
    var dashboards = [];
    var transactions = [];
    var allocations = [];

    if (Array.isArray(raw.dashboards)) {
      raw.dashboards.forEach(function normalizeDashboard(item) {
        if (!item || typeof item !== "object") {
          return;
        }

        var id = String(item.id || createId("dash"));
        if (seenDashboards[id]) {
          return;
        }

        seenDashboards[id] = true;
        var allocationBaseAmount = toAmount(item.allocationBaseAmount);
        var dashboard = {
          id: id,
          name: String(item.name || "Untitled Dashboard").trim() || "Untitled Dashboard",
          createdAt: item.createdAt || nowIso(),
          updatedAt: item.updatedAt || item.createdAt || nowIso(),
        };

        if (allocationBaseAmount > 0) {
          dashboard.allocationBaseAmount = allocationBaseAmount;
        }

        dashboards.push(dashboard);
      });
    }

    if (Array.isArray(raw.transactions)) {
      raw.transactions.forEach(function normalizeTransaction(item) {
        if (!item || typeof item !== "object") {
          return;
        }

        var amount = toAmount(item.amount);
        var type = String(item.type || "");
        var dashboardId = String(item.dashboardId || "");

        if (
          !seenDashboards[dashboardId] ||
          !TRANSACTION_TYPES[type] ||
          amount <= 0 ||
          !isValidDateKey(item.date)
        ) {
          return;
        }

        transactions.push({
          id: String(item.id || createId("tx")),
          dashboardId: dashboardId,
          type: type,
          amount: amount,
          date: item.date,
          category: String(item.category || "").trim(),
          notes: String(item.notes || "").trim(),
          createdAt: item.createdAt || nowIso(),
          updatedAt: item.updatedAt || item.createdAt || nowIso(),
        });
      });
    }

    if (Array.isArray(raw.allocations)) {
      raw.allocations.forEach(function normalizeAllocation(item) {
        if (!item || typeof item !== "object") {
          return;
        }

        var dashboardId = String(item.dashboardId || "");
        if (!seenDashboards[dashboardId]) {
          return;
        }

        allocations.push({
          id: String(item.id || createId("allocation")),
          dashboardId: dashboardId,
          name: String(item.name || "Allocation").trim() || "Allocation",
          percentage: clamp(toAmount(item.percentage), 0, 100),
          createdAt: item.createdAt || nowIso(),
          updatedAt: item.updatedAt || item.createdAt || nowIso(),
        });
      });
    }

    var selectedDashboardId = seenDashboards[String(raw.selectedDashboardId || "")]
      ? String(raw.selectedDashboardId)
      : dashboards.length
        ? dashboards[0].id
        : null;

    return {
      dashboards: dashboards,
      transactions: transactions,
      allocations: allocations,
      selectedDashboardId: selectedDashboardId,
      updatedAt: raw.updatedAt || nowIso(),
    };
  }

  function loadState() {
    if (typeof localStorage === "undefined") {
      return createDefaultState();
    }

    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : createDefaultState());
    } catch (error) {
      return createDefaultState();
    }
  }

  function saveState(state) {
    var next = normalizeState(state);
    next.updatedAt = nowIso();

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }

    return next;
  }

  function getDashboard(state, dashboardId) {
    var current = normalizeState(state);
    return current.dashboards.find(function findDashboard(dashboard) {
      return dashboard.id === dashboardId;
    }) || null;
  }

  function createDashboard(state, name) {
    var next = clone(normalizeState(state));
    var timestamp = nowIso();
    var dashboard = {
      id: createId("dash"),
      name: String(name || "").trim() || "Untitled Dashboard",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    next.dashboards.push(dashboard);
    next.selectedDashboardId = dashboard.id;
    next.updatedAt = timestamp;
    return next;
  }

  function updateDashboard(state, dashboardId, updates) {
    var next = clone(normalizeState(state));
    var dashboard = next.dashboards.find(function findDashboard(item) {
      return item.id === dashboardId;
    });

    if (!dashboard) {
      return next;
    }

    if (updates.name !== undefined) {
      dashboard.name = String(updates.name || "").trim() || dashboard.name;
    }

    if (updates.allocationBaseAmount !== undefined) {
      var baseAmount = toAmount(updates.allocationBaseAmount);
      if (baseAmount > 0) {
        dashboard.allocationBaseAmount = baseAmount;
      } else {
        delete dashboard.allocationBaseAmount;
      }
    }

    dashboard.updatedAt = nowIso();
    next.updatedAt = dashboard.updatedAt;
    return next;
  }

  function deleteDashboard(state, dashboardId) {
    var next = clone(normalizeState(state));
    next.dashboards = next.dashboards.filter(function keepDashboard(item) {
      return item.id !== dashboardId;
    });
    next.transactions = next.transactions.filter(function keepTransaction(item) {
      return item.dashboardId !== dashboardId;
    });
    next.allocations = next.allocations.filter(function keepAllocation(item) {
      return item.dashboardId !== dashboardId;
    });
    next.selectedDashboardId = next.dashboards.length ? next.dashboards[0].id : null;
    next.updatedAt = nowIso();
    return next;
  }

  function validateTransaction(state, transaction) {
    var current = normalizeState(state);
    var errors = [];
    var dashboardId = String(transaction.dashboardId || "");
    var type = String(transaction.type || "");
    var amount = toAmount(transaction.amount);

    if (!current.dashboards.some(function hasDashboard(dashboard) {
      return dashboard.id === dashboardId;
    })) {
      errors.push("Choose a dashboard.");
    }

    if (!TRANSACTION_TYPES[type]) {
      errors.push("Choose a transaction type.");
    }

    if (amount <= 0) {
      errors.push("Amount must be greater than 0.");
    }

    if (!isValidDateKey(transaction.date)) {
      errors.push("Choose a valid date.");
    }

    return errors;
  }

  function addTransaction(state, input) {
    var next = clone(normalizeState(state));
    var errors = validateTransaction(next, input);

    if (errors.length) {
      return { state: next, errors: errors };
    }

    var timestamp = nowIso();
    next.transactions.push({
      id: createId("tx"),
      dashboardId: String(input.dashboardId),
      type: String(input.type),
      amount: toAmount(input.amount),
      date: String(input.date),
      category: String(input.category || "").trim(),
      notes: String(input.notes || "").trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    next.updatedAt = timestamp;
    return { state: next, errors: [] };
  }

  function updateTransaction(state, transactionId, input) {
    var next = clone(normalizeState(state));
    var transaction = next.transactions.find(function findTransaction(item) {
      return item.id === transactionId;
    });

    if (!transaction) {
      return { state: next, errors: ["Transaction was not found."] };
    }

    var candidate = {
      id: transaction.id,
      dashboardId: input.dashboardId,
      type: input.type,
      amount: input.amount,
      date: input.date,
      category: input.category,
      notes: input.notes,
    };
    var errors = validateTransaction(next, candidate);

    if (errors.length) {
      return { state: next, errors: errors };
    }

    transaction.dashboardId = String(input.dashboardId);
    transaction.type = String(input.type);
    transaction.amount = toAmount(input.amount);
    transaction.date = String(input.date);
    transaction.category = String(input.category || "").trim();
    transaction.notes = String(input.notes || "").trim();
    transaction.updatedAt = nowIso();
    next.updatedAt = transaction.updatedAt;
    return { state: next, errors: [] };
  }

  function deleteTransaction(state, transactionId) {
    var next = clone(normalizeState(state));
    next.transactions = next.transactions.filter(function keepTransaction(item) {
      return item.id !== transactionId;
    });
    next.updatedAt = nowIso();
    return next;
  }

  function addAllocation(state, dashboardId, input) {
    var next = clone(normalizeState(state));

    if (!getDashboard(next, dashboardId)) {
      return { state: next, errors: ["Choose a dashboard."] };
    }

    var percentage = toAmount(input.percentage);
    if (percentage < 0 || percentage > 100) {
      return { state: next, errors: ["Percentage must be between 0 and 100."] };
    }

    var timestamp = nowIso();
    next.allocations.push({
      id: createId("allocation"),
      dashboardId: dashboardId,
      name: String(input.name || "Allocation").trim() || "Allocation",
      percentage: percentage,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    next.updatedAt = timestamp;
    return { state: next, errors: [] };
  }

  function updateAllocation(state, allocationId, updates) {
    var next = clone(normalizeState(state));
    var allocation = next.allocations.find(function findAllocation(item) {
      return item.id === allocationId;
    });

    if (!allocation) {
      return next;
    }

    if (updates.name !== undefined) {
      allocation.name = String(updates.name || "").trim() || "Allocation";
    }

    if (updates.percentage !== undefined) {
      allocation.percentage = clamp(toAmount(updates.percentage), 0, 100);
    }

    allocation.updatedAt = nowIso();
    next.updatedAt = allocation.updatedAt;
    return next;
  }

  function deleteAllocation(state, allocationId) {
    var next = clone(normalizeState(state));
    next.allocations = next.allocations.filter(function keepAllocation(item) {
      return item.id !== allocationId;
    });
    next.updatedAt = nowIso();
    return next;
  }

  function getDashboardTransactions(state, dashboardId) {
    var current = normalizeState(state);
    return current.transactions
      .filter(function belongsToDashboard(transaction) {
        return !dashboardId || transaction.dashboardId === dashboardId;
      })
      .sort(function sortLatestFirst(a, b) {
        if (a.date === b.date) {
          return String(b.createdAt).localeCompare(String(a.createdAt));
        }

        return b.date.localeCompare(a.date);
      });
  }

  function calculateSummaryFromTransactions(transactions) {
    var totals = {
      income: 0,
      expense: 0,
      loss: 0,
      investment: 0,
      debt_payment: 0,
    };

    transactions.forEach(function sumTransaction(transaction) {
      if (totals[transaction.type] !== undefined) {
        totals[transaction.type] += toAmount(transaction.amount);
      }
    });

    Object.keys(totals).forEach(function roundTotal(key) {
      totals[key] = toAmount(totals[key]);
    });

    var netEarnings = toAmount(totals.income - totals.expense - totals.loss);
    var currentBalance = toAmount(
      totals.income + totals.investment - totals.expense - totals.loss - totals.debt_payment,
    );
    var health = calculateCashflowHealth(totals.income, totals.expense, totals.loss);

    return {
      totalIncome: totals.income,
      totalExpenses: totals.expense,
      totalLosses: totals.loss,
      investmentCapital: totals.investment,
      totalDebt: totals.debt_payment,
      netEarnings: netEarnings,
      currentBalance: currentBalance,
      cashflowHealth: health,
      transactionCount: transactions.length,
    };
  }

  function calculateSummary(state, dashboardId) {
    return calculateSummaryFromTransactions(getDashboardTransactions(state, dashboardId || null));
  }

  function calculateCashflowHealth(income, expenses, losses) {
    var totalIncome = toAmount(income);
    var pressure = toAmount(expenses + losses);
    var net = toAmount(totalIncome - pressure);

    if (totalIncome <= 0 && pressure <= 0) {
      return {
        percent: 0,
        status: "Stable",
        message: "Waiting for financial activity.",
      };
    }

    if (totalIncome <= 0 && pressure > 0) {
      return {
        percent: 0,
        status: "Critical",
        message: "Money is going out with no recorded income.",
      };
    }

    var percent = clamp(Math.round((net / totalIncome) * 100), -100, 100);

    if (net < 0) {
      return {
        percent: percent,
        status: "Critical",
        message: "Outflow is higher than income.",
      };
    }

    if (percent < 10) {
      return {
        percent: percent,
        status: "Warning",
        message: "Cashflow margin is very tight.",
      };
    }

    if (percent < 30) {
      return {
        percent: percent,
        status: "Stable",
        message: "Cashflow is positive but should be watched.",
      };
    }

    return {
      percent: percent,
      status: "Healthy",
      message: "Cashflow is in good condition.",
    };
  }

  function getAllocationsForDashboard(state, dashboardId) {
    return normalizeState(state).allocations
      .filter(function belongsToDashboard(allocation) {
        return allocation.dashboardId === dashboardId;
      })
      .sort(function sortOldestFirst(a, b) {
        return String(a.createdAt).localeCompare(String(b.createdAt));
      });
  }

  function calculateAllocationTotal(allocations) {
    return toAmount((allocations || []).reduce(function sum(total, allocation) {
      return total + toAmount(allocation.percentage);
    }, 0));
  }

  function getTransactionsForPeriod(state, dashboardId, period, today) {
    var transactions = getDashboardTransactions(state, dashboardId || null);
    var range = getDateRange(period, today);

    if (!range.start || !range.end) {
      return transactions;
    }

    return transactions.filter(function inRange(transaction) {
      return transaction.date >= range.start && transaction.date <= range.end;
    });
  }

  function getTransactionsForDate(state, dashboardId, dateKey) {
    return getDashboardTransactions(state, dashboardId || null).filter(function onDate(transaction) {
      return transaction.date === dateKey;
    });
  }

  function getTransactionsForMonth(state, dashboardId, monthValue) {
    var prefix = monthValue + "-";
    return getDashboardTransactions(state, dashboardId || null).filter(function inMonth(transaction) {
      return transaction.date.indexOf(prefix) === 0;
    });
  }

  function getMonthlyNetPoints(state, dashboardId, monthValue) {
    var parts = monthValue.split("-").map(Number);
    var daysInMonth = new Date(parts[0], parts[1], 0).getDate();
    var transactions = getTransactionsForMonth(state, dashboardId || null, monthValue);
    var points = [];

    for (var day = 1; day <= daysInMonth; day += 1) {
      var dateKey = monthValue + "-" + String(day).padStart(2, "0");
      var daySummary = calculateSummaryFromTransactions(transactions.filter(function onDay(transaction) {
        return transaction.date === dateKey;
      }));
      points.push({
        date: dateKey,
        net: daySummary.netEarnings + daySummary.investmentCapital - daySummary.totalDebt,
      });
    }

    return points;
  }

  function getPreviousPeriod(period, today) {
    var current = today instanceof Date ? today : new Date();

    if (period === "week") {
      var thisWeek = getDateRange("week", current);
      var weekStart = parseDateKey(thisWeek.start);
      return {
        start: todayKey(addDays(weekStart, -7)),
        end: todayKey(addDays(weekStart, -1)),
      };
    }

    if (period === "month") {
      var start = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      var end = new Date(current.getFullYear(), current.getMonth(), 0);
      return {
        start: todayKey(start),
        end: todayKey(end),
      };
    }

    return { start: null, end: null };
  }

  function filterTransactionsByRange(transactions, range) {
    if (!range.start || !range.end) {
      return transactions;
    }

    return transactions.filter(function inRange(transaction) {
      return transaction.date >= range.start && transaction.date <= range.end;
    });
  }

  function generateInsights(state, dashboardId, today) {
    var transactions = getDashboardTransactions(state, dashboardId || null);
    var insights = [];

    if (!transactions.length) {
      return insights;
    }

    var allSummary = calculateSummaryFromTransactions(transactions);
    var thisWeek = calculateSummaryFromTransactions(
      getTransactionsForPeriod(state, dashboardId || null, "week", today),
    );
    var previousWeek = calculateSummaryFromTransactions(
      filterTransactionsByRange(transactions, getPreviousPeriod("week", today)),
    );
    var thisMonth = calculateSummaryFromTransactions(
      getTransactionsForPeriod(state, dashboardId || null, "month", today),
    );
    var previousMonth = calculateSummaryFromTransactions(
      filterTransactionsByRange(transactions, getPreviousPeriod("month", today)),
    );

    if (allSummary.cashflowHealth.status === "Critical") {
      insights.push({
        tone: "red",
        title: "Cashflow is currently critical.",
        body: "Expenses and losses are higher than income.",
      });
    } else if (allSummary.cashflowHealth.status === "Warning") {
      insights.push({
        tone: "amber",
        title: "Cashflow needs attention.",
        body: "Income is positive, but the cashflow margin is tight.",
      });
    }

    if (thisMonth.transactionCount > 0 && thisMonth.netEarnings > 0) {
      insights.push({
        tone: "green",
        title: dashboardId ? "This dashboard is profitable this month." : "Your cashflow is profitable this month.",
        body: "Income is higher than expenses and losses for the current month.",
      });
    } else if (thisMonth.transactionCount > 0 && thisMonth.netEarnings < 0) {
      insights.push({
        tone: "red",
        title: dashboardId ? "This dashboard is losing money this month." : "Cashflow is losing money this month.",
        body: "Expenses and losses are higher than income for the current month.",
      });
    }

    if (previousWeek.totalExpenses > 0 && thisWeek.totalExpenses > previousWeek.totalExpenses * 1.1) {
      insights.push({
        tone: "amber",
        title: "Expenses increased this week.",
        body: "This week's expenses are more than 10% higher than last week.",
      });
    }

    if (previousWeek.totalIncome > 0 && thisWeek.totalIncome > previousWeek.totalIncome * 1.1) {
      insights.push({
        tone: "green",
        title: "Income is stronger than last week.",
        body: "This week's income is more than 10% higher than last week.",
      });
    }

    if (previousWeek.totalLosses > 0 && thisWeek.totalLosses > previousWeek.totalLosses * 1.1) {
      insights.push({
        tone: "red",
        title: "Losses are higher than normal.",
        body: "This week's losses are more than 10% higher than last week.",
      });
    }

    if (
      thisMonth.investmentCapital > 0 &&
      thisMonth.investmentCapital > previousMonth.investmentCapital
    ) {
      insights.push({
        tone: "blue",
        title: "Investment capital increased this month.",
        body: "More capital was added this month than in the previous month.",
      });
    }

    return insights.slice(0, 6);
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    TRANSACTION_TYPES: TRANSACTION_TYPES,
    PERIODS: PERIODS,
    addAllocation: addAllocation,
    addDays: addDays,
    addMonths: addMonths,
    addTransaction: addTransaction,
    calculateAllocationTotal: calculateAllocationTotal,
    calculateCashflowHealth: calculateCashflowHealth,
    calculateSummary: calculateSummary,
    calculateSummaryFromTransactions: calculateSummaryFromTransactions,
    clone: clone,
    createDashboard: createDashboard,
    createDefaultState: createDefaultState,
    createId: createId,
    deleteAllocation: deleteAllocation,
    deleteDashboard: deleteDashboard,
    deleteTransaction: deleteTransaction,
    generateInsights: generateInsights,
    getAllocationsForDashboard: getAllocationsForDashboard,
    getDashboard: getDashboard,
    getDashboardTransactions: getDashboardTransactions,
    getDateRange: getDateRange,
    getMonthlyNetPoints: getMonthlyNetPoints,
    getTransactionsForDate: getTransactionsForDate,
    getTransactionsForMonth: getTransactionsForMonth,
    getTransactionsForPeriod: getTransactionsForPeriod,
    isValidDateKey: isValidDateKey,
    loadState: loadState,
    monthKey: monthKey,
    normalizeState: normalizeState,
    parseDateKey: parseDateKey,
    saveState: saveState,
    todayKey: todayKey,
    toAmount: toAmount,
    updateAllocation: updateAllocation,
    updateDashboard: updateDashboard,
    updateTransaction: updateTransaction,
    validateTransaction: validateTransaction,
  };
});

(function flowFundCoreFactory(root, factory) {
  var api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.FlowFundCore = api;
})(typeof window !== "undefined" ? window : globalThis, function createFlowFundCore() {
  "use strict";

  var STORAGE_KEY = "flowfund:data:v2";
  var LEGACY_STORAGE_KEY = "flowfund:data:v1";

  var TRANSACTION_TYPES = {
    income: { label: "Income", shortLabel: "Income", tone: "green" },
    expense: { label: "Expense", shortLabel: "Expenses", tone: "red" },
    loss: { label: "Loss", shortLabel: "Losses", tone: "amber" },
    investment: { label: "Investment Capital", shortLabel: "Investment", tone: "blue" },
    debt_payment: { label: "Debt Payment", shortLabel: "Debt", tone: "purple" },
  };

  var PERIODS = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time",
  };

  var SUMMARY_PERIODS = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    all: "All Time",
  };

  var DEFAULT_CATEGORY_NAMES = {
    income: ["Sales", "Service", "Salary", "Commission", "Other"],
    expense: ["Supplies", "Payment", "Salary", "Utilities", "Rent", "Other"],
    loss: ["Damaged Goods", "Refund", "Penalty", "Theft", "Other"],
    investment: ["Capital Added", "Equipment", "Inventory", "Marketing", "Other"],
    debt_payment: ["Loan Payment", "Supplier Credit", "Credit Card", "Personal Debt", "Other"],
  };

  var DEFAULT_ALLOCATION_TEMPLATE = [
    { name: "Operations", percentage: 40 },
    { name: "Savings", percentage: 20 },
    { name: "Emergency", percentage: 10 },
    { name: "Investment", percentage: 30 },
  ];

  var DEFAULT_HEALTH_SETTINGS = {
    healthyThreshold: 30,
    stableThreshold: 10,
    warningThreshold: 0,
    criticalThreshold: 0,
  };

  var DEFAULT_SETTINGS = {
    theme: "system",
    currencyCode: "PHP",
    currencySymbol: "\u20b1",
    numberFormat: "symbol",
    dateFormat: "month_day_year",
    weekStartsOn: "monday",
    defaultCalendarView: "month",
    defaultDashboardId: "",
    defaultTimelineFilter: "month",
    preferredSummaryPeriod: "monthly",
    hiddenTimelineTypes: [],
    hideBalances: false,
    confirmBeforeDeleteTransactions: true,
    confirmBeforeDeleteDashboards: true,
    showArchivedDashboards: false,
    defaultAllocationTemplate: DEFAULT_ALLOCATION_TEMPLATE,
    healthSettings: DEFAULT_HEALTH_SETTINGS,
  };

  Object.keys(TRANSACTION_TYPES).forEach(function attachDefaultCategories(type) {
    TRANSACTION_TYPES[type].categories = DEFAULT_CATEGORY_NAMES[type].slice();
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }

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

  function toInt(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : fallback;
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

  function createDefaultState() {
    return normalizeState({
      dashboards: [],
      transactions: [],
      allocations: [],
      transactionCategories: [],
      selectedDashboardId: null,
      settings: DEFAULT_SETTINGS,
      updatedAt: nowIso(),
    });
  }

  function getWeekStartOffset(date, weekStartsOn) {
    var day = date.getDay();
    if (weekStartsOn === "sunday") {
      return -day;
    }

    return day === 0 ? -6 : 1 - day;
  }

  function getDateRange(period, today, weekStartsOn) {
    var current = today instanceof Date ? today : new Date();
    var start;
    var end;

    if (period === "today" || period === "daily") {
      start = new Date(current.getFullYear(), current.getMonth(), current.getDate());
      end = start;
    } else if (period === "week" || period === "weekly") {
      start = addDays(current, getWeekStartOffset(current, weekStartsOn || "monday"));
      end = addDays(start, 6);
    } else if (period === "month" || period === "monthly") {
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

  function normalizeHealthSettings(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var settings = {
      healthyThreshold: clamp(toAmount(source.healthyThreshold ?? DEFAULT_HEALTH_SETTINGS.healthyThreshold), 0, 100),
      stableThreshold: clamp(toAmount(source.stableThreshold ?? DEFAULT_HEALTH_SETTINGS.stableThreshold), -100, 100),
      warningThreshold: clamp(toAmount(source.warningThreshold ?? DEFAULT_HEALTH_SETTINGS.warningThreshold), -100, 100),
      criticalThreshold: clamp(toAmount(source.criticalThreshold ?? DEFAULT_HEALTH_SETTINGS.criticalThreshold), -100, 100),
    };

    if (settings.stableThreshold > settings.healthyThreshold) {
      settings.stableThreshold = settings.healthyThreshold;
    }

    if (settings.warningThreshold > settings.stableThreshold) {
      settings.warningThreshold = settings.stableThreshold;
    }

    return settings;
  }

  function normalizeTemplate(rawTemplate) {
    var source = Array.isArray(rawTemplate) && rawTemplate.length ? rawTemplate : DEFAULT_ALLOCATION_TEMPLATE;
    return source
      .map(function normalizeTemplateItem(item, index) {
        return {
          id: String(item.id || createId("template")),
          name: String(item.name || "Allocation").trim() || "Allocation",
          percentage: clamp(toAmount(item.percentage), 0, 100),
          sortOrder: toInt(item.sortOrder, index),
        };
      })
      .sort(function sortTemplate(a, b) {
        return a.sortOrder - b.sortOrder;
      });
  }

  function normalizeSettings(raw, seenDashboards) {
    var source = raw && typeof raw === "object" ? raw : {};
    var validThemes = ["light", "dark", "system"];
    var validDateFormats = ["month_day_year", "mm_dd_yyyy", "yyyy_mm_dd"];
    var validWeekStarts = ["monday", "sunday"];
    var validCalendarViews = ["month", "week", "today"];
    var validTimelineFilters = Object.keys(PERIODS);
    var validSummaryPeriods = Object.keys(SUMMARY_PERIODS);
    var hiddenTypes = Array.isArray(source.hiddenTimelineTypes)
      ? source.hiddenTimelineTypes.filter(function validType(type) {
          return Boolean(TRANSACTION_TYPES[type]);
        })
      : [];
    var defaultDashboardId = String(source.defaultDashboardId || "");

    if (defaultDashboardId && seenDashboards && !seenDashboards[defaultDashboardId]) {
      defaultDashboardId = "";
    }

    return {
      theme: validThemes.indexOf(source.theme) !== -1 ? source.theme : DEFAULT_SETTINGS.theme,
      currencyCode: String(source.currencyCode || DEFAULT_SETTINGS.currencyCode).trim().toUpperCase() || "PHP",
      currencySymbol: String(source.currencySymbol || DEFAULT_SETTINGS.currencySymbol).trim() || DEFAULT_SETTINGS.currencySymbol,
      numberFormat: source.numberFormat === "code" ? "code" : "symbol",
      dateFormat: validDateFormats.indexOf(source.dateFormat) !== -1 ? source.dateFormat : DEFAULT_SETTINGS.dateFormat,
      weekStartsOn: validWeekStarts.indexOf(source.weekStartsOn) !== -1 ? source.weekStartsOn : DEFAULT_SETTINGS.weekStartsOn,
      defaultCalendarView:
        validCalendarViews.indexOf(source.defaultCalendarView) !== -1
          ? source.defaultCalendarView
          : DEFAULT_SETTINGS.defaultCalendarView,
      defaultDashboardId: defaultDashboardId,
      defaultTimelineFilter:
        validTimelineFilters.indexOf(source.defaultTimelineFilter) !== -1
          ? source.defaultTimelineFilter
          : DEFAULT_SETTINGS.defaultTimelineFilter,
      preferredSummaryPeriod:
        validSummaryPeriods.indexOf(source.preferredSummaryPeriod) !== -1
          ? source.preferredSummaryPeriod
          : DEFAULT_SETTINGS.preferredSummaryPeriod,
      hiddenTimelineTypes: hiddenTypes,
      hideBalances: Boolean(source.hideBalances),
      confirmBeforeDeleteTransactions: source.confirmBeforeDeleteTransactions !== false,
      confirmBeforeDeleteDashboards: source.confirmBeforeDeleteDashboards !== false,
      showArchivedDashboards: Boolean(source.showArchivedDashboards),
      defaultAllocationTemplate: normalizeTemplate(source.defaultAllocationTemplate),
      healthSettings: normalizeHealthSettings(source.healthSettings),
    };
  }

  function normalizeCategories(rawCategories) {
    var categories = [];
    var seen = {};
    var timestamp = nowIso();

    if (Array.isArray(rawCategories)) {
      rawCategories.forEach(function normalizeCategory(item) {
        if (!item || typeof item !== "object" || !TRANSACTION_TYPES[item.type]) {
          return;
        }

        var name = String(item.name || "").trim();
        if (!name) {
          return;
        }

        var key = item.type + "::" + name.toLowerCase();
        if (seen[key]) {
          return;
        }

        seen[key] = true;
        categories.push({
          id: String(item.id || createId("cat")),
          type: String(item.type),
          name: name,
          sortOrder: toInt(item.sortOrder, categories.length),
          isDefault: Boolean(item.isDefault),
          createdAt: item.createdAt || timestamp,
          updatedAt: item.updatedAt || item.createdAt || timestamp,
        });
      });
    }

    Object.keys(DEFAULT_CATEGORY_NAMES).forEach(function addMissingDefaults(type) {
      DEFAULT_CATEGORY_NAMES[type].forEach(function addDefault(name, index) {
        var key = type + "::" + name.toLowerCase();
        if (!seen[key]) {
          seen[key] = true;
          categories.push({
            id: createId("cat"),
            type: type,
            name: name,
            sortOrder: index,
            isDefault: true,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      });
    });

    return categories.sort(function sortCategories(a, b) {
      if (a.type === b.type) {
        return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
      }

      return Object.keys(TRANSACTION_TYPES).indexOf(a.type) - Object.keys(TRANSACTION_TYPES).indexOf(b.type);
    });
  }

  function normalizeState(input) {
    var raw = input && typeof input === "object" ? input : {};
    var seenDashboards = {};
    var dashboards = [];
    var transactions = [];
    var allocations = [];
    var timestamp = nowIso();

    if (Array.isArray(raw.dashboards)) {
      raw.dashboards.forEach(function normalizeDashboard(item, index) {
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
          sortOrder: toInt(item.sortOrder, index),
          isArchived: Boolean(item.isArchived),
          includeInGlobalTotals: item.includeInGlobalTotals !== false,
          createdAt: item.createdAt || timestamp,
          updatedAt: item.updatedAt || item.createdAt || timestamp,
        };

        if (allocationBaseAmount > 0) {
          dashboard.allocationBaseAmount = allocationBaseAmount;
        }

        dashboards.push(dashboard);
      });
    }

    dashboards.sort(function sortDashboards(a, b) {
      return a.sortOrder - b.sortOrder || String(a.createdAt).localeCompare(String(b.createdAt));
    });

    var settings = normalizeSettings(raw.settings, seenDashboards);
    var transactionCategories = normalizeCategories(raw.transactionCategories || raw.categories);

    if (Array.isArray(raw.transactions)) {
      raw.transactions.forEach(function normalizeTransaction(item) {
        if (!item || typeof item !== "object") {
          return;
        }

        var amount = toAmount(item.amount);
        var type = String(item.type || "");
        var dashboardId = String(item.dashboardId || item.dashboard_id || "");

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
          categoryId: item.categoryId ? String(item.categoryId) : "",
          notes: String(item.notes || "").trim(),
          createdAt: item.createdAt || timestamp,
          updatedAt: item.updatedAt || item.createdAt || timestamp,
        });
      });
    }

    if (Array.isArray(raw.allocations)) {
      raw.allocations.forEach(function normalizeAllocation(item, index) {
        if (!item || typeof item !== "object") {
          return;
        }

        var dashboardId = String(item.dashboardId || item.dashboard_id || "");
        if (!seenDashboards[dashboardId]) {
          return;
        }

        allocations.push({
          id: String(item.id || createId("allocation")),
          dashboardId: dashboardId,
          name: String(item.name || "Allocation").trim() || "Allocation",
          percentage: clamp(toAmount(item.percentage), 0, 100),
          sortOrder: toInt(item.sortOrder, index),
          createdAt: item.createdAt || timestamp,
          updatedAt: item.updatedAt || item.createdAt || timestamp,
        });
      });
    }

    var selectedDashboardId = seenDashboards[String(raw.selectedDashboardId || "")]
      ? String(raw.selectedDashboardId)
      : settings.defaultDashboardId && seenDashboards[settings.defaultDashboardId]
        ? settings.defaultDashboardId
        : dashboards.length
          ? dashboards[0].id
          : null;

    return {
      dashboards: dashboards,
      transactions: transactions,
      allocations: allocations.sort(function sortAllocations(a, b) {
        return a.sortOrder - b.sortOrder || String(a.createdAt).localeCompare(String(b.createdAt));
      }),
      transactionCategories: transactionCategories,
      selectedDashboardId: selectedDashboardId,
      settings: settings,
      updatedAt: raw.updatedAt || timestamp,
    };
  }

  function loadState() {
    if (typeof localStorage === "undefined") {
      return createDefaultState();
    }

    try {
      var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : createDefaultState());
    } catch (error) {
      return createDefaultState();
    }
  }

  function storageKeyForUser(userId) {
    return STORAGE_KEY + ":user:" + String(userId || "anonymous");
  }

  function loadStateForUser(userId) {
    if (!userId || typeof localStorage === "undefined") {
      return createDefaultState();
    }

    try {
      var raw = localStorage.getItem(storageKeyForUser(userId));
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

  function saveStateForUser(userId, state) {
    var next = normalizeState(state);
    next.updatedAt = nowIso();

    if (userId && typeof localStorage !== "undefined") {
      localStorage.setItem(storageKeyForUser(userId), JSON.stringify(next));
    }

    return next;
  }

  function getDashboard(state, dashboardId) {
    var current = normalizeState(state);
    return current.dashboards.find(function findDashboard(dashboard) {
      return dashboard.id === dashboardId;
    }) || null;
  }

  function getVisibleDashboards(state) {
    var current = normalizeState(state);
    return current.dashboards.filter(function isVisible(dashboard) {
      return current.settings.showArchivedDashboards || !dashboard.isArchived;
    });
  }

  function getGlobalDashboards(state) {
    var current = normalizeState(state);
    return current.dashboards.filter(function inGlobalTotals(dashboard) {
      return dashboard.includeInGlobalTotals && !dashboard.isArchived;
    });
  }

  function createDashboard(state, name) {
    var next = clone(normalizeState(state));
    var timestamp = nowIso();
    var maxSortOrder = next.dashboards.reduce(function maxOrder(max, dashboard) {
      return Math.max(max, dashboard.sortOrder || 0);
    }, -1);
    var dashboard = {
      id: createId("dash"),
      name: String(name || "").trim() || "Untitled Dashboard",
      sortOrder: maxSortOrder + 1,
      isArchived: false,
      includeInGlobalTotals: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    next.dashboards.push(dashboard);
    next.selectedDashboardId = dashboard.id;

    if (Math.abs(calculateAllocationTotal(next.settings.defaultAllocationTemplate) - 100) < 0.001) {
      next.settings.defaultAllocationTemplate.forEach(function addTemplateAllocation(template, index) {
        next.allocations.push({
          id: createId("allocation"),
          dashboardId: dashboard.id,
          name: template.name,
          percentage: template.percentage,
          sortOrder: index,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });
    }

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

    if (updates.isArchived !== undefined) {
      dashboard.isArchived = Boolean(updates.isArchived);
    }

    if (updates.includeInGlobalTotals !== undefined) {
      dashboard.includeInGlobalTotals = Boolean(updates.includeInGlobalTotals);
    }

    if (updates.sortOrder !== undefined) {
      dashboard.sortOrder = toInt(updates.sortOrder, dashboard.sortOrder);
    }

    dashboard.updatedAt = nowIso();
    next.updatedAt = dashboard.updatedAt;
    return next;
  }

  function moveDashboard(state, dashboardId, direction) {
    var next = clone(normalizeState(state));
    var dashboards = next.dashboards.slice().sort(function byOrder(a, b) {
      return a.sortOrder - b.sortOrder;
    });
    var index = dashboards.findIndex(function findDashboard(dashboard) {
      return dashboard.id === dashboardId;
    });
    var targetIndex = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= dashboards.length) {
      return next;
    }

    var currentOrder = dashboards[index].sortOrder;
    dashboards[index].sortOrder = dashboards[targetIndex].sortOrder;
    dashboards[targetIndex].sortOrder = currentOrder;
    next.dashboards = dashboards;
    next.updatedAt = nowIso();
    return normalizeState(next);
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
    if (next.settings.defaultDashboardId === dashboardId) {
      next.settings.defaultDashboardId = "";
    }
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
    var category = String(transaction.category || "").trim();

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

    if (category) {
      var validCategory = current.transactionCategories.some(function categoryMatches(item) {
        return item.type === type && item.name.toLowerCase() === category.toLowerCase();
      });
      if (!validCategory) {
        errors.push("Choose a category that belongs to this transaction type.");
      }
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
    var category = String(input.category || "").trim();
    var categoryMatch = next.transactionCategories.find(function findCategory(item) {
      return item.type === String(input.type) && item.name.toLowerCase() === category.toLowerCase();
    });

    next.transactions.push({
      id: createId("tx"),
      dashboardId: String(input.dashboardId),
      type: String(input.type),
      amount: toAmount(input.amount),
      date: String(input.date),
      category: category,
      categoryId: categoryMatch ? categoryMatch.id : "",
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

    var errors = validateTransaction(next, input);

    if (errors.length) {
      return { state: next, errors: errors };
    }

    var category = String(input.category || "").trim();
    var categoryMatch = next.transactionCategories.find(function findCategory(item) {
      return item.type === String(input.type) && item.name.toLowerCase() === category.toLowerCase();
    });

    transaction.dashboardId = String(input.dashboardId);
    transaction.type = String(input.type);
    transaction.amount = toAmount(input.amount);
    transaction.date = String(input.date);
    transaction.category = category;
    transaction.categoryId = categoryMatch ? categoryMatch.id : "";
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
    var maxSortOrder = next.allocations
      .filter(function forDashboard(allocation) {
        return allocation.dashboardId === dashboardId;
      })
      .reduce(function maxOrder(max, allocation) {
        return Math.max(max, allocation.sortOrder || 0);
      }, -1);

    next.allocations.push({
      id: createId("allocation"),
      dashboardId: dashboardId,
      name: String(input.name || "Allocation").trim() || "Allocation",
      percentage: percentage,
      sortOrder: maxSortOrder + 1,
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

  function updateSettings(state, updates) {
    var next = clone(normalizeState(state));
    next.settings = normalizeSettings(Object.assign({}, next.settings, updates), dashboardMap(next.dashboards));
    next.updatedAt = nowIso();
    return next;
  }

  function updateHealthSettings(state, updates) {
    var next = clone(normalizeState(state));
    next.settings.healthSettings = normalizeHealthSettings(Object.assign({}, next.settings.healthSettings, updates));
    next.updatedAt = nowIso();
    return next;
  }

  function validateDefaultAllocationTemplate(state) {
    var current = normalizeState(state);
    var total = calculateAllocationTotal(current.settings.defaultAllocationTemplate);
    return {
      valid: Math.abs(total - 100) < 0.001,
      total: total,
      message:
        Math.abs(total - 100) < 0.001
          ? "Default allocation template totals 100%."
          : total < 100
            ? "Template is below 100% by " + toAmount(100 - total) + "%."
            : "Template is above 100% by " + toAmount(total - 100) + "%.",
    };
  }

  function updateDefaultAllocationItem(state, itemId, updates) {
    var next = clone(normalizeState(state));
    next.settings.defaultAllocationTemplate = next.settings.defaultAllocationTemplate.map(function updateItem(item) {
      if (item.id !== itemId) {
        return item;
      }

      return {
        id: item.id,
        name: updates.name !== undefined ? String(updates.name || "").trim() || "Allocation" : item.name,
        percentage:
          updates.percentage !== undefined ? clamp(toAmount(updates.percentage), 0, 100) : item.percentage,
        sortOrder: item.sortOrder,
      };
    });
    next.updatedAt = nowIso();
    return next;
  }

  function addDefaultAllocationItem(state, input) {
    var next = clone(normalizeState(state));
    next.settings.defaultAllocationTemplate.push({
      id: createId("template"),
      name: String(input.name || "Allocation").trim() || "Allocation",
      percentage: clamp(toAmount(input.percentage), 0, 100),
      sortOrder: next.settings.defaultAllocationTemplate.length,
    });
    next.updatedAt = nowIso();
    return next;
  }

  function deleteDefaultAllocationItem(state, itemId) {
    var next = clone(normalizeState(state));
    next.settings.defaultAllocationTemplate = next.settings.defaultAllocationTemplate
      .filter(function keepItem(item) {
        return item.id !== itemId;
      })
      .map(function reindex(item, index) {
        item.sortOrder = index;
        return item;
      });
    next.updatedAt = nowIso();
    return next;
  }

  function resetDefaultAllocationTemplate(state) {
    var next = clone(normalizeState(state));
    next.settings.defaultAllocationTemplate = normalizeTemplate(DEFAULT_ALLOCATION_TEMPLATE);
    next.updatedAt = nowIso();
    return next;
  }

  function addCategory(state, type, name) {
    var next = clone(normalizeState(state));
    var categoryType = String(type || "");
    var categoryName = String(name || "").trim();

    if (!TRANSACTION_TYPES[categoryType]) {
      return { state: next, errors: ["Choose a transaction type."] };
    }

    if (!categoryName) {
      return { state: next, errors: ["Category name cannot be empty."] };
    }

    if (next.transactionCategories.some(function duplicate(item) {
      return item.type === categoryType && item.name.toLowerCase() === categoryName.toLowerCase();
    })) {
      return { state: next, errors: ["That category already exists."] };
    }

    var maxSortOrder = next.transactionCategories
      .filter(function sameType(item) {
        return item.type === categoryType;
      })
      .reduce(function maxOrder(max, item) {
        return Math.max(max, item.sortOrder || 0);
      }, -1);
    var timestamp = nowIso();

    next.transactionCategories.push({
      id: createId("cat"),
      type: categoryType,
      name: categoryName,
      sortOrder: maxSortOrder + 1,
      isDefault: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    next.updatedAt = timestamp;
    return { state: next, errors: [] };
  }

  function updateCategory(state, categoryId, updates) {
    var next = clone(normalizeState(state));
    var category = next.transactionCategories.find(function findCategory(item) {
      return item.id === categoryId;
    });

    if (!category) {
      return { state: next, errors: ["Category was not found."] };
    }

    var name = String(updates.name || "").trim();
    if (!name) {
      return { state: next, errors: ["Category name cannot be empty."] };
    }

    if (next.transactionCategories.some(function duplicate(item) {
      return item.id !== categoryId && item.type === category.type && item.name.toLowerCase() === name.toLowerCase();
    })) {
      return { state: next, errors: ["That category already exists."] };
    }

    var oldName = category.name;
    category.name = name;
    category.updatedAt = nowIso();
    next.transactions.forEach(function updateTransactionCategory(transaction) {
      if (transaction.type === category.type && transaction.category.toLowerCase() === oldName.toLowerCase()) {
        transaction.category = name;
        transaction.categoryId = category.id;
        transaction.updatedAt = category.updatedAt;
      }
    });
    next.updatedAt = category.updatedAt;
    return { state: next, errors: [] };
  }

  function deleteCategory(state, categoryId) {
    var next = clone(normalizeState(state));
    var category = next.transactionCategories.find(function findCategory(item) {
      return item.id === categoryId;
    });

    if (!category) {
      return { state: next, errors: ["Category was not found."] };
    }

    var inUse = next.transactions.some(function transactionUsesCategory(transaction) {
      return transaction.type === category.type && transaction.category.toLowerCase() === category.name.toLowerCase();
    });

    if (inUse) {
      return { state: next, errors: ["This category is used by saved transactions. Rename it instead."] };
    }

    next.transactionCategories = next.transactionCategories.filter(function keepCategory(item) {
      return item.id !== categoryId;
    });
    next.updatedAt = nowIso();
    return { state: next, errors: [] };
  }

  function getCategoriesByType(state, type) {
    return normalizeState(state).transactionCategories.filter(function byType(category) {
      return category.type === type;
    });
  }

  function dashboardMap(dashboards) {
    return (dashboards || []).reduce(function mapDashboards(map, dashboard) {
      map[dashboard.id] = true;
      return map;
    }, {});
  }

  function getDashboardTransactions(state, dashboardId) {
    var current = normalizeState(state);
    var globalIds = dashboardMap(getGlobalDashboards(current));
    return current.transactions
      .filter(function belongsToDashboard(transaction) {
        return dashboardId ? transaction.dashboardId === dashboardId : Boolean(globalIds[transaction.dashboardId]);
      })
      .sort(function sortLatestFirst(a, b) {
        if (a.date === b.date) {
          return String(b.createdAt).localeCompare(String(a.createdAt));
        }

        return b.date.localeCompare(a.date);
      });
  }

  function calculateSummaryFromTransactions(transactions, healthSettings) {
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
    var health = calculateCashflowHealth(totals.income, totals.expense, totals.loss, healthSettings);

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
    var current = normalizeState(state);
    return calculateSummaryFromTransactions(
      getDashboardTransactions(current, dashboardId || null),
      current.settings.healthSettings,
    );
  }

  function calculateCashflowHealth(income, expenses, losses, settings) {
    var thresholds = normalizeHealthSettings(settings);
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
        percent: -100,
        status: "Critical",
        message: "Money is going out with no recorded income.",
      };
    }

    var percent = clamp(Math.round((net / totalIncome) * 100), -100, 100);

    if (net < 0 || percent < thresholds.warningThreshold) {
      return {
        percent: percent,
        status: "Critical",
        message: "Outflow is higher than income.",
      };
    }

    if (percent < thresholds.stableThreshold) {
      return {
        percent: percent,
        status: "Warning",
        message: "Cashflow margin is very tight.",
      };
    }

    if (percent < thresholds.healthyThreshold) {
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
      .sort(function sortAllocations(a, b) {
        return a.sortOrder - b.sortOrder || String(a.createdAt).localeCompare(String(b.createdAt));
      });
  }

  function calculateAllocationTotal(allocations) {
    return toAmount((allocations || []).reduce(function sum(total, allocation) {
      return total + toAmount(allocation.percentage);
    }, 0));
  }

  function getTransactionsForPeriod(state, dashboardId, period, today) {
    var current = normalizeState(state);
    var transactions = getDashboardTransactions(current, dashboardId || null);
    var range = getDateRange(period, today, current.settings.weekStartsOn);

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
    var current = normalizeState(state);
    var parts = monthValue.split("-").map(Number);
    var daysInMonth = new Date(parts[0], parts[1], 0).getDate();
    var transactions = getTransactionsForMonth(current, dashboardId || null, monthValue);
    var points = [];

    for (var day = 1; day <= daysInMonth; day += 1) {
      var dateKey = monthValue + "-" + String(day).padStart(2, "0");
      var daySummary = calculateSummaryFromTransactions(
        transactions.filter(function onDay(transaction) {
          return transaction.date === dateKey;
        }),
        current.settings.healthSettings,
      );
      points.push({
        date: dateKey,
        net: daySummary.netEarnings + daySummary.investmentCapital - daySummary.totalDebt,
      });
    }

    return points;
  }

  function getPreviousPeriod(period, today, weekStartsOn) {
    var current = today instanceof Date ? today : new Date();

    if (period === "week") {
      var thisWeek = getDateRange("week", current, weekStartsOn || "monday");
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
    var current = normalizeState(state);
    var transactions = getDashboardTransactions(current, dashboardId || null);
    var insights = [];

    if (!transactions.length) {
      return insights;
    }

    var allSummary = calculateSummaryFromTransactions(transactions, current.settings.healthSettings);
    var thisWeek = calculateSummaryFromTransactions(
      getTransactionsForPeriod(current, dashboardId || null, "week", today),
      current.settings.healthSettings,
    );
    var previousWeek = calculateSummaryFromTransactions(
      filterTransactionsByRange(transactions, getPreviousPeriod("week", today, current.settings.weekStartsOn)),
      current.settings.healthSettings,
    );
    var thisMonth = calculateSummaryFromTransactions(
      getTransactionsForPeriod(current, dashboardId || null, "month", today),
      current.settings.healthSettings,
    );
    var previousMonth = calculateSummaryFromTransactions(
      filterTransactionsByRange(transactions, getPreviousPeriod("month", today, current.settings.weekStartsOn)),
      current.settings.healthSettings,
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
    DEFAULT_ALLOCATION_TEMPLATE: DEFAULT_ALLOCATION_TEMPLATE,
    DEFAULT_CATEGORY_NAMES: DEFAULT_CATEGORY_NAMES,
    DEFAULT_HEALTH_SETTINGS: DEFAULT_HEALTH_SETTINGS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    LEGACY_STORAGE_KEY: LEGACY_STORAGE_KEY,
    PERIODS: PERIODS,
    STORAGE_KEY: STORAGE_KEY,
    SUMMARY_PERIODS: SUMMARY_PERIODS,
    TRANSACTION_TYPES: TRANSACTION_TYPES,
    addAllocation: addAllocation,
    addCategory: addCategory,
    addDays: addDays,
    addDefaultAllocationItem: addDefaultAllocationItem,
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
    deleteCategory: deleteCategory,
    deleteDashboard: deleteDashboard,
    deleteDefaultAllocationItem: deleteDefaultAllocationItem,
    deleteTransaction: deleteTransaction,
    generateInsights: generateInsights,
    getAllocationsForDashboard: getAllocationsForDashboard,
    getCategoriesByType: getCategoriesByType,
    getDashboard: getDashboard,
    getDashboardTransactions: getDashboardTransactions,
    getDateRange: getDateRange,
    getGlobalDashboards: getGlobalDashboards,
    getMonthlyNetPoints: getMonthlyNetPoints,
    getTransactionsForDate: getTransactionsForDate,
    getTransactionsForMonth: getTransactionsForMonth,
    getTransactionsForPeriod: getTransactionsForPeriod,
    getVisibleDashboards: getVisibleDashboards,
    isValidDateKey: isValidDateKey,
    loadState: loadState,
    loadStateForUser: loadStateForUser,
    monthKey: monthKey,
    moveDashboard: moveDashboard,
    normalizeHealthSettings: normalizeHealthSettings,
    normalizeSettings: normalizeSettings,
    normalizeState: normalizeState,
    normalizeTemplate: normalizeTemplate,
    parseDateKey: parseDateKey,
    resetDefaultAllocationTemplate: resetDefaultAllocationTemplate,
    saveState: saveState,
    saveStateForUser: saveStateForUser,
    storageKeyForUser: storageKeyForUser,
    todayKey: todayKey,
    toAmount: toAmount,
    updateAllocation: updateAllocation,
    updateCategory: updateCategory,
    updateDashboard: updateDashboard,
    updateDefaultAllocationItem: updateDefaultAllocationItem,
    updateHealthSettings: updateHealthSettings,
    updateSettings: updateSettings,
    updateTransaction: updateTransaction,
    validateDefaultAllocationTemplate: validateDefaultAllocationTemplate,
    validateTransaction: validateTransaction,
  };
});

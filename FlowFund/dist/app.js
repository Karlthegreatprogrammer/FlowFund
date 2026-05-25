(function flowFundApp() {
  "use strict";

  var core = window.FlowFundCore;
  var root = document.getElementById("app");
  var moneyFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
  var compactMoneyFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  var dateFormatter = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  var monthFormatter = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" });

  var state = core.loadState();
  var ui = {
    view: "home",
    selectedDate: core.todayKey(),
    calendarMonth: core.monthKey(),
    timelineFilter: "month",
    modal: null,
  };

  function save(nextState) {
    state = core.saveState(nextState);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    return moneyFormatter.format(core.toAmount(value));
  }

  function formatCompactMoney(value) {
    return compactMoneyFormatter.format(core.toAmount(value));
  }

  function formatDate(dateKey) {
    var date = core.parseDateKey(dateKey);
    return date ? dateFormatter.format(date) : "No date";
  }

  function dashboardName(dashboardId) {
    var dashboard = core.getDashboard(state, dashboardId);
    return dashboard ? dashboard.name : "Deleted dashboard";
  }

  function selectedDashboard() {
    return core.getDashboard(state, state.selectedDashboardId);
  }

  function typeConfig(type) {
    return core.TRANSACTION_TYPES[type] || core.TRANSACTION_TYPES.expense;
  }

  function render() {
    state = core.normalizeState(state);

    if (ui.view !== "home" && !state.dashboards.length) {
      ui.view = "home";
    }

    root.innerHTML = [
      '<div class="app-shell">',
      renderSidebar(),
      '<main class="main-panel">',
      renderHeader(),
      renderCurrentView(),
      "</main>",
      renderMobileNav(),
      "</div>",
      renderModal(),
    ].join("");
  }

  function renderSidebar() {
    var dashboards = state.dashboards
      .map(function renderDashboardLink(dashboard) {
        var summary = core.calculateSummary(state, dashboard.id);
        var active = dashboard.id === state.selectedDashboardId && ui.view === "dashboard" ? " is-active" : "";
        return [
          '<button class="dashboard-link',
          active,
          '" data-action="open-dashboard" data-dashboard-id="',
          escapeHtml(dashboard.id),
          '">',
          '<span class="dashboard-dot status-',
          summary.cashflowHealth.status.toLowerCase(),
          '"></span>',
          '<span>',
          escapeHtml(dashboard.name),
          "</span>",
          '<strong>',
          formatCompactMoney(summary.currentBalance),
          "</strong>",
          "</button>",
        ].join("");
      })
      .join("");

    return [
      '<aside class="sidebar">',
      '<div class="brand"><span class="brand-mark">F</span><span>FlowFund</span></div>',
      '<nav class="side-nav">',
      renderNavButton("home", "Dashboard", "home"),
      renderNavButton("timeline", "Timeline", "timeline"),
      renderNavButton("insights", "Insights", "insights"),
      renderNavButton("calendar", "Calendar", "calendar"),
      renderNavButton("allocations", "Allocations", "allocations"),
      "</nav>",
      '<div class="side-section">',
      '<div class="side-section-title"><span>My dashboards</span><button class="icon-button" data-action="new-dashboard" aria-label="New dashboard">+</button></div>',
      dashboards || '<p class="side-empty">No dashboards yet.</p>',
      "</div>",
      '<div class="sync-pill"><span></span> All data saved on this device</div>',
      "</aside>",
    ].join("");
  }

  function renderNavButton(view, label, iconName) {
    var active = ui.view === view ? " is-active" : "";
    return [
      '<button class="nav-button',
      active,
      '" data-action="set-view" data-view="',
      view,
      '">',
      '<span class="nav-icon nav-',
      iconName,
      '"></span>',
      '<span>',
      label,
      "</span>",
      "</button>",
    ].join("");
  }

  function renderMobileNav() {
    return [
      '<nav class="mobile-nav">',
      renderMobileNavButton("home", "Dashboard"),
      renderMobileNavButton("calendar", "Calendar"),
      '<button class="mobile-add" data-action="quick-add" aria-label="Add transaction">+</button>',
      renderMobileNavButton("timeline", "Timeline"),
      renderMobileNavButton("insights", "Insights"),
      "</nav>",
    ].join("");
  }

  function renderMobileNavButton(view, label) {
    var active = ui.view === view ? " is-active" : "";
    return [
      '<button class="mobile-nav-button',
      active,
      '" data-action="set-view" data-view="',
      view,
      '">',
      escapeHtml(label),
      "</button>",
    ].join("");
  }

  function renderHeader() {
    var globalSummary = core.calculateSummary(state);
    var dashboard = selectedDashboard();
    var subtitle = state.dashboards.length
      ? "Everything updates from your saved records."
      : "Create your first income dashboard to begin.";

    return [
      '<header class="topbar">',
      '<div>',
      '<p class="eyebrow">Financial Command Center</p>',
      '<h1>FlowFund</h1>',
      '<p class="topbar-subtitle">',
      escapeHtml(subtitle),
      "</p>",
      "</div>",
      '<div class="topbar-actions">',
      dashboard
        ? '<button class="ghost-button" data-action="open-dashboard" data-dashboard-id="' +
          escapeHtml(dashboard.id) +
          '">Open ' +
          escapeHtml(dashboard.name) +
          "</button>"
        : "",
      '<button class="primary-button" data-action="new-dashboard">+ New Dashboard</button>',
      "</div>",
      '<div class="topbar-health status-',
      globalSummary.cashflowHealth.status.toLowerCase(),
      '">',
      '<span>Global health</span>',
      '<strong>',
      escapeHtml(globalSummary.cashflowHealth.status),
      " ",
      globalSummary.cashflowHealth.percent,
      "%</strong>",
      "</div>",
      "</header>",
    ].join("");
  }

  function renderCurrentView() {
    if (ui.view === "dashboard") {
      return renderDashboardDetail(selectedDashboard());
    }

    if (ui.view === "timeline") {
      return renderGlobalTimeline();
    }

    if (ui.view === "calendar") {
      return renderCalendarView();
    }

    if (ui.view === "allocations") {
      return renderAllocationsView();
    }

    if (ui.view === "insights") {
      return renderInsightsView();
    }

    return renderHome();
  }

  function renderHome() {
    var summary = core.calculateSummary(state);
    return [
      renderHealthHero(null, summary),
      state.dashboards.length
        ? '<section class="section-block"><div class="section-heading"><div><p class="eyebrow">Global Summary</p><h2>All Cashflow</h2></div></div>' +
          renderSummaryBar(null, summary) +
          "</section>"
        : "",
      '<section class="section-block">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">Businesses and income streams</p><h2>Your dashboards</h2></div>',
      '<button class="secondary-button" data-action="new-dashboard">+ New Dashboard</button>',
      "</div>",
      state.dashboards.length ? renderDashboardGrid() : renderEmptyDashboards(),
      "</section>",
      '<div class="split-layout">',
      renderTimelinePanel(null, "Global Timeline", false),
      renderInsightsPanel(null, "Smart Insights"),
      "</div>",
    ].join("");
  }

  function renderEmptyDashboards() {
    return [
      '<div class="empty-state">',
      '<h3>No dashboards yet</h3>',
      "<p>Create one dashboard for each business, income stream, or cashflow source you want to manage.</p>",
      '<button class="primary-button" data-action="new-dashboard">Create Dashboard</button>',
      "</div>",
    ].join("");
  }

  function renderDashboardGrid() {
    return [
      '<div class="dashboard-grid">',
      state.dashboards
        .map(function renderDashboardCard(dashboard) {
          var summary = core.calculateSummary(state, dashboard.id);
          return [
            '<button class="dashboard-card" data-action="open-dashboard" data-dashboard-id="',
            escapeHtml(dashboard.id),
            '">',
            '<div class="card-row">',
            '<span class="dashboard-dot status-',
            summary.cashflowHealth.status.toLowerCase(),
            '"></span>',
            '<strong>',
            escapeHtml(dashboard.name),
            "</strong>",
            '<span class="health-badge status-',
            summary.cashflowHealth.status.toLowerCase(),
            '">',
            escapeHtml(summary.cashflowHealth.status),
            "</span>",
            "</div>",
            '<div class="dashboard-balance">',
            formatMoney(summary.currentBalance),
            "</div>",
            '<div class="dashboard-metrics">',
            '<span><small>Income</small>',
            formatCompactMoney(summary.totalIncome),
            "</span>",
            '<span><small>Out</small>',
            formatCompactMoney(summary.totalExpenses + summary.totalLosses + summary.totalDebt),
            "</span>",
            '<span><small>Net</small>',
            formatCompactMoney(summary.netEarnings),
            "</span>",
            "</div>",
            "</button>",
          ].join("");
        })
        .join(""),
      "</div>",
    ].join("");
  }

  function renderDashboardDetail(dashboard) {
    if (!dashboard) {
      return renderHome();
    }

    var summary = core.calculateSummary(state, dashboard.id);
    return [
      '<section class="dashboard-title-row">',
      '<div><p class="eyebrow">Selected dashboard</p><h2>',
      escapeHtml(dashboard.name),
      "</h2></div>",
      '<div class="row-actions">',
      '<button class="ghost-button" data-action="rename-dashboard" data-dashboard-id="',
      escapeHtml(dashboard.id),
      '">Rename</button>',
      '<button class="danger-ghost-button" data-action="delete-dashboard" data-dashboard-id="',
      escapeHtml(dashboard.id),
      '">Delete</button>',
      "</div>",
      "</section>",
      renderSummaryBar(dashboard.id, summary),
      renderHealthHero(dashboard, summary),
      '<div class="split-layout align-start">',
      renderAllocationPanel(dashboard, false),
      renderCalendarPanel(dashboard, false),
      "</div>",
      '<div class="split-layout">',
      renderTimelinePanel(dashboard.id, "Flow Timeline", false),
      renderInsightsPanel(dashboard.id, "Smart Insights"),
      "</div>",
    ].join("");
  }

  function renderSummaryBar(dashboardId, summary) {
    var cards = [
      ["income", "Total Income", summary.totalIncome, "income"],
      ["expense", "Total Expenses", summary.totalExpenses, "expense"],
      ["loss", "Total Losses", summary.totalLosses, "loss"],
      ["debt_payment", "Total Debt", summary.totalDebt, "debt_payment"],
      ["investment", "Investment Capital", summary.investmentCapital, "investment"],
    ]
      .map(function renderMetric(item) {
        return renderSummaryCard(item[0], item[1], item[2], item[3], dashboardId);
      })
      .join("");

    return [
      '<section class="summary-grid">',
      cards,
      renderReadOnlySummaryCard("Net Earnings", summary.netEarnings, "net"),
      renderReadOnlySummaryCard("Current Balance", summary.currentBalance, "balance"),
      renderHealthSummaryCard(summary.cashflowHealth),
      "</section>",
    ].join("");
  }

  function renderSummaryCard(type, title, value, tone, dashboardId) {
    return [
      '<button class="summary-card clickable tone-',
      tone,
      '" data-action="open-transaction" data-type="',
      type,
      '" data-dashboard-id="',
      escapeHtml(dashboardId || ""),
      '">',
      '<span class="summary-icon"></span>',
      '<span>',
      escapeHtml(title),
      "</span>",
      '<strong>',
      formatMoney(value),
      "</strong>",
      '<small>Add record</small>',
      "</button>",
    ].join("");
  }

  function renderReadOnlySummaryCard(title, value, tone) {
    return [
      '<div class="summary-card tone-',
      tone,
      '">',
      '<span class="summary-icon"></span>',
      '<span>',
      escapeHtml(title),
      "</span>",
      '<strong>',
      formatMoney(value),
      "</strong>",
      '<small>Auto calculated</small>',
      "</div>",
    ].join("");
  }

  function renderHealthSummaryCard(health) {
    return [
      '<div class="summary-card tone-health status-',
      health.status.toLowerCase(),
      '">',
      '<span>Cashflow Health</span>',
      '<strong>',
      escapeHtml(health.status),
      " ",
      health.percent,
      "%</strong>",
      '<small>',
      escapeHtml(health.message),
      "</small>",
      "</div>",
    ].join("");
  }

  function renderHealthHero(dashboard, summary) {
    var title = dashboard ? dashboard.name : "All dashboards";
    return [
      '<section class="health-hero status-',
      summary.cashflowHealth.status.toLowerCase(),
      '">',
      '<div class="health-copy">',
      '<p>Cashflow Health</p>',
      '<h2>',
      escapeHtml(summary.cashflowHealth.status),
      "</h2>",
      '<span>',
      escapeHtml(summary.cashflowHealth.message),
      "</span>",
      "</div>",
      '<div class="hero-divider"></div>',
      '<div class="hero-net">',
      '<p>Net Earnings</p>',
      '<strong>',
      formatMoney(summary.netEarnings),
      "</strong>",
      '<span>',
      escapeHtml(title),
      "</span>",
      "</div>",
      renderSparkline(dashboard ? dashboard.id : null),
      "</section>",
    ].join("");
  }

  function renderSparkline(dashboardId) {
    var points = core.getMonthlyNetPoints(state, dashboardId, ui.calendarMonth);
    var values = points.map(function getNet(point) {
      return point.net;
    });
    var max = Math.max.apply(null, values.concat([1]));
    var min = Math.min.apply(null, values.concat([0]));
    var range = max - min || 1;
    var width = 260;
    var height = 96;
    var path = values
      .map(function pointToPath(value, index) {
        var x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
        var y = height - ((value - min) / range) * (height - 12) - 6;
        return (index === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
      })
      .join(" ");

    if (!values.some(function hasValue(value) {
      return value !== 0;
    })) {
      path = "M0 72 L260 72";
    }

    return [
      '<svg class="sparkline" viewBox="0 0 260 96" role="img" aria-label="Monthly cashflow line">',
      '<path d="',
      path,
      '" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />',
      "</svg>",
    ].join("");
  }

  function renderAllocationPanel(dashboard, standalone) {
    var summary = core.calculateSummary(state, dashboard.id);
    var allocations = core.getAllocationsForDashboard(state, dashboard.id);
    var total = core.calculateAllocationTotal(allocations);
    var baseAmount = dashboard.allocationBaseAmount || summary.currentBalance;
    var isValid = Math.abs(total - 100) < 0.001;
    var allocationMessage = isValid
      ? "Allocations are balanced at 100%."
      : total < 100
        ? "Allocation total is below 100% by " + core.toAmount(100 - total) + "%."
        : "Allocation total is above 100% by " + core.toAmount(total - 100) + "%.";
    var rows = allocations.length
      ? allocations
          .map(function renderAllocationRow(allocation) {
            var amount = core.toAmount((baseAmount * allocation.percentage) / 100);
            return [
              '<div class="allocation-row" data-allocation-id="',
              escapeHtml(allocation.id),
              '">',
              '<input type="text" aria-label="Allocation name" data-action="allocation-name" value="',
              escapeHtml(allocation.name),
              '" />',
              '<label><span>%</span><input type="number" min="0" max="100" step="0.01" data-action="allocation-percent" value="',
              allocation.percentage,
              '" /></label>',
              '<strong>',
              formatMoney(amount),
              "</strong>",
              '<button class="icon-button danger" data-action="delete-allocation" data-allocation-id="',
              escapeHtml(allocation.id),
              '" aria-label="Delete allocation">x</button>',
              "</div>",
            ].join("");
          })
          .join("")
      : '<div class="empty-state compact"><h3>No allocations configured yet</h3><p>Add flexible allocation sections for this dashboard.</p></div>';

    return [
      '<section class="panel',
      standalone ? " wide-panel" : "",
      '">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">Allocation</p><h2>Money Plan</h2></div>',
      '<span class="allocation-total ',
      isValid ? "is-valid" : "is-invalid",
      '">',
      total,
      "% total</span>",
      "</div>",
      '<div class="base-control">',
      '<label>Base amount</label>',
      '<input type="number" min="0" step="0.01" data-action="allocation-base" data-dashboard-id="',
      escapeHtml(dashboard.id),
      '" value="',
      dashboard.allocationBaseAmount || "",
      '" placeholder="',
      escapeHtml(formatMoney(summary.currentBalance)),
      '" />',
      '<button class="ghost-button" data-action="clear-allocation-base" data-dashboard-id="',
      escapeHtml(dashboard.id),
      '">Use balance</button>',
      "</div>",
      '<div class="allocation-list">',
      rows,
      "</div>",
      '<form class="inline-form" data-action="add-allocation" data-dashboard-id="',
      escapeHtml(dashboard.id),
      '">',
      '<input name="name" type="text" placeholder="Allocation name" required />',
      '<input name="percentage" type="number" min="0" max="100" step="0.01" placeholder="%" required />',
      '<button class="secondary-button" type="submit">Add</button>',
      "</form>",
      '<p class="',
      isValid ? "success-text" : "error-text",
      '">',
      escapeHtml(allocationMessage),
      "</p>",
      "</section>",
    ].join("");
  }

  function renderCalendarView() {
    var dashboard = selectedDashboard();

    if (!dashboard) {
      return renderNeedsDashboard("Calendar");
    }

    return renderCalendarPanel(dashboard, true);
  }

  function renderCalendarPanel(dashboard, standalone) {
    var selectedRecords = core.getTransactionsForDate(state, dashboard.id, ui.selectedDate);
    var recordsHtml = selectedRecords.length
      ? selectedRecords.map(renderTimelineItem).join("")
      : '<div class="empty-state compact"><h3>No records for this date</h3><p>Add a record to connect this date with your dashboard totals.</p></div>';

    return [
      '<section class="panel',
      standalone ? " wide-panel" : "",
      '">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">Cashflow Calendar</p><h2>',
      escapeHtml(monthFormatter.format(core.parseDateKey(ui.calendarMonth + "-01"))),
      "</h2></div>",
      '<div class="row-actions">',
      '<button class="icon-button" data-action="calendar-prev" aria-label="Previous month">&lt;</button>',
      '<button class="ghost-button" data-action="calendar-today">Today</button>',
      '<button class="icon-button" data-action="calendar-next" aria-label="Next month">&gt;</button>',
      "</div>",
      "</div>",
      renderCalendarGrid(dashboard.id),
      '<div class="selected-date-panel">',
      '<div class="section-heading tight">',
      '<div><p class="eyebrow">Selected date</p><h3>',
      escapeHtml(formatDate(ui.selectedDate)),
      "</h3></div>",
      '<button class="secondary-button" data-action="open-transaction" data-dashboard-id="',
      escapeHtml(dashboard.id),
      '" data-date="',
      escapeHtml(ui.selectedDate),
      '">Add Record</button>',
      "</div>",
      '<div class="timeline-list">',
      recordsHtml,
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderCalendarGrid(dashboardId) {
    var firstDay = core.parseDateKey(ui.calendarMonth + "-01");
    var year = firstDay.getFullYear();
    var month = firstDay.getMonth();
    var startOffset = firstDay.getDay();
    var startDate = new Date(year, month, 1 - startOffset);
    var cells = [];
    var monthTransactions = core.getTransactionsForMonth(state, dashboardId, ui.calendarMonth);

    for (var index = 0; index < 42; index += 1) {
      var date = core.addDays(startDate, index);
      var dateKey = core.todayKey(date);
      var inMonth = date.getMonth() === month;
      var dayTransactions = monthTransactions.filter(function onDate(transaction) {
        return transaction.date === dateKey;
      });
      var daySummary = core.calculateSummaryFromTransactions(dayTransactions);
      var active = ui.selectedDate === dateKey ? " is-selected" : "";
      var muted = inMonth ? "" : " is-muted";
      var hasActivity = dayTransactions.length ? " has-activity" : "";
      var net = daySummary.netEarnings + daySummary.investmentCapital - daySummary.totalDebt;
      var types = Array.from(new Set(dayTransactions.map(function getType(transaction) {
        return transaction.type;
      })));

      cells.push([
        '<button class="calendar-day',
        active,
        muted,
        hasActivity,
        '" data-action="select-date" data-date="',
        dateKey,
        '">',
        '<span>',
        date.getDate(),
        "</span>",
        dayTransactions.length
          ? '<strong class="' +
            (net >= 0 ? "positive" : "negative") +
            '">' +
            escapeHtml(formatCompactMoney(net)) +
            "</strong>"
          : "",
        '<div class="day-dots">',
        types
          .map(function renderDot(type) {
            return '<i class="dot tone-' + type + '"></i>';
          })
          .join(""),
        "</div>",
        "</button>",
      ].join(""));
    }

    return [
      '<div class="calendar-grid">',
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        .map(function renderWeekday(day) {
          return '<span class="calendar-weekday">' + day + "</span>";
        })
        .join(""),
      cells.join(""),
      "</div>",
    ].join("");
  }

  function renderTimelinePanel(dashboardId, title, compact) {
    var transactions = core.getTransactionsForPeriod(state, dashboardId, ui.timelineFilter);
    var body = transactions.length
      ? transactions.map(renderTimelineItem).join("")
      : '<div class="empty-state compact"><h3>No transactions yet</h3><p>Add income, expenses, losses, investments, or debt payments to build your timeline.</p></div>';

    return [
      '<section class="panel timeline-panel">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">',
      dashboardId ? "Dashboard records" : "All dashboards",
      "</p><h2>",
      escapeHtml(title),
      "</h2></div>",
      compact ? "" : '<button class="secondary-button" data-action="open-transaction" data-dashboard-id="' + escapeHtml(dashboardId || "") + '">Add Record</button>',
      "</div>",
      renderTimelineFilters(),
      '<div class="timeline-list">',
      body,
      "</div>",
      "</section>",
    ].join("");
  }

  function renderGlobalTimeline() {
    return [
      '<section class="section-block">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">Every saved movement</p><h2>Flow Timeline</h2></div>',
      '<button class="secondary-button" data-action="open-transaction">Add Record</button>',
      "</div>",
      renderTimelineFilters(),
      '<div class="panel wide-panel">',
      '<div class="timeline-list">',
      core.getTransactionsForPeriod(state, null, ui.timelineFilter).length
        ? core.getTransactionsForPeriod(state, null, ui.timelineFilter).map(renderTimelineItem).join("")
        : '<div class="empty-state compact"><h3>No transactions yet</h3><p>Filtering only changes what you see. Your stored records stay saved.</p></div>',
      "</div>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderTimelineFilters() {
    return [
      '<div class="segmented-control" role="tablist">',
      Object.keys(core.PERIODS)
        .map(function renderFilter(key) {
          var active = ui.timelineFilter === key ? " is-active" : "";
          return [
            '<button class="',
            active,
            '" data-action="timeline-filter" data-filter="',
            key,
            '">',
            core.PERIODS[key],
            "</button>",
          ].join("");
        })
        .join(""),
      "</div>",
    ].join("");
  }

  function renderTimelineItem(transaction) {
    var config = typeConfig(transaction.type);
    var outflow = transaction.type === "expense" || transaction.type === "loss" || transaction.type === "debt_payment";
    var sign = outflow ? "-" : "+";
    return [
      '<article class="timeline-item tone-',
      transaction.type,
      '">',
      '<div class="timeline-marker"></div>',
      '<div class="timeline-copy">',
      '<strong>',
      escapeHtml(transaction.category || config.label),
      "</strong>",
      '<span>',
      escapeHtml(dashboardName(transaction.dashboardId)),
      " - ",
      escapeHtml(formatDate(transaction.date)),
      "</span>",
      transaction.notes ? '<p>' + escapeHtml(transaction.notes) + "</p>" : "",
      "</div>",
      '<div class="timeline-amount">',
      '<strong>',
      sign,
      formatMoney(transaction.amount),
      "</strong>",
      '<span>',
      escapeHtml(config.label),
      "</span>",
      "</div>",
      '<div class="timeline-actions">',
      '<button class="mini-button" data-action="edit-transaction" data-transaction-id="',
      escapeHtml(transaction.id),
      '">Edit</button>',
      '<button class="mini-button danger" data-action="delete-transaction" data-transaction-id="',
      escapeHtml(transaction.id),
      '">Delete</button>',
      "</div>",
      "</article>",
    ].join("");
  }

  function renderInsightsView() {
    return [
      '<section class="section-block">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">Based on saved data</p><h2>Smart Insights</h2></div>',
      "</div>",
      renderInsightsPanel(null, "All Dashboards"),
      "</section>",
    ].join("");
  }

  function renderInsightsPanel(dashboardId, title) {
    var insights = core.generateInsights(state, dashboardId);
    var body = insights.length
      ? insights
          .map(function renderInsight(insight) {
            return [
              '<article class="insight-item tone-',
              escapeHtml(insight.tone),
              '">',
              '<span class="insight-icon"></span>',
              '<div><strong>',
              escapeHtml(insight.title),
              "</strong><p>",
              escapeHtml(insight.body),
              "</p></div>",
              "</article>",
            ].join("");
          })
          .join("")
      : '<div class="empty-state compact"><h3>No insights available yet</h3><p>FlowFund will show trends after you add enough real transaction data.</p></div>';

    return [
      '<section class="panel insights-panel">',
      '<div class="section-heading tight">',
      '<div><p class="eyebrow">Insights</p><h2>',
      escapeHtml(title),
      "</h2></div>",
      "</div>",
      '<div class="insight-list">',
      body,
      "</div>",
      "</section>",
    ].join("");
  }

  function renderAllocationsView() {
    var dashboard = selectedDashboard();

    if (!dashboard) {
      return renderNeedsDashboard("Allocations");
    }

    return renderAllocationPanel(dashboard, true);
  }

  function renderNeedsDashboard(title) {
    return [
      '<section class="section-block">',
      '<div class="empty-state">',
      '<h3>',
      escapeHtml(title),
      " needs a dashboard</h3>",
      "<p>Create or open a dashboard first.</p>",
      '<button class="primary-button" data-action="new-dashboard">+ New Dashboard</button>',
      "</div>",
      "</section>",
    ].join("");
  }

  function renderModal() {
    if (!ui.modal) {
      return "";
    }

    if (ui.modal.kind === "dashboard") {
      return renderDashboardModal();
    }

    if (ui.modal.kind === "transaction") {
      return renderTransactionModal();
    }

    return "";
  }

  function renderDashboardModal() {
    var dashboard = ui.modal.dashboardId ? core.getDashboard(state, ui.modal.dashboardId) : null;
    var title = dashboard ? "Rename Dashboard" : "New Dashboard";
    var value = dashboard ? dashboard.name : "";

    return [
      '<div class="modal-backdrop" data-action="close-modal">',
      '<section class="modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-modal-title" data-modal-stop>',
      '<div class="section-heading tight"><h2 id="dashboard-modal-title">',
      title,
      "</h2></div>",
      '<form data-action="save-dashboard">',
      '<label>Dashboard name<input name="name" type="text" value="',
      escapeHtml(value),
      '" required autofocus /></label>',
      '<div class="modal-actions">',
      '<button type="button" class="ghost-button" data-action="close-modal">Cancel</button>',
      '<button type="submit" class="primary-button">Save</button>',
      "</div>",
      "</form>",
      "</section>",
      "</div>",
    ].join("");
  }

  function renderTransactionModal() {
    var draft = ui.modal.draft || {};
    var transaction = ui.modal.transactionId
      ? state.transactions.find(function findTransaction(item) {
          return item.id === ui.modal.transactionId;
        })
      : null;
    var selectedType = draft.type || (transaction && transaction.type) || ui.modal.type || "income";
    var selectedDashboardId =
      draft.dashboardId ||
      (transaction && transaction.dashboardId) ||
      ui.modal.dashboardId ||
      state.selectedDashboardId ||
      (state.dashboards[0] && state.dashboards[0].id) ||
      "";
    var selectedDate = draft.date || (transaction && transaction.date) || ui.modal.date || ui.selectedDate;
    var selectedConfig = typeConfig(selectedType);

    return [
      '<div class="modal-backdrop" data-action="close-modal">',
      '<section class="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title" data-modal-stop>',
      '<div class="section-heading tight"><div><p class="eyebrow">Financial record</p><h2 id="transaction-modal-title">',
      transaction ? "Edit Record" : "Add Record",
      "</h2></div></div>",
      ui.modal.error ? '<p class="error-box">' + escapeHtml(ui.modal.error) + "</p>" : "",
      '<form data-action="save-transaction">',
      '<div class="form-grid">',
      '<label>Type<select name="type" required>',
      Object.keys(core.TRANSACTION_TYPES)
        .map(function renderTypeOption(type) {
          return [
            '<option value="',
            type,
            '"',
            selectedType === type ? " selected" : "",
            ">",
            escapeHtml(core.TRANSACTION_TYPES[type].label),
            "</option>",
          ].join("");
        })
        .join(""),
      "</select></label>",
      '<label>Dashboard<select name="dashboardId" required>',
      state.dashboards
        .map(function renderDashboardOption(dashboard) {
          return [
            '<option value="',
            escapeHtml(dashboard.id),
            '"',
            selectedDashboardId === dashboard.id ? " selected" : "",
            ">",
            escapeHtml(dashboard.name),
            "</option>",
          ].join("");
        })
        .join(""),
      "</select></label>",
      '<label>Amount<input name="amount" type="number" min="0.01" step="0.01" value="',
      escapeHtml(draft.amount || (transaction && transaction.amount) || ""),
      '" required /></label>',
      '<label>Date<input name="date" type="date" value="',
      escapeHtml(selectedDate),
      '" required /></label>',
      '<label>Reason or category<input name="category" list="category-options" value="',
      escapeHtml(draft.category || (transaction && transaction.category) || ""),
      '" placeholder="Payment, supplies, salary..." /></label>',
      '<datalist id="category-options">',
      selectedConfig.categories
        .map(function renderCategory(category) {
          return '<option value="' + escapeHtml(category) + '"></option>';
        })
        .join(""),
      "</datalist>",
      '<label class="wide-field">Notes<textarea name="notes" rows="3" placeholder="Optional notes">',
      escapeHtml(draft.notes || (transaction && transaction.notes) || ""),
      "</textarea></label>",
      "</div>",
      '<div class="modal-actions">',
      '<button type="button" class="ghost-button" data-action="close-modal">Cancel</button>',
      '<button type="submit" class="primary-button">Save Record</button>',
      "</div>",
      "</form>",
      "</section>",
      "</div>",
    ].join("");
  }

  function openTransactionModal(options) {
    if (!state.dashboards.length) {
      ui.modal = { kind: "dashboard" };
      render();
      return;
    }

    ui.modal = Object.assign({ kind: "transaction" }, options || {});
    render();
  }

  function setView(view) {
    if ((view === "calendar" || view === "allocations") && !selectedDashboard()) {
      ui.view = "home";
    } else {
      ui.view = view;
    }

    render();
  }

  root.addEventListener("click", function handleClick(event) {
    var trigger = event.target.closest("[data-action]");
    if (!trigger) {
      return;
    }

    var action = trigger.dataset.action;

    if (action === "close-modal") {
      if (event.target.closest("[data-modal-stop]") && event.target !== trigger) {
        return;
      }
      ui.modal = null;
      render();
      return;
    }

    if (action === "new-dashboard") {
      ui.modal = { kind: "dashboard" };
      render();
      return;
    }

    if (action === "rename-dashboard") {
      ui.modal = { kind: "dashboard", dashboardId: trigger.dataset.dashboardId };
      render();
      return;
    }

    if (action === "delete-dashboard") {
      var dashboard = core.getDashboard(state, trigger.dataset.dashboardId);
      if (dashboard && window.confirm("Delete " + dashboard.name + " and all of its records?")) {
        save(core.deleteDashboard(state, dashboard.id));
        ui.view = state.dashboards.length ? "home" : "home";
        render();
      }
      return;
    }

    if (action === "open-dashboard") {
      state.selectedDashboardId = trigger.dataset.dashboardId;
      save(state);
      ui.view = "dashboard";
      render();
      return;
    }

    if (action === "set-view") {
      setView(trigger.dataset.view);
      return;
    }

    if (action === "quick-add") {
      openTransactionModal({ dashboardId: state.selectedDashboardId });
      return;
    }

    if (action === "open-transaction") {
      openTransactionModal({
        type: trigger.dataset.type || "income",
        dashboardId: trigger.dataset.dashboardId || state.selectedDashboardId,
        date: trigger.dataset.date || ui.selectedDate,
      });
      return;
    }

    if (action === "edit-transaction") {
      ui.modal = { kind: "transaction", transactionId: trigger.dataset.transactionId };
      render();
      return;
    }

    if (action === "delete-transaction") {
      if (window.confirm("Delete this transaction?")) {
        save(core.deleteTransaction(state, trigger.dataset.transactionId));
        render();
      }
      return;
    }

    if (action === "timeline-filter") {
      ui.timelineFilter = trigger.dataset.filter;
      render();
      return;
    }

    if (action === "calendar-prev") {
      ui.calendarMonth = core.addMonths(ui.calendarMonth, -1);
      render();
      return;
    }

    if (action === "calendar-next") {
      ui.calendarMonth = core.addMonths(ui.calendarMonth, 1);
      render();
      return;
    }

    if (action === "calendar-today") {
      ui.selectedDate = core.todayKey();
      ui.calendarMonth = core.monthKey();
      render();
      return;
    }

    if (action === "select-date") {
      ui.selectedDate = trigger.dataset.date;
      ui.calendarMonth = trigger.dataset.date.slice(0, 7);
      render();
      return;
    }

    if (action === "delete-allocation") {
      save(core.deleteAllocation(state, trigger.dataset.allocationId));
      render();
      return;
    }

    if (action === "clear-allocation-base") {
      save(core.updateDashboard(state, trigger.dataset.dashboardId, { allocationBaseAmount: 0 }));
      render();
    }
  });

  root.addEventListener("submit", function handleSubmit(event) {
    var form = event.target.closest("form[data-action]");
    if (!form) {
      return;
    }

    event.preventDefault();
    var action = form.dataset.action;
    var formData = Object.fromEntries(new FormData(form).entries());

    if (action === "save-dashboard") {
      if (ui.modal && ui.modal.dashboardId) {
        save(core.updateDashboard(state, ui.modal.dashboardId, { name: formData.name }));
      } else {
        save(core.createDashboard(state, formData.name));
      }

      ui.modal = null;
      ui.view = "dashboard";
      render();
      return;
    }

    if (action === "save-transaction") {
      var result = ui.modal && ui.modal.transactionId
        ? core.updateTransaction(state, ui.modal.transactionId, formData)
        : core.addTransaction(state, formData);

      if (result.errors.length) {
        ui.modal = Object.assign({}, ui.modal, {
          draft: formData,
          error: result.errors.join(" "),
        });
        render();
        return;
      }

      save(result.state);
      ui.selectedDate = formData.date;
      ui.calendarMonth = formData.date.slice(0, 7);
      state.selectedDashboardId = formData.dashboardId;
      save(state);
      ui.modal = null;
      render();
      return;
    }

    if (action === "add-allocation") {
      var allocationResult = core.addAllocation(state, form.dataset.dashboardId, formData);
      save(allocationResult.state);
      render();
    }
  });

  root.addEventListener("change", function handleChange(event) {
    var target = event.target;
    var action = target.dataset.action;

    if (action === "allocation-name" || action === "allocation-percent") {
      var row = target.closest("[data-allocation-id]");
      var nameInput = row.querySelector('[data-action="allocation-name"]');
      var percentInput = row.querySelector('[data-action="allocation-percent"]');
      save(core.updateAllocation(state, row.dataset.allocationId, {
        name: nameInput.value,
        percentage: percentInput.value,
      }));
      render();
      return;
    }

    if (action === "allocation-base") {
      save(core.updateDashboard(state, target.dataset.dashboardId, {
        allocationBaseAmount: target.value,
      }));
      render();
      return;
    }

    if (ui.modal && ui.modal.kind === "transaction" && target.name === "type") {
      var form = target.closest("form");
      ui.modal = Object.assign({}, ui.modal, {
        type: target.value,
        draft: Object.fromEntries(new FormData(form).entries()),
      });
      render();
    }
  });

  document.addEventListener("keydown", function handleKeydown(event) {
    if (event.key === "Escape" && ui.modal) {
      ui.modal = null;
      render();
    }
  });

  render();
})();

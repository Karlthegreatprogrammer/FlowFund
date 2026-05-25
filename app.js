(function flowFundApp() {
  "use strict";

  var core = window.FlowFundCore;
  var cloud = window.FlowFundSupabase || null;
  var root = document.getElementById("app");
  var state = core.createDefaultState();
  var ui = {
    view: "home",
    selectedDate: core.todayKey(),
    calendarMonth: core.monthKey(),
    timelineFilter: state.settings.defaultTimelineFilter,
    modal: null,
    message: "",
  };
  var auth = {
    ready: false,
    loading: false,
    user: null,
    message: cloud ? "Checking Supabase session..." : "Supabase configuration is required before sign in.",
  };

  var CURRENCY_CHOICES = [
    { code: "PHP", symbol: "\u20b1", label: "PHP - Philippine Peso" },
    { code: "USD", symbol: "$", label: "USD - US Dollar" },
    { code: "EUR", symbol: "\u20ac", label: "EUR - Euro" },
    { code: "JPY", symbol: "\u00a5", label: "JPY - Japanese Yen" },
  ];

  var DATE_FORMATS = [
    { value: "month_day_year", label: "Month Day, Year" },
    { value: "mm_dd_yyyy", label: "MM/DD/YYYY" },
    { value: "yyyy_mm_dd", label: "YYYY-MM-DD" },
  ];

  var ICONS = {
    allocations: "assets/icons/allocations_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
    arrowDown: "assets/icons/arrow_downward_24dp_C7445A_FILL0_wght400_GRAD0_opsz24.svg",
    arrowForward: "assets/icons/arrow_forward_24dp_6542A0_FILL0_wght400_GRAD0_opsz24.svg",
    arrowUp: "assets/icons/arrow_upward_24dp_4B9E7C_FILL0_wght400_GRAD0_opsz24.svg",
    barChart: "assets/icons/bar_chart_24dp_000000_FILL0_wght400_GRAD0_opsz24.svg",
    business: "assets/icons/business_center_24dp_2D55B8_FILL1_wght400_GRAD0_opsz24.svg",
    calendar: "assets/icons/calendar_today_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
    cardiology: "assets/icons/cardiology_24dp_000000_FILL1_wght400_GRAD0_opsz24.svg",
    cashflow: "assets/icons/credit_card_heart_24dp_6542A0_FILL1_wght400_GRAD0_opsz24.svg",
    dashboard: "assets/icons/dashboard_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
    debt: "assets/icons/debt_icon.png",
    debts: "assets/icons/debts_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
    eventNote: "assets/icons/event_note_24dp_000000_FILL0_wght400_GRAD0_opsz24.svg",
    expense: "assets/icons/expenses_icon.png",
    income: "assets/icons/income_icon.png",
    investment: "assets/icons/investment_24dp_2D55B8_FILL0_wght400_GRAD0_opsz24.svg",
    investments: "assets/icons/investments_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
    loss: "assets/icons/losses_icon.png",
    reports: "assets/icons/reports_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
    savings: "assets/icons/savings_24dp_0E9960_FILL1_wght400_GRAD0_opsz24.svg",
    settings: "assets/icons/settings_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
    shield: "assets/icons/shield_check_24dp_2D55B8_FILL0_wght400_GRAD0_opsz24.svg",
    shieldHeart: "assets/icons/shield_with_heart_24dp_DA811E_FILL1_wght400_GRAD0_opsz24.svg",
    stackedLine: "assets/icons/stacked_line_chart_24dp_000000_FILL0_wght400_GRAD0_opsz24.svg",
    timeline: "assets/icons/timeline_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg",
    visibility: "assets/icons/visibility_24dp_000000_FILL0_wght400_GRAD0_opsz24.svg",
  };

  var NAV_ICONS = {
    home: "dashboard",
    timeline: "timeline",
    insights: "stackedLine",
    calendar: "calendar",
    allocations: "allocations",
    settings: "settings",
  };

  var TYPE_ICONS = {
    income: "income",
    expense: "expense",
    loss: "loss",
    investment: "investment",
    debt_payment: "debt",
  };

  var SETTINGS_ICONS = {
    Appearance: "visibility",
    "Currency & Date": "eventNote",
    Dashboards: "business",
    Categories: "reports",
    "Cashflow Health": "cardiology",
    Allocations: "allocations",
    "Timeline & Summary": "timeline",
    "Data & Privacy": "shield",
  };

  var OAUTH_PROVIDER_LABELS = {
    google: "Google",
    facebook: "Facebook",
  };

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function icon(name, className, label) {
    var src = ICONS[name];
    if (!src) {
      return "";
    }

    var fileClass = /\.svg(?:$|\?)/.test(src) ? " svg-icon" : " png-icon";
    var extraClass = className ? " " + escapeHtml(className) : "";

    return [
      '<img class="ui-icon',
      fileClass,
      extraClass,
      '" src="',
      escapeHtml(src),
      '" alt="',
      label ? escapeHtml(label) : "",
      '"',
      label ? "" : ' aria-hidden="true"',
      " />",
    ].join("");
  }

  function typeIcon(type, className) {
    return icon(TYPE_ICONS[type] || "reports", className || "type-icon");
  }

  function brandMark() {
    return '<span class="brand-mark">' + icon("cashflow", "brand-mark-icon") + "</span>";
  }

  function insightIcon(tone) {
    var iconName = {
      green: "arrowUp",
      amber: "shieldHeart",
      red: "arrowDown",
      blue: "stackedLine",
    }[tone] || "reports";

    return icon(iconName, "insight-icon-img");
  }

  function actionIcon(name) {
    return icon(name, "button-icon");
  }

  function appConfig() {
    return window.FLOWFUND_SUPABASE_CONFIG || {};
  }

  function enabledOAuthProviders() {
    var providers = appConfig().oauthProviders;
    if (!Array.isArray(providers)) {
      return [];
    }

    return providers.filter(function enabled(provider) {
      return OAUTH_PROVIDER_LABELS[provider];
    });
  }

  function isOAuthProviderEnabled(provider) {
    return enabledOAuthProviders().indexOf(provider) !== -1;
  }

  function oauthProviderLabel(provider) {
    return OAUTH_PROVIDER_LABELS[provider] || provider;
  }

  function save(nextState) {
    state = auth.user
      ? core.saveStateForUser(auth.user.id, nextState)
      : core.normalizeState(nextState);
    applyTheme();
    queueCloudSave();
  }

  function queueCloudSave() {
    if (!cloud || !auth.user || !cloud.pushState) {
      return;
    }

    cloud.pushState(state).then(function synced() {
      auth.message = "Cloud data saved.";
    }).catch(function failed(error) {
      auth.message = "Cloud sync needs attention: " + error.message;
      render();
    });
  }

  function resolveTheme() {
    if (state.settings.theme === "dark") {
      return "dark";
    }

    if (state.settings.theme === "light") {
      return "light";
    }

    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    return "light";
  }

  function applyTheme() {
    var resolved = resolveTheme();
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-choice", state.settings.theme);
  }

  function formatMoney(value, options) {
    if (state.settings.hideBalances && !(options && options.reveal)) {
      return "Hidden";
    }

    var amount = core.toAmount(value);
    var formatted = new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    var prefix = amount < 0 ? "-" : "";

    if (state.settings.numberFormat === "code") {
      return prefix + state.settings.currencyCode + " " + formatted;
    }

    return prefix + state.settings.currencySymbol + formatted;
  }

  function formatCompactMoney(value) {
    if (state.settings.hideBalances) {
      return "Hidden";
    }

    var amount = core.toAmount(value);
    var formatted = new Intl.NumberFormat("en-PH", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(Math.abs(amount));
    var prefix = amount < 0 ? "-" : "";
    return prefix + state.settings.currencySymbol + formatted;
  }

  function formatDate(dateKey) {
    var date = core.parseDateKey(dateKey);
    if (!date) {
      return "No date";
    }

    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    var year = String(date.getFullYear());

    if (state.settings.dateFormat === "mm_dd_yyyy") {
      return month + "/" + day + "/" + year;
    }

    if (state.settings.dateFormat === "yyyy_mm_dd") {
      return year + "-" + month + "-" + day;
    }

    return new Intl.DateTimeFormat("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatMonth(monthValue) {
    return new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric",
    }).format(core.parseDateKey(monthValue + "-01"));
  }

  function dashboardName(dashboardId) {
    var dashboard = core.getDashboard(state, dashboardId);
    return dashboard ? dashboard.name : "Deleted dashboard";
  }

  function selectedDashboard() {
    return core.getDashboard(state, state.selectedDashboardId);
  }

  function periodForSummary() {
    if (state.settings.preferredSummaryPeriod === "daily") {
      return "today";
    }
    if (state.settings.preferredSummaryPeriod === "weekly") {
      return "week";
    }
    if (state.settings.preferredSummaryPeriod === "monthly") {
      return "month";
    }
    return "all";
  }

  function displaySummary(dashboardId) {
    var period = periodForSummary();
    var allTime = core.calculateSummary(state, dashboardId || null);

    if (period === "all") {
      return allTime;
    }

    var periodTransactions = core.getTransactionsForPeriod(state, dashboardId || null, period);
    var summary = core.calculateSummaryFromTransactions(periodTransactions, state.settings.healthSettings);
    summary.currentBalance = allTime.currentBalance;
    return summary;
  }

  function filteredTimelineTransactions(dashboardId) {
    var hidden = state.settings.hiddenTimelineTypes;
    return core.getTransactionsForPeriod(state, dashboardId || null, ui.timelineFilter).filter(function visibleType(tx) {
      return hidden.indexOf(tx.type) === -1;
    });
  }

  function typeConfig(type) {
    return core.TRANSACTION_TYPES[type] || core.TRANSACTION_TYPES.expense;
  }

  function render() {
    state = core.normalizeState(state);
    applyTheme();

    if (!auth.ready) {
      root.innerHTML = renderAuthLoading();
      return;
    }

    if (!auth.user) {
      if (window.location.hash !== "#signin") {
        window.history.replaceState(null, "", "#signin");
      }
      root.innerHTML = renderAuthScreen();
      return;
    }

    if (window.location.hash === "#signin") {
      window.history.replaceState(null, "", "#app");
    }

    if (!state.dashboards.some(function selectedExists(dashboard) {
      return dashboard.id === state.selectedDashboardId;
    })) {
      state.selectedDashboardId = state.settings.defaultDashboardId || (state.dashboards[0] && state.dashboards[0].id) || null;
    }

    if (ui.view !== "home" && !state.dashboards.length && ui.view !== "settings") {
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

  function renderAuthLoading() {
    return [
      '<main class="auth-shell">',
      '<section class="auth-card">',
      '<div class="brand auth-brand">',
      brandMark(),
      "<span>FlowFund</span></div>",
      '<h1>Checking your session</h1>',
      '<p>Getting your private cashflow workspace ready.</p>',
      '<div class="loading-line"></div>',
      "</section>",
      "</main>",
    ].join("");
  }

  function renderAuthScreen() {
    var disabled = auth.loading || !cloud ? " disabled" : "";
    var oauthButtons = enabledOAuthProviders().map(function renderOAuthProvider(provider) {
      return [
        '<button class="secondary-button" data-action="oauth" data-provider="',
        escapeHtml(provider),
        '"',
        disabled,
        ">Continue with ",
        escapeHtml(oauthProviderLabel(provider)),
        "</button>",
      ].join("");
    }).join("");

    return [
      '<main class="auth-shell">',
      '<section class="auth-card">',
      '<div class="brand auth-brand">',
      brandMark(),
      "<span>FlowFund</span></div>",
      '<h1>Sign in to FlowFund</h1>',
      '<p>Use your account to manage private dashboards, cashflow, categories, and records.</p>',
      auth.message ? '<p class="auth-message">' + escapeHtml(auth.message) + "</p>" : "",
      oauthButtons ? '<div class="auth-oauth">' + oauthButtons + "</div>" : "",
      '<form class="auth-form auth-form-card" data-action="auth-email">',
      '<label>Email<input name="email" type="email" autocomplete="email" required /></label>',
      '<label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required /></label>',
      '<div class="row-actions">',
      '<button class="primary-button" type="submit" data-auth-mode="signin"',
      disabled,
      ">Sign In</button>",
      '<button class="ghost-button" type="submit" data-auth-mode="signup"',
      disabled,
      ">Sign Up</button>",
      "</div>",
      "</form>",
      '<p class="auth-footnote">Your records are protected by Supabase Auth and Row Level Security.</p>',
      "</section>",
      "</main>",
    ].join("");
  }

  function renderSidebar() {
    var dashboards = core.getVisibleDashboards(state)
      .map(function renderDashboardLink(dashboard) {
        var summary = displaySummary(dashboard.id);
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
          dashboard.isArchived ? " (Archived)" : "",
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
      '<div class="brand">',
      brandMark(),
      "<span>FlowFund</span></div>",
      '<nav class="side-nav">',
      renderNavButton("home", "Dashboard", "home"),
      renderNavButton("timeline", "Timeline", "timeline"),
      renderNavButton("insights", "Insights", "insights"),
      renderNavButton("calendar", "Calendar", "calendar"),
      renderNavButton("allocations", "Allocations", "allocations"),
      renderNavButton("settings", "Settings", "settings"),
      "</nav>",
      '<div class="side-section">',
      '<div class="side-section-title"><span>My dashboards</span><button class="icon-button" data-action="new-dashboard" aria-label="New dashboard">+</button></div>',
      dashboards || '<p class="side-empty">No dashboards yet.</p>',
      "</div>",
      '<div class="sync-pill"><span></span> ',
      auth.user ? "Signed in: " + escapeHtml(auth.user.email || "FlowFund user") : "Sign in required",
      "</div>",
      auth.user ? '<button class="ghost-button sidebar-logout" data-action="logout">Logout</button>' : "",
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
      icon(NAV_ICONS[iconName] || NAV_ICONS[view] || iconName, "nav-icon"),
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
      renderMobileNavButton("settings", "Settings"),
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
      icon(NAV_ICONS[view] || "dashboard", "mobile-nav-icon"),
      '<span>',
      escapeHtml(label),
      "</span>",
      "</button>",
    ].join("");
  }

  function renderHeader() {
    var globalSummary = displaySummary(null);
    var dashboard = selectedDashboard();
    var subtitle = state.dashboards.length
      ? "Settings, summaries, and cashflow update from the same saved records."
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
          '">' +
          actionIcon("arrowForward") +
          "<span>Open " +
          escapeHtml(dashboard.name) +
          "</span></button>"
        : "",
      '<button class="primary-button" data-action="new-dashboard">',
      actionIcon("business"),
      "<span>New Dashboard</span></button>",
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
    if (ui.view === "settings") {
      return renderSettingsView();
    }
    return renderHome();
  }

  function renderHome() {
    var summary = displaySummary(null);
    return [
      renderHealthHero(null, summary),
      state.dashboards.length
        ? '<section class="section-block"><div class="section-heading"><div><p class="eyebrow">Global Summary</p><h2>All Cashflow</h2></div><span class="period-pill">' +
          escapeHtml(core.SUMMARY_PERIODS[state.settings.preferredSummaryPeriod]) +
          "</span></div>" +
          renderSummaryBar(null, summary) +
          "</section>"
        : "",
      '<section class="section-block">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">Businesses and income streams</p><h2>Your dashboards</h2></div>',
      '<button class="secondary-button" data-action="new-dashboard">',
      actionIcon("business"),
      "<span>New Dashboard</span></button>",
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
      '<button class="primary-button" data-action="new-dashboard">',
      actionIcon("business"),
      "<span>Create Dashboard</span></button>",
      "</div>",
    ].join("");
  }

  function renderDashboardGrid() {
    var dashboards = core.getVisibleDashboards(state);
    if (!dashboards.length) {
      return [
        '<div class="empty-state">',
        '<h3>All dashboards are archived</h3>',
        "<p>Open Settings to show archived dashboards or create a new one.</p>",
        '<button class="secondary-button" data-action="set-view" data-view="settings">',
        actionIcon("settings"),
        "<span>Open Settings</span></button>",
        "</div>",
      ].join("");
    }

    return [
      '<div class="dashboard-grid">',
      dashboards
        .map(function renderDashboardCard(dashboard) {
          var summary = displaySummary(dashboard.id);
          return [
            '<button class="dashboard-card" data-action="open-dashboard" data-dashboard-id="',
            escapeHtml(dashboard.id),
            '">',
            '<div class="card-row">',
            '<span class="dashboard-card-icon">',
            icon("business", "dashboard-card-icon-img"),
            "</span>",
            '<strong>',
            escapeHtml(dashboard.name),
            dashboard.isArchived ? " (Archived)" : "",
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

    var summary = displaySummary(dashboard.id);
    return [
      '<section class="dashboard-title-row">',
      '<div><p class="eyebrow">Selected dashboard</p><h2>',
      escapeHtml(dashboard.name),
      dashboard.isArchived ? " (Archived)" : "",
      "</h2></div>",
      '<div class="row-actions">',
      '<button class="ghost-button" data-action="rename-dashboard" data-dashboard-id="',
      escapeHtml(dashboard.id),
      '">Rename</button>',
      '<button class="ghost-button" data-action="toggle-dashboard-archive" data-dashboard-id="',
      escapeHtml(dashboard.id),
      '">',
      dashboard.isArchived ? "Unarchive" : "Archive",
      "</button>",
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
      escapeHtml(dashboardId || state.selectedDashboardId || ""),
      '">',
      '<span class="summary-icon">',
      typeIcon(type, "summary-icon-img"),
      "</span>",
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
    var iconName = tone === "balance" ? "savings" : "barChart";
    return [
      '<div class="summary-card tone-',
      tone,
      '">',
      '<span class="summary-icon">',
      icon(iconName, "summary-icon-img"),
      "</span>",
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
      '<span class="summary-icon">',
      icon("cardiology", "summary-icon-img"),
      "</span>",
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
      '<span class="health-hero-icon">',
      icon("cardiology", "health-hero-icon-img"),
      "</span>",
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
      " - ",
      escapeHtml(core.SUMMARY_PERIODS[state.settings.preferredSummaryPeriod]),
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
    var calendarTitle = state.settings.defaultCalendarView === "week"
      ? "Week of " + formatDate(ui.selectedDate)
      : state.settings.defaultCalendarView === "today"
        ? "Today"
        : formatMonth(ui.calendarMonth);
    var recordsHtml = selectedRecords.length
      ? selectedRecords.map(renderTimelineItem).join("")
      : '<div class="empty-state compact"><h3>No records for this date</h3><p>Add a record to connect this date with your dashboard totals.</p></div>';

    return [
      '<section class="panel',
      standalone ? " wide-panel" : "",
      '">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">Cashflow Calendar</p><h2>',
      escapeHtml(calendarTitle),
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
      '">',
      actionIcon("cashflow"),
      "<span>Add Record</span></button>",
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
    var weekStart = state.settings.weekStartsOn === "sunday" ? 0 : 1;
    var startOffset = (firstDay.getDay() - weekStart + 7) % 7;
    var startDate = new Date(year, month, 1 - startOffset);
    var cellCount = 42;
    var calendarView = state.settings.defaultCalendarView;
    var cells = [];
    var monthTransactions = core.getDashboardTransactions(state, dashboardId);
    var weekdays = state.settings.weekStartsOn === "sunday"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    if (calendarView === "week") {
      var selected = core.parseDateKey(ui.selectedDate);
      var selectedOffset = (selected.getDay() - weekStart + 7) % 7;
      startDate = core.addDays(selected, -selectedOffset);
      cellCount = 7;
    } else if (calendarView === "today") {
      startDate = core.parseDateKey(ui.selectedDate);
      cellCount = 1;
    }

    for (var index = 0; index < cellCount; index += 1) {
      var date = core.addDays(startDate, index);
      var dateKey = core.todayKey(date);
      var inMonth = date.getMonth() === month;
      var dayTransactions = monthTransactions.filter(function onDate(transaction) {
        return transaction.date === dateKey;
      });
      var daySummary = core.calculateSummaryFromTransactions(dayTransactions, state.settings.healthSettings);
      var active = ui.selectedDate === dateKey ? " is-selected" : "";
      var muted = inMonth || calendarView !== "month" ? "" : " is-muted";
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
      weekdays
        .map(function renderWeekday(day) {
          return '<span class="calendar-weekday">' + day + "</span>";
        })
        .join(""),
      cells.join(""),
      "</div>",
    ].join("");
  }

  function renderTimelinePanel(dashboardId, title, compact) {
    var transactions = filteredTimelineTransactions(dashboardId);
    var body = transactions.length
      ? transactions.map(renderTimelineItem).join("")
      : '<div class="empty-state compact"><h3>No transactions visible</h3><p>Add records or adjust timeline type visibility in Settings.</p></div>';

    return [
      '<section class="panel timeline-panel">',
      '<div class="section-heading">',
      '<div><p class="eyebrow">',
      dashboardId ? "Dashboard records" : "All dashboards",
      "</p><h2>",
      escapeHtml(title),
      "</h2></div>",
      compact ? "" : '<button class="secondary-button" data-action="open-transaction" data-dashboard-id="' + escapeHtml(dashboardId || state.selectedDashboardId || "") + '">' + actionIcon("cashflow") + "<span>Add Record</span></button>",
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
      '<button class="secondary-button" data-action="open-transaction">',
      actionIcon("cashflow"),
      "<span>Add Record</span></button>",
      "</div>",
      renderTimelineFilters(),
      '<div class="panel wide-panel">',
      '<div class="timeline-list">',
      filteredTimelineTransactions(null).length
        ? filteredTimelineTransactions(null).map(renderTimelineItem).join("")
        : '<div class="empty-state compact"><h3>No transactions visible</h3><p>Filtering only changes what you see. Your stored records stay saved.</p></div>',
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
      '<div class="timeline-marker">',
      typeIcon(transaction.type, "timeline-marker-icon"),
      "</div>",
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
              '<span class="insight-icon">',
              insightIcon(insight.tone),
              "</span>",
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
      '<button class="primary-button" data-action="new-dashboard">',
      actionIcon("business"),
      "<span>New Dashboard</span></button>",
      "</div>",
      "</section>",
    ].join("");
  }

  function renderSettingsView() {
    return [
      '<section class="settings-layout">',
      '<div class="section-heading settings-heading">',
      '<div><p class="eyebrow">Preferences and account</p><h2>Settings</h2></div>',
      auth.user ? '<button class="secondary-button" data-action="cloud-pull">' + actionIcon("shield") + "<span>Sync From Supabase</span></button>" : "",
      "</div>",
      ui.message ? '<p class="notice-box">' + escapeHtml(ui.message) + "</p>" : "",
      renderAppearanceSettings(),
      renderCurrencySettings(),
      renderDashboardSettings(),
      renderCategorySettings(),
      renderHealthSettings(),
      renderDefaultAllocationSettings(),
      renderTimelineSettings(),
      renderDataPrivacySettings(),
      "</section>",
    ].join("");
  }

  function renderSettingsCard(title, intro, body) {
    return [
      '<section class="panel settings-card">',
      '<div class="settings-card-head">',
      '<span class="settings-card-icon">',
      icon(SETTINGS_ICONS[title] || "settings", "settings-card-icon-img"),
      "</span>",
      "<div><h3>",
      escapeHtml(title),
      "</h3><p>",
      escapeHtml(intro),
      "</p></div>",
      "</div>",
      body,
      "</section>",
    ].join("");
  }

  function renderAppearanceSettings() {
    return renderSettingsCard(
      "Appearance",
      "Choose the display style FlowFund should use every day.",
      [
        '<div class="setting-row"><span>Theme</span>',
        '<div class="segmented-control settings-segment">',
        ["light", "dark", "system"]
          .map(function themeButton(theme) {
            return [
              '<button class="',
              state.settings.theme === theme ? "is-active" : "",
              '" data-action="setting-value" data-key="theme" data-value="',
              theme,
              '">',
              theme.charAt(0).toUpperCase() + theme.slice(1),
              "</button>",
            ].join("");
          })
          .join(""),
        "</div></div>",
      ].join(""),
    );
  }

  function renderCurrencySettings() {
    return renderSettingsCard(
      "Currency & Date",
      "Set how amounts, dates, weeks, and calendars appear across FlowFund.",
      [
        '<div class="settings-grid">',
        renderSelectSetting("currencyCode", "Currency", CURRENCY_CHOICES.map(function currencyOption(option) {
          return { value: option.code, label: option.label };
        })),
        renderSelectSetting("currencySymbol", "Currency symbol", CURRENCY_CHOICES.map(function currencyOption(option) {
          return { value: option.symbol, label: option.symbol };
        })),
        renderSelectSetting("numberFormat", "Number format", [
          { value: "symbol", label: "Symbol first" },
          { value: "code", label: "Currency code first" },
        ]),
        renderSelectSetting("dateFormat", "Date format", DATE_FORMATS),
        renderSelectSetting("weekStartsOn", "Week starts on", [
          { value: "monday", label: "Monday" },
          { value: "sunday", label: "Sunday" },
        ]),
        renderSelectSetting("defaultCalendarView", "Default calendar view", [
          { value: "month", label: "Month" },
          { value: "week", label: "Week" },
          { value: "today", label: "Today" },
        ]),
        "</div>",
        '<p class="settings-example">Example: ',
        escapeHtml(formatMoney(1000, { reveal: true })),
        " - ",
        escapeHtml(formatDate(core.todayKey())),
        "</p>",
      ].join(""),
    );
  }

  function renderDashboardSettings() {
    var dashboardOptions = [{ value: "", label: "Last opened dashboard" }].concat(
      state.dashboards.map(function dashboardOption(dashboard) {
        return { value: dashboard.id, label: dashboard.name + (dashboard.isArchived ? " (Archived)" : "") };
      }),
    );
    var rows = state.dashboards.length
      ? state.dashboards
          .map(function dashboardRow(dashboard) {
            return [
              '<div class="dashboard-setting-row">',
              '<span class="dashboard-setting-icon">',
              icon("business", "dashboard-setting-icon-img"),
              "</span>",
              '<strong>',
              escapeHtml(dashboard.name),
              dashboard.isArchived ? " (Archived)" : "",
              "</strong>",
              '<div class="row-actions">',
              '<button class="mini-button" data-action="move-dashboard" data-direction="up" data-dashboard-id="',
              escapeHtml(dashboard.id),
              '">',
              actionIcon("arrowUp"),
              "<span>Up</span></button>",
              '<button class="mini-button" data-action="move-dashboard" data-direction="down" data-dashboard-id="',
              escapeHtml(dashboard.id),
              '">',
              actionIcon("arrowDown"),
              "<span>Down</span></button>",
              renderToggle("dashboard-archive", dashboard.isArchived, "Archive", "dashboard-id", dashboard.id),
              renderToggle(
                "dashboard-global",
                dashboard.includeInGlobalTotals,
                "Include global",
                "dashboard-id",
                dashboard.id,
              ),
              "</div>",
              "</div>",
            ].join("");
          })
          .join("")
      : '<div class="empty-state compact"><h3>No dashboards yet</h3><p>Create a dashboard before setting dashboard preferences.</p></div>';

    return renderSettingsCard(
      "Dashboards",
      "Choose what opens first, reorder dashboards, archive them, and control global totals.",
      [
        '<div class="settings-grid">',
        renderSelectSetting("defaultDashboardId", "Default dashboard", dashboardOptions),
        renderToggle("setting-toggle", state.settings.showArchivedDashboards, "Show archived dashboards", "key", "showArchivedDashboards"),
        "</div>",
        '<div class="settings-list">',
        rows,
        "</div>",
      ].join(""),
    );
  }

  function renderCategorySettings() {
    var body = Object.keys(core.TRANSACTION_TYPES)
      .map(function categoryGroup(type) {
        var categories = core.getCategoriesByType(state, type);
        return [
          '<div class="category-group">',
          '<div class="section-heading tight category-heading"><h3>',
          typeIcon(type, "category-heading-icon"),
          escapeHtml(core.TRANSACTION_TYPES[type].label),
          "</h3></div>",
          '<div class="category-list">',
          categories
            .map(function categoryRow(category) {
              return [
                '<div class="category-row" data-category-id="',
                escapeHtml(category.id),
                '">',
                '<input data-action="category-name" value="',
                escapeHtml(category.name),
                '" aria-label="Category name" />',
                '<button class="mini-button danger" data-action="delete-category" data-category-id="',
                escapeHtml(category.id),
                '">Remove</button>',
                "</div>",
              ].join("");
            })
            .join(""),
          "</div>",
          '<form class="inline-form" data-action="add-category" data-type="',
          type,
          '">',
          '<input name="name" type="text" placeholder="New category" required />',
          '<button class="secondary-button" type="submit">Add</button>',
          "</form>",
          "</div>",
        ].join("");
      })
      .join("");

    return renderSettingsCard(
      "Categories",
      "Edit the reasons available when adding income, expenses, losses, investments, and debt payments.",
      body,
    );
  }

  function renderHealthSettings() {
    var health = state.settings.healthSettings;
    return renderSettingsCard(
      "Cashflow Health",
      "Adjust the simple percentage thresholds used by dashboard health indicators.",
      [
        '<div class="settings-grid">',
        renderNumberSetting("healthyThreshold", "Healthy at or above %", health.healthyThreshold, "health"),
        renderNumberSetting("stableThreshold", "Stable at or above %", health.stableThreshold, "health"),
        renderNumberSetting("warningThreshold", "Warning at or above %", health.warningThreshold, "health"),
        '<div class="setting-note">Critical appears when cashflow is negative or below the warning threshold.</div>',
        "</div>",
      ].join(""),
    );
  }

  function renderDefaultAllocationSettings() {
    var validation = core.validateDefaultAllocationTemplate(state);
    var rows = state.settings.defaultAllocationTemplate
      .map(function templateRow(item) {
        return [
          '<div class="allocation-row" data-template-id="',
          escapeHtml(item.id),
          '">',
          '<input data-action="template-name" value="',
          escapeHtml(item.name),
          '" aria-label="Template allocation name" />',
          '<label><span>%</span><input type="number" min="0" max="100" step="0.01" data-action="template-percent" value="',
          item.percentage,
          '" /></label>',
          '<strong>',
          item.percentage,
          "%</strong>",
          '<button class="icon-button danger" data-action="delete-template-item" data-template-id="',
          escapeHtml(item.id),
          '" aria-label="Delete template item">x</button>',
          "</div>",
        ].join("");
      })
      .join("");

    return renderSettingsCard(
      "Allocations",
      "Set the default money plan copied into new dashboards when the total equals 100%.",
      [
        '<div class="allocation-list">',
        rows,
        "</div>",
        '<form class="inline-form" data-action="add-template-item">',
        '<input name="name" type="text" placeholder="Allocation name" required />',
        '<input name="percentage" type="number" min="0" max="100" step="0.01" placeholder="%" required />',
        '<button class="secondary-button" type="submit">Add</button>',
        "</form>",
        '<div class="row-actions settings-actions">',
        '<button class="ghost-button" data-action="reset-template">Reset to default</button>',
        '<span class="',
        validation.valid ? "success-text" : "error-text",
        '">',
        escapeHtml(validation.message),
        "</span>",
        "</div>",
      ].join(""),
    );
  }

  function renderTimelineSettings() {
    return renderSettingsCard(
      "Timeline & Summary",
      "Choose the default timeline, visible movement types, and summary period.",
      [
        '<div class="settings-grid">',
        renderSelectSetting("defaultTimelineFilter", "Default timeline filter", Object.keys(core.PERIODS).map(function periodOption(key) {
          return { value: key, label: core.PERIODS[key] };
        })),
        renderSelectSetting("preferredSummaryPeriod", "Preferred summary period", Object.keys(core.SUMMARY_PERIODS).map(function periodOption(key) {
          return { value: key, label: core.SUMMARY_PERIODS[key] };
        })),
        "</div>",
        '<div class="toggle-grid">',
        Object.keys(core.TRANSACTION_TYPES)
          .map(function timelineTypeToggle(type) {
            var visible = state.settings.hiddenTimelineTypes.indexOf(type) === -1;
            return renderToggle("timeline-type", visible, core.TRANSACTION_TYPES[type].label, "type", type);
          })
          .join(""),
        "</div>",
      ].join(""),
    );
  }

  function renderDataPrivacySettings() {
    return renderSettingsCard(
      "Data & Privacy",
      "Protect balances, control delete confirmations, export data, and connect Supabase.",
      [
        '<div class="settings-grid">',
        renderToggle("setting-toggle", state.settings.hideBalances, "Hide balances", "key", "hideBalances"),
        renderToggle(
          "setting-toggle",
          state.settings.confirmBeforeDeleteTransactions,
          "Confirm before deleting transactions",
          "key",
          "confirmBeforeDeleteTransactions",
        ),
        renderToggle(
          "setting-toggle",
          state.settings.confirmBeforeDeleteDashboards,
          "Confirm before deleting dashboards",
          "key",
          "confirmBeforeDeleteDashboards",
        ),
        "</div>",
        '<div class="row-actions settings-actions">',
        '<button class="secondary-button" data-action="export-data">',
        actionIcon("arrowDown"),
        "<span>Export Data</span></button>",
        '<button class="ghost-button" data-action="open-import">',
        actionIcon("arrowUp"),
        "<span>Import JSON</span></button>",
        "</div>",
        renderAuthPanel(),
      ].join(""),
    );
  }

  function renderAuthPanel() {
    if (!cloud) {
      return [
        '<div class="auth-panel">',
        '<h3>Supabase Auth</h3>',
        '<p>Supabase config is required before private financial data can be opened.</p>',
        "</div>",
      ].join("");
    }

    return [
      '<div class="auth-panel">',
      '<h3>Account</h3>',
      '<p>Signed in as ',
      escapeHtml(auth.user ? auth.user.email || auth.user.id : "Unknown user"),
      ". Your cloud rows are owned by this Supabase user ID.</p>",
      '<div class="row-actions">',
      '<button class="secondary-button" data-action="cloud-push">',
      actionIcon("shield"),
      "<span>Save To Supabase</span></button>",
      '<button class="ghost-button" data-action="cloud-pull">',
      actionIcon("shield"),
      "<span>Load From Supabase</span></button>",
      '<button class="danger-ghost-button" data-action="logout">Logout</button>',
      "</div>",
      '<p class="settings-example">',
      escapeHtml(auth.message || ""),
      "</p>",
      "</div>",
    ].join("");
  }

  function renderSelectSetting(key, label, options) {
    return [
      '<label>',
      escapeHtml(label),
      '<select data-action="setting-select" data-key="',
      escapeHtml(key),
      '">',
      options
        .map(function optionHtml(option) {
          return [
            '<option value="',
            escapeHtml(option.value),
            '"',
            String(state.settings[key]) === String(option.value) ? " selected" : "",
            ">",
            escapeHtml(option.label),
            "</option>",
          ].join("");
        })
        .join(""),
      "</select></label>",
    ].join("");
  }

  function renderNumberSetting(key, label, value, group) {
    return [
      '<label>',
      escapeHtml(label),
      '<input type="number" step="0.01" data-action="number-setting" data-group="',
      escapeHtml(group || "settings"),
      '" data-key="',
      escapeHtml(key),
      '" value="',
      escapeHtml(value),
      '" />',
      "</label>",
    ].join("");
  }

  function renderToggle(action, checked, label, dataName, dataValue) {
    return [
      '<label class="toggle-row">',
      '<input type="checkbox" data-action="',
      escapeHtml(action),
      '" data-',
      escapeHtml(dataName),
      '="',
      escapeHtml(dataValue),
      '"',
      checked ? " checked" : "",
      " />",
      '<span class="toggle-track"></span>',
      '<strong>',
      escapeHtml(label),
      "</strong>",
      "</label>",
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
    if (ui.modal.kind === "import") {
      return renderImportModal();
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
    var categories = core.getCategoriesByType(state, selectedType);

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
            dashboard.isArchived ? " (Archived)" : "",
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
      '<label>Reason or category<select name="category">',
      '<option value="">No category</option>',
      categories
        .map(function renderCategory(category) {
          var value = draft.category || (transaction && transaction.category) || "";
          return [
            '<option value="',
            escapeHtml(category.name),
            '"',
            value === category.name ? " selected" : "",
            ">",
            escapeHtml(category.name),
            "</option>",
          ].join("");
        })
        .join(""),
      "</select></label>",
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

  function renderImportModal() {
    return [
      '<div class="modal-backdrop" data-action="close-modal">',
      '<section class="modal" role="dialog" aria-modal="true" aria-labelledby="import-modal-title" data-modal-stop>',
      '<div class="section-heading tight"><div><p class="eyebrow">Data import</p><h2 id="import-modal-title">Import FlowFund JSON</h2></div></div>',
      '<form data-action="import-data">',
      '<label>Paste exported JSON<textarea name="json" rows="10" placeholder="Paste FlowFund export JSON here" required></textarea></label>',
      '<div class="modal-actions">',
      '<button type="button" class="ghost-button" data-action="close-modal">Cancel</button>',
      '<button type="submit" class="primary-button">Import</button>',
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
    if (view === "calendar" && state.settings.defaultCalendarView === "today") {
      ui.selectedDate = core.todayKey();
      ui.calendarMonth = core.monthKey();
    }
    render();
  }

  function exportData() {
    var payload = JSON.stringify(core.normalizeState(state), null, 2);
    var blob = new Blob([payload], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "flowfund-export-" + core.todayKey() + ".json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleSettingValue(key, value) {
    var updates = {};
    updates[key] = value;
    if (key === "currencyCode") {
      var match = CURRENCY_CHOICES.find(function findCurrency(option) {
        return option.code === value;
      });
      if (match) {
        updates.currencySymbol = match.symbol;
      }
    }
    save(core.updateSettings(state, updates));
    if (key === "defaultTimelineFilter") {
      ui.timelineFilter = value;
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

    if (action === "toggle-dashboard-archive") {
      var archiveDashboard = core.getDashboard(state, trigger.dataset.dashboardId);
      save(core.updateDashboard(state, archiveDashboard.id, { isArchived: !archiveDashboard.isArchived }));
      render();
      return;
    }

    if (action === "delete-dashboard") {
      var dashboard = core.getDashboard(state, trigger.dataset.dashboardId);
      var shouldDelete =
        dashboard &&
        (!state.settings.confirmBeforeDeleteDashboards ||
          window.confirm("Delete " + dashboard.name + " and all of its records?"));
      if (shouldDelete) {
        save(core.deleteDashboard(state, dashboard.id));
        ui.view = "home";
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
      var shouldDeleteTransaction =
        !state.settings.confirmBeforeDeleteTransactions || window.confirm("Delete this transaction?");
      if (shouldDeleteTransaction) {
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
      return;
    }

    if (action === "setting-value") {
      handleSettingValue(trigger.dataset.key, trigger.dataset.value);
      return;
    }

    if (action === "delete-category") {
      var deleteCategoryResult = core.deleteCategory(state, trigger.dataset.categoryId);
      if (deleteCategoryResult.errors.length) {
        ui.message = deleteCategoryResult.errors.join(" ");
      } else {
        ui.message = "Category removed.";
        save(deleteCategoryResult.state);
      }
      render();
      return;
    }

    if (action === "delete-template-item") {
      save(core.deleteDefaultAllocationItem(state, trigger.dataset.templateId));
      render();
      return;
    }

    if (action === "reset-template") {
      save(core.resetDefaultAllocationTemplate(state));
      render();
      return;
    }

    if (action === "move-dashboard") {
      save(core.moveDashboard(state, trigger.dataset.dashboardId, trigger.dataset.direction));
      render();
      return;
    }

    if (action === "export-data") {
      exportData();
      return;
    }

    if (action === "open-import") {
      ui.modal = { kind: "import" };
      render();
      return;
    }

    if (action === "oauth" && cloud) {
      if (!isOAuthProviderEnabled(trigger.dataset.provider)) {
        auth.message = oauthProviderLabel(trigger.dataset.provider) + " sign in is not enabled yet. Use email and password for now.";
        render();
        return;
      }

      auth.loading = true;
      auth.message = "Opening " + trigger.dataset.provider + " sign in...";
      render();
      cloud.signInWithOAuth(trigger.dataset.provider).catch(function oauthFailed(error) {
        auth.loading = false;
        auth.message = error.message;
        render();
      });
      return;
    }

    if (action === "logout" && cloud) {
      cloud.signOut().then(function signedOut() {
        handleSignedOut("Logged out.");
      }).catch(function logoutFailed(error) {
        auth.message = error.message;
        render();
      });
      return;
    }

    if (action === "cloud-push" && cloud && auth.user) {
      cloud.pushState(state).then(function pushed() {
        auth.message = "Saved current data to Supabase.";
        render();
      }).catch(function pushFailed(error) {
        auth.message = error.message;
        render();
      });
      return;
    }

    if (action === "cloud-pull" && cloud && auth.user) {
      cloud.pullState(state).then(function pulled(remoteState) {
        state = core.saveStateForUser(auth.user.id, remoteState);
        auth.message = "Loaded Supabase data.";
        render();
      }).catch(function pullFailed(error) {
        auth.message = error.message;
        render();
      });
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
      if (allocationResult.errors.length) {
        ui.message = allocationResult.errors.join(" ");
      } else {
        save(allocationResult.state);
      }
      render();
      return;
    }

    if (action === "add-category") {
      var categoryResult = core.addCategory(state, form.dataset.type, formData.name);
      if (categoryResult.errors.length) {
        ui.message = categoryResult.errors.join(" ");
      } else {
        ui.message = "Category added.";
        save(categoryResult.state);
      }
      render();
      return;
    }

    if (action === "add-template-item") {
      save(core.addDefaultAllocationItem(state, formData));
      render();
      return;
    }

    if (action === "auth-email" && cloud) {
      var mode = event.submitter && event.submitter.dataset.authMode;
      var authAction = mode === "signup" ? cloud.signUp : cloud.signInWithPassword;
      auth.loading = true;
      auth.message = mode === "signup" ? "Creating your account..." : "Signing in...";
      render();
      authAction(formData.email, formData.password).then(function signedIn(result) {
        var user = result.user || (result.session && result.session.user) || auth.user;
        if (user) {
          return handleSignedIn(
            user,
            mode === "signup" ? "Account created. Your private workspace is ready." : "Signed in.",
          );
        }
        auth.loading = false;
        auth.message = "Check your email if confirmation is enabled, then sign in.";
        render();
      }).catch(function authFailed(error) {
        auth.loading = false;
        auth.message = error.message;
        render();
      });
      return;
    }

    if (action === "import-data") {
      try {
        var imported = core.normalizeState(JSON.parse(formData.json));
        if (!window.confirm("Import this FlowFund data and replace the current local data?")) {
          return;
        }
        save(imported);
        ui.modal = null;
        ui.message = "Imported FlowFund data.";
        render();
      } catch (error) {
        ui.message = "Import failed: " + error.message;
        ui.modal = null;
        render();
      }
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
      return;
    }

    if (action === "setting-select") {
      handleSettingValue(target.dataset.key, target.value);
      return;
    }

    if (action === "setting-toggle") {
      var toggleUpdate = {};
      toggleUpdate[target.dataset.key] = target.checked;
      save(core.updateSettings(state, toggleUpdate));
      render();
      return;
    }

    if (action === "dashboard-archive") {
      save(core.updateDashboard(state, target.dataset.dashboardId, { isArchived: target.checked }));
      render();
      return;
    }

    if (action === "dashboard-global") {
      save(core.updateDashboard(state, target.dataset.dashboardId, { includeInGlobalTotals: target.checked }));
      render();
      return;
    }

    if (action === "timeline-type") {
      var hidden = state.settings.hiddenTimelineTypes.slice();
      if (target.checked) {
        hidden = hidden.filter(function keepType(type) {
          return type !== target.dataset.type;
        });
      } else if (hidden.indexOf(target.dataset.type) === -1) {
        hidden.push(target.dataset.type);
      }
      save(core.updateSettings(state, { hiddenTimelineTypes: hidden }));
      render();
      return;
    }

    if (action === "number-setting") {
      var update = {};
      update[target.dataset.key] = target.value;
      if (target.dataset.group === "health") {
        save(core.updateHealthSettings(state, update));
      } else {
        save(core.updateSettings(state, update));
      }
      render();
      return;
    }

    if (action === "category-name") {
      var categoryRow = target.closest("[data-category-id]");
      var categoryResult = core.updateCategory(state, categoryRow.dataset.categoryId, { name: target.value });
      if (categoryResult.errors.length) {
        ui.message = categoryResult.errors.join(" ");
      } else {
        ui.message = "Category updated.";
        save(categoryResult.state);
      }
      render();
      return;
    }

    if (action === "template-name" || action === "template-percent") {
      var templateRow = target.closest("[data-template-id]");
      var templateName = templateRow.querySelector('[data-action="template-name"]');
      var templatePercent = templateRow.querySelector('[data-action="template-percent"]');
      save(core.updateDefaultAllocationItem(state, templateRow.dataset.templateId, {
        name: templateName.value,
        percentage: templatePercent.value,
      }));
      render();
    }
  });

  document.addEventListener("keydown", function handleKeydown(event) {
    if (event.key === "Escape" && ui.modal) {
      ui.modal = null;
      render();
    }
  });

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function systemThemeChanged() {
      if (state.settings.theme === "system") {
        applyTheme();
      }
    });
  }

  function protectedHomeForUser(user) {
    state = core.loadStateForUser(user.id);
    ui.view = state.settings.defaultDashboardId ? "dashboard" : "home";
    ui.timelineFilter = state.settings.defaultTimelineFilter;
    window.history.replaceState(null, "", "#app");
  }

  function handleSignedIn(user, message) {
    auth.user = user;
    auth.ready = true;
    auth.loading = true;
    auth.message = "Loading your private FlowFund data...";
    protectedHomeForUser(user);
    render();

    if (!cloud || !cloud.pullState) {
      auth.loading = false;
      auth.message = message || "Signed in. Cloud data sync is not available.";
      render();
      return Promise.resolve();
    }

    return cloud.pullState(state).then(function pulled(remoteState) {
      state = core.saveStateForUser(user.id, remoteState);
      ui.view = state.settings.defaultDashboardId ? "dashboard" : "home";
      ui.timelineFilter = state.settings.defaultTimelineFilter;
      auth.loading = false;
      auth.message = message || "Signed in. Your private records are loaded.";
      render();
    }).catch(function pullFailed(error) {
      auth.loading = false;
      auth.message = "Signed in, but cloud data could not load: " + error.message;
      render();
    });
  }

  function handleSignedOut(message) {
    auth.user = null;
    auth.ready = true;
    auth.loading = false;
    auth.message = message || "Signed out.";
    state = core.createDefaultState();
    ui.view = "home";
    ui.modal = null;
    window.history.replaceState(null, "", "#signin");
    render();
  }

  function initCloud() {
    if (!cloud || !cloud.init) {
      auth.ready = true;
      auth.message = "Supabase is not configured. Sign in is required before using FlowFund.";
      render();
      return;
    }

    cloud.init().then(function initialized() {
      return cloud.getSession();
    }).then(function gotSession(session) {
      if (cloud.onAuthStateChange) {
        cloud.onAuthStateChange(function authChanged(user) {
          if (user) {
            handleSignedIn(user, "Supabase session active.");
          } else {
            handleSignedOut("Logged out.");
          }
        });
      }
      if (session && session.user) {
        return handleSignedIn(session.user, "Supabase session restored.");
      }
      handleSignedOut("Sign in to open your FlowFund workspace.");
    }).catch(function initFailed(error) {
      auth.ready = true;
      auth.message = "Supabase is not ready: " + error.message;
      render();
    });
  }

  applyTheme();
  render();
  initCloud();
})();

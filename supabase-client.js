(function flowFundSupabaseClient(root) {
  "use strict";

  var client = null;
  var initialized = false;
  var libraryPromise = null;
  var SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  function config() {
    return root.FLOWFUND_SUPABASE_CONFIG || {};
  }

  function loadLibrary() {
    if (root.supabase && root.supabase.createClient) {
      return Promise.resolve(root.supabase);
    }

    if (libraryPromise) {
      return libraryPromise;
    }

    libraryPromise = new Promise(function load(resolve, reject) {
      var script = document.createElement("script");
      script.src = SUPABASE_CDN;
      script.async = true;
      script.onload = function loaded() {
        if (root.supabase && root.supabase.createClient) {
          resolve(root.supabase);
        } else {
          reject(new Error("Supabase library loaded but did not expose createClient."));
        }
      };
      script.onerror = function failed() {
        reject(new Error("Could not load Supabase client library."));
      };
      document.head.appendChild(script);
    });

    return libraryPromise;
  }

  function init() {
    if (initialized && client) {
      return Promise.resolve(client);
    }

    var supabaseConfig = config();
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      return Promise.reject(new Error("Supabase URL and publishable anon key are missing."));
    }

    return loadLibrary().then(function create(supabaseLib) {
      client = supabaseLib.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      initialized = true;
      return client;
    });
  }

  function requireClient() {
    return init();
  }

  function getSession() {
    return requireClient().then(function ready(supabase) {
      return supabase.auth.getSession().then(function result(response) {
        if (response.error) {
          throw response.error;
        }
        return response.data.session;
      });
    });
  }

  function getUser() {
    return requireClient().then(function ready(supabase) {
      return supabase.auth.getUser().then(function result(response) {
        if (response.error) {
          throw response.error;
        }
        return response.data.user;
      });
    });
  }

  function currentHttpUrl() {
    if (!root.location || (root.location.protocol !== "http:" && root.location.protocol !== "https:")) {
      return null;
    }

    return root.location.origin + root.location.pathname;
  }

  function authRedirectTo() {
    return config().authRedirectUrl || currentHttpUrl();
  }

  function isRedirectUrlError(error) {
    var message = String(error && error.message ? error.message : "").toLowerCase();
    return message.indexOf("redirect") !== -1 && (message.indexOf("url") !== -1 || message.indexOf("allowed") !== -1);
  }

  function authResult(response) {
    if (response.error) {
      throw response.error;
    }

    return response.data;
  }

  function onAuthStateChange(callback) {
    if (!client) {
      return;
    }

    client.auth.onAuthStateChange(function changed(event, session) {
      callback(session && session.user ? session.user : null, event);
    });
  }

  function signInWithPassword(email, password) {
    return requireClient().then(function ready(supabase) {
      return supabase.auth.signInWithPassword({ email: email, password: password }).then(authResult);
    });
  }

  function signUp(email, password) {
    return requireClient().then(function ready(supabase) {
      var payload = { email: email, password: password };
      var redirectTo = authRedirectTo();

      if (redirectTo) {
        payload.options = { emailRedirectTo: redirectTo };
      }

      return supabase.auth.signUp(payload).then(function result(response) {
        if (response.error && redirectTo && isRedirectUrlError(response.error)) {
          return supabase.auth.signUp({ email: email, password: password }).then(authResult);
        }

        return authResult(response);
      });
    });
  }

  function signInWithOAuth(provider) {
    return requireClient().then(function ready(supabase) {
      var options = {};
      var redirectTo = authRedirectTo();

      if (redirectTo) {
        options.redirectTo = redirectTo;
      }

      return supabase.auth.signInWithOAuth({
        provider: provider,
        options: options,
      }).then(authResult);
    });
  }

  function signOut() {
    return requireClient().then(function ready(supabase) {
      return supabase.auth.signOut().then(function result(response) {
        if (response.error) {
          throw response.error;
        }
      });
    });
  }

  function table(name) {
    return client.from(name);
  }

  function toSettingsRows(state, userId) {
    return {
      user_id: userId,
      theme: state.settings.theme,
      currency_code: state.settings.currencyCode,
      currency_symbol: state.settings.currencySymbol,
      number_format: state.settings.numberFormat,
      date_format: state.settings.dateFormat,
      week_starts_on: state.settings.weekStartsOn,
      default_calendar_view: state.settings.defaultCalendarView,
      default_dashboard_id: state.settings.defaultDashboardId || null,
      default_timeline_filter: state.settings.defaultTimelineFilter,
      preferred_summary_period: state.settings.preferredSummaryPeriod,
      hidden_timeline_types: state.settings.hiddenTimelineTypes,
      hide_balances: state.settings.hideBalances,
      confirm_before_delete_transactions: state.settings.confirmBeforeDeleteTransactions,
      confirm_before_delete_dashboards: state.settings.confirmBeforeDeleteDashboards,
      show_archived_dashboards: state.settings.showArchivedDashboards,
    };
  }

  function fromSettingsRow(row, localSettings) {
    if (!row) {
      return localSettings;
    }

    return Object.assign({}, localSettings, {
      theme: row.theme,
      currencyCode: row.currency_code,
      currencySymbol: row.currency_symbol,
      numberFormat: row.number_format,
      dateFormat: row.date_format,
      weekStartsOn: row.week_starts_on,
      defaultCalendarView: row.default_calendar_view,
      defaultDashboardId: row.default_dashboard_id || "",
      defaultTimelineFilter: row.default_timeline_filter,
      preferredSummaryPeriod: row.preferred_summary_period,
      hiddenTimelineTypes: row.hidden_timeline_types || [],
      hideBalances: Boolean(row.hide_balances),
      confirmBeforeDeleteTransactions: row.confirm_before_delete_transactions !== false,
      confirmBeforeDeleteDashboards: row.confirm_before_delete_dashboards !== false,
      showArchivedDashboards: Boolean(row.show_archived_dashboards),
    });
  }

  function toDashboardRows(state, userId) {
    return state.dashboards.map(function dashboardRow(dashboard) {
      return {
        id: dashboard.id,
        user_id: userId,
        name: dashboard.name,
        sort_order: dashboard.sortOrder,
        is_archived: dashboard.isArchived,
        include_in_global_totals: dashboard.includeInGlobalTotals,
        created_at: dashboard.createdAt,
        updated_at: dashboard.updatedAt,
      };
    });
  }

  function fromDashboardRow(row) {
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order || 0,
      isArchived: Boolean(row.is_archived),
      includeInGlobalTotals: row.include_in_global_totals !== false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function toTransactionRows(state, userId) {
    return state.transactions.map(function transactionRow(transaction) {
      return {
        id: transaction.id,
        user_id: userId,
        dashboard_id: transaction.dashboardId,
        type: transaction.type,
        amount: transaction.amount,
        date: transaction.date,
        notes: transaction.notes,
        category_id: transaction.categoryId || null,
        category: transaction.category || null,
        created_at: transaction.createdAt,
        updated_at: transaction.updatedAt,
      };
    });
  }

  function fromTransactionRow(row) {
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      type: row.type,
      amount: Number(row.amount),
      date: row.date,
      notes: row.notes || "",
      categoryId: row.category_id || "",
      category: row.category || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function toAllocationRows(state, userId) {
    var dashboardAllocations = state.allocations.map(function allocationRow(allocation) {
      return {
        id: allocation.id,
        user_id: userId,
        dashboard_id: allocation.dashboardId,
        name: allocation.name,
        percentage: allocation.percentage,
        sort_order: allocation.sortOrder || 0,
        is_default_template: false,
        created_at: allocation.createdAt,
        updated_at: allocation.updatedAt,
      };
    });
    var templateAllocations = state.settings.defaultAllocationTemplate.map(function templateRow(template) {
      return {
        id: template.id,
        user_id: userId,
        dashboard_id: null,
        name: template.name,
        percentage: template.percentage,
        sort_order: template.sortOrder || 0,
        is_default_template: true,
      };
    });

    return dashboardAllocations.concat(templateAllocations);
  }

  function fromAllocationRows(rows) {
    var dashboardAllocations = [];
    var template = [];

    rows.forEach(function allocationRow(row) {
      if (row.is_default_template) {
        template.push({
          id: row.id,
          name: row.name,
          percentage: Number(row.percentage),
          sortOrder: row.sort_order || 0,
        });
      } else {
        dashboardAllocations.push({
          id: row.id,
          dashboardId: row.dashboard_id,
          name: row.name,
          percentage: Number(row.percentage),
          sortOrder: row.sort_order || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
    });

    return {
      dashboardAllocations: dashboardAllocations,
      template: template,
    };
  }

  function toCategoryRows(state, userId) {
    return state.transactionCategories.map(function categoryRow(category) {
      return {
        id: category.id,
        user_id: userId,
        type: category.type,
        name: category.name,
        sort_order: category.sortOrder || 0,
        is_default: category.isDefault,
        created_at: category.createdAt,
        updated_at: category.updatedAt,
      };
    });
  }

  function fromCategoryRow(row) {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      sortOrder: row.sort_order || 0,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function toHealthRow(state, userId) {
    return {
      user_id: userId,
      healthy_threshold: state.settings.healthSettings.healthyThreshold,
      stable_threshold: state.settings.healthSettings.stableThreshold,
      warning_threshold: state.settings.healthSettings.warningThreshold,
      critical_threshold: state.settings.healthSettings.criticalThreshold,
    };
  }

  function fromHealthRow(row, localHealth) {
    if (!row) {
      return localHealth;
    }

    return {
      healthyThreshold: Number(row.healthy_threshold),
      stableThreshold: Number(row.stable_threshold),
      warningThreshold: Number(row.warning_threshold),
      criticalThreshold: Number(row.critical_threshold),
    };
  }

  function upsertRows(name, rows, conflictTarget) {
    if (!rows.length) {
      return Promise.resolve();
    }

    return table(name).upsert(rows, { onConflict: conflictTarget || "id" }).then(function result(response) {
      if (response.error) {
        throw response.error;
      }
    });
  }

  function removeMissing(name, userId, ids) {
    var query = table(name).delete().eq("user_id", userId);
    if (ids.length) {
      query = query.not("id", "in", "(" + ids.join(",") + ")");
    }
    return query.then(function result(response) {
      if (response.error) {
        throw response.error;
      }
    });
  }

  function pushState(localState) {
    return requireClient().then(function ready() {
      return getUser();
    }).then(function withUser(user) {
      if (!user) {
        throw new Error("Sign in before syncing to Supabase.");
      }

      var state = root.FlowFundCore.normalizeState(localState);
      var userId = user.id;
      var dashboardRows = toDashboardRows(state, userId);
      var transactionRows = toTransactionRows(state, userId);
      var allocationRows = toAllocationRows(state, userId);
      var categoryRows = toCategoryRows(state, userId);

      return upsertRows("profiles", [{
        id: userId,
        email: user.email || "",
        full_name: user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : "",
        avatar_url: user.user_metadata && user.user_metadata.avatar_url ? user.user_metadata.avatar_url : "",
      }], "id")
        .then(function saveDashboards() {
          return upsertRows("dashboards", dashboardRows);
        })
        .then(function saveCategories() {
          return upsertRows("transaction_categories", categoryRows);
        })
        .then(function saveSettings() {
          return upsertRows("user_settings", [toSettingsRows(state, userId)], "user_id");
        })
        .then(function saveHealth() {
          return upsertRows("cashflow_health_settings", [toHealthRow(state, userId)], "user_id");
        })
        .then(function saveAllocations() {
          return upsertRows("allocations", allocationRows);
        })
        .then(function saveTransactions() {
          return upsertRows("transactions", transactionRows);
        })
        .then(function cleanTransactions() {
          return removeMissing("transactions", userId, transactionRows.map(function id(row) { return row.id; }));
        })
        .then(function cleanAllocations() {
          return removeMissing("allocations", userId, allocationRows.map(function id(row) { return row.id; }));
        })
        .then(function cleanCategories() {
          return removeMissing("transaction_categories", userId, categoryRows.map(function id(row) { return row.id; }));
        })
        .then(function cleanDashboards() {
          return removeMissing("dashboards", userId, dashboardRows.map(function id(row) { return row.id; }));
        });
    });
  }

  function selectAll(name, userId) {
    return table(name).select("*").eq("user_id", userId).then(function result(response) {
      if (response.error) {
        throw response.error;
      }
      return response.data || [];
    });
  }

  function pullState(localState) {
    return requireClient().then(function ready() {
      return getUser();
    }).then(function withUser(user) {
      if (!user) {
        throw new Error("Sign in before loading Supabase data.");
      }

      return Promise.all([
        table("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
        table("cashflow_health_settings").select("*").eq("user_id", user.id).maybeSingle(),
        selectAll("dashboards", user.id),
        selectAll("transactions", user.id),
        selectAll("allocations", user.id),
        selectAll("transaction_categories", user.id),
      ]).then(function map(results) {
        var settingsResult = results[0];
        var healthResult = results[1];
        var dashboards = results[2];
        var transactions = results[3];
        var allocations = results[4];
        var categories = results[5];

        if (settingsResult.error) {
          throw settingsResult.error;
        }
        if (healthResult.error) {
          throw healthResult.error;
        }

        if (!dashboards.length && !transactions.length) {
          return pushState(localState).then(function pushed() {
            return root.FlowFundCore.normalizeState(localState);
          });
        }

        var allocationGroups = fromAllocationRows(allocations);
        var base = root.FlowFundCore.normalizeState(localState);
        var next = {
          dashboards: dashboards.map(fromDashboardRow),
          transactions: transactions.map(fromTransactionRow),
          allocations: allocationGroups.dashboardAllocations,
          transactionCategories: categories.map(fromCategoryRow),
          settings: fromSettingsRow(settingsResult.data, base.settings),
          selectedDashboardId: settingsResult.data && settingsResult.data.default_dashboard_id
            ? settingsResult.data.default_dashboard_id
            : dashboards[0] && dashboards[0].id,
        };

        next.settings.healthSettings = fromHealthRow(healthResult.data, base.settings.healthSettings);
        if (allocationGroups.template.length) {
          next.settings.defaultAllocationTemplate = allocationGroups.template;
        }

        return root.FlowFundCore.normalizeState(next);
      });
    });
  }

  root.FlowFundSupabase = {
    getSession: getSession,
    init: init,
    onAuthStateChange: onAuthStateChange,
    pullState: pullState,
    pushState: pushState,
    signInWithOAuth: signInWithOAuth,
    signInWithPassword: signInWithPassword,
    signOut: signOut,
    signUp: signUp,
  };
})(typeof window !== "undefined" ? window : globalThis);

const STORAGE_KEY = "bravo-finance-tracker-v2";
const THEME_KEY = "bravo-finance-theme";
const API_BASE = window.__FINANCE_API__ || "http://localhost:8080/api";

const emptyState = {
  user: {
    id: 1,
    name: "",
    currency: "INR"
  },
  accounts: [],
  categories: [],
  budgets: [],
  goals: [],
  transactions: []
};

const state = {
  source: "demo",
  data: clone(emptyState),
  ui: {
    theme: localStorage.getItem(THEME_KEY) || "light",
    transactionsExpanded: false,
    filters: {
      type: "ALL",
      accountId: "ALL",
      categoryId: "ALL",
      month: "",
      search: ""
    }
  }
};

const elements = {
  metricsGrid: document.getElementById("metrics-grid"),
  reportInsights: document.getElementById("report-insights"),
  reportCaption: document.getElementById("report-caption"),
  reportMonth: document.getElementById("report-month"),
  modeBadge: document.getElementById("mode-badge"),
  userBadge: document.getElementById("user-badge"),
  heroBalance: document.getElementById("hero-balance"),
  heroCaption: document.getElementById("hero-caption"),
  budgetPulseCaption: document.getElementById("budget-pulse-caption"),
  budgetPulseList: document.getElementById("budget-pulse-list"),
  transactionList: document.getElementById("transaction-list"),
  transactionCount: document.getElementById("transaction-count"),
  transactionForm: document.getElementById("transaction-form"),
  budgetForm: document.getElementById("budget-form"),
  goalForm: document.getElementById("goal-form"),
  profileForm: document.getElementById("profile-form"),
  accountForm: document.getElementById("account-form"),
  categoryForm: document.getElementById("category-form"),
  metricCardTemplate: document.getElementById("metric-card-template"),
  transactionCategory: document.getElementById("transaction-category"),
  transactionAccount: document.getElementById("transaction-account"),
  budgetCategory: document.getElementById("budget-category"),
  transactionHelper: document.getElementById("transaction-helper"),
  themeToggle: document.getElementById("theme-toggle"),
  filterType: document.getElementById("filter-type"),
  filterAccount: document.getElementById("filter-account"),
  filterCategory: document.getElementById("filter-category"),
  filterMonth: document.getElementById("filter-month"),
  filterSearch: document.getElementById("filter-search"),
  clearFilters: document.getElementById("clear-filters"),
  toggleTransactions: document.getElementById("toggle-transactions")
};

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme();
  bindScrollButtons();
  setDefaultDates();
  await boot();
  bindEvents();
  hydrateSetupForms();
  render();
});

async function boot() {
  try {
    const liveData = await fetchBootstrap();
    state.source = "oracle";
    state.data = normalizeIncomingState(liveData);
  } catch (error) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      state.data = normalizeIncomingState(JSON.parse(saved));
    } else {
      state.data = clone(emptyState);
      persistLocalState();
    }
    recalculateAccountBalances();
  }
}

function bindEvents() {
  elements.profileForm.addEventListener("submit", handleProfileSubmit);
  elements.accountForm.addEventListener("submit", handleAccountSubmit);
  elements.categoryForm.addEventListener("submit", handleCategorySubmit);
  elements.transactionForm.addEventListener("submit", handleTransactionSubmit);
  elements.budgetForm.addEventListener("submit", handleBudgetSubmit);
  elements.goalForm.addEventListener("submit", handleGoalSubmit);
  elements.reportMonth.addEventListener("change", render);
  elements.transactionForm.transactionType.addEventListener("change", () => {
    syncCategoryOptions();
    updateTransactionFormState();
  });
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.filterType.addEventListener("change", handleFilterChange);
  elements.filterAccount.addEventListener("change", handleFilterChange);
  elements.filterCategory.addEventListener("change", handleFilterChange);
  elements.filterMonth.addEventListener("change", handleFilterChange);
  elements.filterSearch.addEventListener("input", handleFilterChange);
  elements.clearFilters.addEventListener("click", clearTransactionFilters);
  elements.toggleTransactions.addEventListener("click", toggleTransactionsExpanded);
}

function bindScrollButtons() {
  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.scrollTarget);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function setDefaultDates() {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const monthValue = isoDate.slice(0, 7);

  elements.transactionForm.transactionDate.value = isoDate;
  elements.reportMonth.value = monthValue;
  elements.budgetForm.budgetMonth.value = monthValue;
  elements.goalForm.targetDate.value = new Date(today.getFullYear(), today.getMonth() + 4, today.getDate()).toISOString().slice(0, 10);
}

function hydrateSetupForms() {
  elements.profileForm.userName.value = state.data.user.name || "";
  elements.profileForm.currency.value = state.data.user.currency || "INR";
}

async function fetchBootstrap() {
  const response = await fetch(`${API_BASE}/bootstrap`);
  if (!response.ok) {
    throw new Error("Backend unavailable");
  }
  return response.json();
}

async function postToApi(endpoint, payload) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json();
}

function handleProfileSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  state.data.user = {
    ...state.data.user,
    name: String(formData.get("userName")).trim(),
    currency: formData.get("currency")
  };

  persistLocalState();
  render();
}

function handleAccountSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const accountName = String(formData.get("accountName")).trim();

  if (state.data.accounts.some((account) => account.name.toLowerCase() === accountName.toLowerCase())) {
    window.alert("An account with that name already exists.");
    return;
  }

  const openingBalance = Number(formData.get("openingBalance") || 0);

  state.data.accounts.unshift({
    id: nextId(state.data.accounts),
    name: accountName,
    type: formData.get("accountType"),
    openingBalance,
    currentBalance: openingBalance
  });

  persistLocalState();
  event.currentTarget.reset();
  render();
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const categoryName = String(formData.get("categoryName")).trim();
  const categoryType = formData.get("categoryType");

  if (state.data.categories.some((category) => category.name.toLowerCase() === categoryName.toLowerCase() && category.type === categoryType)) {
    window.alert("That category already exists for the selected type.");
    return;
  }

  state.data.categories.unshift({
    id: nextId(state.data.categories),
    name: categoryName,
    type: categoryType,
    defaultLimit: Number(formData.get("defaultLimit") || 0)
  });

  persistLocalState();
  event.currentTarget.reset();
  render();
}

async function handleTransactionSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    accountId: Number(formData.get("accountId")),
    categoryId: Number(formData.get("categoryId")),
    type: formData.get("transactionType"),
    amount: Number(formData.get("amount")),
    date: formData.get("transactionDate"),
    description: String(formData.get("description")).trim(),
    paymentMode: formData.get("paymentMode")
  };

  try {
    if (state.source === "oracle") {
      await postToApi("/transactions", payload);
      state.data = normalizeIncomingState(await fetchBootstrap());
    } else {
      addLocalTransaction(payload);
    }

    event.currentTarget.reset();
    setDefaultDates();
    syncCategoryOptions();
    render();
  } catch (error) {
    window.alert(error.message);
  }
}

async function handleBudgetSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    categoryId: Number(formData.get("categoryId")),
    month: formData.get("budgetMonth"),
    limit: Number(formData.get("budgetLimit")),
    warningPercent: Number(formData.get("warningPercent"))
  };

  try {
    if (state.source === "oracle") {
      await postToApi("/budgets", payload);
      state.data = normalizeIncomingState(await fetchBootstrap());
    } else {
      addLocalBudget(payload);
    }

    event.currentTarget.reset();
    setDefaultDates();
    render();
  } catch (error) {
    window.alert(error.message);
  }
}

async function handleGoalSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    name: String(formData.get("goalName")).trim(),
    targetAmount: Number(formData.get("targetAmount")),
    targetDate: formData.get("targetDate")
  };

  try {
    if (state.source === "oracle") {
      await postToApi("/goals", payload);
      state.data = normalizeIncomingState(await fetchBootstrap());
    } else {
      addLocalGoal(payload);
    }

    event.currentTarget.reset();
    setDefaultDates();
    render();
  } catch (error) {
    window.alert(error.message);
  }
}

function addLocalTransaction(payload) {
  ensureTransactionSetup(payload.type, payload.categoryId, payload.accountId);

  if (payload.type === "EXPENSE") {
    enforceBudgetRule(payload);
  }

  state.data.transactions.unshift({
    id: nextId(state.data.transactions),
    ...payload
  });

  recalculateAccountBalances();
  persistLocalState();
}

function addLocalBudget(payload) {
  const category = findCategory(payload.categoryId);
  if (!category || category.type !== "EXPENSE") {
    throw new Error("Select a valid expense category before creating a budget rule.");
  }

  const existing = state.data.budgets.find(
    (budget) => budget.categoryId === payload.categoryId && budget.month === payload.month
  );

  if (existing) {
    existing.limit = payload.limit;
    existing.warningPercent = payload.warningPercent;
  } else {
    state.data.budgets.unshift({
      id: nextId(state.data.budgets),
      ...payload
    });
  }

  persistLocalState();
}

function addLocalGoal(payload) {
  state.data.goals.unshift({
    id: nextId(state.data.goals),
    name: payload.name,
    targetAmount: payload.targetAmount,
    currentAmount: 0,
    targetDate: payload.targetDate,
    status: "ACTIVE"
  });

  persistLocalState();
}

function ensureTransactionSetup(type, categoryId, accountId) {
  const category = findCategory(categoryId);
  const account = findAccount(accountId);

  if (!account) {
    throw new Error("Please add an account before recording a transaction.");
  }

  if (!category) {
    throw new Error("Please add a category before recording a transaction.");
  }

  if (category.type !== type) {
    throw new Error("Transaction type must match the selected category.");
  }
}

function enforceBudgetRule(transaction) {
  const monthKey = transaction.date.slice(0, 7);
  const budget = state.data.budgets.find(
    (entry) => entry.categoryId === transaction.categoryId && entry.month === monthKey
  );

  if (!budget) {
    return;
  }

  const existingSpend = state.data.transactions
    .filter((entry) => entry.type === "EXPENSE" && entry.categoryId === transaction.categoryId && entry.date.startsWith(monthKey))
    .reduce((total, entry) => total + entry.amount, 0);

  if (existingSpend + transaction.amount > budget.limit) {
    throw new Error("This expense crosses the monthly budget limit configured for that category.");
  }
}

function render() {
  populateSelects();
  populateTransactionFilters();
  updateTransactionFormState();
  renderHeader();
  renderMetrics();
  renderBudgetPulse();
  renderReport();
  renderTransactions();
}

function populateSelects() {
  syncCategoryOptions();

  hydrateSelect(
    elements.transactionAccount,
    state.data.accounts.map((account) => ({
      value: account.id,
      label: `${account.name} (${account.type})`
    })),
    "Add an account first"
  );

  hydrateSelect(
    elements.budgetCategory,
    getExpenseCategories().map((category) => ({
      value: category.id,
      label: category.name
    })),
    "Add an expense category first"
  );
}

function syncCategoryOptions() {
  const currentType = elements.transactionForm.transactionType.value;
  hydrateSelect(
    elements.transactionCategory,
    state.data.categories
      .filter((category) => category.type === currentType)
      .map((category) => ({
        value: category.id,
        label: category.name
      })),
    `Add a ${currentType.toLowerCase()} category first`
  );
}

function hydrateSelect(select, options, placeholder) {
  const previous = select.value;
  const markup = [];

  if (!options.length && placeholder) {
    markup.push(`<option value="">${placeholder}</option>`);
  }

  select.innerHTML = markup.concat(
    options.map((option) => `<option value="${option.value}">${option.label}</option>`)
  ).join("");

  select.disabled = options.length === 0;

  if (options.some((option) => String(option.value) === previous)) {
    select.value = previous;
  }
}

function populateTransactionFilters() {
  hydrateStaticSelect(
    elements.filterAccount,
    state.data.accounts.map((account) => ({
      value: String(account.id),
      label: account.name
    })),
    "All accounts",
    state.ui.filters.accountId
  );

  hydrateStaticSelect(
    elements.filterCategory,
    state.data.categories.map((category) => ({
      value: String(category.id),
      label: `${category.name} (${capitalize(category.type)})`
    })),
    "All categories",
    state.ui.filters.categoryId
  );

  elements.filterType.value = state.ui.filters.type;
  elements.filterMonth.value = state.ui.filters.month;
  elements.filterSearch.value = state.ui.filters.search;
}

function hydrateStaticSelect(select, options, allLabel, selectedValue) {
  select.innerHTML = [`<option value="ALL">${allLabel}</option>`]
    .concat(options.map((option) => `<option value="${option.value}">${option.label}</option>`))
    .join("");

  select.value = options.some((option) => option.value === selectedValue) ? selectedValue : "ALL";
}

function updateTransactionFormState() {
  const hasAccounts = state.data.accounts.length > 0;
  const hasMatchingCategories = state.data.categories.some(
    (category) => category.type === elements.transactionForm.transactionType.value
  );
  const canSubmit = hasAccounts && hasMatchingCategories;

  elements.transactionForm.querySelector('button[type="submit"]').disabled = !canSubmit;

  if (canSubmit) {
    elements.transactionHelper.textContent = "Ready to record a transaction.";
    elements.transactionHelper.className = "form-message is-ready";
  } else {
    elements.transactionHelper.textContent = "Add at least one account and a matching category to unlock transaction entry.";
    elements.transactionHelper.className = "form-message is-warning";
  }

  elements.budgetForm.querySelector('button[type="submit"]').disabled = getExpenseCategories().length === 0;
}

function renderHeader() {
  const selectedMonth = getSelectedMonth();
  const overview = calculateOverview(selectedMonth);
  const userName = state.data.user.name || "Set up your tracker";

  elements.modeBadge.textContent = state.source === "oracle" ? "Oracle Connected" : "";
  elements.modeBadge.className = state.source === "oracle" ? "status-pill" : "status-pill neutral";
  elements.modeBadge.hidden = state.source !== "oracle";
  elements.userBadge.textContent = `${userName} | ${selectedMonth}`;
  elements.heroBalance.textContent = formatCurrency(overview.totalBalance);
  elements.heroCaption.textContent = state.data.transactions.length
    ? `${formatCurrency(overview.monthlyIncome)} in, ${formatCurrency(overview.monthlyExpenses)} out this month`
    : "Start by adding your profile, accounts, categories, and first transaction.";
  elements.themeToggle.textContent = state.ui.theme === "dark" ? "Light Mode" : "Dark Mode";
}

function renderMetrics() {
  const selectedMonth = getSelectedMonth();
  const overview = calculateOverview(selectedMonth);
  const cards = [
    { label: "Monthly Income", value: formatCurrency(overview.monthlyIncome), footnote: "Based entirely on your own entries" },
    { label: "Monthly Expenses", value: formatCurrency(overview.monthlyExpenses), footnote: "Checked against your budget rules" },
    { label: "Savings Rate", value: `${overview.savingsRate}%`, footnote: "Net savings percentage for the selected month" },
    { label: "Active Goals", value: String(state.data.goals.filter((goal) => goal.status === "ACTIVE").length), footnote: "Targets you are currently tracking" }
  ];

  elements.metricsGrid.innerHTML = "";

  cards.forEach((card) => {
    const node = elements.metricCardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".metric-label").textContent = card.label;
    node.querySelector(".metric-value").textContent = card.value;
    node.querySelector(".metric-footnote").textContent = card.footnote;
    elements.metricsGrid.appendChild(node);
  });
}

function renderBudgetPulse() {
  const selectedMonth = getSelectedMonth();
  const budgets = getBudgetUsage(selectedMonth).slice(0, 3);
  elements.budgetPulseCaption.textContent = `${budgets.length} tracked categories`;
  elements.budgetPulseList.innerHTML = budgets.length
    ? budgets.map(renderBudgetPulseItem).join("")
    : renderEmptyState("No budget rules saved for this month yet.");
}

function renderReport() {
  const selectedMonth = getSelectedMonth();
  const overview = calculateOverview(selectedMonth);
  const categories = getBudgetUsage(selectedMonth);
  const sortedCategories = [...categories].sort((left, right) => right.spent - left.spent);
  const topExpense = sortedCategories[0];
  const reportItems = [
    {
      label: "Net Position",
      value: formatCurrency(overview.monthlyIncome - overview.monthlyExpenses)
    },
    {
      label: "Top Expense Category",
      value: topExpense ? `${topExpense.categoryName} (${formatCurrency(topExpense.spent)})` : "No expense data"
    },
    {
      label: "Budget Utilisation",
      value: `${Math.min(999, overview.budgetUtilisation)}%`
    },
    {
      label: "Goal Progress",
      value: `${averageGoalProgress()}% average`
    }
  ];

  elements.reportCaption.textContent = `Insights for ${selectedMonth}`;
  elements.reportInsights.innerHTML = reportItems
    .map((item) => `<div class="report-chip"><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join("");
}

function renderTransactions() {
  const filteredTransactions = getFilteredTransactions();
  const visibleTransactions = state.ui.transactionsExpanded ? filteredTransactions : filteredTransactions.slice(0, 5);

  if (!filteredTransactions.length) {
    elements.transactionCount.textContent = "0 matching entries";
    elements.toggleTransactions.textContent = "View All";
    elements.toggleTransactions.disabled = true;
    elements.transactionList.innerHTML = renderEmptyState("No transactions match the selected filters.");
    return;
  }

  elements.transactionCount.textContent = state.ui.transactionsExpanded
    ? `Showing all ${filteredTransactions.length} matching transactions`
    : `Showing ${visibleTransactions.length} of ${filteredTransactions.length} matching transactions`;

  elements.toggleTransactions.disabled = filteredTransactions.length <= 5;
  elements.toggleTransactions.textContent = state.ui.transactionsExpanded ? "Show Less" : "View All";
  elements.transactionList.innerHTML = visibleTransactions.map(renderTransactionItem).join("");
}

function renderTransactionItem(entry) {
  const category = findCategory(entry.categoryId);
  const account = findAccount(entry.accountId);
  return `
    <article class="transaction-item">
      <div>
        <p class="transaction-title">${entry.description}</p>
        <div class="transaction-meta">${entry.date} | ${category?.name || "Unknown"} | ${account?.name || "Account"} | ${entry.paymentMode}</div>
      </div>
      <div class="transaction-amount ${entry.type === "INCOME" ? "income" : "expense"}">
        ${entry.type === "INCOME" ? "+" : "-"} ${formatCurrency(entry.amount)}
      </div>
    </article>
  `;
}

function renderBudgetPulseItem(budget) {
  return `
    <div class="budget-card ${budget.percentUsed >= budget.warningPercent ? "alert" : ""}">
      <p class="budget-title">${budget.categoryName}</p>
      <div class="budget-progress"><span style="width: ${Math.min(100, budget.percentUsed)}%"></span></div>
      <div class="budget-meta">
        <span>${Math.round(budget.percentUsed)}% used</span>
        <span>${formatCurrency(budget.limit)}</span>
      </div>
    </div>
  `;
}

function getFilteredTransactions() {
  return [...state.data.transactions]
    .filter((entry) => state.ui.filters.type === "ALL" || entry.type === state.ui.filters.type)
    .filter((entry) => state.ui.filters.accountId === "ALL" || String(entry.accountId) === state.ui.filters.accountId)
    .filter((entry) => state.ui.filters.categoryId === "ALL" || String(entry.categoryId) === state.ui.filters.categoryId)
    .filter((entry) => !state.ui.filters.month || entry.date.startsWith(state.ui.filters.month))
    .filter((entry) => {
      if (!state.ui.filters.search) {
        return true;
      }

      const haystack = `${entry.description} ${entry.paymentMode} ${findCategory(entry.categoryId)?.name || ""} ${findAccount(entry.accountId)?.name || ""}`.toLowerCase();
      return haystack.includes(state.ui.filters.search.toLowerCase());
    })
    .sort((left, right) => right.date.localeCompare(left.date));
}

function calculateOverview(selectedMonth) {
  const monthTransactions = state.data.transactions.filter((entry) => entry.date.startsWith(selectedMonth));
  const monthlyIncome = monthTransactions
    .filter((entry) => entry.type === "INCOME")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const monthlyExpenses = monthTransactions
    .filter((entry) => entry.type === "EXPENSE")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalBalance = state.data.accounts.reduce((sum, account) => sum + account.currentBalance, 0);
  const totalBudget = getBudgetUsage(selectedMonth).reduce((sum, entry) => sum + entry.limit, 0);
  const savingsRate = monthlyIncome ? Math.max(0, Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100)) : 0;
  const budgetUtilisation = totalBudget ? Math.round((monthlyExpenses / totalBudget) * 100) : 0;

  return {
    monthlyIncome,
    monthlyExpenses,
    totalBalance,
    savingsRate,
    budgetUtilisation
  };
}

function getBudgetUsage(selectedMonth) {
  return state.data.budgets
    .filter((budget) => budget.month === selectedMonth)
    .map((budget) => {
      const spent = state.data.transactions
        .filter((entry) => entry.type === "EXPENSE" && entry.categoryId === budget.categoryId && entry.date.startsWith(selectedMonth))
        .reduce((sum, entry) => sum + entry.amount, 0);

      return {
        ...budget,
        spent,
        percentUsed: budget.limit ? (spent / budget.limit) * 100 : 0,
        categoryName: findCategory(budget.categoryId)?.name || "Unknown"
      };
    });
}

function averageGoalProgress() {
  if (!state.data.goals.length) {
    return 0;
  }

  const total = state.data.goals.reduce((sum, goal) => sum + ((goal.currentAmount / goal.targetAmount) * 100), 0);
  return Math.round(total / state.data.goals.length);
}

function recalculateAccountBalances() {
  state.data.accounts.forEach((account) => {
    const ledger = state.data.transactions.filter((entry) => entry.accountId === account.id);
    const delta = ledger.reduce((sum, entry) => sum + (entry.type === "INCOME" ? entry.amount : -entry.amount), 0);
    account.currentBalance = Number((account.openingBalance + delta).toFixed(2));
  });
}

function normalizeIncomingState(payload) {
  return {
    user: {
      id: payload.user?.id || payload.user?.user_id || 1,
      name: payload.user?.name || payload.user?.full_name || "",
      currency: payload.user?.currency || payload.user?.base_currency || "INR"
    },
    accounts: Array.isArray(payload.accounts) ? payload.accounts.map((account) => ({
      id: account.id || account.account_id,
      name: account.name || account.account_name,
      type: account.type || account.account_type,
      openingBalance: Number(account.openingBalance ?? account.opening_balance ?? 0),
      currentBalance: Number(account.currentBalance ?? account.current_balance ?? account.openingBalance ?? account.opening_balance ?? 0)
    })) : [],
    categories: Array.isArray(payload.categories) ? payload.categories.map((category) => ({
      id: category.id || category.category_id,
      name: category.name || category.category_name,
      type: category.type || category.category_type,
      defaultLimit: Number(category.defaultLimit ?? category.default_monthly_limit ?? 0)
    })) : [],
    budgets: Array.isArray(payload.budgets) ? payload.budgets.map((budget) => ({
      id: budget.id || budget.budget_id,
      categoryId: budget.categoryId || budget.category_id,
      month: (budget.month || budget.budget_month_key || "").toString().slice(0, 7),
      limit: Number(budget.limit ?? budget.budget_limit ?? 0),
      warningPercent: Number(budget.warningPercent ?? budget.warning_percent ?? 80)
    })) : [],
    goals: Array.isArray(payload.goals) ? payload.goals.map((goal) => ({
      id: goal.id || goal.goal_id,
      name: goal.name || goal.goal_name,
      targetAmount: Number(goal.targetAmount ?? goal.target_amount ?? 0),
      currentAmount: Number(goal.currentAmount ?? goal.current_amount ?? 0),
      targetDate: (goal.targetDate || goal.target_date || "").toString().slice(0, 10),
      status: goal.status || "ACTIVE"
    })) : [],
    transactions: Array.isArray(payload.transactions) ? payload.transactions.map((entry) => ({
      id: entry.id || entry.transaction_id,
      accountId: entry.accountId || entry.account_id,
      categoryId: entry.categoryId || entry.category_id,
      type: entry.type || entry.transaction_type,
      amount: Number(entry.amount ?? 0),
      date: (entry.date || entry.transaction_date || "").toString().slice(0, 10),
      description: entry.description || "",
      paymentMode: entry.paymentMode || entry.payment_mode || "UPI"
    })) : []
  };
}

function persistLocalState() {
  if (state.source === "demo") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }
}

function handleFilterChange() {
  state.ui.filters = {
    type: elements.filterType.value,
    accountId: elements.filterAccount.value,
    categoryId: elements.filterCategory.value,
    month: elements.filterMonth.value,
    search: elements.filterSearch.value.trim()
  };
  state.ui.transactionsExpanded = false;
  renderTransactions();
}

function clearTransactionFilters() {
  state.ui.filters = {
    type: "ALL",
    accountId: "ALL",
    categoryId: "ALL",
    month: "",
    search: ""
  };
  state.ui.transactionsExpanded = false;
  populateTransactionFilters();
  renderTransactions();
}

function toggleTransactionsExpanded() {
  state.ui.transactionsExpanded = !state.ui.transactionsExpanded;
  renderTransactions();
}

function applyTheme() {
  document.body.setAttribute("data-theme", state.ui.theme);
}

function toggleTheme() {
  state.ui.theme = state.ui.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, state.ui.theme);
  applyTheme();
  renderHeader();
}

function findCategory(categoryId) {
  return state.data.categories.find((category) => category.id === Number(categoryId));
}

function findAccount(accountId) {
  return state.data.accounts.find((account) => account.id === Number(accountId));
}

function getExpenseCategories() {
  return state.data.categories.filter((category) => category.type === "EXPENSE");
}

function nextId(collection) {
  return collection.length ? Math.max(...collection.map((entry) => Number(entry.id))) + 1 : 1;
}

function getSelectedMonth() {
  return elements.reportMonth.value || new Date().toISOString().slice(0, 7);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: state.data.user.currency || "INR",
    maximumFractionDigits: 2
  }).format(value || 0);
}

function renderEmptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

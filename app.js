const STORAGE_KEYS = {
  sessionToken: "mb_session_token_v1",
};

const FX_TO_EUR = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.16,
};

const appState = {
  token: null,
  data: null,
  transactionFilter: "all",
  activeTab: "home",
};

const screens = {
  welcome: document.getElementById("welcome-screen"),
  login: document.getElementById("login-screen"),
  dashboard: document.getElementById("dashboard-screen"),
  status: document.getElementById("status-screen"),
};

const openLoginBtn = document.getElementById("open-login-btn");
const openRegisterBtn = document.getElementById("open-register-btn");
const openLoginBtnBottom = document.getElementById("open-login-btn-bottom");
const openRegisterBtnBottom = document.getElementById("open-register-btn-bottom");
const backHomeBtn = document.getElementById("back-home-btn");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const transferForm = document.getElementById("transfer-form");
const logoutBtn = document.getElementById("logout-btn");
const statusBackBtn = document.getElementById("status-back-btn");
const loginError = document.getElementById("login-error");
const registerError = document.getElementById("register-error");
const transferError = document.getElementById("transfer-error");
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');
const registerSubmitBtn = registerForm.querySelector('button[type="submit"]');
const transferSubmitBtn = transferForm.querySelector('button[type="submit"]');

const userNameEl = document.getElementById("user-name");
const portfolioTotalEl = document.getElementById("portfolio-total");
const monthlyTrendEl = document.getElementById("monthly-trend");
const walletCardsEl = document.getElementById("wallet-cards");
const activeCardNameEl = document.getElementById("active-card-name");
const activeCardNumberEl = document.getElementById("active-card-number");
const cardStatusBadgeEl = document.getElementById("card-status-badge");
const cardsListEl = document.getElementById("cards-list");
const toggleCardBtn = document.getElementById("toggle-card-btn");
const newVirtualBtn = document.getElementById("new-virtual-btn");

const beneficiariesListEl = document.getElementById("beneficiaries-list");
const transactionsList = document.getElementById("transactions-list");
const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
const spentAmountEl = document.getElementById("spent-amount");
const budgetProgressEl = document.getElementById("budget-progress");
const budgetCaptionEl = document.getElementById("budget-caption");
const income30dEl = document.getElementById("income-30d");
const expense30dEl = document.getElementById("expense-30d");
const savingRateEl = document.getElementById("saving-rate");

const statusTitle = document.getElementById("status-title");
const statusMessage = document.getElementById("status-message");

const actionSend = document.getElementById("action-send");
const actionRequest = document.getElementById("action-request");
const actionConvert = document.getElementById("action-convert");
const actionTopup = document.getElementById("action-topup");

const recipientInput = document.getElementById("recipient");
const ibanInput = document.getElementById("iban");
const amountInput = document.getElementById("amount");
const referenceInput = document.getElementById("reference");
const transferSpeedSelect = document.getElementById("transfer-speed");
const registerNameInput = document.getElementById("register-name");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const expenseLineEl = document.getElementById("expense-line");
const expenseAreaEl = document.getElementById("expense-area");
const chartTotalExpensesEl = document.getElementById("chart-total-expenses");
const chartStartEl = document.getElementById("chart-start");

const profileNameEl = document.getElementById("profile-name");
const profileEmailEl = document.getElementById("profile-email");
const profileBudgetEl = document.getElementById("profile-budget");
const apiStatusEl = document.getElementById("api-status");
const deleteAccountBtn = document.getElementById("delete-account-btn");

function getAuthHeaders() {
  return appState.token ? { Authorization: `Bearer ${appState.token}` } : {};
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Erreur API");
  }
  return payload;
}

const api = {
  async login(email, password) {
    return apiFetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async register(name, email, password) {
    return apiFetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },

  async getDashboard() {
    return apiFetch("/api/dashboard");
  },

  async transfer(payload) {
    return apiFetch("/api/transfer", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async toggleCardFreeze() {
    return apiFetch("/api/card/toggle", {
      method: "POST",
    });
  },

  async createVirtualCard() {
    return apiFetch("/api/card/virtual", {
      method: "POST",
    });
  },

  async convert() {
    return apiFetch("/api/action/convert", {
      method: "POST",
      body: JSON.stringify({ amount: 50, from: "USD", to: "EUR" }),
    });
  },

  async topup() {
    return apiFetch("/api/action/topup", {
      method: "POST",
      body: JSON.stringify({ amount: 100, currency: "EUR" }),
    });
  },

  async logout() {
    return apiFetch("/api/logout", {
      method: "POST",
    });
  },

  async deleteAccount() {
    return apiFetch("/api/account", {
      method: "DELETE",
    });
  },
};

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

openLoginBtn.addEventListener("click", () => {
  showScreen("login");
  document.getElementById("email").focus();
});

openRegisterBtn.addEventListener("click", () => {
  showScreen("login");
  registerNameInput.focus();
});

openLoginBtnBottom.addEventListener("click", () => {
  showScreen("login");
  document.getElementById("email").focus();
});

openRegisterBtnBottom.addEventListener("click", () => {
  showScreen("login");
  registerNameInput.focus();
});

backHomeBtn.addEventListener("click", () => {
  showScreen("welcome");
});

function setButtonBusy(button, isBusy, busyLabel, idleLabel) {
  button.disabled = isBusy;
  button.textContent = isBusy ? busyLabel : idleLabel;
}

function setSessionToken(token) {
  appState.token = token;
  if (token) {
    localStorage.setItem(STORAGE_KEYS.sessionToken, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.sessionToken);
  }
}

function readSessionToken() {
  return localStorage.getItem(STORAGE_KEYS.sessionToken);
}

function extractState(payload) {
  const state = payload?.state?.user ? payload.state : payload?.user ? payload : null;
  if (!state?.user) {
    throw new Error("Reponse serveur invalide. Redemarre le serveur puis reessaie.");
  }
  return state;
}

function formatCurrency(value, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(value);
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function convertToEur(amount, currency) {
  const rate = FX_TO_EUR[currency] ?? 1;
  return amount * rate;
}

function computeTotals() {
  const state = appState.data;
  const totalEur = state.wallets.reduce(
    (sum, wallet) => sum + convertToEur(wallet.balance, wallet.code),
    0
  );

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  let monthIn = 0;
  let monthOutAbs = 0;

  for (const txn of state.transactions) {
    const d = new Date(txn.date);
    if (d.getMonth() !== thisMonth || d.getFullYear() !== thisYear) {
      continue;
    }

    const eurAmount = convertToEur(txn.amount, txn.currency || "EUR");
    if (eurAmount >= 0) {
      monthIn += eurAmount;
    } else {
      monthOutAbs += Math.abs(eurAmount);
    }
  }

  const trend = monthIn === 0 ? 0 : ((monthIn - monthOutAbs) / monthIn) * 100;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  let income30d = 0;
  let expense30dAbs = 0;

  for (const txn of state.transactions) {
    const d = new Date(txn.date);
    if (d < cutoff) {
      continue;
    }

    const eurAmount = convertToEur(txn.amount, txn.currency || "EUR");
    if (eurAmount >= 0) {
      income30d += eurAmount;
    } else {
      expense30dAbs += Math.abs(eurAmount);
    }
  }

  const savingRate = income30d > 0 ? ((income30d - expense30dAbs) / income30d) * 100 : 0;

  return {
    totalEur,
    trend,
    monthOutAbs,
    income30d,
    expense30dAbs,
    savingRate,
  };
}

function getFilteredTransactions() {
  const items = appState.data.transactions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (appState.transactionFilter === "in") {
    return items.filter((txn) => txn.amount > 0);
  }
  if (appState.transactionFilter === "out") {
    return items.filter((txn) => txn.amount < 0);
  }
  return items;
}

function renderTabs() {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === appState.activeTab);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === appState.activeTab);
  });
}

function renderWallets() {
  walletCardsEl.innerHTML = "";
  for (const wallet of appState.data.wallets) {
    const div = document.createElement("div");
    div.className = "wallet-item";
    div.innerHTML = `
      <small>${wallet.code}</small>
      <strong>${formatCurrency(wallet.balance, wallet.code)}</strong>
    `;
    walletCardsEl.appendChild(div);
  }
}

function renderCards() {
  const active = appState.data.cards[0];
  activeCardNameEl.textContent = active?.label || "Aucune carte";
  activeCardNumberEl.textContent = active?.number || "**** **** **** 0000";

  const frozen = !!active?.frozen;
  cardStatusBadgeEl.textContent = frozen ? "Gelee" : "Active";
  cardStatusBadgeEl.className = frozen ? "badge warn" : "badge ok";
  toggleCardBtn.textContent = frozen ? "Degeler la carte" : "Geler la carte";

  cardsListEl.innerHTML = "";
  appState.data.cards.forEach((card) => {
    const li = document.createElement("li");
    li.className = "card-item";
    li.innerHTML = `
      <div class="meta">
        <strong>${card.label}</strong>
        <small>${card.type} - ${card.number}</small>
      </div>
      <span class="badge ${card.frozen ? "warn" : "ok"}">${card.frozen ? "Gelee" : "Active"}</span>
    `;
    cardsListEl.appendChild(li);
  });
}

function renderBeneficiaries() {
  beneficiariesListEl.innerHTML = "";
  for (const beneficiary of appState.data.beneficiaries) {
    const li = document.createElement("li");
    li.className = "beneficiary-item";
    li.innerHTML = `
      <div class="meta">
        <strong>${beneficiary.name}</strong>
        <small>${beneficiary.country} - ${beneficiary.iban.slice(0, 8)}...</small>
      </div>
      <button type="button" class="ghost" data-beneficiary-id="${beneficiary.id}">Choisir</button>
    `;
    beneficiariesListEl.appendChild(li);
  }
}

function renderTransactions() {
  transactionsList.innerHTML = "";
  const txns = getFilteredTransactions();

  if (txns.length === 0) {
    const empty = document.createElement("li");
    empty.className = "transaction-item";
    empty.innerHTML = "<div class=\"meta\"><strong>Aucune transaction</strong><small>Essaie un autre filtre.</small></div>";
    transactionsList.appendChild(empty);
    return;
  }

  txns.slice(0, 12).forEach((txn) => {
    const li = document.createElement("li");
    li.className = "transaction-item";
    const amountClass = txn.amount >= 0 ? "credit" : "debit";
    const sign = txn.amount >= 0 ? "+" : "";
    li.innerHTML = `
      <div class="meta">
        <strong>${txn.label}</strong>
        <small>${formatDate(txn.date)}</small>
      </div>
      <span class="amount ${amountClass}">${sign}${formatCurrency(txn.amount, txn.currency || "EUR")}</span>
    `;
    transactionsList.appendChild(li);
  });
}

function buildExpenseSeries(days = 14) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const labels = [];
  const values = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(end);
    day.setDate(end.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    labels.push(key);

    let total = 0;
    appState.data.transactions.forEach((txn) => {
      if (txn.date === key && txn.amount < 0) {
        total += Math.abs(convertToEur(txn.amount, txn.currency || "EUR"));
      }
    });
    values.push(total);
  }

  return { labels, values };
}

function renderExpenseChart() {
  const { labels, values } = buildExpenseSeries(14);
  const width = 320;
  const height = 140;
  const padding = 12;
  const max = Math.max(...values, 1);

  const points = values.map((value, i) => {
    const x = padding + (i * (width - padding * 2)) / (values.length - 1);
    const y = height - padding - (value / max) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  expenseLineEl.setAttribute("points", points.join(" "));
  const areaPoints = [`${padding},${height - padding}`, ...points, `${width - padding},${height - padding}`];
  expenseAreaEl.setAttribute("points", areaPoints.join(" "));
  expenseLineEl.classList.remove("animate");
  expenseAreaEl.classList.remove("animate");
  void expenseLineEl.offsetWidth;
  expenseLineEl.classList.add("animate");
  expenseAreaEl.classList.add("animate");

  const total = values.reduce((acc, v) => acc + v, 0);
  chartTotalExpensesEl.textContent = formatCurrency(total, "EUR");

  const startDate = new Date(labels[0]);
  const diffDays = Math.round((Date.now() - startDate.getTime()) / 86400000);
  chartStartEl.textContent = `J-${diffDays}`;
}

function renderProfile() {
  profileNameEl.textContent = appState.data.user.name;
  profileEmailEl.textContent = appState.data.user.email;
  profileBudgetEl.textContent = formatCurrency(appState.data.user.monthlyBudget, "EUR");
  apiStatusEl.textContent = "Connecte";
}

function renderBudgetAndInsights() {
  const totals = computeTotals();

  portfolioTotalEl.textContent = formatCurrency(totals.totalEur, "EUR");
  const trendPrefix = totals.trend >= 0 ? "+" : "";
  monthlyTrendEl.textContent = `${trendPrefix}${totals.trend.toFixed(1)}%`;

  spentAmountEl.textContent = formatCurrency(totals.monthOutAbs, "EUR");
  const budget = appState.data.user.monthlyBudget;
  const pct = budget > 0 ? Math.min(100, (totals.monthOutAbs / budget) * 100) : 0;
  budgetProgressEl.style.width = `${pct.toFixed(1)}%`;
  budgetCaptionEl.textContent = `${pct.toFixed(1)}% du budget utilise`;

  income30dEl.textContent = formatCurrency(totals.income30d, "EUR");
  expense30dEl.textContent = formatCurrency(totals.expense30dAbs, "EUR");
  savingRateEl.textContent = `${totals.savingRate.toFixed(1)}%`;
}

function renderDashboard() {
  if (!appState.data) {
    return;
  }

  userNameEl.textContent = appState.data.user.name;
  renderTabs();
  renderWallets();
  renderCards();
  renderBeneficiaries();
  renderTransactions();
  renderExpenseChart();
  renderBudgetAndInsights();
  renderProfile();
}

function showStatus(success, message) {
  statusTitle.textContent = success ? "Operation validee" : "Erreur";
  statusTitle.className = success ? "success" : "error";
  statusMessage.textContent = message;
  showScreen("status");
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    appState.activeTab = btn.dataset.tab || "home";
    renderTabs();
  });
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    appState.transactionFilter = btn.dataset.filter || "all";
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderTransactions();
  });
});

beneficiariesListEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("button[data-beneficiary-id]");
  if (!button) {
    return;
  }

  const id = button.getAttribute("data-beneficiary-id");
  const beneficiary = appState.data.beneficiaries.find((b) => b.id === id);
  if (!beneficiary) {
    return;
  }

  recipientInput.value = beneficiary.name;
  ibanInput.value = beneficiary.iban;
  referenceInput.value = `Paiement ${beneficiary.name}`;
  appState.activeTab = "payments";
  renderTabs();
  amountInput.focus();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setButtonBusy(loginSubmitBtn, true, "Connexion...", "Se connecter");
  try {
    const result = await api.login(email, password);
    setSessionToken(result.token);
    appState.data = extractState(result);
    appState.activeTab = "home";
    renderDashboard();
    showScreen("dashboard");
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    setButtonBusy(loginSubmitBtn, false, "Connexion...", "Se connecter");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerError.textContent = "";

  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;

  setButtonBusy(registerSubmitBtn, true, "Creation...", "Creer un compte");
  try {
    const result = await api.register(name, email, password);
    setSessionToken(result.token);
    appState.data = extractState(result);
    appState.activeTab = "home";
    renderDashboard();
    showScreen("dashboard");
    registerForm.reset();
  } catch (error) {
    registerError.textContent = error.message;
  } finally {
    setButtonBusy(registerSubmitBtn, false, "Creation...", "Creer un compte");
  }
});

transferForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  transferError.textContent = "";

  const payload = {
    recipient: recipientInput.value,
    iban: ibanInput.value,
    amount: amountInput.value,
    reference: referenceInput.value,
    speed: transferSpeedSelect.value,
  };

  setButtonBusy(transferSubmitBtn, true, "Traitement...", "Envoyer");
  try {
    const result = await api.transfer(payload);
    appState.data = extractState(result);
    renderDashboard();
    transferForm.reset();

    const feeText = result.fee > 0 ? ` (frais ${formatCurrency(result.fee, "EUR")})` : "";
    showStatus(true, `${formatCurrency(result.amount, "EUR")} envoyes a ${result.recipient}${feeText}.`);
  } catch (error) {
    if (showingDashboard()) {
      transferError.textContent = error.message;
    } else {
      showStatus(false, error.message);
    }
  } finally {
    setButtonBusy(transferSubmitBtn, false, "Traitement...", "Envoyer");
  }
});

toggleCardBtn.addEventListener("click", async () => {
  toggleCardBtn.disabled = true;
  try {
    const result = await api.toggleCardFreeze();
    appState.data = extractState(result);
    renderDashboard();
    showStatus(true, result.frozen ? "Carte gelee avec succes." : "Carte degelee avec succes.");
  } catch (error) {
    showStatus(false, error.message);
  } finally {
    toggleCardBtn.disabled = false;
  }
});

newVirtualBtn.addEventListener("click", async () => {
  newVirtualBtn.disabled = true;
  try {
    const result = await api.createVirtualCard();
    appState.data = extractState(result);
    renderDashboard();
    showStatus(true, `${result.card.label} creee.`);
  } catch (error) {
    showStatus(false, error.message);
  } finally {
    newVirtualBtn.disabled = false;
  }
});

actionSend.addEventListener("click", () => {
  appState.activeTab = "payments";
  renderTabs();
  recipientInput.focus();
});

actionRequest.addEventListener("click", () => {
  showStatus(true, "Lien de demande de paiement cree.");
});

actionConvert.addEventListener("click", async () => {
  try {
    const result = await api.convert();
    appState.data = extractState(result);
    renderDashboard();
    showStatus(true, result.message);
  } catch (error) {
    showStatus(false, error.message);
  }
});

actionTopup.addEventListener("click", async () => {
  try {
    const result = await api.topup();
    appState.data = extractState(result);
    renderDashboard();
    showStatus(true, result.message);
  } catch (error) {
    showStatus(false, error.message);
  }
});

statusBackBtn.addEventListener("click", () => {
  renderDashboard();
  showScreen("dashboard");
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api.logout();
  } catch {
    // no-op
  }

  setSessionToken(null);
  appState.data = null;
  loginForm.reset();
  registerForm.reset();
  transferForm.reset();
  loginError.textContent = "";
  registerError.textContent = "";
  transferError.textContent = "";
  showScreen("welcome");
});

deleteAccountBtn.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Confirmer la suppression de votre compte ? Cette action est definitive."
  );
  if (!confirmed) {
    return;
  }

  deleteAccountBtn.disabled = true;
  try {
    await api.deleteAccount();
    setSessionToken(null);
    appState.data = null;
    loginForm.reset();
    registerForm.reset();
    transferForm.reset();
    loginError.textContent = "Compte supprime. Vous pouvez en creer un nouveau.";
    registerError.textContent = "";
    transferError.textContent = "";
    showScreen("welcome");
  } catch (error) {
    showStatus(false, error.message);
  } finally {
    deleteAccountBtn.disabled = false;
  }
});

function showingDashboard() {
  return screens.dashboard.classList.contains("active");
}

async function bootstrap() {
  showScreen("welcome");
  const token = readSessionToken();
  if (!token) {
    return;
  }

  setSessionToken(token);
  setButtonBusy(loginSubmitBtn, true, "Restauration...", "Se connecter");
  try {
    const data = await api.getDashboard();
    appState.data = extractState(data);
    renderDashboard();
    showScreen("dashboard");
  } catch {
    setSessionToken(null);
    showScreen("welcome");
  } finally {
    setButtonBusy(loginSubmitBtn, false, "Restauration...", "Se connecter");
  }
}

bootstrap();

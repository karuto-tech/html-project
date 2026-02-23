const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "db.json");

const FX_TO_EUR = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.16,
};

const sessions = new Map();

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

async function readDb() {
  const raw = await fs.readFile(DB_FILE, "utf8");
  return normalizeDb(JSON.parse(raw.replace(/^\uFEFF/, "")));
}

async function writeDb(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function normalizeDb(db) {
  if (Array.isArray(db?.users)) {
    const users = db.users
      .filter((u) => u && typeof u === "object")
      .map((u, idx) => ({
        id: String(u.id || `u_${Date.now()}_${idx}`),
        name: String(u.name || "Client"),
        email: String(u.email || "").trim(),
        password: String(u.password || ""),
        monthlyBudget: Number.isFinite(Number(u.monthlyBudget)) ? Number(u.monthlyBudget) : 2000,
        wallets: Array.isArray(u.wallets) ? u.wallets : [],
        cards: Array.isArray(u.cards) ? u.cards : [],
        beneficiaries: Array.isArray(u.beneficiaries) ? u.beneficiaries : [],
        transactions: Array.isArray(u.transactions) ? u.transactions : [],
      }))
      .filter((u) => u.email && u.password);

    return { users };
  }

  if (db?.user) {
    return {
      users: [
        {
          id: "u_seed",
          name: db.user.name,
          email: db.user.email,
          password: db.user.password,
          monthlyBudget: db.user.monthlyBudget,
          wallets: db.wallets || [],
          cards: db.cards || [],
          beneficiaries: db.beneficiaries || [],
          transactions: db.transactions || [],
        },
      ],
    };
  }

  return { users: [] };
}

function publicState(user) {
  return {
    user: {
      name: user.name,
      email: user.email,
      monthlyBudget: user.monthlyBudget,
    },
    wallets: user.wallets,
    cards: user.cards,
    beneficiaries: user.beneficiaries,
    transactions: user.transactions,
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload trop grand"));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("JSON invalide"));
      }
    });
    req.on("error", reject);
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return null;
  }
  return auth.slice(7).trim();
}

function requireAuth(req) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) {
    return null;
  }
  return { token, session: sessions.get(token) };
}

function findUserBySession(db, auth) {
  if (!auth) {
    return null;
  }
  return db.users.find((u) => u && u.id === auth.session.userId) || null;
}

function clearUserSessions(userId) {
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) {
      sessions.delete(token);
    }
  }
}

function nowIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function convertToEur(amount, currency) {
  return amount * (FX_TO_EUR[currency] ?? 1);
}

function maskCardNumber(raw) {
  const trimmed = String(raw).replace(/\s+/g, "");
  const last = trimmed.slice(-4).padStart(4, "0");
  return `**** **** **** ${last}`;
}

function createStarterUser(name, email, password) {
  return {
    id: `u_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name,
    email,
    password,
    monthlyBudget: 2200,
    wallets: [
      { code: "EUR", balance: 500 },
      { code: "USD", balance: 120 },
      { code: "GBP", balance: 90 },
    ],
    cards: [
      {
        id: `card_main_${Date.now()}`,
        label: "Carte Standard",
        number: "**** **** **** 1201",
        frozen: false,
        type: "physical",
      },
    ],
    beneficiaries: [
      { id: `b_${Date.now()}_1`, name: "Support", iban: "FR7630006000011234567890189", country: "FR" },
    ],
    transactions: [
      { id: Date.now(), label: "Prime bienvenue", date: nowIsoDate(), amount: 500, currency: "EUR", kind: "income" },
    ],
  };
}

function serveStaticFile(req, res, filePath, contentType) {
  return fs
    .readFile(filePath)
    .then((data) => {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    })
    .catch(() => {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    });
}

async function handleApi(req, res) {
  const { method, url } = req;

  if (url === "/api/register" && method === "POST") {
    try {
      const body = await parseBody(req);
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (name.length < 2) {
        json(res, 400, { error: "Nom invalide" });
        return;
      }
      if (!email.includes("@")) {
        json(res, 400, { error: "Email invalide" });
        return;
      }
      if (password.length < 6) {
        json(res, 400, { error: "Mot de passe trop court" });
        return;
      }

      const db = await readDb();
      const exists = db.users.some(
        (u) => u && typeof u.email === "string" && u.email.toLowerCase() === email
      );
      if (exists) {
        json(res, 409, { error: "Cet email existe deja" });
        return;
      }

      const newUser = createStarterUser(name, email, password);
      db.users.push(newUser);
      await writeDb(db);

      const token = crypto.randomUUID();
      sessions.set(token, { userId: newUser.id, createdAt: Date.now() });

      json(res, 200, {
        token,
        state: publicState(newUser),
      });
      return;
    } catch (error) {
      json(res, 400, { error: error.message || "Erreur inscription" });
      return;
    }
  }

  if (url === "/api/login" && method === "POST") {
    try {
      const body = await parseBody(req);
      const db = await readDb();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      const user = db.users.find(
        (u) => u && typeof u.email === "string" && u.email.toLowerCase() === email && u.password === password
      );

      if (!user) {
        json(res, 401, { error: "Identifiants invalides" });
        return;
      }

      const token = crypto.randomUUID();
      sessions.set(token, { userId: user.id, createdAt: Date.now() });

      json(res, 200, {
        token,
        state: publicState(user),
      });
      return;
    } catch (error) {
      json(res, 400, { error: error.message || "Erreur login" });
      return;
    }
  }

  if (url === "/api/dashboard" && method === "GET") {
    const auth = requireAuth(req);
    if (!auth) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    const db = await readDb();
    const user = findUserBySession(db, auth);
    if (!user) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    json(res, 200, { state: publicState(user) });
    return;
  }

  if (url === "/api/transfer" && method === "POST") {
    const auth = requireAuth(req);
    if (!auth) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    try {
      const body = await parseBody(req);
      const recipient = String(body.recipient || "").trim();
      const iban = String(body.iban || "").trim();
      const amount = Number(body.amount);
      const reference = String(body.reference || "").trim();
      const speed = String(body.speed || "standard");

      if (!recipient || !iban || !Number.isFinite(amount) || amount <= 0) {
        json(res, 400, { error: "Champs de virement invalides" });
        return;
      }

      if (iban.length < 10) {
        json(res, 400, { error: "IBAN invalide" });
        return;
      }

      const db = await readDb();
      const user = findUserBySession(db, auth);
      if (!user) {
        json(res, 401, { error: "Session invalide" });
        return;
      }

      const eurWallet = user.wallets.find((w) => w.code === "EUR");
      const fee = speed === "instant" ? 1.5 : 0;
      const totalDebit = amount + fee;

      if (!eurWallet || totalDebit > eurWallet.balance) {
        json(res, 400, { error: "Fonds insuffisants sur le wallet EUR" });
        return;
      }

      eurWallet.balance -= totalDebit;

      user.transactions.unshift({
        id: Date.now(),
        label: reference || `Virement vers ${recipient}`,
        date: nowIsoDate(),
        amount: -amount,
        currency: "EUR",
        kind: "expense",
      });

      if (fee > 0) {
        user.transactions.unshift({
          id: Date.now() + 1,
          label: "Frais instantane",
          date: nowIsoDate(),
          amount: -fee,
          currency: "EUR",
          kind: "expense",
        });
      }

      await writeDb(db);
      json(res, 200, {
        recipient,
        iban,
        amount,
        fee,
        state: publicState(user),
      });
      return;
    } catch (error) {
      json(res, 400, { error: error.message || "Erreur virement" });
      return;
    }
  }

  if (url === "/api/card/toggle" && method === "POST") {
    const auth = requireAuth(req);
    if (!auth) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    const db = await readDb();
    const user = findUserBySession(db, auth);
    if (!user) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    const active = user.cards[0];
    if (!active) {
      json(res, 400, { error: "Aucune carte disponible" });
      return;
    }

    active.frozen = !active.frozen;
    await writeDb(db);

    json(res, 200, {
      frozen: active.frozen,
      state: publicState(user),
    });
    return;
  }

  if (url === "/api/card/virtual" && method === "POST") {
    const auth = requireAuth(req);
    if (!auth) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    const db = await readDb();
    const user = findUserBySession(db, auth);
    if (!user) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    const card = {
      id: `card_virtual_${Date.now()}`,
      label: `Virtual ${user.cards.filter((c) => c.type === "virtual").length + 1}`,
      number: maskCardNumber(String(Math.floor(Math.random() * 1e16)).padStart(16, "0")),
      frozen: false,
      type: "virtual",
    };

    user.cards.unshift(card);
    await writeDb(db);

    json(res, 200, {
      card,
      state: publicState(user),
    });
    return;
  }

  if (url === "/api/action/convert" && method === "POST") {
    const auth = requireAuth(req);
    if (!auth) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    try {
      const body = await parseBody(req);
      const amount = Number(body.amount || 50);
      const from = String(body.from || "USD");
      const to = String(body.to || "EUR");

      if (!Number.isFinite(amount) || amount <= 0 || to !== "EUR") {
        json(res, 400, { error: "Conversion invalide" });
        return;
      }

      const db = await readDb();
      const user = findUserBySession(db, auth);
      if (!user) {
        json(res, 401, { error: "Session invalide" });
        return;
      }

      const fromWallet = user.wallets.find((w) => w.code === from);
      const toWallet = user.wallets.find((w) => w.code === to);

      if (!fromWallet || !toWallet || fromWallet.balance < amount) {
        json(res, 400, { error: `Solde ${from} insuffisant` });
        return;
      }

      fromWallet.balance -= amount;
      const converted = convertToEur(amount, from);
      toWallet.balance += converted;

      user.transactions.unshift({
        id: Date.now(),
        label: `Conversion ${from} vers ${to}`,
        date: nowIsoDate(),
        amount: 0,
        currency: "EUR",
        kind: "info",
      });

      await writeDb(db);
      json(res, 200, {
        message: `${amount} ${from} convertis en ${converted.toFixed(2)} EUR`,
        state: publicState(user),
      });
      return;
    } catch (error) {
      json(res, 400, { error: error.message || "Erreur conversion" });
      return;
    }
  }

  if (url === "/api/action/topup" && method === "POST") {
    const auth = requireAuth(req);
    if (!auth) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    try {
      const body = await parseBody(req);
      const amount = Number(body.amount || 100);
      const currency = String(body.currency || "EUR");

      if (!Number.isFinite(amount) || amount <= 0) {
        json(res, 400, { error: "Montant invalide" });
        return;
      }

      const db = await readDb();
      const user = findUserBySession(db, auth);
      if (!user) {
        json(res, 401, { error: "Session invalide" });
        return;
      }

      const wallet = user.wallets.find((w) => w.code === currency);

      if (!wallet) {
        json(res, 400, { error: `Wallet ${currency} introuvable` });
        return;
      }

      wallet.balance += amount;
      user.transactions.unshift({
        id: Date.now(),
        label: "Top up carte",
        date: nowIsoDate(),
        amount,
        currency,
        kind: "income",
      });

      await writeDb(db);
      json(res, 200, {
        message: `${amount} ${currency} ajoutes au wallet ${currency}`,
        state: publicState(user),
      });
      return;
    } catch (error) {
      json(res, 400, { error: error.message || "Erreur topup" });
      return;
    }
  }

  if (url === "/api/account" && method === "DELETE") {
    const auth = requireAuth(req);
    if (!auth) {
      json(res, 401, { error: "Session invalide" });
      return;
    }

    const db = await readDb();
    const userId = auth.session.userId;
    const before = db.users.length;
    db.users = db.users.filter((u) => u.id !== userId);

    if (db.users.length === before) {
      json(res, 404, { error: "Compte introuvable" });
      return;
    }

    await writeDb(db);
    clearUserSessions(userId);
    json(res, 200, { ok: true });
    return;
  }

  if (url === "/api/logout" && method === "POST") {
    const token = getToken(req);
    if (token) {
      sessions.delete(token);
    }
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "Route API introuvable" });
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = req.url || "/";

    if (reqUrl.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    if (reqUrl === "/" || reqUrl === "/index.html") {
      await serveStaticFile(req, res, path.join(ROOT, "index.html"), "text/html; charset=utf-8");
      return;
    }

    if (reqUrl === "/styles.css") {
      await serveStaticFile(req, res, path.join(ROOT, "styles.css"), "text/css; charset=utf-8");
      return;
    }

    if (reqUrl === "/app.js") {
      await serveStaticFile(req, res, path.join(ROOT, "app.js"), "text/javascript; charset=utf-8");
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (error) {
    json(res, 500, { error: error.message || "Erreur serveur" });
  }
});

server.listen(PORT, () => {
  console.log(`Mobile Banking API server running at http://localhost:${PORT}`);
});

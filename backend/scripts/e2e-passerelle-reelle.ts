/**
 * Test de bout en bout SANS aucun composant simule.
 *
 * KoliGo -> passerelle apisungku (locale) -> API sandbox pawaPay (reelle)
 *        <- webhook signe <- callback pawaPay
 *
 * Prerequis : la passerelle tourne sur 127.0.0.1:3000 et le tenant koligo
 * pointe son webhook vers ce backend.
 *
 *   npx ts-node --transpile-only scripts/e2e-passerelle-reelle.ts
 */
import http from "http";
import jwt from "jsonwebtoken";

const PORT_APP = 4998;
const GATEWAY = "http://127.0.0.1:3000/v1";

const API_KEY = process.env.APISUNGKU_API_KEY!;
const CALLBACK_SECRET = process.env.PAWAPAY_CALLBACK_SECRET!;

// Numero de test MTN dont on sait qu'il aboutit sur le sandbox.
const NUMERO = "237678758976";

process.env.DATABASE_URL = "file:./e2e-reel.db";
process.env.JWT_ACCESS_SECRET = "secret-acces-e2e";
process.env.JWT_REFRESH_SECRET = "secret-refresh-e2e";
process.env.PAYMENT_PROVIDER = "apisungku";
process.env.APISUNGKU_BASE_URL = GATEWAY;

/* eslint-disable @typescript-eslint/no-var-requires */
const { createApp } = require("../src/app");
const { prisma } = require("../src/models/prisma");

let reussis = 0;
let echoues = 0;

function verifier(intitule: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(
    `  ${ok ? "OK   " : "ECHEC"} ${intitule}` +
      (ok ? "" : ` — obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`)
  );
  ok ? reussis++ : echoues++;
}

async function appelApp(chemin: string, methode: string, token: string, corps?: unknown) {
  const r = await fetch(`http://127.0.0.1:${PORT_APP}${chemin}`, {
    method: methode,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  return { statut: r.status, corps: (await r.json().catch(() => ({}))) as any };
}

const solde = async (walletId: string) =>
  (await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } })).balanceXAF;

/**
 * Declenche le callback que pawaPay enverrait en production. La passerelle ne
 * fait pas confiance a ce contenu : elle interroge pawaPay pour connaitre
 * l'etat reel. Le statut applique est donc le vrai.
 */
async function declencherCallback(depositId: string) {
  const r = await fetch(`${GATEWAY}/callbacks/pawapay/deposits`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Callback-Secret": CALLBACK_SECRET },
    body: JSON.stringify({ depositId }),
  });
  return r.status;
}

/** Attend qu'une condition se realise, sans bloquer indefiniment. */
async function attendre<T>(quoi: () => Promise<T>, predicat: (v: T) => boolean, essais = 20) {
  for (let i = 0; i < essais; i++) {
    const v = await quoi();
    if (predicat(v)) return v;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return quoi();
}

async function main() {
  const app = createApp();
  const serveur = await new Promise<http.Server>((r) => {
    const s = app.listen(PORT_APP, () => r(s));
  });

  const user = await prisma.user.create({
    data: {
      email: `reel-${Date.now()}@koligo.test`,
      name: "Test reel",
      phone: `2376${Date.now().toString().slice(-8)}`,
      pinHash: "x",
      roles: '["DELIVERER"]',
      activeRole: "DELIVERER",
    },
  });
  const wallet = await prisma.wallet.create({
    data: { userId: user.id, balanceXAF: 0, paymentProvider: "MTN" },
  });
  const token = jwt.sign(
    { userId: user.id, phone: user.phone, activeRole: user.activeRole },
    process.env.JWT_ACCESS_SECRET!
  );

  console.log("\n=== 1. Rechargement reel via la passerelle ===");
  const r = await appelApp("/wallet/topup", "POST", token, { amount: 500, phone: NUMERO });
  verifier("la requete aboutit", r.statut, 200);
  console.log("   paiement passerelle :", r.corps.paymentId);
  verifier("le solde reste a 0 avant autorisation", await solde(wallet.id), 0);

  const topUp = await prisma.topUp.findFirst({ where: { walletId: wallet.id } });
  verifier("le rechargement est enregistre en PENDING", topUp.status, "PENDING");
  verifier("l'identifiant passerelle est conserve", Boolean(topUp.paymentId), true);

  console.log("\n=== 2. Le paiement aboutit cote pawaPay (sandbox) ===");
  const etat = await attendre(
    async () =>
      (await (
        await fetch(`${GATEWAY}/transactions/${r.corps.paymentId}`, {
          headers: { "X-Api-Key": API_KEY },
        })
      ).json()) as any,
    (t) => t.status === "COMPLETED" || t.status === "FAILED",
    3
  );
  console.log("   statut vu par la passerelle :", etat.status);

  console.log("\n=== 3. Callback pawaPay -> passerelle -> webhook -> KoliGo ===");
  verifier("le callback est accepte", await declencherCallback(r.corps.paymentId), 200);

  const final = await attendre(
    () => prisma.topUp.findUnique({ where: { id: topUp.id } }),
    (t: any) => t.status !== "PENDING"
  );
  verifier("le rechargement est confirme", final.status, "SUCCESS");
  verifier("le solde est credite de 500 XAF", await solde(wallet.id), 500);

  const mouvement = await prisma.transaction.findFirst({
    where: { walletId: wallet.id, type: "TOPUP" },
  });
  verifier("un mouvement TOPUP est trace", Boolean(mouvement), true);

  console.log("\n=== 4. Rejeu du callback ===");
  await declencherCallback(r.corps.paymentId);
  await new Promise((res) => setTimeout(res, 3000));
  verifier("le solde n'est pas credite deux fois", await solde(wallet.id), 500);

  console.log("\n=== 5. Garde-fous ===");
  const petit = await appelApp("/wallet/topup", "POST", token, { amount: 50, phone: NUMERO });
  verifier("montant sous le minimum refuse", petit.statut, 400);

  const trop = await appelApp("/wallet/withdraw", "POST", token, {
    amount: 999999,
    provider: "MTN",
    phone: NUMERO,
  });
  verifier("solde insuffisant refuse", trop.statut, 400);

  console.log(`\n──────────────────────────────\n${reussis} verifications reussies, ${echoues} en echec\n`);

  await prisma.$disconnect();
  serveur.close();
  process.exit(echoues === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

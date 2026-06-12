import nodemailer from 'nodemailer';

const FROM = `"KoliGo" <${process.env.SMTP_USER ?? 'infos@trugroup.cm'}>`;
const ADMIN = process.env.SMTP_USER ?? 'infos@trugroup.cm';

// Green/orange brand palette for emails
const GREEN = '#178A3C';
const ORANGE = '#E8551C';
const FOREST = '#0E2A1C';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'mx-dc03.ewodi.net',
  port: parseInt(process.env.SMTP_PORT ?? '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER ?? 'infos@trugroup.cm',
    pass: process.env.SMTP_PASS ?? 'FM3F%hctXxsq',
  },
  tls: { rejectUnauthorized: false },
});

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#F4F5F1;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F1;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <!-- Header -->
        <tr><td style="background:${FOREST};padding:28px 32px;">
          <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Koli<span style="color:${GREEN}">Go</span></span>
          <span style="font-size:11px;color:rgba(255,255,255,0.5);margin-left:12px;text-transform:uppercase;letter-spacing:1px;">La livraison go-go</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#F4F5F1;padding:20px 32px;border-top:1px solid #E7E7E0;">
          <p style="margin:0;font-size:11px;color:#76746B;line-height:16px;">
            KoliGo · La livraison collaborative au Cameroun<br>
            <a href="mailto:infos@trugroup.cm" style="color:${GREEN};text-decoration:none;">infos@trugroup.cm</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(text: string, href = '#') {
  return `<a href="${href}" style="display:inline-block;background:${GREEN};color:#fff;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;text-decoration:none;margin-top:16px;">${text}</a>`;
}

async function send(to: string | string[], subject: string, html: string) {
  const targets = Array.isArray(to) ? to : [to];
  try {
    await transporter.sendMail({ from: FROM, to: targets.join(', '), subject, html });
  } catch (e) {
    // Never crash the main flow — just log
    console.error('[EMAIL] Failed:', (e as Error).message);
  }
}

export const emailService = {
  // ── OTP ─────────────────────────────────────────────────────────────────────
  async sendOtp(to: string, code: string, name?: string) {
    const html = layout('Votre code de vérification KoliGo', `
      <h2 style="font-size:22px;font-weight:800;color:#15140F;margin:0 0 8px;">Votre code : <span style="color:${GREEN};">${code}</span></h2>
      <p style="color:#76746B;font-size:14px;line-height:22px;margin:0 0 20px;">
        ${name ? `Bonjour <strong>${name}</strong>, u` : 'U'}tilisez ce code pour vérifier votre numéro sur KoliGo.<br>
        Il expire dans <strong>5 minutes</strong>.
      </p>
      <div style="background:#E7F2EA;border-radius:14px;padding:20px;text-align:center;margin:20px 0;">
        <span style="font-size:40px;font-weight:900;letter-spacing:10px;color:${FOREST};">${code}</span>
      </div>
      <p style="color:#9A988E;font-size:12px;margin:16px 0 0;">Si vous n'avez pas demandé ce code, ignorez ce message.</p>
    `);
    await send([to, ADMIN], `[KoliGo] Code de vérification : ${code}`, html);
    // Also notify admin
    await send(ADMIN, `[Admin] OTP envoyé à ${to}`, layout('Admin · OTP', `<p>OTP <strong>${code}</strong> envoyé à <strong>${to}</strong></p>`));
  },

  // ── Welcome ──────────────────────────────────────────────────────────────────
  async sendWelcome(to: string, name: string, role: string) {
    const roleLabel = role === 'DELIVERER' ? 'Livreur' : 'Vendeur';
    const html = layout(`Bienvenue sur KoliGo, ${name} !`, `
      <h2 style="font-size:24px;font-weight:900;color:#15140F;margin:0 0 6px;">
        Bienvenue, <span style="color:${GREEN};">${name}</span> ! 🎉
      </h2>
      <p style="color:#76746B;font-size:14px;line-height:22px;margin:0 0 20px;">
        Ton compte <strong>${roleLabel}</strong> KoliGo est créé avec succès.<br>
        La livraison collaborative au Cameroun commence ici.
      </p>
      <div style="background:#F4F5F1;border-radius:14px;padding:20px;margin:0 0 20px;">
        <div style="margin-bottom:10px;">✅ <span style="font-weight:700;">Compte créé</span></div>
        <div style="margin-bottom:10px;color:#9A988E;">⏳ <span>Vérification KYC (à compléter)</span></div>
        <div style="color:#9A988E;">🚀 <span>Première livraison</span></div>
      </div>
      ${btn('Ouvrir l\'app KoliGo')}
    `);
    await send(to, `Bienvenue sur KoliGo, ${name} !`, html);
    await send(ADMIN, `[Admin] Nouvelle inscription : ${name} (${role})`, layout('Admin · Inscription', `
      <p>Nouvel utilisateur inscrit :</p>
      <ul>
        <li>Nom : <strong>${name}</strong></li>
        <li>Email : <strong>${to}</strong></li>
        <li>Rôle : <strong>${role}</strong></li>
        <li>Date : <strong>${new Date().toLocaleString('fr-FR')}</strong></li>
      </ul>
    `));
  },

  // ── Delivery Created ─────────────────────────────────────────────────────────
  async sendDeliveryCreated(to: string, name: string, delivery: { id: string; pickupAddress: string; dropoffAddress: string; priceXAF: number; collectCode: string }) {
    const html = layout('Livraison créée · KoliGo', `
      <h2 style="font-size:20px;font-weight:800;color:#15140F;margin:0 0 8px;">Votre livraison est publiée ✅</h2>
      <p style="color:#76746B;font-size:14px;line-height:22px;margin:0 0 20px;">
        Bonjour <strong>${name}</strong>, un livreur va bientôt accepter votre course.
      </p>
      <div style="background:#F4F5F1;border-radius:14px;padding:20px;margin:0 0 20px;">
        <div style="margin-bottom:8px;"><span style="font-size:11px;color:#9A988E;text-transform:uppercase;letter-spacing:1px;">Départ</span><br><strong>${delivery.pickupAddress}</strong></div>
        <div style="margin-bottom:8px;"><span style="font-size:11px;color:#9A988E;text-transform:uppercase;letter-spacing:1px;">Arrivée</span><br><strong>${delivery.dropoffAddress}</strong></div>
        <div style="margin-bottom:8px;"><span style="font-size:11px;color:#9A988E;text-transform:uppercase;letter-spacing:1px;">Prix</span><br><strong style="color:${GREEN};">${delivery.priceXAF.toLocaleString('fr-FR')} XAF</strong></div>
        <div style="background:#fff;border-radius:10px;padding:14px;text-align:center;margin-top:12px;">
          <span style="font-size:11px;color:#9A988E;display:block;margin-bottom:4px;">CODE DE COLLECTE (à donner au livreur)</span>
          <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:${FOREST};">${delivery.collectCode}</span>
        </div>
      </div>
    `);
    await send(to, '[KoliGo] Livraison créée — code de collecte', html);
    await send(ADMIN, `[Admin] Livraison créée : ${delivery.id}`, layout('Admin · Livraison', `<p>Nouvelle livraison <strong>${delivery.id}</strong> par ${name} (${to})<br>${delivery.pickupAddress} → ${delivery.dropoffAddress} · ${delivery.priceXAF} XAF</p>`));
  },

  // ── Delivery Accepted ────────────────────────────────────────────────────────
  async sendDeliveryAccepted(to: string, name: string, delivererName: string, delivery: { pickupAddress: string; dropoffAddress: string }) {
    const html = layout('Livreur en route · KoliGo', `
      <h2 style="font-size:20px;font-weight:800;color:#15140F;margin:0 0 8px;">Votre livreur arrive ! 🛵</h2>
      <p style="color:#76746B;font-size:14px;line-height:22px;margin:0 0 20px;">
        Bonjour <strong>${name}</strong>,<br>
        <strong>${delivererName}</strong> a accepté votre livraison et se dirige vers vous.
      </p>
      <div style="background:#E7F2EA;border-radius:14px;padding:16px;color:${FOREST};font-size:14px;">
        ${delivery.pickupAddress} → ${delivery.dropoffAddress}
      </div>
    `);
    await send(to, '[KoliGo] Un livreur a accepté votre course', html);
  },

  // ── Delivery Completed ───────────────────────────────────────────────────────
  async sendDeliveryCompleted(to: string, name: string, earning: number, delivery: { dropoffAddress: string }) {
    const html = layout('Livraison effectuée · KoliGo', `
      <h2 style="font-size:20px;font-weight:800;color:#15140F;margin:0 0 8px;">Colis livré ! ✅</h2>
      <p style="color:#76746B;font-size:14px;line-height:22px;margin:0 0 20px;">
        Bonjour <strong>${name}</strong>, le colis a bien été remis à destination.
      </p>
      <div style="background:#E7F2EA;border-radius:14px;padding:20px;text-align:center;">
        <span style="font-size:11px;color:${GREEN};text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;">Gains crédités</span>
        <span style="font-size:36px;font-weight:900;color:${FOREST};">${earning.toLocaleString('fr-FR')} <span style="font-size:16px;color:#76746B;">XAF</span></span>
      </div>
    `);
    await send(to, '[KoliGo] Livraison complète · Gains crédités', html);
    await send(ADMIN, `[Admin] Livraison complète → ${earning} XAF crédités à ${name}`, layout('Admin · Livraison terminée', `<p>Livraison à ${delivery.dropoffAddress} terminée. ${earning} XAF crédités à ${name} (${to})</p>`));
  },
};

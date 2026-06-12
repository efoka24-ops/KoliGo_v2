import axios from 'axios';

// Credentials loaded from .env — never hardcoded
const IB_BASE = process.env.INFOBIP_BASE_URL ?? '';   // ex: abc123.api.infobip.com
const IB_KEY  = process.env.INFOBIP_API_KEY  ?? '';
const IB_FROM = process.env.INFOBIP_WHATSAPP_FROM ?? ''; // WhatsApp Business sender number

// Normalize a Cameroon phone to international format (237XXXXXXXXX)
function toIntl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('237')) return digits;
  if (digits.startsWith('6') && digits.length === 9) return `237${digits}`;
  return digits;
}

const enabled = () => !!(IB_BASE && IB_KEY && IB_FROM);

export const infobipService = {
  isEnabled: () => enabled(),

  // Update WhatsApp Business sender profile (display name + about)
  // Call once at startup to set the sender name to "KoliGo"
  async updateSenderProfile(): Promise<void> {
    if (!enabled()) return;
    try {
      await axios.put(
        `https://${IB_BASE}/whatsapp/1/senders/${IB_FROM}/profile`,
        {
          about: 'Livraison rapide et sécurisée au Cameroun',
          address: 'Cameroun',
          description: 'KoliGo — Plateforme de livraison locale',
          email: 'contact@koligo.cm',
          vertical: 'TRANSPORTATION',
        },
        {
          headers: { Authorization: `App ${IB_KEY}`, 'Content-Type': 'application/json' },
          timeout: 10_000,
        }
      );
      console.log('[INFOBIP] Sender profile updated to KoliGo');
    } catch (e: any) {
      console.warn('[INFOBIP] Could not update sender profile (portal config may be needed):', e.response?.data?.requestError?.serviceException?.messageId ?? e.message);
    }
  },

  // Send OTP via WhatsApp text message
  async sendOtpWhatsApp(phone: string, code: string, name?: string): Promise<boolean> {
    if (!enabled()) {
      console.log('[INFOBIP] Not configured — skipping WhatsApp OTP');
      return false;
    }
    const to = toIntl(phone);
    const greeting = name ? `Bonjour ${name} ! ` : '';
    const text = `${greeting}Votre code de vérification *KoliGo* : *${code}*\n\nValide 5 minutes. Ne le partagez à personne.`;

    try {
      await axios.post(
        `https://${IB_BASE}/whatsapp/1/message/text`,
        { from: IB_FROM, to, content: { text } },
        {
          headers: {
            Authorization: `App ${IB_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        }
      );
      console.log(`[INFOBIP] WhatsApp OTP sent to ${to}`);
      return true;
    } catch (e: any) {
      console.error('[INFOBIP] WhatsApp send failed:', e.response?.data ?? e.message);
      return false;
    }
  },

  // Send a delivery notification via WhatsApp
  async sendDeliveryNotif(phone: string, message: string): Promise<boolean> {
    if (!enabled()) return false;
    const to = toIntl(phone);
    try {
      await axios.post(
        `https://${IB_BASE}/whatsapp/1/message/text`,
        { from: IB_FROM, to, content: { text: message } },
        { headers: { Authorization: `App ${IB_KEY}`, 'Content-Type': 'application/json' }, timeout: 10_000 }
      );
      return true;
    } catch (e: any) {
      console.error('[INFOBIP] Delivery notif failed:', e.response?.data ?? e.message);
      return false;
    }
  },
};

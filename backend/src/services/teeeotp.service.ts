import axios from 'axios';

// teeeotp — passerelle SMS mutualisee TRU GROUP (trugroup.cm/teeeotp).
// Un telephone Android avec forfait SMS envoie le message, sans operateur ni
// agregateur. Voir https://github.com/efoka24-ops/teeeotp (branche otp-gateway).
const TO_BASE = (process.env.TEEEOTP_BASE_URL ?? 'https://trugroup.cm/teeeotp').replace(/\/$/, '');
const TO_KEY  = process.env.TEEEOTP_API_KEY ?? ''; // en-tete X-Api-Key: sk_...

// Normalize a Cameroon phone to international format (237XXXXXXXXX)
function toIntl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('237')) return digits;
  if (digits.startsWith('6') && digits.length === 9) return `237${digits}`;
  return digits;
}

const enabled = () => !!TO_KEY;

export const teeeotpService = {
  isEnabled: () => enabled(),

  // Send a plain SMS (e.g. the OTP code) via the teeeotp gateway
  async sendSms(phone: string, message: string): Promise<boolean> {
    if (!enabled()) {
      console.log('[TEEEOTP] Not configured — skipping SMS');
      return false;
    }
    const to = toIntl(phone);
    try {
      await axios.post(
        `${TO_BASE}/v1/sms`,
        { phone: to, message: message.slice(0, 480) },
        {
          headers: { 'X-Api-Key': TO_KEY, 'Content-Type': 'application/json' },
          timeout: 10_000,
        }
      );
      console.log(`[TEEEOTP] SMS sent to ${to}`);
      return true;
    } catch (e: any) {
      console.error('[TEEEOTP] SMS send failed:', e.response?.data ?? e.message);
      return false;
    }
  },

  // Send OTP via SMS text message
  async sendOtpSms(phone: string, code: string, name?: string): Promise<boolean> {
    const greeting = name ? `Bonjour ${name} ! ` : '';
    const text = `${greeting}Votre code de verification KoliGo : ${code}\n\nValide 5 minutes. Ne le partagez a personne.`;
    return this.sendSms(phone, text);
  },
};

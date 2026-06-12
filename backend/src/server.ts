import 'dotenv/config';
import { createApp } from './app';
import { infobipService } from './services/infobip.service';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`KoliGo API listening on http://localhost:${PORT}`);
  // Attempt to update WhatsApp Business sender profile to display "KoliGo"
  infobipService.updateSenderProfile();
});

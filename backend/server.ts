import 'dotenv/config';
import { createApp } from './src/app';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`[koligo] server running on port ${PORT}`);
});

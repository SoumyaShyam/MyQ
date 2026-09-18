import 'dotenv/config';
import { MyQApplication } from './app';

async function main(): Promise<void> {
  const application = new MyQApplication();
  await application.start();
  process.once('SIGINT', () => void application.stop().then(() => process.exit(0)));
  process.once('SIGTERM', () => void application.stop().then(() => process.exit(0)));
  console.log('MyQ listening on configured TCP address');
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });

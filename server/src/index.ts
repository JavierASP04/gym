import { config } from './config.js';
import { createApp } from './app.js';
import { startRateScheduler } from './lib/bcv.js';

createApp().listen(config.port, () => {
  console.log(`IronPulse API escuchando en http://localhost:${config.port}`);
  startRateScheduler();
});

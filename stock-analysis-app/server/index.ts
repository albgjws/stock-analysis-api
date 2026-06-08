import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { stockRoutes } from './routes/stockRoutes';
import { analysisRoutes } from './routes/analysisRoutes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/stock', stockRoutes);
app.use('/api/stock', analysisRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Serve static frontend in production
const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).json({ message: 'API server is running. Frontend not built yet.' });
    }
  });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[Server] Stock Analysis API running on http://localhost:${config.port}`);
  console.log(`[Server] Cache directory: ${config.cacheDir}`);
});

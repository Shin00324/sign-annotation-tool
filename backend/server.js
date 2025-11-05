import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RENDER_INSTANCE_ID ? { rejectUnauthorized: false } : false,
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS annotations (
        id VARCHAR(255) PRIMARY KEY,
        "taskId" VARCHAR(255) NOT NULL,
        gloss VARCHAR(255) NOT NULL,
        "startTime" REAL NOT NULL,
        "endTime" REAL NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_status (
        "taskId" VARCHAR(255) PRIMARY KEY,
        status VARCHAR(50) NOT NULL
      );
    `);
    console.log('Database tables are ready.');
  } catch (err) {
    console.error('Error setting up database table:', err);
  } finally {
    client.release();
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);

const allowedOrigins = ['http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"]
};

const io = new Server(httpServer, { cors: corsOptions });
const PORT = process.env.PORT || 3001;

async function startServer() {
  await setupDatabase();

  app.use(cors(corsOptions));
  app.use(express.json());

  io.on('connection', (socket) => console.log('A user connected:', socket.id));

  app.get('/api/tasks', async (req, res) => {
    try {
      const tasksFilePath = path.join(__dirname, 'tasks.json');
      const tasksFileContent = fs.readFileSync(tasksFilePath, 'utf-8');
      const taskCategories = JSON.parse(tasksFileContent);
      
      const { rows: statuses } = await pool.query('SELECT * FROM task_status');
      const statusMap = new Map(statuses.map(s => [s.taskId, s.status]));

      const processedCategories = taskCategories.map(category => ({
        ...category,
        tasks: category.tasks.map(task => ({
          ...task,
          status: statusMap.get(task.id) || '待处理',
        }))
      }));
      res.json(processedCategories);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Error processing tasks' });
    }
  });

  app.get('/api/annotations', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM annotations');
      res.json(rows);
    } catch (err) {
      console.error('Error fetching annotations:', err);
      res.status(500).send('Server error');
    }
  });

  app.post('/api/annotations/import', async (req, res) => {
    const annotations = req.body;
    if (!Array.isArray(annotations) || annotations.length === 0) {
      return res.status(400).send('Invalid input');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const anno of annotations) {
        await client.query(
          'INSERT INTO annotations (id, "taskId", gloss, "startTime", "endTime") VALUES ($1, $2, $3, $4, $5)',
          [anno.id, anno.taskId, anno.gloss, anno.startTime, anno.endTime]
        );
      }
      await client.query('COMMIT');
      io.emit('annotations_updated'); // 已有广播
      res.status(201).send('Import successful');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error importing annotations:', err);
      res.status(500).send('Server error');
    } finally {
      client.release();
    }
  });

  app.delete('/api/tasks/:taskId/annotations', async (req, res) => {
    const { taskId } = req.params;
    try {
      await pool.query('DELETE FROM annotations WHERE "taskId" = $1', [taskId]);
      io.emit('annotations_updated'); // **新增广播**
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting annotations:', err);
      res.status(500).send('Server error');
    }
  });

  app.put('/api/tasks/:taskId/status', async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;
    try {
      await pool.query(
        'INSERT INTO task_status ("taskId", status) VALUES ($1, $2) ON CONFLICT ("taskId") DO UPDATE SET status = $2',
        [taskId, status]
      );
      io.emit('annotations_updated'); // **新增广播**
      res.status(200).json({ taskId, status });
    } catch (err) {
      console.error('Error updating task status:', err);
      res.status(500).send('Server error');
    }
  });

  httpServer.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
}

startServer();
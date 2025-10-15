// filepath: c:\Users\ASUS\Desktop\手语标注工具\sign-annotation-tool\backend\server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg'; // 引入新的 pg 包

const { Pool } = pg;

// --- Database Setup ---
// Render 会自动注入 DATABASE_URL 环境变量，指向我们创建的 PostgreSQL 数据库
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 如果在 Render 上部署，需要启用 SSL
  ssl: process.env.RENDER_INSTANCE_ID ? { rejectUnauthorized: false } : false,
});

// 检查并创建 annotations 表
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
    console.log('Database table "annotations" is ready.');
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
  await setupDatabase(); // 启动服务器前先设置好数据库

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.static(path.join(__dirname, '..', 'dist')));

  io.on('connection', (socket) => console.log('A user connected:', socket.id));

  // --- API Endpoints (使用 PostgreSQL) ---

  app.get('/api/tasks', async (req, res) => {
    try {
      const tasksFilePath = path.join(__dirname, 'tasks.json');
      const tasksFileContent = fs.readFileSync(tasksFilePath, 'utf-8');
      const taskCategories = JSON.parse(tasksFileContent);
      
      const { rows: annotations } = await pool.query('SELECT * FROM annotations');

      const processedCategories = taskCategories.map(category => ({
        ...category,
        tasks: category.tasks.map(task => {
          const taskAnnotations = annotations.filter(a => a.taskId === task.id);
          const annotatedGlosses = new Set(taskAnnotations.map(a => a.gloss));
          let status = '待处理';
          if (annotatedGlosses.size > 0 && annotatedGlosses.size < task.glosses.length) {
            status = '部分完成';
          } else if (annotatedGlosses.size >= task.glosses.length) {
            status = '已完成';
          }
          return { ...task, status };
        })
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

  app.post('/api/annotations', async (req, res) => {
    const { id, taskId, gloss, startTime, endTime } = req.body;
    try {
      const { rows } = await pool.query(
        'INSERT INTO annotations (id, "taskId", gloss, "startTime", "endTime") VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [id, taskId, gloss, startTime, endTime]
      );
      io.emit('annotations_updated');
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Error creating annotation:', err);
      res.status(500).send('Server error');
    }
  });

  app.put('/api/annotations/:id', async (req, res) => {
    const { id } = req.params;
    const { startTime, endTime } = req.body;
    try {
      const { rows } = await pool.query(
        'UPDATE annotations SET "startTime" = $1, "endTime" = $2 WHERE id = $3 RETURNING *',
        [startTime, endTime, id]
      );
      if (rows.length === 0) return res.status(404).json({ message: 'Annotation not found' });
      io.emit('annotations_updated');
      res.status(200).json(rows[0]);
    } catch (err) {
      console.error('Error updating annotation:', err);
      res.status(500).send('Server error');
    }
  });

  app.delete('/api/annotations/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM annotations WHERE id = $1', [id]);
      io.emit('annotations_updated');
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting annotation:', err);
      res.status(500).send('Server error');
    }
  });

  // ... 其他端点保持不变 ...

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });

  httpServer.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
}

startServer();
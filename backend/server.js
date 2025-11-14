import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const { Pool } = pg;

// --- 安全配置 ---
// 建议将这些值存储在 .env 文件中，并从 process.env 读取
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-for-jwt';
const APP_PASSWORD = process.env.APP_PASSWORD || '20251114'; // 在这里设置您的访问密码

// Cloudflare R2 配置
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '36f7dc084cca7d3a1b25cf000ec05767';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'c533c1e72a2e1e706cf0461460932b76';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '9ec46afd4a56000fafcb41cfc1df3210b71583c103ffe43a391524cef31c0d92';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'sign-annotation-videos';

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});
// --- 结束安全配置 ---

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
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

  // --- 新增认证相关接口 ---
  app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
      const token = jwt.sign({ user: 'authenticated' }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    } else {
      res.status(401).send('密码错误');
    }
  });

  // JWT 认证中间件
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401); // 如果没有token，返回未授权

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403); // 如果token无效或过期，返回禁止访问
      req.user = user;
      next();
    });
  };
  // --- 结束新增认证 ---

  io.on('connection', (socket) => console.log('A user connected:', socket.id));

  // 对现有接口应用认证中间件
  app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
      const tasksFilePath = path.join(__dirname, 'tasks.json');
      const tasksFileContent = await fs.readFile(tasksFilePath, 'utf-8');
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
      res.status(500).send('Server error');
    }
  });

  app.get('/api/annotations', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM annotations');
      res.json(rows);
    } catch (err) {
      console.error('Error fetching annotations:', err);
      res.status(500).send('Error fetching annotations');
    }
  });

  // --- 新增签名URL接口 ---
  app.get('/api/signed-video-url/:taskId', authenticateToken, async (req, res) => {
    const { taskId } = req.params;
    try {
      const tasksData = await fs.readFile(path.join(__dirname, 'tasks.json'), 'utf-8');
      const categories = JSON.parse(tasksData);
      const task = categories.flatMap(c => c.tasks).find(t => t.id === taskId);

      if (!task || !task.video) {
        return res.status(404).send('Task or video not found');
      }

      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: task.video,
      });
      
      // 生成有效期为 3 分钟的签名 URL
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 180 }); 

      res.json({ url: signedUrl });

    } catch (error) {
      console.error(`Error generating signed URL for task ${taskId}:`, error);
      res.status(500).send('Error generating signed URL');
    }
  });
  // --- 结束新增签名URL接口 ---

  app.post('/api/annotations/import', authenticateToken, async (req, res) => {
    const annotations = req.body;
    if (!Array.isArray(annotations) || annotations.length === 0) {
      return res.status(400).send('Invalid input');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const annotation of annotations) {
        await client.query(
          'INSERT INTO annotations (id, "taskId", gloss, "startTime", "endTime") VALUES ($1, $2, $3, $4, $5)',
          [anno.id, anno.taskId, anno.gloss, anno.startTime, anno.endTime]
        );
      }
      await client.query('COMMIT');
      io.emit('annotations_updated'); // 实时通知
      res.status(201).send('Annotations imported successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error importing annotations:', err);
      res.status(500).send('Server error');
    } finally {
      client.release();
    }
  });

  app.delete('/api/tasks/:taskId/annotations', authenticateToken, async (req, res) => {
    const { taskId } = req.params;
    try {
      await pool.query('DELETE FROM annotations WHERE "taskId" = $1', [taskId]);
      io.emit('annotations_updated'); // **新增广播**
      res.status(204).send();
    } catch (err) {
      console.error(`Error deleting annotations for task ${taskId}:`, err);
      res.status(500).send('Error deleting annotations');
    }
  });

  app.put('/api/tasks/:taskId/status', authenticateToken, async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO task_status ("taskId", status) VALUES ($1, $2)
         ON CONFLICT ("taskId") DO UPDATE SET status = $2`,
        [taskId, status]
      );
      io.emit('annotations_updated'); // 实时通知
      res.status(200).json({ taskId, status });
    } catch (err) {
      console.error('Error updating task status:', err);
      res.status(500).send('Server error');
    }
  });

  httpServer.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
}

startServer();
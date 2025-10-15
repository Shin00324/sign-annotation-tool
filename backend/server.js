import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"] // 允许 PUT 方法
  }
});

const PORT = process.env.PORT || 3001;

// --- Database Setup ---
const DATA_DIRECTORY = '/var/data';
let db;

async function getDb() {
  if (db) return db;

  let dbPath;
  if (process.env.RENDER_INSTANCE_ID) {
    if (!fs.existsSync(DATA_DIRECTORY)) {
      fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    }
    dbPath = path.join(DATA_DIRECTORY, 'db.json');
  } else {
    dbPath = path.join(__dirname, 'db.json');
  }

  console.log(`Database path: ${dbPath}`);

  const adapter = new JSONFile(dbPath);
  db = new Low(adapter, { annotations: [] });

  await db.read();
  db.data = db.data || { annotations: [] };
  await db.write();

  return db;
}

async function startServer() {
  await getDb();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.static(path.join(__dirname, '..', 'dist')));

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // --- API Endpoints ---
  app.get('/api/tasks', async (req, res) => {
    try {
      const db = await getDb();
      await db.read();
      const tasksFilePath = path.join(__dirname, 'tasks.json');
      const tasksFileContent = fs.readFileSync(tasksFilePath, 'utf-8');
      const taskCategories = JSON.parse(tasksFileContent);
      const { annotations } = db.data;

      const processedCategories = taskCategories.map(category => {
        const processedTasks = category.tasks.map(task => {
          const taskAnnotations = annotations.filter(a => a.taskId === task.id);
          const annotatedGlosses = new Set(taskAnnotations.map(a => a.gloss));
          let status;
          if (annotatedGlosses.size === 0) {
            status = '待处理';
          } else if (annotatedGlosses.size < task.glosses.length) {
            status = '部分完成';
          } else {
            status = '已完成';
          }
          return { ...task, status };
        });
        return { ...category, tasks: processedTasks };
      });

      res.json(processedCategories);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Error reading tasks file' });
    }
  });

  app.get('/api/annotations', async (req, res) => {
    const db = await getDb();
    await db.read();
    res.json(db.data.annotations || []);
  });

  app.post('/api/annotations', async (req, res) => {
    const db = await getDb();
    await db.read();
    const newAnnotation = req.body;
    db.data.annotations.push(newAnnotation);
    await db.write();
    io.emit('annotations_updated');
    res.status(201).json(newAnnotation);
  });

  // **新增功能**: 更新一个已有的标注
  app.put('/api/annotations/:id', async (req, res) => {
    const db = await getDb();
    await db.read();
    const { id } = req.params;
    const { startTime, endTime } = req.body;

    const annotationIndex = db.data.annotations.findIndex(a => a.id === id);

    if (annotationIndex === -1) {
      return res.status(404).json({ message: 'Annotation not found' });
    }

    // 只更新时间和我们关心的字段
    const originalAnnotation = db.data.annotations[annotationIndex];
    const updatedAnnotation = {
      ...originalAnnotation,
      startTime: startTime !== undefined ? startTime : originalAnnotation.startTime,
      endTime: endTime !== undefined ? endTime : originalAnnotation.endTime,
    };

    db.data.annotations[annotationIndex] = updatedAnnotation;
    
    console.log('Updated annotation:', updatedAnnotation);

    await db.write();
    io.emit('annotations_updated'); // 广播变更
    res.status(200).json(updatedAnnotation);
  });

  app.delete('/api/annotations/:id', async (req, res) => {
    const db = await getDb();
    await db.read();
    const { id } = req.params;
    db.data.annotations = db.data.annotations.filter(a => a.id !== id);
    await db.write();
    io.emit('annotations_updated');

    res.status(204).send();
  });

  app.post('/api/annotations/import', async (req, res) => {
    const db = await getDb();
    await db.read();
    const importedAnnotations = req.body;
    if (!Array.isArray(importedAnnotations)) {
      return res.status(400).json({ message: 'Invalid data format' });
    }
    db.data.annotations.push(...importedAnnotations);
    await db.write();
    io.emit('annotations_updated');
    console.log(`Imported ${importedAnnotations.length} annotations and broadcasted update.`);
    res.status(200).json({ message: `Successfully imported.` });
  });

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });

  httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
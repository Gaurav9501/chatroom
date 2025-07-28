const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In-memory image click counter
const imageClicks = {};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer for handling uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'gallery.html'));
});

app.get('/images', (req, res) => {
  const files = fs.readdirSync(uploadDir);
  const data = files.map(filename => ({
    filename,
    count: imageClicks[filename] || 0
  }));
  res.json(data);
});

app.post('/upload', upload.single('image'), (req, res) => {
  const filename = req.file.filename;
  imageClicks[filename] = 0;
  res.json({ success: true, filename });

  broadcastImageStats(); // notify all clients of new image
});

// Socket.IO for real-time clicks
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('image-clicked', (filename) => {
    imageClicks[filename] = (imageClicks[filename] || 0) + 1;
    broadcastImageStats();
  });
});

function broadcastImageStats() {
  const files = fs.readdirSync(uploadDir);
  const data = files.map(filename => ({
    filename,
    count: imageClicks[filename] || 0
  }));
  io.emit('image-stats', data);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

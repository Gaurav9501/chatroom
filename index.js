const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In-memory click tracker
const imageClicks = {};

// Create uploads directory if not exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
});

app.post('/click/:filename', (req, res) => {
  const filename = req.params.filename;
  imageClicks[filename] = (imageClicks[filename] || 0) + 1;
  res.json({ clicked: true, count: imageClicks[filename] });
});

// Your existing WebRTC + Socket.IO logic
io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join-room', (roomId, username) => {
    currentRoom = roomId;
    currentUser = username;

    socket.join(roomId);
    socket.to(roomId).emit('user-joined', username);

    socket.on('send-message', (message) => {
      io.to(roomId).emit('receive-message', { message, username });
    });

    socket.on('incoming-call', () => {
      socket.to(currentRoom).emit('incoming-call');
    });

    socket.on('call-accepted', () => {
      socket.to(currentRoom).emit('call-accepted');
    });

    socket.on('call-rejected', () => {
      socket.to(currentRoom).emit('call-rejected');
    });

    socket.on('offer', (data) => {
      socket.to(roomId).emit('offer', data);
    });

    socket.on('answer', (data) => {
      socket.to(roomId).emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
      socket.to(roomId).emit('ice-candidate', data);
    });
  });

  socket.on('disconnect', () => {
    if (currentRoom && currentUser) {
      socket.to(currentRoom).emit('user-left', currentUser);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

const express = require('express');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const upload = multer({ dest: 'uploads/' });

const imageStats = {}; // filename -> count
const movieStats = {}; // movie name -> count

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// Upload image
app.post('/upload', upload.single('image'), (req, res) => {
  const filename = req.file.filename;
  if (!imageStats[filename]) {
    imageStats[filename] = 0;
  }
  sendStats();
  res.status(200).send('Uploaded');
});

// Add movie name
app.post('/add-movie', (req, res) => {
  const name = req.body.name.trim();
  if (!name) return res.status(400).send('Invalid name');
  if (!movieStats[name]) {
    movieStats[name] = 0;
  }
  sendStats();
  res.status(200).send('Movie added');
});

// Return all items (images + movies)
app.get('/items', (req, res) => {
  const items = [];

  for (const [filename, count] of Object.entries(imageStats)) {
    items.push({ type: 'image', filename, count });
  }

  for (const [name, count] of Object.entries(movieStats)) {
    items.push({ type: 'movie', name, count });
  }

  res.json(items);
});

// DELETE image endpoint
app.delete('/delete-image/:filename', (req, res) => {
  const filename = req.params.filename;

  if (!imageStats[filename]) {
    return res.status(404).send('Image not found');
  }

  delete imageStats[filename];

  const filePath = path.join(__dirname, 'uploads', filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      return res.status(500).send('Failed to delete file');
    }

    sendStats();
    res.status(200).send('Image deleted');
  });
});

// Socket.io: Handle click events
io.on('connection', (socket) => {
  socket.emit('item-stats', getCurrentStats());

  socket.on('item-clicked', ({ type, key }) => {
    if (type === 'image') {
      if (imageStats[key] !== undefined) {
        imageStats[key]++;
      }
    } else if (type === 'movie') {
      if (movieStats[key] !== undefined) {
        movieStats[key]++;
      }
    }
    sendStats();
  });
});

function getCurrentStats() {
  const items = [];

  for (const [filename, count] of Object.entries(imageStats)) {
    items.push({ type: 'image', filename, count });
  }

  for (const [name, count] of Object.entries(movieStats)) {
    items.push({ type: 'movie', name, count });
  }

  return items;
}

function sendStats() {
  io.emit('item-stats', getCurrentStats());
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

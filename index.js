const express = require('express');
const multer = require('multer');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;

let imageStats = {};
let movieStats = {};

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/gallery', (req, res) => res.sendFile(path.join(__dirname, 'gallery.html')));

app.post('/upload', upload.single('image'), (req, res) => {
  const filename = req.file.filename;
  imageStats[filename] = imageStats[filename] || 0;
  sendStats();
  res.status(200).send('Uploaded');
});

app.post('/add-movie', (req, res) => {
  const name = req.body.name;
  movieStats[name] = movieStats[name] || 0;
  sendStats();
  res.status(200).send('Movie added');
});

app.get('/items', (req, res) => {
  const images = Object.entries(imageStats).map(([filename, count]) => ({ type: 'image', filename, count }));
  const movies = Object.entries(movieStats).map(([name, count]) => ({ type: 'movie', name, count }));
  res.json([...images, ...movies]);
});

app.delete('/delete-image/:filename', (req, res) => {
  const filename = req.params.filename;

  // Remove from stats if exists
  if (imageStats[filename] !== undefined) {
    delete imageStats[filename];
  }

  // Delete from file system
  const filePath = path.join(__dirname, 'uploads', filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      return res.status(500).send('File delete failed');
    }
    sendStats();
    res.status(200).send('Deleted');
  });
});

io.on('connection', (socket) => {
  socket.on('item-clicked', ({ type, key }) => {
    if (type === 'image' && imageStats[key] !== undefined) imageStats[key]++;
    else if (type === 'movie' && movieStats[key] !== undefined) movieStats[key]++;
    sendStats();
  });
});

function sendStats() {
  const images = Object.entries(imageStats).map(([filename, count]) => ({ type: 'image', filename, count }));
  const movies = Object.entries(movieStats).map(([name, count]) => ({ type: 'movie', name, count }));
  io.emit('update-stats', [...images, ...movies]);
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

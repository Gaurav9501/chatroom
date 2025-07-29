// === index.js ===
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const movies = [];
const comments = [];

const DATA_COMMENTS_FILE = path.join(__dirname, 'comments.json');

try {
  const data = fs.readFileSync(DATA_COMMENTS_FILE, 'utf-8');
  comments.push(...JSON.parse(data));
} catch (err) {
  console.log('No saved comments found, starting fresh.');
}

function saveComments() {
  fs.writeFileSync(DATA_COMMENTS_FILE, JSON.stringify(comments, null, 2));
}

app.use(express.static(path.join(__dirname)));

io.on('connection', (socket) => {
  console.log('A user connected');

  // 🎥 Movie Events
  socket.on('movie:getVotes', () => {
    socket.emit('movie:updateVotes', movies);
  });

  socket.on('movie:vote', (movieId) => {
    const movie = movies.find(m => m.id === movieId);
    if (movie) {
      movie.votes++;
      io.emit('movie:updateVotes', movies);
    }
  });

  socket.on('movie:add', (imageUrl) => {
    const newMovie = {
      id: uuidv4(),
      image: imageUrl,
      votes: 0,
      uploaded: true
    };
    movies.push(newMovie);
    io.emit('movie:updateVotes', movies);
  });

  socket.on('movie:delete', (movieId) => {
    const index = movies.findIndex(m => m.id === movieId && m.uploaded);
    if (index !== -1) {
      movies.splice(index, 1);
      io.emit('movie:updateVotes', movies);
    }
  });

  // 💬 Chat Events
  socket.on('chat:joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username;
    socket.data.roomId = roomId;
  });

  socket.on('chat:message', (data) => {
    console.log('Message received:', data);
    io.to(data.roomId).emit('chat:message', data);
  });

  // 📝 Comment Events
  socket.emit('comment:all', comments);

  socket.on('comment:new', (msg) => {
    const comment = {
      id: uuidv4(),
      text: msg,
      timestamp: new Date().toISOString()
    };
    comments.push(comment);
    saveComments();
    io.emit('comment:new', comment);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

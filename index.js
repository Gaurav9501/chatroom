const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const movies = [];

app.use(express.static(path.join(__dirname)));

io.on('connection', (socket) => {
  console.log('A user connected');

  // =====================
  // 🎥 Movie Events (movies.html)
  // =====================
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

  // =====================
  // 💬 Chat Events (index.html)
  // =====================
  socket.on('chat:joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username;
    socket.data.roomId = roomId;
  });

  socket.on('chat:message', ({ roomId, message }) => {
    io.to(roomId).emit('chat:message', message);
  });

  // =====================
  // 📝 Comment Events (comments.html)
  // =====================
  socket.on('comment:new', (msg) => {
    io.emit('comment:new', msg); // Broadcast to all users
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// In-memory vote storage
const movieVotes = {
  inception: 0,
  matrix: 0,
  interstellar: 0,
};

app.get('/movies', (req, res) => {
  res.sendFile(path.join(__dirname, 'movies.html'));
});

io.on('connection', (socket) => {
  // Chat functionality
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
  });

  socket.on('chat message', ({ roomId, message }) => {
    io.to(roomId).emit('chat message', message);
  });

  // Movie voting
  socket.on('getVotes', () => {
    socket.emit('updateVotes', movieVotes);
  });

  socket.on('voteMovie', (movieId) => {
    if (movieVotes[movieId] !== undefined) {
      movieVotes[movieId]++;
      io.emit('updateVotes', movieVotes); // broadcast to all
    }
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});

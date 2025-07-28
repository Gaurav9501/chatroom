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
  // Movie: Send all movies on new connection
  socket.emit('updateVotes', movies);

  // Movie: Return current movie list
  socket.on('getVotes', () => {
    socket.emit('updateVotes', movies);
  });

  // Movie: Vote for a movie
  socket.on('voteMovie', (movieId) => {
    const movie = movies.find(m => m.id === movieId);
    if (movie) {
      movie.votes++;
      io.emit('updateVotes', movies);
    }
  });

  // Movie: Add a new movie
  socket.on('addMovie', (imageUrl) => {
    const newMovie = {
      id: uuidv4(),
      image: imageUrl,
      votes: 0,
      uploaded: true
    };
    movies.push(newMovie);
    io.emit('updateVotes', movies);
  });

  // Movie: Delete a movie
  socket.on('deleteMovie', (movieId) => {
    const index = movies.findIndex(m => m.id === movieId && m.uploaded);
    if (index !== -1) {
      movies.splice(index, 1);
      io.emit('updateVotes', movies);
    }
  });

  // ✅ Chat: Join room
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username;
    socket.data.roomId = roomId;
  });

  // ✅ Chat: Receive and broadcast message to room
  socket.on('chat message', ({ roomId, message }) => {
    io.to(roomId).emit('chat message', message);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

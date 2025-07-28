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
  socket.emit('updateVotes', movies);

  socket.on('getVotes', () => {
    socket.emit('updateVotes', movies);
  });

  socket.on('voteMovie', (movieId) => {
    const movie = movies.find(m => m.id === movieId);
    if (movie) {
      movie.votes++;
      io.emit('updateVotes', movies);
    }
  });

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

  socket.on('deleteMovie', (movieId) => {
    const index = movies.findIndex(m => m.id === movieId && m.uploaded);
    if (index !== -1) {
      movies.splice(index, 1);
      io.emit('updateVotes', movies);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

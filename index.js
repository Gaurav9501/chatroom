const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In-memory storage
const movieList = [
  { id: 'inception', image: 'https://image.tmdb.org/t/p/w500/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg' },
  { id: 'matrix', image: 'https://image.tmdb.org/t/p/w500/aOi8WhZzQZctdVxrQbbpHzxRiXo.jpg' },
  { id: 'interstellar', image: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' }
];
const voteCounts = {
  inception: 0,
  matrix: 0,
  interstellar: 0
};

app.use(express.static(__dirname));

app.get('/movies', (req, res) => {
  res.sendFile(path.join(__dirname, 'movies.html'));
});

io.on('connection', (socket) => {
  // Chat
  socket.on('joinRoom', ({ roomId, username }) => socket.join(roomId));
  socket.on('chat message', ({ roomId, message }) => {
    io.to(roomId).emit('chat message', message);
  });

  // Voting
  socket.on('getVotes', () => {
    socket.emit('initMovies', movieList, voteCounts);
  });

  socket.on('voteMovie', (movieId) => {
    if (voteCounts[movieId] !== undefined) {
      voteCounts[movieId]++;
      io.emit('updateVotes', voteCounts);
    }
  });

  socket.on('addMovie', (base64Image) => {
    const id = uuidv4();
    const newMovie = { id, image: base64Image };
    movieList.push(newMovie);
    voteCounts[id] = 0;
    io.emit('newMovie', newMovie);
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});

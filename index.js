const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (like index.html, movies.html)
app.use(express.static(__dirname));

app.get('/movies', (req, res) => {
  res.sendFile(path.join(__dirname, 'movies.html'));
});

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`${username} joined room ${roomId}`);
  });

  socket.on('chat message', ({ roomId, message }) => {
    io.to(roomId).emit('chat message', message);
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});

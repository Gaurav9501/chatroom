const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname)); // serve static files (html, css, images)

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('join room', ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    socket.to(room).emit('system message', `${username} joined the room.`);
  });

  socket.on('chat message', (message) => {
    const { username, room } = socket;
    if (room) {
      io.to(room).emit('chat message', {
        username,
        message,
        isSender: false,
        from: username,
      });
    }
  });

  socket.on('disconnect', () => {
    if (socket.room && socket.username) {
      socket.to(socket.room).emit('system message', `${socket.username} left the room.`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

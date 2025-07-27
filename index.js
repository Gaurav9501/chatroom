const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from root
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', socket => {
  socket.on('join-room', (roomId, username) => {
    const clients = io.sockets.adapter.rooms.get(roomId) || new Set();

    // Optional: limit room to 2 participants
    if (clients.size >= 2) {
      socket.emit('room-full');
      return;
    }

    socket.join(roomId);
    socket.to(roomId).emit('user-joined', username);

    socket.on('send-message', (message) => {
      socket.to(roomId).emit('receive-message', { message, username });
    });

    socket.on('offer', (data) => {
      socket.to(roomId).emit('offer', data);
    });

    socket.on('answer', (data) => {
      socket.to(roomId).emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
      socket.to(roomId).emit('ice-candidate', data);
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-left', username);
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join-room', (roomId, username) => {
    currentRoom = roomId;
    currentUser = username;

    socket.join(roomId);
    socket.to(roomId).emit('user-joined', username);

    console.log(`${username} joined room ${roomId}`);

    socket.on('send-message', (message) => {
      io.to(roomId).emit('receive-message', { message, username });
    });

    socket.on('incoming-call', () => {
      socket.to(currentRoom).emit('incoming-call');
    });

    socket.on('call-accepted', () => {
      socket.to(currentRoom).emit('call-accepted');
    });

    socket.on('call-rejected', () => {
      socket.to(currentRoom).emit('call-rejected');
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
  });

  socket.on('disconnect', () => {
    if (currentRoom && currentUser) {
      socket.to(currentRoom).emit('user-left', currentUser);
      console.log(`${currentUser} disconnected from room ${currentRoom}`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const users = {};

io.on('connection', socket => {
  console.log('[socket.io] New connection');

  socket.on('join-room', (roomId, username) => {
    socket.join(roomId);
    users[socket.id] = { roomId, username };
    socket.to(roomId).emit('user-joined', username);
    console.log(`[join-room] ${username} joined room ${roomId}`);
  });

  socket.on('send-message', msg => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('receive-message', {
        message: msg,
        username: user.username
      });
    }
  });

  socket.on('incoming-call', () => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('incoming-call');
    }
  });

  socket.on('call-accepted', () => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('call-accepted');
    }
  });

  socket.on('call-rejected', () => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('call-rejected');
    }
  });

  socket.on('offer', offer => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('offer', offer);
    }
  });

  socket.on('answer', answer => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('answer', answer);
    }
  });

  socket.on('ice-candidate', candidate => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('ice-candidate', candidate);
    }
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('user-left', user.username);
      delete users[socket.id];
    }
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});

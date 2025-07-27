const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(__dirname));

io.on('connection', socket => {
  socket.on('join', ({ username, roomId }) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { username });
  });

  socket.on('start-call', ({ roomId, from }) => {
    socket.to(roomId).emit('incoming-call', { from });
  });

  socket.on('call-accepted', ({ roomId, from }) => {
    socket.to(roomId).emit('call-accepted');
  });

  socket.on('offer', ({ offer, roomId }) => {
    socket.to(roomId).emit('offer', { offer });
  });

  socket.on('answer', ({ answer, roomId }) => {
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ candidate, roomId }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));

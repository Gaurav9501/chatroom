const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const movies = [];
const commnets = [];



const fs = require('fs');
const DATA_COMMENTS_FILE = path.join(__dirname, 'comments.json');

let comments = [];

// Load comments from file on startup
try {
  const data = fs.readFileSync(DATA_COMMENTS_FILE, 'utf-8');
  comments = JSON.parse(data);
} catch (err) {
  console.log('No saved comments found, starting fresh.');
}

// Save comments helper
function saveComments() {
  fs.writeFileSync(DATA_COMMENTS_FILE, JSON.stringify(comments, null, 2));
}

app.use(express.static(path.join(__dirname)));

io.on('connection', (socket) => {
  console.log('A user connected');

  // =====================
  // 🎥 Movie Events (movies.html)
  // =====================
  socket.on('movie:getVotes', () => {
    socket.emit('movie:updateVotes', movies);
  });

  socket.on('movie:vote', (movieId) => {
    const movie = movies.find(m => m.id === movieId);
    if (movie) {
      movie.votes++;
      io.emit('movie:updateVotes', movies);
    }
  });

  socket.on('movie:add', (imageUrl) => {
    const newMovie = {
      id: uuidv4(),
      image: imageUrl,
      votes: 0,
      uploaded: true
    };
    movies.push(newMovie);
    io.emit('movie:updateVotes', movies);
  });

  socket.on('movie:delete', (movieId) => {
    const index = movies.findIndex(m => m.id === movieId && m.uploaded);
    if (index !== -1) {
      movies.splice(index, 1);
      io.emit('movie:updateVotes', movies);
    }
  });

  // =====================
  // 💬 Chat Events (index.html)
  // =====================
  socket.on('chat:joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username;
    socket.data.roomId = roomId;
  });

socket.on('chat:message', ({ roomId, message, sender, file }) => {
  io.to(roomId).emit('chat:message', { message, sender, file });
});  

  // =====================
  // 📝 Comment Events (comments.html)
  // =====================
  socket.on('comment:new', (msg) => {
    io.emit('comment:new', msg); // Broadcast to all users
  });


  socket.emit('comment:all', comments);

  socket.on('comment:new', (msg) => {
  const comment = {
    id: uuidv4(),
    text: msg,
    timestamp: new Date().toISOString()
  };
  comments.push(comment);
  saveComments();
  io.emit('comment:new', comment);
});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

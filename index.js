const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

// Serve static files
app.use(express.static(__dirname));

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('join room', (room) => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    socket.on('chat message', ({ name, room, message }) => {
        io.to(room).emit('chat message', { name, message });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const port = 5000;
server.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
});

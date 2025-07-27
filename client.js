const socket = io();
let username, roomId;
let localStream, peerConnection;
let isCaller = false;

const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messageArea = document.getElementById('messageArea');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function joinRoom() {
  username = document.getElementById('username').value.trim();
  roomId = document.getElementById('room').value.trim();

  if (!username || !roomId) return alert("Enter name and room!");

  socket.emit('join-room', roomId, username);
  document.getElementById('chatSection').classList.remove('hidden');
}

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (messageInput.value.trim()) {
    socket.emit('send-message', messageInput.value.trim());
    appendMessage(`You: ${messageInput.value.trim()}`, true);
    messageInput.value = '';
  }
});

socket.on('receive-message', ({ message, username: from }) => {
  appendMessage(`${from}: ${message}`, false);
});

socket.on('user-joined', (user) => {
  appendMessage(`${user} joined the chat.`, false);
});

socket.on('user-left', (user) => {
  appendMessage(`${user} left the chat.`, false);
});

function appendMessage(msg, isSender) {
  const div = document.createElement('div');
  div.className = `message ${isSender ? 'sender' : 'receiver'}`;
  div.textContent = msg;
  messageArea.appendChild(div);
  messageArea.scrollTop = messageArea.scrollHeight;
}

function startCall() {
  if (peerConnection) {
    alert("Call already in progress");
    return;
  }
  isCaller = true;
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;

      peerConnection = new RTCPeerConnection(servers);

      // Add local stream tracks to peerConnection
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      // ICE candidate event
      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate);
        }
      };

      // Track event - when remote track arrives
      peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
      };

      // Create and send offer
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
          socket.emit('offer', peerConnection.localDescription);
        })
        .catch(console.error);
    })
    .catch(err => alert('Error accessing media devices: ' + err));
}

socket.on('offer', (offer) => {
  if (peerConnection) return; // Already have a call, ignore

  isCaller = false;
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;

      peerConnection = new RTCPeerConnection(servers);

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate);
        }
      };

      peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
      };

      peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
          socket.emit('answer', peerConnection.localDescription);
        })
        .catch(console.error);
    })
    .catch(err => alert('Error accessing media devices: ' + err));
});

socket.on('answer', (answer) => {
  if (!isCaller) return;
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
    .catch(console.error);
});

socket.on('ice-candidate', (candidate) => {
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
  }
});

socket.on('room-full', () => {
  alert('Room is full. Cannot join.');
});

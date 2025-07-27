const socket = io();
let username, roomId;
let localStream, peerConnection;

const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messageArea = document.getElementById('messageArea');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

function joinRoom() {
  username = document.getElementById('username').value;
  roomId = document.getElementById('room').value;

  if (!username || !roomId) return alert("Enter name and room!");

  socket.emit('join-room', roomId, username);
  document.getElementById('chatSection').classList.remove('hidden');
}

socket.on('user-joined', (user) => {
  const msg = document.createElement('div');
  msg.textContent = `${user} joined the chat.`;
  messageArea.appendChild(msg);
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (messageInput.value) {
    socket.emit('send-message', messageInput.value);
    appendMessage(messageInput.value, true);
    messageInput.value = '';
  }
});

socket.on('receive-message', ({ message, username: from }) => {
  appendMessage(`${from}: ${message}`, false);
});

function appendMessage(msg, isSender) {
  const div = document.createElement('div');
  div.className = `message ${isSender ? 'sender' : 'receiver'}`;
  div.textContent = msg;
  messageArea.appendChild(div);
  messageArea.scrollTop = messageArea.scrollHeight;
}

// WebRTC
const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

function startCall() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    peerConnection = new RTCPeerConnection(servers);
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.createOffer().then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit('offer', offer);
    });
  });
}

socket.on('offer', (offer) => {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    peerConnection = new RTCPeerConnection(servers);
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    peerConnection.createAnswer().then(answer => {
      peerConnection.setLocalDescription(answer);
      socket.emit('answer', answer);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };
  });
});

socket.on('answer', (answer) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', (candidate) => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

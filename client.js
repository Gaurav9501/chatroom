const socket = io();
let username, roomId;
let localStream, peerConnection;
let isCaller = false;
let iceCandidatesQueue = [];

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messageArea = document.getElementById('messageArea');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

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

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  peerConnection.ontrack = (event) => {
    if (remoteVideo.srcObject !== event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  if (localStream) {
    localStream.getTracks().forEach(track =>
      peerConnection.addTrack(track, localStream)
    );
  }
}

function startCall() {
  isCaller = true;
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    setupPeerConnection();

    peerConnection.createOffer().then(offer => {
      return peerConnection.setLocalDescription(offer);
    }).then(() => {
      socket.emit('offer', peerConnection.localDescription);
    });
  }).catch(err => {
    alert("Media device error: " + err);
  });
}

socket.on('offer', (offer) => {
  isCaller = false;
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    setupPeerConnection();

    peerConnection.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
      return peerConnection.createAnswer();
    }).then(answer => {
      return peerConnection.setLocalDescription(answer);
    }).then(() => {
      socket.emit('answer', peerConnection.localDescription);
    });

    iceCandidatesQueue.forEach(candidate => {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
    iceCandidatesQueue = [];
  });
});

socket.on('answer', (answer) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', (candidate) => {
  const rtcCandidate = new RTCIceCandidate(candidate);
  if (peerConnection && peerConnection.remoteDescription?.type) {
    peerConnection.addIceCandidate(rtcCandidate);
  } else {
    iceCandidatesQueue.push(candidate);
  }
});

socket.on('room-full', () => {
  alert('Room is full. Cannot join.');
});

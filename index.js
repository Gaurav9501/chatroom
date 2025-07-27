const socket = io();

const joinScreen = document.getElementById('joinScreen');
const chatScreen = document.getElementById('chatScreen');
const chatForm = document.getElementById('chatForm');
const chatBox = document.getElementById('chatBox');
const roomNameSpan = document.getElementById('roomName');

let username, room;
let localStream;
let peerConnection;

function joinRoom() {
  username = document.getElementById('username').value;
  room = document.getElementById('room').value;

  if (!username || !room) return;

  socket.emit('join', { username, room });

  joinScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  roomNameSpan.textContent = room;
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('message');
  if (input.value.trim()) {
    socket.emit('chat message', input.value.trim());
    appendMessage(username, input.value.trim(), true);
    input.value = '';
  }
});

socket.on('chat message', (data) => {
  appendMessage(data.username, data.message, data.username === username);
});

socket.on('user joined', (msg) => {
  appendSystemMessage(msg);
});

socket.on('user left', (msg) => {
  appendSystemMessage(msg);
});

function appendMessage(name, msg, isSelf) {
  const msgEl = document.createElement('div');
  msgEl.className = isSelf ? 'message-right' : 'message-left';
  msgEl.innerHTML = `<strong>${name}</strong>: ${msg}`;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendSystemMessage(msg) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message-left';
  msgEl.innerHTML = `<em>${msg}</em>`;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// WebRTC Call
const callBtn = document.getElementById('callBtn');
const endCallBtn = document.getElementById('endCallBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

callBtn.onclick = async () => {
  callBtn.classList.add('hidden');
  endCallBtn.classList.remove('hidden');
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) socket.emit('ice-candidate', e.candidate);
  };

  peerConnection.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
};

endCallBtn.onclick = () => {
  callBtn.classList.remove('hidden');
  endCallBtn.classList.add('hidden');
  peerConnection?.close();
  localStream?.getTracks().forEach(track => track.stop());
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
};

// Handle WebRTC responses
socket.on('offer', async (offer) => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) socket.emit('ice-candidate', e.candidate);
  };

  peerConnection.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on('ice-candidate', async (candidate) => {
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (e) {
    console.error('Error adding ICE candidate:', e);
  }
});

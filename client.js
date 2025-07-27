window.onload = () => {
  const socket = io();
  let username, roomId;
  let localStream, remoteStream, peerConnection;
  let callAccepted = false;
  let isCaller = false;

  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const messageArea = document.getElementById('messageArea');

  const localAudio = document.getElementById('localAudio');
  const remoteAudio = document.getElementById('remoteAudio');

  const body = document.body;
  let incomingCallDiv;

  function joinRoom() {
    username = document.getElementById('username').value.trim();
    roomId = document.getElementById('room').value.trim();

    if (!username || !roomId) {
      alert("Enter name and room!");
      return;
    }

    socket.emit('join-room', roomId, username);
    document.getElementById('chatSection').style.display = 'block';
    log(`Joined room: ${roomId} as ${username}`);
  }

  socket.on('user-joined', (user) => {
    appendMessage(`${user} joined the chat.`, false);
  });

  socket.on('user-left', (user) => {
    appendMessage(`${user} left the chat.`, false);
    dropCall();
  });

  messageForm.addEventListener('submit', e => {
    e.preventDefault();
    if (messageInput.value.trim()) {
      socket.emit('send-message', messageInput.value);
      appendMessage(`You: ${messageInput.value}`, true);
      messageInput.value = '';
    }
  });

  socket.on('receive-message', ({ message, username: from }) => {
    appendMessage(`${from}: ${message}`, false);
  });

  function appendMessage(msg, isSender) {
    const div = document.createElement('div');
    div.className = isSender ? 'message sender' : 'message receiver';
    div.textContent = msg;
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  function startCall() {
    callAccepted = false;
    isCaller = true;

    socket.emit('incoming-call');
    log('Sent incoming call request');
  }

  function showIncomingCallPopup() {
    if (incomingCallDiv) return;

    incomingCallDiv = document.createElement('div');
    incomingCallDiv.style = `
      position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
      background: white; padding: 20px; border: 2px solid #333; z-index: 1000;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      text-align: center;
    `;
    incomingCallDiv.innerHTML = `
      <p>Incoming call</p>
      <button id="acceptCallBtn">Accept</button>
      <button id="rejectCallBtn">Reject</button>
    `;
    body.appendChild(incomingCallDiv);

    document.getElementById('acceptCallBtn').onclick = () => {
      socket.emit('call-accepted');
      body.removeChild(incomingCallDiv);
      incomingCallDiv = null;
      callAccepted = true;
      isCaller = false;
      startWebRTC();
    };

    document.getElementById('rejectCallBtn').onclick = () => {
      socket.emit('call-rejected');
      body.removeChild(incomingCallDiv);
      incomingCallDiv = null;
      callAccepted = false;
      log('Call rejected');
    };
  }

  function startWebRTC() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      localStream = stream;
      localAudio.srcObject = stream;

      peerConnection = new RTCPeerConnection(servers);

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate);
          log('Sent ICE candidate');
        }
      };

      peerConnection.ontrack = event => {
        if (!remoteStream) {
          remoteStream = new MediaStream();
          remoteAudio.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
        log('Received remote track');
      };

      peerConnection.oniceconnectionstatechange = () => {
        log('ICE connection state: ' + peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
          dropCall();
        }
      };

      if (isCaller) {
        peerConnection.createOffer()
          .then(offer => peerConnection.setLocalDescription(offer))
          .then(() => {
            socket.emit('offer', peerConnection.localDescription);
            log('Sent offer');
          })
          .catch(err => log('Error creating offer: ' + err));
      } else {
        peerConnection.createAnswer()
          .then(answer => peerConnection.setLocalDescription(answer))
          .then(() => {
            socket.emit('answer', peerConnection.localDescription);
            log('Sent answer');
          })
          .catch(err => log('Error creating answer: ' + err));
      }
    }).catch(err => {
      log(`Error accessing audio devices: ${err.message}`);
      alert(`Error accessing audio devices: ${err.message}`);
    });
  }

  socket.on('incoming-call', () => {
    log('Incoming call received');
    showIncomingCallPopup();
  });

  socket.on('call-accepted', () => {
    callAccepted = true;
    log('Call accepted by other user');
    startWebRTC();
  });

  socket.on('call-rejected', () => {
    log('Call rejected by other user');
    alert('Call was rejected');
  });

  socket.on('offer', (offer) => {
    if (!peerConnection) {
      startWebRTC();
    }
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => log('Received offer and set remote description'))
      .catch(err => log('Error setting remote description: ' + err));
  });

  socket.on('answer', (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      .then(() => log('Received answer'))
      .catch(err => log('Error setting remote description: ' + err));
  });

  socket.on('ice-candidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      .then(() => log('Added ICE candidate'))
      .catch(err => log('Error adding ICE candidate: ' + err));
  });

  window.dropCall = () => {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
      log("Call ended");

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }

      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
      }

      localAudio.srcObject = null;
      remoteAudio.srcObject = null;
    }
  };

  function log(msg) {
    console.log(`[LOG] ${msg}`);
  }

  window.joinRoom = joinRoom;
  window.startCall = startCall;
};

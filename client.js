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
      console.log('[joinRoom] Username or Room ID missing');
      return;
    }

    socket.emit('join-room', roomId, username);
    document.getElementById('chatSection').style.display = 'block';
    console.log(`[joinRoom] Joined room: ${roomId} as ${username}`);
  }

  socket.on('user-joined', (user) => {
    appendMessage(`${user} joined the chat.`, false);
    console.log(`[socket] User joined: ${user}`);
  });

  socket.on('user-left', (user) => {
    appendMessage(`${user} left the chat.`, false);
    console.log(`[socket] User left: ${user}`);
    dropCall();
  });

  messageForm.addEventListener('submit', e => {
    e.preventDefault();
    if (messageInput.value.trim()) {
      socket.emit('send-message', messageInput.value);
      appendMessage(`You: ${messageInput.value}`, true);
      console.log(`[messageForm] Sent message: ${messageInput.value}`);
      messageInput.value = '';
    }
  });

  socket.on('receive-message', ({ message, username: from }) => {
    appendMessage(`${from}: ${message}`, false);
    console.log(`[socket] Received message from ${from}: ${message}`);
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
    console.log('[startCall] Sent incoming call request');
  }

  function showIncomingCallPopup() {
    if (incomingCallDiv) {
      console.log('[showIncomingCallPopup] Incoming call popup already displayed');
      return;
    }

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
    console.log('[showIncomingCallPopup] Displayed incoming call popup');

    document.getElementById('acceptCallBtn').onclick = () => {
      socket.emit('call-accepted');
      body.removeChild(incomingCallDiv);
      incomingCallDiv = null;
      callAccepted = true;
      isCaller = false;
      console.log('[showIncomingCallPopup] Call accepted');
      startWebRTC();
    };

    document.getElementById('rejectCallBtn').onclick = () => {
      socket.emit('call-rejected');
      body.removeChild(incomingCallDiv);
      incomingCallDiv = null;
      callAccepted = false;
      console.log('[showIncomingCallPopup] Call rejected');
    };
  }

  // Modified startWebRTC: setup peerConnection & media but DO NOT createAnswer here
  function startWebRTC() {
    console.log('[startWebRTC] Starting WebRTC connection...');
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      console.log('[startWebRTC] Media stream obtained');
      localStream = stream;
      localAudio.srcObject = stream;

      peerConnection = new RTCPeerConnection(servers);
      console.log('[startWebRTC] RTCPeerConnection created');

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
        console.log(`[startWebRTC] Added local track: ${track.kind}`);
      });

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate);
          console.log('[peerConnection] Sent ICE candidate');
        }
      };

      peerConnection.ontrack = event => {
        if (!remoteStream) {
          remoteStream = new MediaStream();
          remoteAudio.srcObject = remoteStream;
          console.log('[peerConnection] Created remote media stream');
        }
        remoteStream.addTrack(event.track);
        console.log(`[peerConnection] Received remote track: ${event.track.kind}`);
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log(`[peerConnection] ICE connection state changed: ${peerConnection.iceConnectionState}`);
        if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
          console.log('[peerConnection] ICE connection failed or disconnected, dropping call');
          dropCall();
        }
      };

      // Important: DO NOT create offer/answer here
      return;
    }).catch(err => {
      console.error('[startWebRTC] Error accessing audio devices:', err);
      alert(`Error accessing audio devices: ${err.message}`);
      throw err;
    });
  }

  socket.on('incoming-call', () => {
    console.log('[socket] Incoming call received');
    showIncomingCallPopup();
  });

  socket.on('call-accepted', () => {
    callAccepted = true;
    console.log('[socket] Call accepted by other user');
    startWebRTC()
      .then(() => {
        // Caller creates offer after media & peerConnection ready
        if (isCaller && peerConnection) {
          peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
              socket.emit('offer', peerConnection.localDescription);
              console.log('[call-accepted] Sent offer');
            })
            .catch(err => console.error('[call-accepted] Error creating or sending offer:', err));
        }
      });
  });

  socket.on('call-rejected', () => {
    console.log('[socket] Call rejected by other user');
    alert('Call was rejected');
  });

  socket.on('offer', (offer) => {
    console.log('[socket] Offer received');

    if (!peerConnection) {
      startWebRTC().then(() => {
        return peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      }).then(() => {
        console.log('[offer] Set remote description (offer)');

        return peerConnection.createAnswer();
      }).then(answer => {
        return peerConnection.setLocalDescription(answer);
      }).then(() => {
        socket.emit('answer', peerConnection.localDescription);
        console.log('[offer] Sent answer');
      }).catch(err => {
        console.error('[offer] Error handling offer:', err);
      });
    } else {
      peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => console.log('[offer] Set remote description (offer)'))
        .catch(err => console.error('[offer] Error setting remote description (offer):', err));
    }
  });

  socket.on('answer', (answer) => {
    console.log('[socket] Answer received');
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      .then(() => console.log('[answer] Set remote description (answer)'))
      .catch(err => console.error('[answer] Error setting remote description (answer):', err));
  });

  socket.on('ice-candidate', (candidate) => {
    console.log('[socket] ICE candidate received');
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      .then(() => console.log('[ice-candidate] Added ICE candidate'))
      .catch(err => console.error('[ice-candidate] Error adding ICE candidate:', err));
  });

  window.dropCall = () => {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
      console.log("[dropCall] Call ended");

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        console.log("[dropCall] Local stream stopped");
      }

      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
        console.log("[dropCall] Remote stream stopped");
      }

      localAudio.srcObject = null;
      remoteAudio.srcObject = null;
    } else {
      console.log("[dropCall] No active peerConnection to drop");
    }
  };

  window.joinRoom = joinRoom;
  window.startCall = startCall;
};

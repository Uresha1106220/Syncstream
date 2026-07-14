// Vercel deployment: All API requests go to /api/*
const API_URL = '';

let pusher = null;
let channel = null;

let player;
let playerType = null; // 'youtube' or 'html5'
let roomId = null;
let isHost = false;
let isSyncing = false;
let heartbeatInterval = null;
let username = '';
let currentTab = 'video';
let unreadMessages = 0;
let currentUserId = null;

// DOM Elements
const landingPage = document.getElementById('landing-page');
const roomPage = document.getElementById('room-page');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinModal = document.getElementById('join-modal');
const roomCodeInput = document.getElementById('room-code-input');
const joinSubmitBtn = document.getElementById('join-submit-btn');
const roomIdDisplay = document.getElementById('room-id-display');
const adminControls = document.getElementById('admin-controls');
const youtubeSearchInput = document.getElementById('youtube-search-input');
const searchVideoBtn = document.getElementById('search-video-btn');
const searchResults = document.getElementById('search-results');
const backgroundPlayToggle = document.getElementById('background-play-toggle');
const userCountEl = document.getElementById('user-count');
const syncIndicator = document.getElementById('sync-indicator');
const syncStatus = document.getElementById('sync-status');
const playerOverlay = document.getElementById('player-overlay');
const noVideo = document.getElementById('no-video');
const html5Player = document.getElementById('html5-player');
const usersList = document.getElementById('users-list');
const queueList = document.getElementById('queue-list');

// Auth elements
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authErrorEl = document.getElementById('auth-error');
const loginTabBtn = document.getElementById('login-tab-btn');
const registerTabBtn = document.getElementById('register-tab-btn');
const loggedInInfo = document.getElementById('logged-in-info');
const loggedInName = document.getElementById('logged-in-name');
const avatarCircle = document.getElementById('avatar-circle');
const logoutBtn = document.getElementById('logout-btn');
const roomActionsEl = document.getElementById('room-actions');
const roomHistorySection = document.getElementById('room-history-section');
const historyList = document.getElementById('history-list');
const authCard = document.getElementById('auth-card');
const authForm = document.querySelector('.auth-form');

// Chat elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const unreadBadge = document.getElementById('unread-badge');

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  currentTab = tabName;
  
  tabBtns.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  tabContents.forEach(content => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  if (tabName === 'chat') {
    unreadMessages = 0;
    unreadBadge.classList.add('hidden');
    scrollChatToBottom();
  }
}

function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function isYouTubeId(val) {
  if (!val) return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(val);
}

// Global player abstraction helpers
function playerSeek(time) {
  if (playerType === 'youtube' && player && player.seekTo) {
    player.seekTo(time, true);
  } else if (playerType === 'html5' && html5Player) {
    html5Player.currentTime = time;
  }
}

function playerPlay() {
  if (playerType === 'youtube' && player && player.playVideo) {
    player.playVideo();
  } else if (playerType === 'html5' && html5Player) {
    html5Player.play().catch(e => console.log('Autoplay blocked:', e));
  }
}

function playerPause() {
  if (playerType === 'youtube' && player && player.pauseVideo) {
    player.pauseVideo();
  } else if (playerType === 'html5' && html5Player) {
    html5Player.pause();
  }
}

function playerGetCurrentTime() {
  if (playerType === 'youtube' && player && player.getCurrentTime) {
    return player.getCurrentTime();
  } else if (playerType === 'html5' && html5Player) {
    return html5Player.currentTime;
  }
  return 0;
}

function playerIsPlaying() {
  if (playerType === 'youtube' && player && player.getPlayerState) {
    return player.getPlayerState() === YT.PlayerState.PLAYING;
  } else if (playerType === 'html5' && html5Player) {
    return !html5Player.paused;
  }
  return false;
}

function initHtml5Player() {
  html5Player.addEventListener('play', () => {
    if (!isHost || isSyncing) return;
    const socketId = pusher ? pusher.connection.socket_id : null;
    fetch('/api/rooms/playback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, action: 'play', currentTime: html5Player.currentTime, socketId })
    });
  });

  html5Player.addEventListener('pause', () => {
    if (!isHost || isSyncing) return;
    const socketId = pusher ? pusher.connection.socket_id : null;
    fetch('/api/rooms/playback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, action: 'pause', currentTime: html5Player.currentTime, socketId })
    });
  });

  html5Player.addEventListener('ended', () => {
    if (!isHost) return;
    console.log('HTML5 Video ended - playing next from queue');
    fetch('/api/rooms/queue/play-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId })
    });
  });

  html5Player.addEventListener('error', () => {
    console.error('HTML5 video loading error');
  });
}

initHtml5Player();

function setYouTubeVisible(visible) {
  const ytEl = document.getElementById('player');
  const ytIframe = document.querySelector('#player iframe, iframe#player');
  const target = ytIframe || ytEl;
  if (target) {
    target.style.display = visible ? 'block' : 'none';
  }
  if (player && player.getIframe) {
    player.getIframe().style.display = visible ? 'block' : 'none';
  }
}

function createPlayer(videoId) {
  noVideo.classList.add('hidden');

  if (isYouTubeId(videoId)) {
    playerType = 'youtube';
    html5Player.style.display = 'none';
    html5Player.pause();
    html5Player.src = '';

    if (player) {
      setYouTubeVisible(true);
      player.loadVideoById(videoId);
      if (!isHost) playerOverlay.classList.remove('hidden');
      else playerOverlay.classList.add('hidden');
      return;
    }

    player = new YT.Player('player', {
      videoId: videoId,
      playerVars: {
        controls: isHost ? 1 : 0,
        disablekb: !isHost ? 1 : 0,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
        autoplay: 1
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError
      }
    });
  } else {
    playerType = 'html5';
    setYouTubeVisible(false);
    if (player && player.pauseVideo) player.pauseVideo();

    html5Player.style.display = 'block';
    html5Player.src = videoId;
    html5Player.controls = isHost;
    html5Player.load();
    if (isHost) html5Player.play().catch(() => {});

    if (!isHost) {
      playerOverlay.classList.remove('hidden');
    } else {
      playerOverlay.classList.add('hidden');
      startHeartbeat();
    }
  }
}

function onPlayerReady(event) {
  console.log('YouTube Player ready');
  noVideo.classList.add('hidden');
  
  if (!isHost) {
    playerOverlay.classList.remove('hidden');
  }
  if (isHost) {
    startHeartbeat();
  }
}

function onPlayerStateChange(event) {
  if (!isHost || isSyncing) return;
  
  const currentTime = player.getCurrentTime();
  const socketId = pusher ? pusher.connection.socket_id : null;
  
  if (event.data === YT.PlayerState.PLAYING) {
    fetch('/api/rooms/playback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, action: 'play', currentTime, socketId })
    });
  } else if (event.data === YT.PlayerState.PAUSED) {
    fetch('/api/rooms/playback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, action: 'pause', currentTime, socketId })
    });
  } else if (event.data === YT.PlayerState.ENDED) {
    console.log('YouTube Video ended - playing next from queue');
    fetch('/api/rooms/queue/play-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId })
    });
  }
}

function onPlayerError(event) {
  alert('Video error: Video not found or unavailable');
}

function setSyncStatus(synced) {
  if (synced) {
    syncIndicator.className = 'sync-indicator synced';
    syncStatus.textContent = 'Synced';
  } else {
    syncIndicator.className = 'sync-indicator syncing';
    syncStatus.textContent = 'Syncing...';
  }
}

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  heartbeatInterval = setInterval(() => {
    const time = playerGetCurrentTime();
    if (time !== null && time !== undefined) {
      const socketId = pusher ? pusher.connection.socket_id : null;
      fetch('/api/rooms/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, currentTime: time, isPlaying: playerIsPlaying(), socketId })
      });
    }
  }, 5000);
}

function showRoom() {
  landingPage.classList.add('hidden');
  roomPage.classList.remove('hidden');
  roomIdDisplay.textContent = roomId;
  
  if (isHost) {
    adminControls.classList.remove('hidden');
  } else {
    adminControls.classList.add('hidden');
  }
}

function updateUsersList(users) {
  usersList.innerHTML = '';
  userCountEl.textContent = users.length;
  
  users.forEach(user => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = user.username.charAt(0).toUpperCase();
    
    const userName = document.createElement('div');
    userName.className = 'user-name';
    userName.textContent = user.username + (user.is_host ? ' (Host)' : '');
    
    userItem.appendChild(avatar);
    userItem.appendChild(userName);
    usersList.appendChild(userItem);
  });
}

function updateQueue(queue) {
  queueList.innerHTML = '';
  
  if (queue.length === 0) {
    queueList.innerHTML = '<p class="empty-message">No videos in queue</p>';
    return;
  }
  
  queue.forEach((item, index) => {
    const queueItem = document.createElement('div');
    queueItem.className = 'queue-item';
    
    const queueNumber = document.createElement('div');
    queueNumber.className = 'queue-number';
    queueNumber.textContent = index + 1;
    
    const queueInfo = document.createElement('div');
    queueInfo.className = 'queue-info';
    
    const queueTitle = document.createElement('div');
    queueTitle.className = 'queue-title';
    queueTitle.textContent = item.title;
    
    queueInfo.appendChild(queueTitle);
    queueItem.appendChild(queueNumber);
    queueItem.appendChild(queueInfo);
    
    if (isHost) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'queue-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.onclick = () => {
        fetch('/api/rooms/queue/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, position: item.position })
        });
      };
      queueItem.appendChild(removeBtn);
    }
    
    queueList.appendChild(queueItem);
  });
}

// Chat functions
function addChatMessage(data) {
  const welcomeMsg = chatMessages.querySelector('.chat-welcome');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }
  
  if (data.isSystem) {
    const systemMsg = document.createElement('div');
    systemMsg.className = 'chat-system-message';
    systemMsg.innerHTML = `<span class="chat-system-text">${data.message}</span>`;
    chatMessages.appendChild(systemMsg);
  } else {
    const messageDiv = document.createElement('div');
    const isMe = (data.username === username);
    messageDiv.className = `chat-message ${isMe ? 'me' : 'other'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = data.username.charAt(0).toUpperCase();
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    
    const usernameEl = document.createElement('div');
    usernameEl.className = 'chat-username';
    usernameEl.textContent = data.username;
    
    const textEl = document.createElement('div');
    textEl.className = 'chat-text';
    textEl.textContent = data.message;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'chat-timestamp';
    const date = new Date(data.timestamp);
    timestamp.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    bubble.appendChild(usernameEl);
    bubble.appendChild(textEl);
    bubble.appendChild(timestamp);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    
    chatMessages.appendChild(messageDiv);
  }
  
  scrollChatToBottom();
  
  if (currentTab !== 'chat' && !data.isSystem && data.username !== username) {
    unreadMessages++;
    unreadBadge.textContent = unreadMessages;
    unreadBadge.classList.remove('hidden');
  }
}

function scrollChatToBottom() {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
}

function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;
  
  const socketId = pusher ? pusher.connection.socket_id : null;
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, username, message, socketId })
  });
  chatInput.value = '';
}

// ── Pusher Connection Setup ──────────────────────────────────────────────────

function initPusher() {
  if (pusher) return;

  // Real-time keys from configuration
  pusher = new Pusher('745a886dc8b366f59ca7', {
    cluster: 'ap2',
    authEndpoint: '/api/pusher/auth',
    auth: {
      params: {
        username: username
      }
    }
  });

  pusher.connection.bind('connected', () => {
    console.log('Pusher Connected successfully');
  });

  pusher.connection.bind('disconnected', () => {
    console.log('Pusher Disconnected');
    setSyncStatus(false);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });
}

function subscribeToRoom(roomCode, onSubscribed) {
  initPusher();
  
  if (channel) {
    pusher.unsubscribe(channel.name);
  }

  channel = pusher.subscribe(`presence-room-${roomCode}`);

  channel.bind('pusher:subscription_succeeded', (members) => {
    console.log('Subscription to room succeeded');
    if (onSubscribed) onSubscribed();
  });

  channel.bind('user-joined', (data) => {
    updateUsersList(data.userList);
  });

  channel.bind('user-left', (data) => {
    updateUsersList(data.userList);
  });

  channel.bind('video-loaded', (data) => {
    createPlayer(data.videoId);
    
    setTimeout(() => {
      if (playerType) {
        const timeDiff = (Date.now() - data.timestamp) / 1000;
        const syncTime = data.currentTime + (data.isPlaying ? timeDiff : 0);
        
        isSyncing = true;
        playerSeek(syncTime);
        
        if (data.isPlaying) {
          playerPlay();
        } else {
          playerPause();
        }
        
        setTimeout(() => {
          isSyncing = false;
          setSyncStatus(true);
        }, 1000);
      }
    }, 1000);
  });

  channel.bind('play', (data) => {
    if (playerType && !isHost) {
      const timeDiff = (Date.now() - data.timestamp) / 1000;
      const syncTime = data.currentTime + timeDiff;
      
      isSyncing = true;
      setSyncStatus(false);
      
      playerSeek(syncTime);
      playerPlay();
      
      setTimeout(() => {
        isSyncing = false;
        setSyncStatus(true);
      }, 1000);
    }
  });

  channel.bind('pause', (data) => {
    if (playerType && !isHost) {
      isSyncing = true;
      setSyncStatus(false);
      
      playerSeek(data.currentTime);
      playerPause();
      
      setTimeout(() => {
        isSyncing = false;
        setSyncStatus(true);
      }, 1000);
    }
  });

  channel.bind('sync-check', (data) => {
    if (playerType && !isHost) {
      const currentTime = playerGetCurrentTime();
      const serverTime = data.currentTime;
      const timeDiff = Math.abs(currentTime - serverTime);
      
      if (timeDiff > 2) {
        isSyncing = true;
        setSyncStatus(false);
        
        playerSeek(serverTime);
        
        if (data.isPlaying && !playerIsPlaying()) {
          playerPlay();
        } else if (!data.isPlaying && playerIsPlaying()) {
          playerPause();
        }
        
        setTimeout(() => {
          isSyncing = false;
          setSyncStatus(true);
        }, 1000);
      }
    }
  });

  channel.bind('new-message', (data) => {
    addChatMessage(data);
  });

  channel.bind('queue-update', (data) => {
    updateQueue(data);
  });

  channel.bind('background-play-update', (data) => {
    backgroundPlayToggle.checked = data.enabled;
  });
}

// ── Auth & Session Handling ──────────────────────────────────────────────────

let authMode = 'login'; // 'login' | 'register'

function showAuthError(msg) {
  authErrorEl.textContent = msg;
  authErrorEl.classList.remove('hidden');
}

function hideAuthError() {
  authErrorEl.classList.add('hidden');
}

function setLoggedIn(userId, uname) {
  currentUserId = userId;
  username = uname;
  localStorage.setItem('ss_userId', userId);
  localStorage.setItem('ss_username', uname);

  authForm.classList.add('hidden');
  document.querySelector('.auth-tabs').classList.add('hidden');
  hideAuthError();
  loggedInInfo.classList.remove('hidden');
  loggedInName.textContent = uname;
  avatarCircle.textContent = uname.charAt(0).toUpperCase();

  roomActionsEl.classList.remove('hidden');
  loadRoomHistory();
}

function setLoggedOut() {
  currentUserId = null;
  username = '';
  localStorage.removeItem('ss_userId');
  localStorage.removeItem('ss_username');

  loggedInInfo.classList.add('hidden');
  authForm.classList.remove('hidden');
  document.querySelector('.auth-tabs').classList.remove('hidden');
  roomActionsEl.classList.add('hidden');
  roomHistorySection.classList.add('hidden');
  authUsernameInput.value = '';
  authPasswordInput.value = '';
  
  if (channel) {
    pusher.unsubscribe(channel.name);
    channel = null;
  }
}

async function doAuth() {
  const uname = authUsernameInput.value.trim();
  const pass = authPasswordInput.value;
  hideAuthError();

  if (!uname || !pass) { showAuthError('Please fill in all fields.'); return; }

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = authMode === 'login' ? 'Logging in...' : 'Registering...';

  const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, password: pass })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      showAuthError(data.error || 'Something went wrong.');
    } else {
      setLoggedIn(data.userId, data.username);
    }
  } catch (e) {
    showAuthError('Network error. Is the server running?');
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = authMode === 'login' ? 'Login' : 'Register';
  }
}

loginTabBtn.addEventListener('click', () => {
  authMode = 'login';
  loginTabBtn.classList.add('active');
  registerTabBtn.classList.remove('active');
  authSubmitBtn.textContent = 'Login';
  authPasswordInput.autocomplete = 'current-password';
  hideAuthError();
});

registerTabBtn.addEventListener('click', () => {
  authMode = 'register';
  registerTabBtn.classList.add('active');
  loginTabBtn.classList.remove('active');
  authSubmitBtn.textContent = 'Register';
  authPasswordInput.autocomplete = 'new-password';
  hideAuthError();
});

authSubmitBtn.addEventListener('click', doAuth);
authUsernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') authPasswordInput.focus(); });
authPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') doAuth(); });

logoutBtn.addEventListener('click', setLoggedOut);

(function autoLogin() {
  const savedId = localStorage.getItem('ss_userId');
  const savedName = localStorage.getItem('ss_username');
  if (savedId && savedName) {
    setLoggedIn(parseInt(savedId), savedName);
  }
})();

// ── Room History ──────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function loadRoomHistory() {
  if (!currentUserId) return;
  try {
    const res = await fetch(`/api/history?user_id=${currentUserId}`);
    const data = await res.json();
    const rooms = data.rooms || [];
    if (rooms.length === 0) {
      roomHistorySection.classList.add('hidden');
      return;
    }
    historyList.innerHTML = '';
    rooms.forEach(r => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div>
          <div class="history-room-code">${r.roomId}</div>
          <div class="history-meta">${timeAgo(r.lastVisited)}</div>
        </div>
        <span class="history-join-icon">&#x27A4;</span>
      `;
      item.addEventListener('click', () => {
        joinModal.classList.add('hidden');
        joinRoomWithAPI(r.roomId);
      });
      historyList.appendChild(item);
    });
    roomHistorySection.classList.remove('hidden');
  } catch (e) {
    console.error('Failed to load history', e);
  }
}

// ── Room Actions ──────────────────────────────────────────────────────────────

createRoomBtn.addEventListener('click', async () => {
  if (!username) { alert('Please log in first.'); return; }
  
  try {
    const res = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, userId: currentUserId })
    });
    const data = await res.json();
    if (data.success) {
      roomId = data.roomId;
      isHost = true;
      
      subscribeToRoom(roomId, () => {
        showRoom();
        setTimeout(loadRoomHistory, 500);
      });
    } else {
      alert('Error creating room: ' + data.error);
    }
  } catch (e) {
    alert('Failed to connect to server.');
  }
});

joinRoomBtn.addEventListener('click', () => {
  joinModal.classList.toggle('hidden');
  if (!joinModal.classList.contains('hidden')) {
    roomCodeInput.focus();
  }
});

async function joinRoomWithAPI(roomCode) {
  try {
    const res = await fetch('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: roomCode, username, userId: currentUserId })
    });
    const data = await res.json();
    if (data.success) {
      roomId = data.roomId;
      isHost = false;
      
      subscribeToRoom(roomId, () => {
        showRoom();
        updateUsersList(data.state.userList);
        updateQueue(data.state.queue);
        
        setTimeout(loadRoomHistory, 500);

        if (data.state.videoId) {
          createPlayer(data.state.videoId);
          
          setTimeout(() => {
            if (playerType) {
              const timeDiff = (Date.now() - data.state.timestamp) / 1000;
              const syncTime = data.state.currentTime + (data.state.isPlaying ? timeDiff : 0);
              
              isSyncing = true;
              playerSeek(syncTime);
              
              if (data.state.isPlaying) {
                playerPlay();
              } else {
                playerPause();
              }
              
              setTimeout(() => {
                isSyncing = false;
                setSyncStatus(true);
              }, 1000);
            }
          }, 1000);
        }
        
        backgroundPlayToggle.checked = data.state.backgroundPlay;
      });
    } else {
      alert(data.error || 'Failed to join room');
    }
  } catch (e) {
    alert('Failed to connect to server');
  }
}

joinSubmitBtn.addEventListener('click', () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!username) { alert('Please log in first.'); return; }
  if (roomCode.length === 6) {
    joinRoomWithAPI(roomCode);
  } else {
    alert('Please enter a valid 6-digit room code');
  }
});

roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinSubmitBtn.click();
  }
});

// Search functions
function performSearch() {
  const query = youtubeSearchInput.value.trim();
  if (!query) return;

  searchVideoBtn.textContent = 'Searching...';
  searchVideoBtn.disabled = true;

  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      searchVideoBtn.textContent = 'Search';
      searchVideoBtn.disabled = false;

      if (data.error) {
        alert(data.error);
        return;
      }

      renderSearchResults(data.items || []);
    })
    .catch(err => {
      searchVideoBtn.textContent = 'Search';
      searchVideoBtn.disabled = false;
      console.error(err);
      alert('Error searching for videos. Please try again.');
    });
}

function renderSearchResults(items) {
  searchResults.innerHTML = '';

  if (items.length === 0) {
    searchResults.innerHTML = '<div style="padding: 1rem; color: #9ca3af; text-align: center;">No results found</div>';
    searchResults.classList.remove('hidden');
    return;
  }

  items.forEach(item => {
    const searchItem = document.createElement('div');
    searchItem.className = 'search-item';

    const thumbnail = document.createElement('img');
    thumbnail.className = 'search-thumbnail';
    thumbnail.src = item.thumbnailUrl || '';
    thumbnail.alt = item.title;

    const info = document.createElement('div');
    info.className = 'search-info';

    const title = document.createElement('div');
    title.className = 'search-title';
    const txt = document.createElement('textarea');
    txt.innerHTML = item.title;
    title.textContent = txt.value;

    const channel = document.createElement('div');
    channel.className = 'search-channel';
    channel.textContent = item.channelTitle;

    info.appendChild(title);
    info.appendChild(channel);

    const actions = document.createElement('div');
    actions.className = 'search-actions';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'search-btn-load';
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
      fetch('/api/rooms/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, videoId: item.videoId })
      });
      searchResults.classList.add('hidden');
      youtubeSearchInput.value = '';
    };

    const queueBtn = document.createElement('button');
    queueBtn.className = 'search-btn-queue';
    queueBtn.textContent = 'Queue';
    queueBtn.onclick = () => {
      const t = document.createElement('textarea');
      t.innerHTML = item.title;
      fetch('/api/rooms/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, videoId: item.videoId, title: t.value })
      });
      queueBtn.textContent = '✓ Added';
      queueBtn.disabled = true;
      setTimeout(() => {
        queueBtn.textContent = 'Queue';
        queueBtn.disabled = false;
      }, 1500);
    };

    actions.appendChild(loadBtn);
    actions.appendChild(queueBtn);

    searchItem.appendChild(thumbnail);
    searchItem.appendChild(info);
    searchItem.appendChild(actions);
    searchResults.appendChild(searchItem);
  });

  searchResults.classList.remove('hidden');
}

searchVideoBtn.addEventListener('click', performSearch);

youtubeSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});

document.addEventListener('click', (e) => {
  const searchArea = document.getElementById('admin-controls');
  if (searchArea && !searchArea.contains(e.target)) {
    searchResults.classList.add('hidden');
  }
});

backgroundPlayToggle.addEventListener('change', (e) => {
  fetch('/api/rooms/background-play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, enabled: e.target.checked })
  });
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

sendMessageBtn.addEventListener('click', sendMessage);

window.onYouTubeIframeAPIReady = function() {
  console.log('YouTube API ready');
};

document.addEventListener('visibilitychange', () => {
  if (backgroundPlayToggle.checked) {
    if (document.hidden) {
      if (playerType === 'youtube' && player && player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.setVolume(0);
      } else if (playerType === 'html5' && html5Player && !html5Player.paused) {
        html5Player.muted = true;
      }
    } else {
      if (playerType === 'youtube' && player) {
        player.setVolume(100);
      } else if (playerType === 'html5' && html5Player) {
        html5Player.muted = false;
      }
    }
  }
});

// Leave room handler
window.addEventListener('beforeunload', () => {
  if (roomId && username) {
    fetch('/api/rooms/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, username }),
      keepalive: true
    });
  }
});
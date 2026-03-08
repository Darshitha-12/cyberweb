// WhatsApp Clone - Main Application JavaScript (Extended Version)

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const chatContainer = document.getElementById('chatContainer');
const lockScreen = document.getElementById('lockScreen');
const userNameInput = document.getElementById('userNameInput');
const statusInput = document.getElementById('statusInput');
const avatarSelect = document.getElementById('avatarSelect');
const btnJoin = document.getElementById('btnJoin');
const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUserName = document.getElementById('currentUserName');
const contactList = document.getElementById('contactList');
const chatArea = document.getElementById('chatArea');
const noChatSelected = document.getElementById('noChatSelected');
const chatAvatar = document.getElementById('chatAvatar');
const chatName = document.getElementById('chatName');
const chatStatus = document.getElementById('chatStatus');
const chatOnlineIndicator = document.getElementById('chatOnlineIndicator');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const btnSend = document.getElementById('btnSend');
const btnRecord = document.getElementById('btnRecord');
const typingIndicator = document.getElementById('typingIndicator');
const recordingIndicator = document.getElementById('recordingIndicator');
const backBtn = document.getElementById('backBtn');
const sidebar = document.getElementById('sidebar');
const connectionStatus = document.getElementById('connectionStatus');
const onlineUserCount = document.getElementById('onlineUserCount');
const searchInput = document.getElementById('searchInput');

// Emoji Elements
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');

// Attachment Elements
const attachmentBtn = document.getElementById('attachmentBtn');
const attachmentMenu = document.getElementById('attachmentMenu');
const fileInput = document.getElementById('fileInput');
const imageInput = document.getElementById('imageInput');
const videoInput = document.getElementById('videoInput');
const audioInput = document.getElementById('audioInput');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const openSettings = document.getElementById('openSettings');

// Location Elements
const locationPicker = document.getElementById('locationPicker');
const closeLocationPicker = document.getElementById('closeLocationPicker');
const sendLocationBtn = document.getElementById('sendLocationBtn');

// Image Preview Elements
const imagePreviewModal = document.getElementById('imagePreviewModal');
const previewImage = document.getElementById('previewImage');
const closeImagePreview = document.getElementById('closeImagePreview');

// Lock Screen Elements
const lockError = document.getElementById('lockError');
const lockToggle = document.getElementById('lockToggle');

// Application State
let currentUser = null;
let selectedContact = null;
let contacts = new Map();
let messages = new Map();
let selectedAvatar = '👤';
let socket = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let settings = {
    notifications: true,
    readReceipts: true,
    privacy: 'everyone',
    status: 'Hey there! I am using WhatsApp',
    chatLock: false,
    pin: null
};

// Initialize Socket.io
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        connectionStatus.className = 'fas fa-circle';
        connectionStatus.style.color = '#25D366';
        connectionStatus.title = 'Connected';
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        connectionStatus.className = 'fas fa-circle-notch fa-spin';
        connectionStatus.style.color = '#8696a0';
        connectionStatus.title = 'Reconnecting...';
    });
    
    socket.on('users:list', (users) => {
        updateContactList(users);
    });
    
    socket.on('user:online', (data) => {
        addOrUpdateContact(data);
    });
    
    socket.on('user:offline', (data) => {
        updateContactOffline(data);
    });
    
    socket.on('message:sent', (data) => {
        updateMessageStatus(data.messageId, 'sent');
    });
    
    socket.on('message:delivered', (data) => {
        updateMessageStatus(data.messageId, 'delivered');
    });
    
    socket.on('message:receive', (data) => {
        receiveMessage(data);
    });
    
    socket.on('message:read', (data) => {
        updateMessageStatus(data.messageId, 'read');
    });
    
    socket.on('user:typing', (data) => {
        showTypingIndicator(data.isTyping);
    });
    
    socket.on('user:recording', (data) => {
        showRecordingIndicator(data.isRecording);
    });
    
    socket.on('settings:updated', (data) => {
        settings = Object.assign({}, settings, data);
    });
    
    socket.on('welcome:show', (data) => {
        showWelcomeMessage(data.message);
    });
    
    socket.on('notification:new', (data) => {
        showNotification(data);
    });
    
    socket.on('lock:verified', (data) => {
        if (data.success) {
            lockScreen.classList.remove('active');
        } else {
            lockError.textContent = data.message || 'Incorrect PIN';
            document.querySelectorAll('.pin-digit').forEach(input => {
                input.value = '';
            });
            document.querySelector('.pin-digit').focus();
        }
    });
}

// Avatar Selection
avatarSelect.addEventListener('click', (e) => {
    if (e.target.classList.contains('avatar-option')) {
        document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedAvatar = e.target.dataset.avatar;
    }
});

document.querySelector('.avatar-option').classList.add('selected');

// Join Chat
btnJoin.addEventListener('click', joinChat);
userNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});

function joinChat() {
    const userName = userNameInput.value.trim();
    if (!userName) {
        userNameInput.style.borderColor = '#dc3545';
        setTimeout(function() { userNameInput.style.borderColor = ''; }, 1000);
        return;
    }
    
    currentUser = {
        userId: generateUserId(),
        userName: userName,
        avatar: selectedAvatar,
        status: statusInput.value || 'Hey there! I am using WhatsApp'
    };
    
    initSocket();
    
    socket.emit('user:join', currentUser);
    
    currentUserAvatar.textContent = selectedAvatar;
    currentUserName.textContent = userName;
    
    initEmojiPicker();
    
    const savedPin = localStorage.getItem('chatPin');
    if (savedPin) {
        settings.chatLock = true;
        settings.pin = savedPin;
    }
    
    loginScreen.style.display = 'none';
    chatContainer.classList.add('active');
    
    noChatSelected.style.display = 'flex';
    chatArea.style.display = 'none';
}

function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function updateContactList(users) {
    const currentUserId = currentUser ? currentUser.userId : null;
    const filteredUsers = users.filter(function(u) { return u.userId !== currentUserId; });
    
    onlineUserCount.textContent = filteredUsers.filter(function(u) { return u.isOnline; }).length;
    
    contactList.innerHTML = '';
    
    filteredUsers.forEach(function(user) {
        contacts.set(user.userId, user);
        addContactToList(user);
    });
}

function addOrUpdateContact(data) {
    contacts.set(data.userId, Object.assign({}, contacts.get(data.userId), data));
    
    const existingContact = document.querySelector('[data-user-id="' + data.userId + '"]');
    if (existingContact) {
        updateContactElement(existingContact, data);
    } else {
        addContactToList(data);
    }
    
    updateOnlineCount();
}

function updateContactOffline(data) {
    const contact = contacts.get(data.userId);
    if (contact) {
        contact.isOnline = false;
        contact.lastSeen = data.lastSeen;
        
        const element = document.querySelector('[data-user-id="' + data.userId + '"]');
        if (element) {
            updateContactElement(element, contact);
        }
    }
    updateOnlineCount();
}

function updateOnlineCount() {
    let onlineCount = 0;
    contacts.forEach(function(c) { if (c.isOnline) onlineCount++; });
    onlineUserCount.textContent = onlineCount;
}

function addContactToList(user) {
    const contactItem = document.createElement('div');
    contactItem.className = 'contact-item';
    contactItem.dataset.userId = user.userId;
    
    const lastMsg = getLastMessage(user.userId);
    const lastTime = getLastMessageTime(user.userId);
    
    contactItem.innerHTML = '<div class="contact-avatar">' +
        (user.avatar || '👤') +
        (user.isOnline ? '<span class="online-indicator"></span>' : '') +
        '</div>' +
        '<div class="contact-info">' +
        '<div class="contact-name">' + user.userName + '</div>' +
        '<div class="last-message">' + (lastMsg || 'Start a conversation') + '</div>' +
        '</div>' +
        '<div class="contact-meta">' +
        '<div class="last-time">' + lastTime + '</div>' +
        '</div>';
    
    contactItem.addEventListener('click', function() { openChat(user); });
    contactList.appendChild(contactItem);
}

function updateContactElement(element, user) {
    const avatarEl = element.querySelector('.contact-avatar');
    avatarEl.innerHTML = (user.avatar || '👤') +
        (user.isOnline ? '<span class="online-indicator"></span>' : '');
    
    const lastMsg = getLastMessage(user.userId);
    const lastTime = getLastMessageTime(user.userId);
    element.querySelector('.last-message').textContent = lastMsg || 'Start a conversation';
    element.querySelector('.last-time').textContent = lastTime;
}

function getLastMessage(userId) {
    const userMessages = messages.get(userId);
    if (userMessages && userMessages.length > 0) {
        const lastMsg = userMessages[userMessages.length - 1];
        if (lastMsg.type === 'image') return '📷 Photo';
        if (lastMsg.type === 'video') return '🎬 Video';
        if (lastMsg.type === 'audio') return '🎤 Voice message';
        if (lastMsg.type === 'file') return '📎 File';
        if (lastMsg.type === 'location') return '📍 Location';
        return lastMsg.content.substring(0, 30) + (lastMsg.content.length > 30 ? '...' : '');
    }
    return null;
}

function getLastMessageTime(userId) {
    const userMessages = messages.get(userId);
    if (userMessages && userMessages.length > 0) {
        const lastMsg = userMessages[userMessages.length - 1];
        return formatTime(lastMsg.timestamp);
    }
    return '';
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function openChat(contact) {
    selectedContact = contact;
    
    noChatSelected.style.display = 'none';
    chatArea.style.display = 'flex';
    chatArea.classList.add('active');
    
    chatAvatar.innerHTML = (contact.avatar || '👤') +
        (contact.isOnline ? '<span class="online-indicator" style="display: block;"></span>' : '<span class="online-indicator" style="display: none;"></span>');
    chatName.textContent = contact.userName;
    
    if (contact.isOnline) {
        chatStatus.textContent = 'online';
        chatStatus.classList.add('online');
    } else {
        const lastSeen = contact.lastSeen ? new Date(contact.lastSeen) : null;
        chatStatus.textContent = lastSeen ? 'last seen ' + formatTime(lastSeen) : 'offline';
        chatStatus.classList.remove('online');
    }
    
    document.querySelectorAll('.contact-item').forEach(function(item) { item.classList.remove('active'); });
    const contactEl = document.querySelector('[data-user-id="' + contact.userId + '"]');
    if (contactEl) contactEl.classList.add('active');
    
    renderMessages();
    
    socket.emit('chat:open', { senderId: contact.userId });
    socket.emit('welcome:check', { chatId: contact.userId });
    
    messageInput.focus();
}

function renderMessages() {
    if (!selectedContact) return;
    
    const userMessages = messages.get(selectedContact.userId) || [];
    messagesContainer.innerHTML = '';
    
    const todayDiv = document.createElement('div');
    todayDiv.className = 'date-divider';
    todayDiv.innerHTML = '<span>Today</span>';
    messagesContainer.appendChild(todayDiv);
    
    userMessages.forEach(function(msg) {
        appendMessageToContainer(msg);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendMessageToContainer(msg) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper ' + (msg.sent ? 'sent' : 'received');
    messageWrapper.dataset.messageId = msg.messageId;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (msg.sent ? 'sent' : 'received');
    
    let mediaContent = '';
    
    if (msg.type === 'image') {
        mediaContent = '<div class="message-media"><img src="' + msg.mediaUrl + '" alt="Image" onclick="openImagePreview(\'' + msg.mediaUrl + '\')"></div>';
    } else if (msg.type === 'video') {
        mediaContent = '<div class="message-media"><video controls><source src="' + msg.mediaUrl + '" type="video/mp4"></video></div>';
    } else if (msg.type === 'audio') {
        mediaContent = '<div class="message-media"><audio controls><source src="' + msg.mediaUrl + '" type="audio/webm"></audio></div>';
    } else if (msg.type === 'file') {
        mediaContent = '<div class="message-file" onclick="downloadFile(\'' + msg.mediaUrl + '\', \'' + msg.fileName + '\')"><i class="fas fa-file file-icon"></i><div class="file-info"><div class="file-name">' + msg.fileName + '</div><div class="file-size">' + formatFileSize(msg.fileSize) + '</div></div><i class="fas fa-download"></i></div>';
    } else if (msg.type === 'location') {
        mediaContent = '<div class="message-location" onclick="openLocation(' + msg.location.lat + ', ' + msg.location.lng + ')"><div class="location-preview">📍</div><div class="location-info"><div class="location-name">' + (msg.location.name || 'Location') + '</div><div class="location-address">Tap to open in maps</div></div></div>';
    }
    
    const tickHtml = msg.sent ? getTickHtml(msg.status) : '';
    
    messageDiv.innerHTML = mediaContent +
        (msg.content ? '<div class="message-content">' + escapeHtml(msg.content) + '</div>' : '') +
        '<div class="message-meta">' +
        '<span class="message-time">' + formatTime(msg.timestamp) + '</span>' +
        tickHtml +
        '</div>';
    
    messageWrapper.appendChild(messageDiv);
    messagesContainer.appendChild(messageWrapper);
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function getTickHtml(status) {
    if (status === 'sent') {
        return '<span class="tick-container tick-single">✓</span>';
    } else if (status === 'delivered') {
        return '<span class="tick-container tick-double">✓</span>';
    } else if (status === 'read') {
        return '<span class="tick-container tick-blue">✓</span>';
    }
    return '<span class="tick-container tick-single">✓</span>';
}

function updateMessageStatus(messageId, status) {
    messages.forEach(function(msgArray, userId) {
        const msg = msgArray.find(function(m) { return m.messageId === messageId; });
        if (msg) {
            msg.status = status;
            
            if (selectedContact && selectedContact.userId === userId) {
                const msgElement = document.querySelector('[data-message-id="' + messageId + '"] .tick-container');
                if (msgElement) {
                    msgElement.outerHTML = getTickHtml(status);
                }
            }
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Send Message
btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
});

messageInput.addEventListener('input', function() {
    if (messageInput.value.trim()) {
        btnSend.style.display = 'flex';
        btnRecord.style.display = 'none';
    } else {
        btnSend.style.display = 'none';
        btnRecord.style.display = 'flex';
    }
});

function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !selectedContact) return;
    
    sendTextMessage(content);
    messageInput.value = '';
    btnSend.style.display = 'none';
    btnRecord.style.display = 'flex';
}

function sendTextMessage(content) {
    const messageId = generateMessageId();
    const timestamp = new Date().toISOString();
    
    const messageData = {
        messageId: messageId,
        senderId: currentUser.userId,
        receiverId: selectedContact.userId,
        content: content,
        timestamp: timestamp,
        sent: true,
        status: 'sent',
        type: 'text'
    };
    
    storeAndSendMessage(messageData);
}

function storeAndSendMessage(messageData) {
    if (!messages.has(messageData.receiverId)) {
        messages.set(messageData.receiverId, []);
    }
    messages.get(messageData.receiverId).push(messageData);
    
    appendMessageToContainer(messageData);
    updateContactListPreview(messageData);
    
    socket.emit('message:send', {
        messageId: messageData.messageId,
        senderId: messageData.senderId,
        receiverId: messageData.receiverId,
        content: messageData.content,
        timestamp: messageData.timestamp,
        type: messageData.type,
        mediaUrl: messageData.mediaUrl,
        location: messageData.location,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize
    });
}

function updateContactListPreview(msg) {
    const contactElement = document.querySelector('[data-user-id="' + (msg.receiverId || msg.senderId) + '"]');
    if (contactElement) {
        const preview = getLastMessage(msg.receiverId || msg.senderId);
        contactElement.querySelector('.last-message').textContent = preview;
        contactElement.querySelector('.last-time').textContent = formatTime(msg.timestamp);
    }
}

function receiveMessage(data) {
    const messageId = data.messageId;
    const senderId = data.senderId;
    const content = data.content;
    const timestamp = data.timestamp;
    const status = data.status;
    const type = data.type || 'text';
    const mediaUrl = data.mediaUrl;
    const location = data.location;
    const fileName = data.fileName;
    const fileSize = data.fileSize;
    
    if (!messages.has(senderId)) {
        messages.set(senderId, []);
    }
    
    const messageData = {
        messageId: messageId,
        senderId: senderId,
        content: content,
        timestamp: timestamp,
        sent: false,
        status: status,
        type: type,
        mediaUrl: mediaUrl,
        location: location,
        fileName: fileName,
        fileSize: fileSize
    };
    
    messages.get(senderId).push(messageData);
    
    if (selectedContact && selectedContact.userId === senderId) {
        appendMessageToContainer(messageData);
        socket.emit('message:read', { messageId: messageId, senderId: senderId });
    }
    
    updateContactListPreview(messageData);
}

// Typing Indicator
let typingTimeout;
messageInput.addEventListener('input', function() {
    if (!selectedContact) return;
    
    socket.emit('user:typing', {
        receiverId: selectedContact.userId,
        isTyping: true
    });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() {
        socket.emit('user:typing', {
            receiverId: selectedContact.userId,
            isTyping: false
        });
    }, 1000);
});

function showTypingIndicator(isTyping) {
    if (isTyping) {
        typingIndicator.classList.add('active');
        chatStatus.style.display = 'none';
    } else {
        typingIndicator.classList.remove('active');
        chatStatus.style.display = 'block';
    }
}

function showRecordingIndicator(isRec) {
    if (isRec) {
        recordingIndicator.classList.add('active');
        chatStatus.style.display = 'none';
    } else {
        recordingIndicator.classList.remove('active');
        chatStatus.style.display = 'block';
    }
}

// Emoji Picker
emojiBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    emojiPicker.classList.toggle('active');
    attachmentMenu.classList.remove('active');
});

document.addEventListener('click', function(e) {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.classList.remove('active');
    }
    if (!attachmentMenu.contains(e.target) && e.target !== attachmentBtn) {
        attachmentMenu.classList.remove('active');
    }
});

// Attachment Menu
attachmentBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    attachmentMenu.classList.toggle('active');
    emojiPicker.classList.remove('active');
});

document.querySelectorAll('.attachment-option').forEach(function(option) {
    option.addEventListener('click', function() {
        const type = option.dataset.type;
        attachmentMenu.classList.remove('active');
        
        if (type === 'document') {
            fileInput.click();
        } else if (type === 'photos') {
            imageInput.click();
        } else if (type === 'camera') {
            openCamera();
        } else if (type === 'location') {
            openLocationPicker();
        } else if (type === 'audio') {
            audioInput.click();
        } else if (type === 'contact') {
            shareContact();
        }
    });
});

// File Handling
fileInput.addEventListener('change', function(e) { handleFileSelect(e, 'file'); });
imageInput.addEventListener('change', function(e) { handleFileSelect(e, 'image'); });
videoInput.addEventListener('change', function(e) { handleFileSelect(e, 'video'); });
audioInput.addEventListener('change', function(e) { handleFileSelect(e, 'audio'); });

async function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const messageId = generateMessageId();
        const timestamp = new Date().toISOString();
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: e.target.result,
                    filename: file.name,
                    type: file.type,
                    userId: currentUser.userId
                })
            });
            
            const result = await response.json();
            
            const messageData = {
                messageId: messageId,
                senderId: currentUser.userId,
                receiverId: selectedContact.userId,
                content: '',
                timestamp: timestamp,
                sent: true,
                status: 'sent',
                type: type,
                mediaUrl: result.url,
                fileName: file.name,
                fileSize: file.size
            };
            
            storeAndSendMessage(messageData);
        } catch (err) {
            console.error('Upload error:', err);
            alert('Failed to upload file');
        }
    };
    
    reader.readAsDataURL(file);
    event.target.value = '';
}

// Audio Recording
btnRecord.addEventListener('mousedown', startRecording);
btnRecord.addEventListener('mouseup', stopRecording);
btnRecord.addEventListener('mouseleave', stopRecording);
btnRecord.addEventListener('touchstart', function(e) { e.preventDefault(); startRecording(); });
btnRecord.addEventListener('touchend', stopRecording);

async function startRecording() {
    if (isRecording) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = function() {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            sendAudioMessage(blob);
            stream.getTracks().forEach(function(track) { track.stop(); });
        };
        
        mediaRecorder.start();
        isRecording = true;
        btnRecord.classList.add('recording');
        btnRecord.innerHTML = '<i class="fas fa-stop"></i>';
        
        socket.emit('user:recording', {
            receiverId: selectedContact.userId,
            isRecording: true
        });
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access microphone. Please check permissions.');
    }
}

function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    mediaRecorder.stop();
    isRecording = false;
    btnRecord.classList.remove('recording');
    btnRecord.innerHTML = '<i class="fas fa-microphone"></i>';
    
    socket.emit('user:recording', {
        receiverId: selectedContact.userId,
        isRecording: false
    });
}

async function sendAudioMessage(blob) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        const messageId = generateMessageId();
        const timestamp = new Date().toISOString();
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: e.target.result,
                    filename: 'voice_message.webm',
                    type: 'audio/webm',
                    userId: currentUser.userId
                })
            });
            
            const result = await response.json();
            
            const messageData = {
                messageId: messageId,
                senderId: currentUser.userId,
                receiverId: selectedContact.userId,
                content: '',
                timestamp: timestamp,
                sent: true,
                status: 'sent',
                type: 'audio',
                mediaUrl: result.url,
                fileName: 'Voice message',
                fileSize: blob.size
            };
            
            storeAndSendMessage(messageData);
        } catch (err) {
            console.error('Upload error:', err);
        }
    };
    
    reader.readAsDataURL(blob);
}

// Location
function openLocationPicker() {
    locationPicker.classList.add('active');
}

closeLocationPicker.addEventListener('click', function() {
    locationPicker.classList.remove('active');
});

sendLocationBtn.addEventListener('click', function() {
    if (navigator.geolocation) {
        sendLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const messageId = generateMessageId();
                const timestamp = new Date().toISOString();
                
                const messageData = {
                    messageId: messageId,
                    senderId: currentUser.userId,
                    receiverId: selectedContact.userId,
                    content: '',
                    timestamp: timestamp,
                    sent: true,
                    status: 'sent',
                    type: 'location',
                    location: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        name: 'Current Location'
                    }
                };
                
                storeAndSendMessage(messageData);
                locationPicker.classList.remove('active');
                sendLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Send Current Location';
            },
            function(error) {
                alert('Could not get location: ' + error.message);
                sendLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Send Current Location';
            }
        );
    } else {
        alert('Geolocation is not supported by your browser');
    }
});

function openLocation(lat, lng) {
    window.open('https://www.google.com/maps?q=' + lat + ',' + lng, '_blank');
}

// Camera
function openCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = function(e) { handleFileSelect(e, 'image'); };
    input.click();
}

// Contact Sharing
function shareContact() {
    const contactName = prompt('Enter contact name:');
    const contactNumber = prompt('Enter contact number:');
    
    if (contactName && contactNumber) {
        const messageId = generateMessageId();
        const timestamp = new Date().toISOString();
        
        const messageData = {
            messageId: messageId,
            senderId: currentUser.userId,
            receiverId: selectedContact.userId,
            content: '👤 ' + contactName + '\n📱 ' + contactNumber,
            timestamp: timestamp,
            sent: true,
            status: 'sent',
            type: 'text'
        };
        
        storeAndSendMessage(messageData);
    }
}

// Image Preview
function openImagePreview(url) {
    previewImage.src = url;
    imagePreviewModal.classList.add('active');
}

closeImagePreview.addEventListener('click', function() {
    imagePreviewModal.classList.remove('active');
});

imagePreviewModal.addEventListener('click', function(e) {
    if (e.target === imagePreviewModal) {
        imagePreviewModal.classList.remove('active');
    }
});

// File Download
function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Settings
settingsBtn.addEventListener('click', function() {
    settingsModal.classList.add('active');
    loadSettings();
});

openSettings.addEventListener('click', function() {
    settingsModal.classList.add('active');
    loadSettings();
});

closeSettings.addEventListener('click', function() {
    settingsModal.classList.remove('active');
});

settingsModal.addEventListener('click', function(e) {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

function loadSettings() {
    document.getElementById('settingsAvatar').innerHTML = currentUser.avatar +
        '<div class="edit-overlay"><i class="fas fa-camera"></i></div>';
    document.getElementById('settingsName').value = currentUser.userName;
    document.getElementById('settingsStatus').value = currentUser.status || settings.status;
    
    if (settings.notifications) {
        document.getElementById('notificationsToggle').classList.add('active');
    } else {
        document.getElementById('notificationsToggle').classList.remove('active');
    }
    
    if (settings.readReceipts) {
        document.getElementById('readReceiptsToggle').classList.add('active');
    } else {
        document.getElementById('readReceiptsToggle').classList.remove('active');
    }
    
    if (settings.chatLock) {
        lockToggle.classList.add('active');
    } else {
        lockToggle.classList.remove('active');
    }
}

// Toggle switches
document.getElementById('notificationsToggle').addEventListener('click', function() {
    this.classList.toggle('active');
    settings.notifications = this.classList.contains('active');
    socket.emit('settings:update', { userId: currentUser.userId, settings: { notifications: settings.notifications } });
});

document.getElementById('readReceiptsToggle').addEventListener('click', function() {
    this.classList.toggle('active');
    settings.readReceipts = this.classList.contains('active');
    socket.emit('settings:update', { userId: currentUser.userId, settings: { readReceipts: settings.readReceipts } });
});

lockToggle.addEventListener('click', function() {
    if (!settings.chatLock) {
        const pin = prompt('Enter a 4-digit PIN to lock your chats:');
        if (pin && pin.length === 4 && /^\d+$/.test(pin)) {
            settings.chatLock = true;
            settings.pin = pin;
            localStorage.setItem('chatPin', pin);
            this.classList.add('active');
            socket.emit('lock:set', { userId: currentUser.userId, pin: pin, enabled: true });
        } else if (pin) {
            alert('PIN must be exactly 4 digits');
        }
    } else {
        const pin = prompt('Enter your current PIN to disable lock:');
        if (pin === settings.pin) {
            settings.chatLock = false;
            settings.pin = null;
            localStorage.removeItem('chatPin');
            this.classList.remove('active');
            socket.emit('lock:set', { userId: currentUser.userId, pin: null, enabled: false });
        } else if (pin) {
            alert('Incorrect PIN');
        }
    }
});

// Lock Screen
const pinInputs = document.querySelectorAll('.pin-digit');
pinInputs.forEach(function(input, index) {
    input.addEventListener('input', function(e) {
        if (e.target.value && index < pinInputs.length - 1) {
            pinInputs[index + 1].focus();
        }
        
        const pin = Array.from(pinInputs).map(function(i) { return i.value; }).join('');
        if (pin.length === 4) {
            socket.emit('lock:verify', { userId: currentUser.userId, pin: pin });
        }
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            pinInputs[index - 1].focus();
        }
    });
});

// Welcome Message
function showWelcomeMessage(message) {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = '<div class="welcome-content">' +
        '<i class="fas fa-lock"></i>' +
        '<span>' + message + '</span>' +
        '</div>';
    messagesContainer.insertBefore(welcomeDiv, messagesContainer.firstChild);
}

// Notifications
function showNotification(data) {
    if (!settings.notifications) return;
    
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.senderName, {
            body: data.preview,
            icon: '/favicon.ico'
        });
    }
}

// Request notification permission
if ('Notification' in window) {
    Notification.requestPermission();
}

// Back Button (Mobile)
backBtn.addEventListener('click', function() {
    chatArea.classList.remove('active');
    sidebar.style.display = 'flex';
    selectedContact = null;
});

// Search Contacts
searchInput.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.contact-item').forEach(function(item) {
        const name = item.querySelector('.contact-name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
});

// Window Resize
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        sidebar.style.display = 'flex';
        if (selectedContact) {
            chatArea.style.display = 'flex';
        }
    }
});

// Make functions globally available
window.openImagePreview = openImagePreview;
window.downloadFile = downloadFile;
window.openLocation = openLocation;

console.log('WhatsApp Clone initialized with all features');
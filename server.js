const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create uploads directory if not exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Store connected users and their socket IDs
const connectedUsers = new Map();
const userSockets = new Map();
const messageStatus = new Map();
const userSettings = new Map(); // userId -> settings
const userLocks = new Map(); // userId -> { locked, pin }
const welcomeMessages = new Map(); // chatId -> welcome sent

// Route for main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// File upload endpoint
app.post('/upload', (req, res) => {
    try {
        const { file, filename, type, userId } = req.body;
        
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        
        const fileBuffer = Buffer.from(file.split(',')[1] || file, 'base64');
        const fileExtension = filename.split('.').pop();
        const newFilename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
        const filePath = path.join(uploadsDir, newFilename);
        
        fs.writeFileSync(filePath, fileBuffer);
        
        res.json({ 
            success: true, 
            url: `/uploads/${newFilename}`,
            filename: newFilename
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User login/registration
    socket.on('user:join', (userData) => {
        const { userId, userName, avatar, status } = userData;
        
        // Initialize user settings if not exists
        if (!userSettings.has(userId)) {
            userSettings.set(userId, {
                notifications: true,
                readReceipts: true,
                privacy: 'everyone',
                status: 'Hey there! I am using WhatsApp'
            });
        }
        
        // Store user connection
        connectedUsers.set(userId, {
            socketId: socket.id,
            userName: userName,
            avatar: avatar || '👤',
            status: status || 'Hey there! I am using WhatsApp',
            isOnline: true,
            lastSeen: new Date()
        });
        userSockets.set(socket.id, userId);
        
        // Broadcast user online status
        io.emit('user:online', { 
            userId, 
            userName, 
            avatar, 
            isOnline: true,
            status: status || 'Hey there! I am using WhatsApp'
        });
        
        // Send updated user list
        const usersList = Array.from(connectedUsers.entries()).map(([id, data]) => ({
            userId: id,
            userName: data.userName,
            avatar: data.avatar,
            status: data.status,
            isOnline: data.isOnline,
            lastSeen: data.lastSeen
        }));
        io.emit('users:list', usersList);
        
        console.log(`User ${userName} (${userId}) joined`);
    });

    // Handle new message (text, image, video, audio, file, location)
    socket.on('message:send', (messageData) => {
        const { messageId, senderId, receiverId, content, timestamp, type, mediaUrl, location, fileName, fileSize } = messageData;
        
        const msgData = {
            status: 'sent',
            senderId,
            receiverId,
            content,
            timestamp,
            type: type || 'text',
            mediaUrl,
            location,
            fileName,
            fileSize
        };
        
        messageStatus.set(messageId, msgData);

        // Send acknowledgment to sender (single tick)
        socket.emit('message:sent', { messageId, status: 'sent' });

        // Check if receiver is online
        const receiver = connectedUsers.get(receiverId);
        if (receiver && receiver.isOnline) {
            io.to(receiver.socketId).emit('message:receive', {
                messageId,
                senderId,
                receiverId,
                content,
                timestamp,
                status: 'delivered',
                type: type || 'text',
                mediaUrl,
                location,
                fileName,
                fileSize
            });

            messageStatus.set(messageId, { ...msgData, status: 'delivered' });
            socket.emit('message:delivered', { messageId, status: 'delivered' });
            
            // Send notification if user is not viewing this chat
            io.to(receiver.socketId).emit('notification:new', {
                type: type || 'text',
                senderId,
                senderName: connectedUsers.get(senderId)?.userName || 'User',
                preview: getPreviewText(type, content),
                messageId
            });
        }
    });

    // Handle message read (blue ticks)
    socket.on('message:read', (data) => {
        const { messageId, senderId } = data;
        const userId = userSockets.get(socket.id);
        
        const msgData = messageStatus.get(messageId);
        if (msgData) {
            messageStatus.set(messageId, { ...msgData, status: 'read' });

            const sender = connectedUsers.get(senderId);
            if (sender) {
                io.to(sender.socketId).emit('message:read', { messageId, status: 'read' });
            }
        }
    });

    // Handle user typing
    socket.on('user:typing', (data) => {
        const { receiverId, isTyping } = data;
        const receiver = connectedUsers.get(receiverId);
        const userId = userSockets.get(socket.id);
        
        if (receiver && userId) {
            io.to(receiver.socketId).emit('user:typing', { senderId: userId, isTyping });
        }
    });

    // Handle recording audio
    socket.on('user:recording', (data) => {
        const { receiverId, isRecording } = data;
        const receiver = connectedUsers.get(receiverId);
        const userId = userSockets.get(socket.id);
        
        if (receiver && userId) {
            io.to(receiver.socketId).emit('user:recording', { senderId: userId, isRecording });
        }
    });

    // Handle chat open (mark previous messages as read)
    socket.on('chat:open', (data) => {
        const { senderId } = data;
        const userId = userSockets.get(socket.id);
        
        messageStatus.forEach((msg, msgId) => {
            if (msg.senderId === senderId && msg.receiverId === userId && msg.status !== 'read') {
                messageStatus.set(msgId, { ...msg, status: 'read' });
                
                const originalSender = connectedUsers.get(senderId);
                if (originalSender) {
                    io.to(originalSender.socketId).emit('message:read', { 
                        messageId: msgId, 
                        status: 'read' 
                    });
                }
            }
        });
    });

    // Handle settings update
    socket.on('settings:update', (data) => {
        const { userId, settings } = data;
        userSettings.set(userId, { ...userSettings.get(userId), ...settings });
        socket.emit('settings:updated', userSettings.get(userId));
    });

    // Get user settings
    socket.on('settings:get', (userId) => {
        const settings = userSettings.get(userId) || {
            notifications: true,
            readReceipts: true,
            privacy: 'everyone',
            status: 'Hey there! I am using WhatsApp'
        };
        socket.emit('settings:updated', settings);
    });

    // Handle chat lock
    socket.on('lock:set', (data) => {
        const { userId, pin, enabled } = data;
        userLocks.set(userId, { locked: enabled, pin });
        socket.emit('lock:updated', { success: true, locked: enabled });
    });

    // Verify lock PIN
    socket.on('lock:verify', (data) => {
        const { userId, pin } = data;
        const lockData = userLocks.get(userId);
        
        if (!lockData || !lockData.locked) {
            socket.emit('lock:verified', { success: true });
        } else if (lockData.pin === pin) {
            socket.emit('lock:verified', { success: true });
        } else {
            socket.emit('lock:verified', { success: false, message: 'Incorrect PIN' });
        }
    });

    // Handle welcome message for new users
    socket.on('welcome:check', (data) => {
        const { chatId } = data;
        const userId = userSockets.get(socket.id);
        
        if (!welcomeMessages.has(chatId)) {
            welcomeMessages.set(chatId, true);
            socket.emit('welcome:show', {
                message: 'Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.'
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const userId = userSockets.get(socket.id);
        
        if (userId) {
            const userData = connectedUsers.get(userId);
            if (userData) {
                userData.isOnline = false;
                userData.lastSeen = new Date();
                
                io.emit('user:offline', { 
                    userId, 
                    lastSeen: userData.lastSeen 
                });
            }
            
            userSockets.delete(socket.id);
            console.log(`User ${userId} disconnected`);
        }
    });
});

// Helper function to get preview text based on message type
function getPreviewText(type, content) {
    switch (type) {
        case 'image': return '📷 Photo';
        case 'video': return '🎬 Video';
        case 'audio': return '🎤 Voice message';
        case 'file': return '📎 File';
        case 'location': return '📍 Location';
        default: return content.substring(0, 30);
    }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`WhatsApp Chat App running on port ${PORT}`);
});
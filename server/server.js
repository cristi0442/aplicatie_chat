require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
// IMPORTANT PENTRU RENDER: Folosim portul dat de ei sau 3001 local
const PORT = process.env.PORT || 3001;

// Configurare Middleware
app.use(cors());
app.use(express.json());

// Configurare Baza de Date (PostgreSQL / Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necesar pentru conexiuni cloud securizate
    }
});

// Secretul pentru Token (ideal ar fi in .env, dar il lasam aici pentru simplitate)
const JWT_SECRET = process.env.JWT_SECRET || "secretul_tau_super_secret";

// Creare Server HTTP și Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Permite conexiuni de oriunde (Vercel, Localhost, Telefon)
        methods: ["GET", "POST"]
    }
});

// --- RUTE DE AUTENTIFICARE ---

// 1. REGISTER
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Verificam daca userul exista deja
        const checkUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: "Username-ul este deja folosit." });
        }

        // Criptam parola
        const hashedPassword = await bcrypt.hash(password, 10);

        // Inseram in baza de date
        const newUser = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );

        res.status(201).json({ message: "Cont creat cu succes!" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Eroare server la inregistrare");
    }
});

// 2. LOGIN (MODIFICAT CU PROTECTIE ANTI-CRASH)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Utilizatorul nu există." });
        }

        const user = result.rows[0];

        // --- PROTECTIE CRITICA ---
        // Daca userul nu are parola (e.g. cont vechi corupt), returnam eroare clara fara sa dam crash
        if (!user.password) {
            console.error(`Eroare: Userul ${username} (ID: ${user.id}) nu are parola setata in DB.`);
            return res.status(500).json({ message: "Cont invalid (fara parola). Te rog creeaza un cont nou." });
        }
        // -------------------------

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: "Parolă incorectă." });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ token, user: { id: user.id, username: user.username } });

    } catch (err) {
        console.error("Eroare Login:", err);
        res.status(500).send("Eroare server la login");
    }
});

// Middleware pentru verificare Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- RUTE PENTRU CHAT ---

// 3. START CONVERSATIE (sau gaseste una existenta)
app.post('/conversations/start', authenticateToken, async (req, res) => {
    const { otherUserId } = req.body;
    const myId = req.user.id;

    try {
        // Pas 1: Creare conversatie
        const convoRes = await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
        const conversationId = convoRes.rows[0].id;

        // Pas 2: Adaugare participanti
        await pool.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)', [conversationId, myId]);
        await pool.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)', [conversationId, otherUserId]);

        // Pas 3: Luam detaliile despre celalalt user pentru a le trimite inapoi
        const otherUserRes = await pool.query('SELECT id, username FROM users WHERE id = $1', [otherUserId]);
        const otherUser = otherUserRes.rows[0];

        res.json({
            createdNew: true,
            conversationId: conversationId,
            participanti: [otherUser]
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Eroare la crearea conversatiei");
    }
});

// 4. LISTA CONVERSATIILE MELE
app.get('/my-conversations', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const query = `
            SELECT c.id as "conversatieId", c.name as "nume_conversatie"
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = $1
            ORDER BY c.created_at DESC
        `;
        const result = await pool.query(query, [userId]);
        
        const conversatii = [];
        for (let convo of result.rows) {
            const partRes = await pool.query(`
                SELECT u.id, u.username 
                FROM users u 
                JOIN conversation_participants cp ON u.id = cp.user_id 
                WHERE cp.conversation_id = $1 AND u.id != $2
            `, [convo.conversatieId, userId]);
            
            conversatii.push({
                ...convo,
                participanti: partRes.rows
            });
        }

        res.json(conversatii);
    } catch (err) {
        console.error(err);
        res.status(500).send("Eroare la fetch conversatii");
    }
});

// 5. ISTORIC MESAJE
app.get('/messages/:conversationId', authenticateToken, async (req, res) => {
    const { conversationId } = req.params;
    try {
        const result = await pool.query(`
            SELECT m.id, m.content as text, m.created_at, m.user_id as sender_id, u.username as sender_name
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC
        `, [conversationId]);

        const mesaje = result.rows.map(m => ({
            id: m.id,
            text: m.text,
            sender: m.sender_name,
            sender_id: m.sender_id,
            conversatie_id: parseInt(conversationId)
        }));

        res.json(mesaje);
    } catch (err) {
        console.error(err);
        res.status(500).send("Eroare la fetch mesaje");
    }
});

// --- SOCKET.IO (Real-time) ---
let onlineUsers = {}; 

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return next(new Error("Authentication error"));
        socket.user = user;
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`User conectat: ${socket.user.username} (ID: ${socket.user.id})`);
    
    onlineUsers[socket.user.id] = socket.id;
    io.emit('updateOnlineUsers', onlineUsers);

    socket.on('sendMessage', async (data) => {
        const { conversationId, text } = data;
        const senderId = socket.user.id;

        try {
            const insertRes = await pool.query(
                'INSERT INTO messages (conversation_id, user_id, content) VALUES ($1, $2, $3) RETURNING id, created_at',
                [conversationId, senderId, text]
            );
            const msgData = insertRes.rows[0];

            const messageToSend = {
                id: msgData.id,
                text: text,
                sender: socket.user.username,
                sender_id: senderId,
                conversatie_id: conversationId,
                created_at: msgData.created_at
            };

            io.emit('newMessage', messageToSend);

        } catch (err) {
            console.error("Eroare trimitere mesaj socket:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User deconectat: ${socket.user.username}`);
        delete onlineUsers[socket.user.id];
        io.emit('updateOnlineUsers', onlineUsers);
    });
});

// START SERVER
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

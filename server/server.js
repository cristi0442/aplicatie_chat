const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const authMiddleware = require('./authMiddleware');

const app = express();
app.use(express.json());
// Permitem accesul de oriunde (pentru Vercel/Localhost)
app.use(cors({ origin: "*" }));

const server = http.createServer(app);

// Configurare Socket.io pentru Render (timeout-uri marite) si poze mari
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8, // 100 MB pentru poze
    pingTimeout: 60000,     // Fix pentru Problema 7 (Render disconnects)
    pingInterval: 25000
});

// CONEXIUNEA TA NEON DB
const NEON_CONNECTION_STRING = "postgresql://neondb_owner:npg_Kgoh7rQ2pFWO@ep-soft-paper-ahy8s9hx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123";

// --- RUTE AUTH ---
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Date incomplete" });

        const salt = await bcrypt.genSalt(10);
        const parolaHash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            "INSERT INTO utilizatori (username, password) VALUES ($1, $2) RETURNING id, username",
            [username, parolaHash]
        );
        res.status(201).json({ message: "Cont creat", user: result.rows[0] });
    } catch (err) { 
        console.error(err); 
        res.status(500).json({ message: "Eroare server" }); 
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query("SELECT * FROM utilizatori WHERE username = $1", [username]);
        
        if (result.rows.length === 0) return res.status(400).json({ message: "User inexistent" });
        const user = result.rows[0];

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ message: "Parola gresita" });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: "Login OK", token, user: { id: user.id, username: user.username } });
    } catch (err) { 
        console.error(err); 
        res.status(500).json({ message: "Eroare server" }); 
    }
});

// --- RUTE CHAT ---

app.get('/my-conversations', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT c.id as "conversatieId", c.nume_conversatie 
            FROM conversatii c
            JOIN participanti p ON c.id = p.conversatie_id
            WHERE p.utilizator_id = $1
        `, [userId]);

        const conversatii = result.rows;
        for (let conv of conversatii) {
            const parts = await pool.query(`
                SELECT u.username FROM utilizatori u
                JOIN participanti p ON u.id = p.utilizator_id
                WHERE p.conversatie_id = $1
            `, [conv.conversatieId]);
            conv.participanti = parts.rows;
        }
        res.json(conversatii);
    } catch (err) { console.error(err); res.status(500).json({ message: "Err" }); }
});

app.post('/conversations/start', authMiddleware, async (req, res) => {
    const myId = req.user.id;
    const otherId = req.body.otherUserId;
    if (!otherId) return res.status(400).json({ message: "Lipseste ID user" });

    try {
        // Fix Problema 5: Verifica daca exista deja (optional, dar mai simplu e sa cream una noua momentan ca sa nu complicam)
        // Cream conversatia
        const newConv = await pool.query("INSERT INTO conversatii (nume_conversatie) VALUES (NULL) RETURNING id", []);
        const convId = newConv.rows[0].id;
        
        // Adaugam participantii
        await pool.query("INSERT INTO participanti (conversatie_id, utilizator_id) VALUES ($1, $2), ($1, $3)", [convId, myId, otherId]);
        
        // Important: Trebuie sa anuntam socket-urile sa intre in camera noua, dar e mai simplu sa dam refresh la frontend.
        res.json({ conversationId: convId });
    } catch (err) { console.error(err); res.status(500).json({ message: "Err" }); }
});

app.get('/messages/:room', authMiddleware, async (req, res) => {
    try {
        const { room } = req.params;
        // Fix Problema 3: Schema DB veche
        const result = await pool.query(`
            SELECT m.continut as message, u.username as author, m.data_trimiterii as time
            FROM mesaje m
            JOIN utilizatori u ON m.expeditor_id = u.id
            WHERE m.conversatie_id = $1
            ORDER BY m.data_trimiterii ASC
        `, [room]);
        
        res.json(result.rows);
    } catch (err) { console.error(err); res.status(500).json({ message: "Err" }); }
});

// --- SOCKET.IO LOGIC ---
let onlineUsers = {};

io.on('connection', async (socket) => {
    const token = socket.handshake.auth.token;
    let userId = null;
    let username = null;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
            username = decoded.username;
            
            // Fix Problema 6: Salvam si username-ul
            onlineUsers[userId] = { socketId: socket.id, username };
            
            // Fix Problema 2: JOIN ROOMS
            // Utilizatorul intra automat in toate camerele lui de conversatie existente in DB
            const myConvos = await pool.query('SELECT conversatie_id FROM participanti WHERE utilizator_id = $1', [userId]);
            myConvos.rows.forEach(c => {
                socket.join(String(c.conversatie_id));
                console.log(`User ${username} joined room ${c.conversatie_id}`);
            });

        } catch (e) { console.error("Socket Auth Error", e); }
    }

    // Trimitem lista de useri catre frontend
    io.emit('updateOnlineUsers', Object.fromEntries(Object.entries(onlineUsers).map(([id, d]) => [id, d.username])));

    socket.on('send_message', async (data) => {
        // data: { room, author, message, type, time }
        try {
            // Salvam in DB (Fix Problema 3: tabela 'mesaje')
            await pool.query(
                `INSERT INTO mesaje (continut, expeditor_id, conversatie_id) VALUES ($1, $2, $3)`,
                [data.message, userId, data.room]
            );
            
            // Fix Problema 1: Trimitem DOAR in camera specifica
            io.to(String(data.room)).emit('receive_message', data);
            
        } catch (e) { console.error("Send Msg Error", e); }
    });

    socket.on('disconnect', () => {
        if (userId) delete onlineUsers[userId];
        io.emit('updateOnlineUsers', Object.fromEntries(Object.entries(onlineUsers).map(([id, d]) => [id, d.username])));
    });
});

<<<<<<< HEAD
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
=======
// START SERVER
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
>>>>>>> 2a8e47130eac7ac14bb58b3e2d2fdacb7740f55f

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
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const NEON_CONNECTION_STRING = "postgresql://neondb_owner:npg_Kgoh7rQ2pFWO@ep-soft-paper-ahy8s9hx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
});

const PORT = 3001;
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123";


// 1. Inregistrare
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Date incomplete" });

        const salt = await bcrypt.genSalt(10);
        const parolaHash = await bcrypt.hash(password, salt);
        const query = `INSERT INTO utilizatori (username, parola_hash) VALUES ($1, $2) RETURNING id, username`;
        const result = await pool.query(query, [username, parolaHash]);

        res.status(201).json({ message: "Utilizator creat!", user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: "Username deja folosit." });
        console.error("Register Error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// 2. Login
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const query = `SELECT * FROM utilizatori WHERE username = $1`;
        const result = await pool.query(query, [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.parola_hash))) {
            return res.status(401).json({ message: "Date incorecte." });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ message: "Login OK", token, user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// 3. Conversatiile Mele
app.get('/my-conversations', authMiddleware, async (req, res) => {
    try {
        const myUserId = req.user.userId;
        const query = `
            SELECT
                c.id as "conversatieId",
                c.nume_conversatie,
                json_agg(json_build_object('userId', u.id, 'username', u.username)) as participanti
            FROM conversatii c
                     JOIN participanti p_me ON c.id = p_me.conversatie_id
                     JOIN participanti p_all ON c.id = p_all.conversatie_id
                     JOIN utilizatori u ON u.id = p_all.utilizator_id
            WHERE p_me.utilizator_id = $1
            GROUP BY c.id, c.nume_conversatie;
        `;
        const result = await pool.query(query, [myUserId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("My Conversations Error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

async function getConversationParticipants(conversationId) {
    const query = `SELECT u.id as "userId", u.username FROM participanti p JOIN utilizatori u ON u.id = p.utilizator_id WHERE p.conversatie_id = $1`;
    const result = await pool.query(query, [conversationId]);
    return result.rows;
}

// 4. Start / Find Conversatie
app.post('/conversations/start', authMiddleware, async (req, res) => {
    const { otherUserId } = req.body;
    const myUserId = req.user.userId;

    try {
        const findQuery = `
            SELECT conversatie_id FROM participanti p1
            WHERE p1.utilizator_id = $1
              AND EXISTS (SELECT 1 FROM participanti p2 WHERE p2.conversatie_id = p1.conversatie_id AND p2.utilizator_id = $2)
              AND (SELECT COUNT(*) FROM participanti p3 WHERE p3.conversatie_id = p1.conversatie_id) = 2
                LIMIT 1;
        `;
        const existingConvo = await pool.query(findQuery, [myUserId, parseInt(otherUserId)]);

        if (existingConvo.rows.length > 0) {
            const convoId = existingConvo.rows[0].conversatie_id;
            const participanti = await getConversationParticipants(convoId);
            return res.status(200).json({ conversationId: convoId, createdNew: false, participanti });
        }

        const newConvoResult = await pool.query(`INSERT INTO conversatii DEFAULT VALUES RETURNING id`);
        const newConvoId = newConvoResult.rows[0].id;

        await pool.query(`INSERT INTO participanti (utilizator_id, conversatie_id) VALUES ($1, $3), ($2, $3)`, [myUserId, parseInt(otherUserId), newConvoId]);
        try {
            const mySock = onlineUsers[myUserId]?.socketId;
            const otherSock = onlineUsers[parseInt(otherUserId)]?.socketId;
            if (mySock) io.sockets.sockets.get(mySock)?.join(String(newConvoId));
            if (otherSock) io.sockets.sockets.get(otherSock)?.join(String(newConvoId));
        } catch(e) { console.log("Socket join error", e); }

        const participanti = await getConversationParticipants(newConvoId);
        res.status(201).json({ conversationId: newConvoId, createdNew: true, participanti });

    } catch (err) {
        console.error("Start Convo Error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// 5. ISTORIC MESAJE (MODIFICAT PENTRU SIGURANTA)
app.get('/messages/:conversationId', authMiddleware, async (req, res) => {
    try {
        const { conversationId } = req.params;

        const query = `SELECT * FROM mesaje WHERE conversatie_id = $1 ORDER BY id ASC`;

        const result = await pool.query(query, [conversationId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Get Messages Error:", err);
        res.status(500).json({ message: "Eroare server la mesaje" });
    }
});

// --- SOCKET.IO ---
const onlineUsers = {};

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) { socket.user = user; next(); }
            else next(new Error('Auth Error'));
        });
    } else next(new Error('No Token'));
});

io.on('connection', async (socket) => {
    const { userId, username } = socket.user;
    onlineUsers[userId] = { username, socketId: socket.id };
    io.emit('updateOnlineUsers', Object.fromEntries(Object.entries(onlineUsers).map(([id, d]) => [id, d.username])));

    const myConvos = await pool.query('SELECT conversatie_id FROM participanti WHERE utilizator_id = $1', [userId]);
    myConvos.rows.forEach(c => socket.join(String(c.conversatie_id)));

    socket.on('sendMessage', async (data) => {
        try {
            const res = await pool.query(
                `INSERT INTO mesaje (continut, expeditor_id, conversatie_id) VALUES ($1, $2, $3) RETURNING *`,
                [data.continut, userId, data.conversatieId]
            );
            io.to(String(data.conversatieId)).emit('newMessage', res.rows[0]);
        } catch (e) { console.error("Send Msg Error", e); }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[userId];
        io.emit('updateOnlineUsers', Object.fromEntries(Object.entries(onlineUsers).map(([id, d]) => [id, d.username])));
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
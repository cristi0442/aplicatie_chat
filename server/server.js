require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

/* ===================== MIDDLEWARE ===================== */
app.use(cors());
app.use(express.json());

/* ===================== DATABASE ===================== */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

/* ===================== JWT ===================== */
const JWT_SECRET = process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY_123";

/* ===================== SERVER + SOCKET ===================== */
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

/* ===================== AUTH MIDDLEWARE ===================== */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user; // { userId, username }
        next();
    });
};

/* ===================== REGISTER ===================== */
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ message: "Date incomplete" });

        const exists = await pool.query(
            'SELECT 1 FROM utilizatori WHERE username = $1',
            [username]
        );
        if (exists.rows.length > 0)
            return res.status(400).json({ message: "Username deja folosit." });

        const parolaHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO utilizatori (username, parola_hash)
             VALUES ($1, $2) RETURNING id, username`,
            [username, parolaHash]
        );

        res.status(201).json({
            message: "Cont creat cu succes",
            user: result.rows[0]
        });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

/* ===================== LOGIN ===================== */
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await pool.query(
            'SELECT * FROM utilizatori WHERE username = $1',
            [username]
        );

        const user = result.rows[0];
        if (!user)
            return res.status(401).json({ message: "Date incorecte" });

        const valid = await bcrypt.compare(password, user.parola_hash);
        if (!valid)
            return res.status(401).json({ message: "Date incorecte" });

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

/* ===================== START / FIND CONVERSATION ===================== */
app.post('/conversations/start', authenticateToken, async (req, res) => {
    const { otherUserId } = req.body;
    const myId = req.user.userId;

    try {
        const findQuery = `
            SELECT conversatie_id FROM participanti p1
            WHERE p1.utilizator_id = $1
              AND EXISTS (
                SELECT 1 FROM participanti p2
                WHERE p2.conversatie_id = p1.conversatie_id
                AND p2.utilizator_id = $2
              )
              AND (
                SELECT COUNT(*) FROM participanti p3
                WHERE p3.conversatie_id = p1.conversatie_id
              ) = 2
            LIMIT 1
        `;

        const existing = await pool.query(findQuery, [myId, otherUserId]);

        if (existing.rows.length > 0) {
            return res.json({
                conversationId: existing.rows[0].conversatie_id,
                createdNew: false
            });
        }

        const convo = await pool.query(
            'INSERT INTO conversatii DEFAULT VALUES RETURNING id'
        );
        const convoId = convo.rows[0].id;

        await pool.query(
            `INSERT INTO participanti (utilizator_id, conversatie_id)
             VALUES ($1, $3), ($2, $3)`,
            [myId, otherUserId, convoId]
        );

        res.status(201).json({
            conversationId: convoId,
            createdNew: true
        });
    } catch (err) {
        console.error("Start conversation error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

/* ===================== MY CONVERSATIONS ===================== */
app.get('/my-conversations', authenticateToken, async (req, res) => {
    try {
        const myId = req.user.userId;
        const query = `
            SELECT
                c.id as "conversatieId",
                json_agg(json_build_object(
                    'id', u.id,
                    'username', u.username
                )) as participanti
            FROM conversatii c
            JOIN participanti p_me ON c.id = p_me.conversatie_id
            JOIN participanti p_all ON c.id = p_all.conversatie_id
            JOIN utilizatori u ON u.id = p_all.utilizator_id
            WHERE p_me.utilizator_id = $1
            GROUP BY c.id
        `;
        const result = await pool.query(query, [myId]);
        res.json(result.rows);
    } catch (err) {
        console.error("My conversations error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

/* ===================== MESSAGES ===================== */
app.get('/messages/:conversationId', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const result = await pool.query(
            `SELECT * FROM mesaje
             WHERE conversatie_id = $1
             ORDER BY id ASC`,
            [conversationId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Messages error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

/* ===================== SOCKET.IO ===================== */
const onlineUsers = {};

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return next(new Error("Invalid token"));
        socket.user = user; // { userId, username }
        next();
    });
});

io.on('connection', async (socket) => {
    const { userId } = socket.user;
    onlineUsers[userId] = socket.id;

    const myConvos = await pool.query(
        'SELECT conversatie_id FROM participanti WHERE utilizator_id = $1',
        [userId]
    );
    myConvos.rows.forEach(c =>
        socket.join(String(c.conversatie_id))
    );

    socket.on('sendMessage', async ({ conversatieId, continut }) => {
        try {
            const result = await pool.query(
                `INSERT INTO mesaje (continut, expeditor_id, conversatie_id)
                 VALUES ($1, $2, $3) RETURNING *`,
                [continut, userId, conversatieId]
            );
            io.to(String(conversatieId)).emit('newMessage', result.rows[0]);
        } catch (err) {
            console.error("Send message error:", err);
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[userId];
    });
});

/* ===================== START SERVER ===================== */
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

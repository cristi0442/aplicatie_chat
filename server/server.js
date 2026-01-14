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
app.use(cors({ origin: "*" }));

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    pingInterval: 25000
});

// =======================
// 🔹 DATABASE
// =======================
const NEON_CONNECTION_STRING =
    "postgresql://neondb_owner:npg_Kgoh7rQ2pFWO@ep-soft-paper-ahy8s9hx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123";

// =======================
// 🔹 AUTH
// =======================
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ message: "Date incomplete" });

        const salt = await bcrypt.genSalt(10);
        const parolaHash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            "INSERT INTO utilizatori (username, parola_hash) VALUES ($1, $2) RETURNING id, username",
            [username, parolaHash]
        );

        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ message: "Username existent" });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await pool.query(
            "SELECT * FROM utilizatori WHERE username = $1",
            [username]
        );

        if (result.rows.length === 0)
            return res.status(400).json({ message: "User inexistent" });

        const user = result.rows[0];
        const validPass = await bcrypt.compare(password, user.parola_hash);

        if (!validPass)
            return res.status(400).json({ message: "Parola gresita" });

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// =======================
// 🔹 CONVERSATII
// =======================
app.get('/my-conversations', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(`
            SELECT c.id AS "conversatieId"
            FROM conversatii c
            JOIN participanti p ON c.id = p.conversatie_id
            WHERE p.utilizator_id = $1
        `, [userId]);

        const conversatii = result.rows;

        for (const conv of conversatii) {
            const parts = await pool.query(`
                SELECT u.username
                FROM utilizatori u
                JOIN participanti p ON u.id = p.utilizator_id
                WHERE p.conversatie_id = $1
            `, [conv.conversatieId]);

            conv.participanti = parts.rows;
        }

        res.json(conversatii);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// 🔥 ENDPOINT CORECTAT
app.post('/conversations/start', authMiddleware, async (req, res) => {
    const myId = req.user.id;
    const otherId = Number(req.body.otherUserId);

    if (!otherId)
        return res.status(400).json({ message: "Lipseste ID user" });

    try {
        // 1️⃣ verificam daca exista deja conversatia
        const existing = await pool.query(`
            SELECT c.id
            FROM conversatii c
            JOIN participanti p1 ON c.id = p1.conversatie_id
            JOIN participanti p2 ON c.id = p2.conversatie_id
            WHERE p1.utilizator_id = $1
              AND p2.utilizator_id = $2
            LIMIT 1
        `, [myId, otherId]);

        if (existing.rows.length > 0) {
            return res.json({
                conversationId: existing.rows[0].id,
                alreadyExists: true
            });
        }

        // 2️⃣ cream conversatia
        const newConv = await pool.query(
            "INSERT INTO conversatii (nume_conversatie) VALUES (NULL) RETURNING id"
        );

        const convId = newConv.rows[0].id;

        await pool.query(
            "INSERT INTO participanti (conversatie_id, utilizator_id) VALUES ($1,$2),($1,$3)",
            [convId, myId, otherId]
        );

        res.json({
            conversationId: convId,
            alreadyExists: false
        });

    } catch (err) {
        console.error("Conversation Start Error:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// =======================
// 🔹 MESAJE
// =======================
app.get('/messages/:room', authMiddleware, async (req, res) => {
    try {
        const { room } = req.params;

        const result = await pool.query(`
            SELECT m.continut AS message,
                   u.username AS author,
                   m.trimis_la AS time
            FROM mesaje m
            JOIN utilizatori u ON m.expeditor_id = u.id
            WHERE m.conversatie_id = $1
            ORDER BY m.trimis_la ASC
        `, [room]);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// =======================
// 🔹 SOCKET.IO
// =======================
let onlineUsers = {};

io.on('connection', async (socket) => {
    const token = socket.handshake.auth.token;
    let userId = null;
    let username = null;

    try {
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
            username = decoded.username;

            onlineUsers[userId] = { socketId: socket.id, username };

            const rooms = await pool.query(
                'SELECT conversatie_id FROM participanti WHERE utilizator_id = $1',
                [userId]
            );

            rooms.rows.forEach(r => socket.join(String(r.conversatie_id)));
        }
    } catch (e) {
        console.error("Socket Auth Error:", e);
    }

    io.emit(
        'updateOnlineUsers',
        Object.fromEntries(
            Object.entries(onlineUsers).map(([id, u]) => [id, u.username])
        )
    );

    socket.on('join_room', room => socket.join(String(room)));

    socket.on('send_message', async (data) => {
        try {
            await pool.query(
                "INSERT INTO mesaje (continut, expeditor_id, conversatie_id) VALUES ($1,$2,$3)",
                [data.message, userId, data.room]
            );
            io.to(String(data.room)).emit('receive_message', data);
        } catch (e) {
            console.error("Send message error:", e);
        }
    });

    socket.on("startCall", ({ room, callerName, type }) => {
        socket.to(String(room)).emit("incomingCall", {
            callerName,
            room,
            type
        });
    });

    socket.on("endCall", ({ room }) => {
        socket.to(String(room)).emit("callEnded");
    });

    socket.on('disconnect', () => {
        if (userId) delete onlineUsers[userId];
        io.emit(
            'updateOnlineUsers',
            Object.fromEntries(
                Object.entries(onlineUsers).map(([id, u]) => [id, u.username])
            )
        );
    });
});

server.listen(PORT, () =>
    console.log(`✅ Server running on port ${PORT}`)
);

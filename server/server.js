// Importă pachetele
const express = require('express');
const http = require('http'); // Necesar pentru Socket.io
const { Server } = require("socket.io");
const { Pool } = require('pg'); // Clientul PostgreSQL
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const authMiddleware = require('./authMiddleware'); // Importăm gardianul

// --- Configurare ---
const app = express();
app.use(express.json()); // Permite serverului să citească JSON
app.use(cors()); // Permite cereri HTTP de la React
const server = http.createServer(app); 
const io = new Server(server, {
    cors: { origin: "*" }
});

// --- Configurare Conexiune Neon PostgreSQL ---
// !!! ASIGURĂ-TE CĂ AI ÎNLOCUIT CU STRING-UL TĂU !!!
const NEON_CONNECTION_STRING = "postgresql://neondb_owner:npg_Kgoh7rQ2pFWO@ep-soft-paper-ahy8s9hx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
    connectionString: NEON_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
});

const PORT = 3001; 
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123"; // Schimbă asta!

// --- Rutele de Autentificare (neprotejate) ---

// 1. Rută de ÎNREGISTRARE
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Username și parola sunt obligatorii" });
        }
        const salt = await bcrypt.genSalt(10);
        const parolaHash = await bcrypt.hash(password, salt);
        const query = `
            INSERT INTO utilizatori (username, parola_hash)
            VALUES ($1, $2)
            RETURNING id, username, creat_la;
        `;
        const result = await pool.query(query, [username, parolaHash]);
        res.status(201).json({ message: "Utilizator creat!", user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ message: "Acest username este deja folosit." });
        }
        console.error("Eroare la înregistrare:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// 2. Rută de LOGIN
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Username și parola sunt obligatorii" });
        }
        const query = `SELECT * FROM utilizatori WHERE username = $1`;
        const result = await pool.query(query, [username]);
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ message: "Utilizatorul nu a fost găsit." });
        }
        const match = await bcrypt.compare(password, user.parola_hash);
        if (!match) {
            return res.status(401).json({ message: "Parolă incorectă." });
        }
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.status(200).json({
            message: "Login reușit!",
            token: token,
            user: { id: user.id, username: user.username }
        });
    } catch (err) {
        console.error("Eroare la login:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// --- RUTE PROTEJATE (Necesită token) ---

// 3. Rută pentru a lua conversațiile utilizatorului logat
app.get('/my-conversations', authMiddleware, async (req, res) => {
    try {
        const myUserId = req.user.userId;
        const query = `
            SELECT 
                c.id as "conversatieId", c.nume_conversatie,
                COALESCE(
                    json_agg(json_build_object('id', u.id, 'username', u.username)) 
                    FILTER (WHERE p.utilizator_id != $1), 
                    '[]'
                ) as participanti
            FROM conversatii c
            JOIN participanti p ON c.id = p.conversatie_id
            LEFT JOIN participanti p_other ON c.id = p_other.conversatie_id AND p_other.utilizator_id != $1
            LEFT JOIN utilizatori u ON u.id = p_other.utilizator_id
            WHERE p.utilizator_id = $1
            GROUP BY c.id, c.nume_conversatie;
        `;
        const result = await pool.query(query, [myUserId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Eroare la preluarea conversațiilor:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// 4. Rută pentru a porni SAU a GĂSI o conversație (logica "find-or-create")
app.post('/conversations/start', authMiddleware, async (req, res) => {
    const { otherUserId } = req.body;
    const myUserId = req.user.userId;

    if (!otherUserId) {
        return res.status(400).json({ message: "ID-ul celuilalt utilizator lipsește" });
    }

    try {
        // PASUL 1: Caută o conversație 1-la-1 existentă
        const findQuery = `
            SELECT conversatie_id FROM participanti p1
            WHERE p1.utilizator_id = $1
            AND EXISTS (
                SELECT 1 FROM participanti p2
                WHERE p2.conversatie_id = p1.conversatie_id AND p2.utilizator_id = $2
            )
            AND (
                SELECT COUNT(*) FROM participanti p3
                WHERE p3.conversatie_id = p1.conversatie_id
            ) = 2
            LIMIT 1;
        `;
        
        const existingConvo = await pool.query(findQuery, [myUserId, parseInt(otherUserId)]);

        // PASUL 2: Verifică dacă am găsit ceva
        if (existingConvo.rows.length > 0) {
            // AM GĂSIT un chat existent.
            res.status(200).json({ 
                conversationId: existingConvo.rows[0].conversatie_id,
                createdNew: false
            });
        } else {
            // NU AM GĂSIT. Creăm un chat nou.
            
            // 1. Creează o nouă conversație
            const newConvoQuery = `INSERT INTO conversatii DEFAULT VALUES RETURNING id`;
            const convoResult = await pool.query(newConvoQuery);
            const newConversationId = convoResult.rows[0].id;
            
            // 2. Adaugă ambii participanți în DB
            const participantsQuery = `
                INSERT INTO participanti (utilizator_id, conversatie_id)
                VALUES ($1, $3), ($2, $3)
            `;
            await pool.query(participantsQuery, [myUserId, parseInt(otherUserId), newConversationId]);
            
            // 3. Forțăm socket-urile live să se alăture camerei
            try {
                // Găsește socket-ul creatorului
                const myUserSocketInfo = onlineUsers[myUserId];
                if (myUserSocketInfo) {
                    const mySocket = io.sockets.sockets.get(myUserSocketInfo.socketId);
                    if (mySocket) {
                        mySocket.join(String(newConversationId));
                    }
                }
                // Găsește socket-ul celuilalt utilizator
                const otherUserSocketInfo = onlineUsers[parseInt(otherUserId)];
                if (otherUserSocketInfo) {
                    const otherSocket = io.sockets.sockets.get(otherUserSocketInfo.socketId);
                    if (otherSocket) {
                        otherSocket.join(String(newConversationId));
                    }
                }
            } catch (joinErr) {
                console.error("Eroare la forțarea alăturării în cameră:", joinErr);
            }

            res.status(201).json({ 
                conversationId: newConversationId,
                createdNew: true
            });
        }
        
    } catch (err) {
        console.error("Eroare la pornirea/găsirea conversației:", err);
        res.status(500).json({ message: "Eroare server" });
    }
});


// --- Logica de Bază a Chat-ului (Socket.io) ---

// Stocăm și socket.id pentru a-i putea forța în camere
const onlineUsers = {}; // Format: { userId: { username: '...', socketId: '...' } }

// Middleware pentru autentificarea Socket.io
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Autentificare eșuată: Token lipsă'));

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return next(new Error('Autentificare eșuată: Token invalid'));
        socket.user = user;
        next();
    });
});

// Logica de conexiune
io.on('connection', async (socket) => {
    const userInfo = socket.user; 
    console.log(`Utilizator CONECTAT: ${userInfo.username} (Socket ID: ${socket.id})`);

    // 1. Adaugă utilizatorul la lista globală
    onlineUsers[userInfo.userId] = {
        username: userInfo.username,
        socketId: socket.id
    };

    // 2. Trimite lista actualizată (doar username-urile)
    const usernamesList = Object.fromEntries(
        Object.entries(onlineUsers).map(([id, data]) => [id, data.username])
    );
    io.emit('updateOnlineUsers', usernamesList);

    // 3. Alătură utilizatorul la toate camerele sale EXISTENTE
    try {
        const query = 'SELECT conversatie_id FROM participanti WHERE utilizator_id = $1';
        const userConversations = await pool.query(query, [userInfo.userId]);
        
        userConversations.rows.forEach(convo => {
            socket.join(String(convo.conversatie_id)); // Folosim String() pentru ID-ul camerei
            console.log(`Utilizatorul ${userInfo.username} s-a alăturat automat camerei ${convo.conversatie_id}`);
        });
    } catch (err) {
        console.error("Eroare la alăturarea automată în camere:", err);
    }
    
    // 4. (Opțional) Alăturare manuală la click-ul pe chat
    socket.on('joinRoom', (conversatieId) => {
        socket.join(String(conversatieId));
        console.log(`Utilizatorul ${userInfo.username} s-a alăturat manual camerei ${conversatieId}`);
    });

    // 5. Când un client trimite un mesaj
    socket.on('sendMessage', async (data) => {
        try {
            const query = `
                INSERT INTO mesaje (continut, expeditor_id, conversatie_id)
                VALUES ($1, $2, $3)
                RETURNING *;
            `;
            const values = [data.continut, userInfo.userId, data.conversatieId];
            
            const result = await pool.query(query, values);
            const mesajSalvat = result.rows[0];

            // Trimite mesajul tuturor din cameră (inclusiv expeditorului)
            io.to(String(data.conversatieId)).emit('newMessage', mesajSalvat);

        } catch (err) {
            console.error('Eroare la salvarea mesajului:', err);
        }
    });

    // 6. Când se deconectează
    socket.on('disconnect', () => {
        console.log(`Utilizator DECONECTAT: ${userInfo.username}`);
        
        delete onlineUsers[userInfo.userId];

        // Trimite lista actualizată
        const usernamesList = Object.fromEntries(
            Object.entries(onlineUsers).map(([id, data]) => [id, data.username])
        );
        io.emit('updateOnlineUsers', usernamesList);
    });
});

// --- Pornirea Serverului ---
server.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
});
// authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123"; // Trebuie să fie ACEEAȘI cheie ca în server.js

module.exports = function(req, res, next) {
    // Luăm token-ul din header-ul 'Authorization'
    // Formatul va fi: "Bearer TOKEN_LUNG_AICI"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extragem doar token-ul

    if (token == null) {
        return res.sendStatus(401); // 401 Unauthorized (Nu ai trimis token)
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // 403 Forbidden (Token invalid/expirat)
        }

        // Dacă totul e OK, atașăm datele utilizatorului la 'request'
        // Acum, toate rutele protejate vor ști cine este utilizatorul
        req.user = user; // user conține { userId, username }
        next(); // Mergi mai departe la ruta cerută
    });
};
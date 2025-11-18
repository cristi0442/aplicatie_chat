// authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123"; 

module.exports = function(req, res, next) {
    // Luam token-ul din header-ul 'Authorization'
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) {
        return res.sendStatus(401); // 401 Unauthorized (Nu ai trimis token)
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // 403 Forbidden (Token invalid/expirat)
        }

        // Dacă totul e OK, atasam datele utilizatorului la 'request'
        // Acum, toate rutele protejate vor sti cine este utilizatorul
        req.user = user; // user conține { userId, username }
        next(); 
    });
};

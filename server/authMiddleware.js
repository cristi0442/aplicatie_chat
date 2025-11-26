// authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = "MY_SUPER_SECRET_KEY_123"; 

module.exports = function(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }


        req.user = user; // user conține { userId, username }
        next(); 
    });
};

const jwt = require('jsonwebtoken');

const genToken = (user) => {
    const payload = {
        username: user.username,
        carrello: user.carrello 
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};

module.exports = { genToken };

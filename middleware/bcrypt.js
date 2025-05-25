const bcrypt = require('bcryptjs');

const hashPassword = async (password) => {
    const hash = bcrypt.hashSync(password, 10);
    return hash;
};

const verPassword = async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
};

module.exports = { hashPassword, verPassword };
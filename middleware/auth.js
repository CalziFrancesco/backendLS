const jwt = require('jsonwebtoken');

const authToken = (req, res, next) => {
  const token = req.signedCookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Token mancante' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET); 
    req.user = payload; 
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.status(401).json({ message: 'Token non valido o scaduto' });
  }
};

module.exports = { authToken };

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access denied. No token.' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'gympro_secret_2024');
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Admin access required.' });
    next();
};
const isTrainer = (req, res, next) => {
    if (req.user.role !== 'Trainer' && req.user.role !== 'Admin') return res.status(403).json({ message: 'Trainer access required.' });
    next();
};
const isMember = (req, res, next) => {
    if (req.user.role !== 'Member' && req.user.role !== 'Admin') return res.status(403).json({ message: 'Member access required.' });
    next();
};

module.exports = { authenticateToken, isAdmin, isTrainer, isMember };

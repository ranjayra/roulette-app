const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

const adminAuth = async(req, res, next) => {
    try {
        const token = req.header('Authorization') ? .replace('Bearer ', '');

        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);

        if (!admin || !admin.isActive) {
            throw new Error();
        }

        req.admin = admin;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate as admin' });
    }
};

const checkPermission = (permission) => {
    return (req, res, next) => {
        if (req.admin.permissions[permission]) {
            next();
        } else {
            res.status(403).json({ error: 'Insufficient permissions' });
        }
    };
};

module.exports = { adminAuth, checkPermission };
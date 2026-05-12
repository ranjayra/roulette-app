const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key_here";

const authMiddleware = async(req, res, next) => {
    try {
        const token = req.headers.authorization ? .split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        const verified = jwt.verify(token, JWT_SECRET);
        req.userId = verified.userId;
        next();

    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};

module.exports = authMiddleware;
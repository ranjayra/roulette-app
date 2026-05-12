const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
    // Existing fields
    selectedNumber: Number,
    winningNumber: { type: Number, default: null },
    bet: Number,
    result: String, // WIN / LOSE
    balance: Number,
    createdAt: {
        type: Date,
        default: Date.now
    },

    // New admin fields
    bettingOpen: {
        type: Boolean,
        default: true
    },
    roundId: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null values
    },
    adminModified: {
        type: Boolean,
        default: false
    },
    modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    }
});

// Pre-save middleware to generate roundId if it doesn't exist
gameSchema.pre('save', async function(next) {
    if (!this.roundId && this.result === 'WIN') {
        this.roundId = `ROUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    next();
});

// Index for better query performance
gameSchema.index({ createdAt: -1 });
gameSchema.index({ roundId: 1 });
gameSchema.index({ result: 1 });

module.exports = mongoose.model("Game", gameSchema);
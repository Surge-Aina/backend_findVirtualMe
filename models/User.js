const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: { 
        type: String 
    },
    lastName: { 
        type: String 
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: { 
        type: String 
    },
    location: { 
        type: String 
    },
    password: {
        type: String,
        required: true
    },
    bio: { 
        type: String 
    },
    goal: { 
        type: String 
    },
    industry: { 
        type: String 
    },
    experienceLevel: { 
        type: String 
    },
    skills: [
        { type: String }
    ],
    role: {
        type: String,
        enum: ['admin', 'customer'],
        default: 'customer'
    },
    portfolios: [
        { type: String}
    ],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
});

//remove password before sending back to front end
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;   // remove password when converting to JSON
    delete ret.__v;        // remove __v version field
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
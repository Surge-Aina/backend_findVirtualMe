const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoute');
const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
//app.use('/portfolio', portfolioRoute);
//jaqueline login route
app.use('/user', userRoutes);

app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Back end is alive',
        timestamp: new Date().toISOString()
    });
});

module.exports = app;
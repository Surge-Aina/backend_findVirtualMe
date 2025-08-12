require('dotenv').config();
const connectDB = require('./utils/db');
const { server } = require('./index');

const PORT = process.env.PORT;

connectDB()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`listening on PORT:${PORT}`)
        });
    })
    .catch(error => {
        console.error('Database connection failed: ', error);
    });
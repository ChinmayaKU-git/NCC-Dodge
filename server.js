const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const { sql } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // Serve static files from current directory

// Register Endpoint
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        // Postgres uses $1, $2, etc. for parameters
        const result = await sql`
            INSERT INTO users (username, password_hash)
            VALUES (${username}, ${hash})
            RETURNING id;
        `;
        res.json({ message: 'User registered successfully', userId: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') { // Postgres unique violation code
            return res.status(400).json({ error: 'Username already exists' });
        }
        console.error("Registration error:", error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
        const user = rows[0];

        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            res.json({ message: 'Login successful', username: user.username, highScore: user.high_score });
        } else {
            res.status(400).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Score Submission Endpoint
app.post('/api/score', async (req, res) => {
    const { username, score } = req.body;

    if (!username || score === undefined) {
        return res.status(400).json({ error: 'Username and score are required' });
    }

    try {
        // Check current high score
        const { rows } = await sql`SELECT high_score FROM users WHERE username = ${username}`;
        const row = rows[0];

        if (row && score > row.high_score) {
            await sql`UPDATE users SET high_score = ${score} WHERE username = ${username}`;
            res.json({ message: 'New high score saved!', newHighScore: score });
        } else {
            res.json({ message: 'Score not higher than existing record', currentHighScore: row ? row.high_score : 0 });
        }
    } catch (error) {
        console.error("Score submission error:", error);
        res.status(500).json({ error: 'Error updating score' });
    }
});

// Leaderboard Endpoint
app.get('/api/leaderboard', async (req, res) => {
    try {
        const { rows } = await sql`SELECT username, high_score FROM users ORDER BY high_score DESC LIMIT 10`;
        res.json(rows);
    } catch (error) {
        console.error("Leaderboard error:", error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

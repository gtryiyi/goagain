require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const path = require('path');

const app = express();
const PORT = 3000;

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REDIRECT_URI = 'https://goagain.vercel.app/twitch/callback';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = 'https://goagain.vercel.app/discord/callback';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Step 1: Twitch Authentication
app.get('/twitch/login', (req, res) => {
    const twitchAuthURL = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${TWITCH_REDIRECT_URI}&response_type=code&scope=user:read:email`;
    res.redirect(twitchAuthURL);
});

app.get('/twitch/callback', async (req, res) => {
    const { code } = req.query;
    const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
            client_id: TWITCH_CLIENT_ID,
            client_secret: TWITCH_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: TWITCH_REDIRECT_URI,
        },
    });
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
            Authorization: `Bearer ${tokenResponse.data.access_token}`,
            'Client-ID': TWITCH_CLIENT_ID,
        },
    });

    req.session.twitch = userResponse.data.data[0];
    res.redirect('/'); // Redirect back to the main page
});

// Step 2: Discord Authentication
app.get('/discord/login', (req, res) => {
    const discordAuthURL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${DISCORD_REDIRECT_URI}&response_type=code&scope=identify email`;
    res.redirect(discordAuthURL);
});

app.get('/discord/callback', async (req, res) => {
    const { code } = req.query;
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', null, {
        params: {
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: DISCORD_REDIRECT_URI,
        },
    });
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
    });

    req.session.discord = userResponse.data;
    res.redirect('/'); // Redirect back to the main page
});

// Step 3: Handle form submission and save to Google Sheets
app.post('/apply', async (req, res) => {
    const { email, message } = req.body;
    const twitchUsername = req.session.twitch?.display_name;
    const discordUsername = req.session.discord?.username;

    try {
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });

        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.addRow({
            Twitch: twitchUsername,
            Discord: discordUsername,
            Email: email,
            Message: message,
        });

        res.status(200).send('Application submitted successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Failed to submit application.');
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

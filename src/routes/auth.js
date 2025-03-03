const express = require("express");
const { default: axios } = require('axios');

const router = express.Router();
const callbackURI = "http://localhost:4321/auth/callback";

router.get("/login", (req,res) => {
    const oauthURI = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(callbackURI)}&scope=identify+guilds`;
    res.redirect(oauthURI);
});

router.get("/logout", (req, res) => {
    req.session.user = null;

    req.session.destroy(err => {
        if(err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Error logging out');
        }
    });

    res.clearCookie("connect.sid");
    res.redirect("/");
});

router.get("/callback", async (req,res) => {
    const { code } = req.query;

    if(!code) {
        return res.status(400).send("Authorization failed: No code provided");
    }

    try {
        const tokenResponse = await axios.post("https://discord.com/api/oauth2/token",
            new URLSearchParams({
                "client_id": process.env.CLIENT_ID,
                "client_secret": process.env.CLIENT_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": "http://localhost:4321/auth/callback",
                "code": code
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
              Authorization: `Bearer ${access_token}`
            }
        });

        const { id, username, global_name } = userResponse.data;

        req.session.user = {
            id,
            username,
            global_name,
            access_token,
            refresh_token
        };

        res.redirect("/");
    } catch(error) {
        console.error('Error during authentication:', error.response?.data || error.message);
        return res.status(500).send("Authentication failed!");
    }
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
      return next();
    }
    res.redirect('/auth/login');
}

module.exports = { authRoutes: router, isAuthenticated };
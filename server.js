const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const REDIRECT_URI = `http://localhost:${PORT}/auth/discord/callback`;

const GUILD_ID = '1431438811560153211';

// Remplace ceci par ton propre ID d'utilisateur Discord (pour recevoir le message privé du bot)
const ADMIN_DISCORD_ID = '1459971234422067392';

// --- CONFIGURATION DU BOT DISCORD ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.once('ready', () => {
    console.log(`🤖 Bot Discord connecté en tant que ${client.user.tag}`);
});

if (BOT_TOKEN) {
    client.login(BOT_TOKEN).catch(err => console.error("Erreur de connexion du bot :", err.message));
} else {
    console.warn("⚠️ DISCORD_BOT_TOKEN manquant dans le fichier .env");
}

// --- API POUR RÉCUPÉRER TOUS LES MEMBRES DU SERVEUR ---
app.get('/api/citoyens', async (req, res) => {
    try {
        if (!client.isReady()) {
            return res.status(500).json({ error: "Le bot Discord n'est pas encore prêt." });
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            return res.status(404).json({ error: "Le bot ne trouve pas le serveur Discord spécifié." });
        }

        await guild.members.fetch();

        const result = guild.members.cache.map(member => ({
            id: member.id,
            name: member.user.username,
            roles: member.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => r.name)
        }));

        res.json(result);
    } catch (error) {
        console.error("ERREUR API CITOYENS :", error);
        res.status(500).json({ error: error.message });
    }
});

// --- NOUVELLE ROUTE : ALERTE URGENTE BOT ---
app.post('/api/urgent-alert', async (req, res) => {
    try {
        if (!client.isReady()) {
            return res.status(500).json({ error: "Le bot n'est pas prêt." });
        }

        const user = await client.users.fetch(ADMIN_DISCORD_ID);
        if (user) {
            await user.send("🚨 **ALERTE STAFF** 🚨\nVas vite sur http://localhost:3000/moderateur.html il y a une candidature importante !");
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Administrateur introuvable par le bot." });
        }
    } catch (error) {
        console.error("ERREUR URGENT ALERT:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Serveur prêt sur https://aspenrp.onrender.com/index.html`);
    console.log(`🌐 Accès Espace Modérateur : https://aspenrp.onrender.com/moderateur.html`);
    console.log(`🌐 Accès Boutique : https://aspenrp.onrender.com/boutique.html`);
});

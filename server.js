const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1431438811560153211';
const ADMIN_DISCORD_ID = '1459971234422067392';

// Import sécurisé de Discord.js pour éviter tout crash global
let client = null;
try {
    const { Client, GatewayIntentBits } = require('discord.js');
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences
        ]
    });

    client.once('clientReady', () => {
        console.log(`🤖 Bot Discord connecté en tant que ${client.user.tag}`);
    });

    if (BOT_TOKEN) {
        client.login(BOT_TOKEN).catch(err => console.error("⚠️ Erreur connexion bot :", err.message));
    } else {
        console.warn("⚠️ DISCORD_BOT_TOKEN manquant");
    }
} catch (e) {
    console.warn("⚠️ Discord.js non chargé ou erreur d'initialisation :", e.message);
}

// --- GESTION DES CANDIDATURES (JSON Local) ---
const DB_FILE = path.join(__dirname, 'candidatures.json');

function getData() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify([]));
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Erreur écriture fichier JSON :", e.message);
    }
}

// Routes API Candidatures
app.get('/api/candidatures', (req, res) => {
    res.json(getData());
});

app.post('/api/candidatures', (req, res) => {
    let list = getData();
    const newCand = req.body;
    
    let existingIndex = list.findIndex(c => c.discord && newCand.discord && c.discord.toLowerCase() === newCand.discord.toLowerCase());
    if (existingIndex !== -1) {
        list[existingIndex] = { ...list[existingIndex], ...newCand };
    } else {
        newCand.status = 'En attente';
        newCand.messages = [];
        list.push(newCand);
    }
    
    saveData(list);
    res.json({ success: true, candidature: newCand });
});

app.post('/api/candidatures/message', (req, res) => {
    const { discord, sender, text } = req.body;
    let list = getData();
    let index = list.findIndex(c => c.discord && discord && c.discord.toLowerCase() === discord.toLowerCase());

    if (index === -1) {
        return res.status(404).json({ error: "Candidature introuvable" });
    }

    if (!list[index].messages) list[index].messages = [];

    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    list[index].messages.push({ sender, text, date: timeString });

    saveData(list);
    res.json({ success: true, messages: list[index].messages });
});

app.post('/api/candidatures/status', (req, res) => {
    const { discord, status } = req.body;
    let list = getData();
    let index = list.findIndex(c => c.discord && discord && c.discord.toLowerCase() === discord.toLowerCase());

    if (index !== -1) {
        list[index].status = status;
        saveData(list);
        return res.json({ success: true });
    }
    res.status(404).json({ error: "Candidature introuvable" });
});

// Route Citoyens Discord sécurisée
app.get('/api/citoyens', async (req, res) => {
    try {
        if (!client || !client.isReady()) {
            return res.json([]);
        }

        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) {
            return res.json([]);
        }

        await guild.members.fetch().catch(() => {});

        const result = guild.members.cache.map(member => ({
            id: member.id,
            name: member.user.username,
            roles: member.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => r.name)
        }));

        res.json(result);
    } catch (error) {
        res.json([]);
    }
});

// Route Alerte urgente
app.post('/api/urgent-alert', async (req, res) => {
    try {
        if (!client || !client.isReady()) {
            return res.status(500).json({ error: "Le bot n'est pas prêt." });
        }

        const user = await client.users.fetch(ADMIN_DISCORD_ID).catch(() => null);
        if (user) {
            await user.send("🚨 **ALERTE STAFF** 🚨\nVas vite sur le panneau de modération il y a une candidature importante !");
            res.res ? res.json({ success: true }) : res.json({ success: true });
        } else {
            res.status(404).json({ error: "Admin introuvable." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Serveur prêt sur le port ${PORT}`);
});

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
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

// --- GESTION DES CANDIDATURES (JSON Local sur le serveur) ---
const DB_FILE = path.join(__dirname, 'candidatures.json');

function getData() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 1. Récupérer toutes les candidatures (Panel Staff)
app.get('/api/candidatures', (req, res) => {
    res.json(getData());
});

// 2. Soumettre une nouvelle candidature (Chatbot)
app.post('/api/candidatures', (req, res) => {
    let list = getData();
    const newCand = req.body;
    
    let existingIndex = list.findIndex(c => c.discord.toLowerCase() === newCand.discord.toLowerCase());
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

// 3. Envoyer un message dans la discussion
app.post('/api/candidatures/message', (req, res) => {
    const { discord, sender, text } = req.body;
    let list = getData();
    let index = list.findIndex(c => c.discord.toLowerCase() === discord.toLowerCase());

    if (index === -1) {
        return res.status(404).json({ error: "Candidature introuvable" });
    }

    if (!list[index].messages) list[index].messages = [];

    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    list[index].messages.push({
        sender: sender,
        text: text,
        date: timeString
    });

    saveData(list);
    res.json({ success: true, messages: list[index].messages });
});

// 4. Changer le statut (Accepter / Refuser)
app.post('/api/candidatures/status', (req, res) => {
    const { discord, status } = req.body;
    let list = getData();
    let index = list.findIndex(c => c.discord.toLowerCase() === discord.toLowerCase());

    if (index !== -1) {
        list[index].status = status;
        saveData(list);
        return res.json({ success: true });
    }
    res.status(404).json({ error: "Candidature introuvable" });
});

// --- API POUR RÉCUPÉRER TOUS LES MEMBRES DU SERVEUR DISCORD ---
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

// --- ROUTE : ALERTE URGENTE BOT ---
app.post('/api/urgent-alert', async (req, res) => {
    try {
        if (!client.isReady()) {
            return res.status(500).json({ error: "Le bot n'est pas prêt." });
        }

        const user = await client.users.fetch(ADMIN_DISCORD_ID);
        if (user) {
            await user.send("🚨 **ALERTE STAFF** 🚨\nVas vite sur le panneau de modération il y a une candidature importante !");
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
    console.log(`✅ Serveur prêt sur le port ${PORT}`);
});

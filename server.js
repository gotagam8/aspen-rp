const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const GUILD_ID = '1431438811560153211';
const CANDIDATURE_CHANNEL_ID = '1529861321775120505';
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

// --- GESTION DU FICHIER DE SAUVEGARDE DES CANDIDATURES ---
const DATA_FILE = path.join(__dirname, 'candidatures.json');

function readCandidatures() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error("Erreur de lecture du fichier JSON :", err);
    }
    return [];
}

function writeCandidatures(candidatures) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(candidatures, null, 2), 'utf8');
    } catch (err) {
        console.error("Erreur d'écriture dans le fichier JSON :", err);
    }
}

// --- API : CRÉER UNE CANDIDATURE ---
app.post('/api/candidatures', async (req, res) => {
    try {
        let candidatures = readCandidatures();
        const nouvelleCandidature = {
            ...req.body,
            status: 'En attente',
            messages: [],
            date: new Date().toISOString()
        };
        
        candidatures.push(nouvelleCandidature);
        writeCandidatures(candidatures);

        // Envoi automatique d'un message dans le salon Discord
        if (client.isReady()) {
            try {
                const channel = await client.channels.fetch(CANDIDATURE_CHANNEL_ID);
                if (channel && channel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setColor('#f72585')
                        .setTitle('🚨 NOUVELLE CANDIDATURE REÇUE')
                        .addFields(
                            { name: '👤 Pseudo Discord', value: nouvelleCandidature.discord || 'Inconnu', inline: true },
                            { name: '💼 Poste Visé', value: nouvelleCandidature.poste || 'Non spécifié', inline: true },
                            { name: '📝 Motivations', value: nouvelleCandidature.motivations || 'Aucune motivation renseignée' }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'ASPEN RP • Système de Recrutement IA' });

                    await channel.send({ embeds: [embed] });
                }
            } catch (discordErr) {
                console.error("Erreur lors de l'envoi de l'embed Discord :", discordErr.message);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("ERREUR API POST CANDIDATURE :", error);
        res.status(500).json({ error: error.message });
    }
});

// --- API : LIRE LES CANDIDATURES ---
app.get('/api/candidatures', (req, res) => {
    const candidatures = readCandidatures();
    res.json(candidatures);
});

// --- API : METTRE À JOUR (Statuts ou Messages de tickets) ---
app.put('/api/candidatures/:index', (req, res) => {
    try {
        const index = parseInt(req.params.index);
        let candidatures = readCandidatures();

        if (index >= 0 && index < candidatures.length) {
            candidatures[index] = { ...candidatures[index], ...req.body };
            writeCandidatures(candidatures);
            return res.json({ success: true, candidatures });
        }
        res.status(404).json({ error: "Candidature introuvable." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API : RÉCUPÉRER TOUS LES MEMBRES DU SERVEUR ---
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
            await user.send(`🚨 **ALERTE STAFF** 🚨\nVas vite sur ${BASE_URL}/moderateur.html il y a une candidature importante !`);
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
    console.log(`🌐 Espace Modérateur : ${BASE_URL}/moderateur.html`);
});

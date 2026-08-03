const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.use(express.json());

// ... (garde toutes tes variables, intents, et fonctions read/write ici) ...

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

        // 🔥 DIFFUSION EN TEMPS RÉEL VIA SOCKET.IO
        io.emit('nouvelleCandidature', nouvelleCandidature);

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

// ... (garde le reste de tes routes api get, put, citoyens, urgent-alert) ...

// Remplacer app.listen par server.listen pour inclure Socket.io
server.listen(PORT, () => {
    console.log(`✅ Serveur prêt sur le port ${PORT}`);
    console.log(`🌐 Espace Modérateur : ${BASE_URL}/moderateur.html`);
});

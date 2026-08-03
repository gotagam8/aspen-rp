const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques (HTML, CSS, images)
app.use(express.static(path.join(__dirname, 'public'))); // Assure-toi que tes fichiers sont dans un dossier 'public' ou ajuste le chemin

// Fichier JSON pour stocker les candidatures de façon centralisée sur le serveur
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

// 1. Récupérer toutes les candidatures (pour le panel Staff)
app.get('/api/candidatures', (req, res) => {
    res.json(getData());
});

// 2. Soumettre une nouvelle candidature (depuis le chatbot)
app.post('/api/candidatures', (req, res) => {
    let list = getData();
    const newCand = req.body;
    
    // Vérifier si elle existe déjà, sinon l'ajouter
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

// 3. Envoyer un message dans la discussion (Joueur ou Staff)
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
        sender: sender, // 'Staff' ou le pseudo du joueur
        text: text,
        date: timeString
    });

    saveData(list);
    res.json({ success: true, messages: list[index].messages });
});

// 4. Changer le statut (Accepter / Refuser) par le staff
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

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});

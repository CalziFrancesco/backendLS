const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId } = require('mongodb');
const { verPassword } = require('./middleware/bcrypt');
const { authToken } = require('./middleware/auth');
const { genToken } = require('./middleware/jwt');
const { hashPassword } = require('./middleware/bcrypt');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: 'https://frontend-ls.vercel.app',
  credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
 
const connectToDatabase = async () => {
    try{
        const client = await MongoClient.connect(process.env.MONGO_URI);
        console.log('Connected to database');
        //console.log("ciao");
        return client.db(process.env.DB_NAME);     
    } catch(err) {
        console.log(err);
        process.exit(1);
    }
   
}
 
let database
 
const startServer = async () => {
    database = await connectToDatabase();
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    })
}
 
startServer();

app.get('/', (req, res) => {
  res.send('Benvenuto nel mio server Express!');
});

//--------------------------------------login-----------------------------------------

app.post('/login', async (req, res) => {
    if (!database) return res.status(500).json({ message: 'Database not connected' });

    const { username, password } = req.body;
    const user = await database.collection('utenti').findOne({ username });
    if (!user){
        return res.status(401).json({ message: 'Credenziali non valide' });
    } 
    const isValid = await verPassword(password, user.password);
    if (!isValid){ 
        return res.status(401).json({ message: 'Credenziali non valide' });
    }

    const token = genToken(user); 
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 3600000,   
        signed: true
    });

    res.status(200).json({ message: 'Login riuscito' });
});

app.post('/registr', async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    try {
        const { nome, cognome, username, email, password } = req.body;

        const utenteEsistente = await database.collection('utenti').findOne({ username });
        if (utenteEsistente) {
            return res.status(400).json({ message: 'Utente già esistente' });
        }

        const passwordHash = await hashPassword(password);

        const risultatoCarrello = await database.collection('carrelli').insertOne({
            articoli: []
        });
        const idCarrello = risultatoCarrello.insertedId;

        await database.collection('utenti').insertOne({
            nome,
            cognome,
            username,
            email,
            password: passwordHash,
            id_carrello: idCarrello
        });

        res.status(201).json({ message: 'Registrazione completata' });
    } catch (err) {
        console.error('Errore registrazione:', err);
        res.status(500).json({ message: 'Errore durante la registrazione' });
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'Lax',
        signed: true,
        path: '/', 
    });

    res.status(200).json({ message: 'Logout effettuato con successo' });
});

//---------------------------------collection-base----------------------------------------------------

app.get('/articoli',authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }
    try {
        const result = await database.collection('articoli').find({}).toArray();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante il recupero degli articoli' });
    }
});

app.delete('/articoli/:id',authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    try {
        const id = parseInt(req.params.id); // converte in intero

        const result = await database.collection('articoli').deleteOne({ Id_art: id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Articolo non trovato' });
        }

        res.status(200).json({ message: 'Articolo eliminato con successo' });
    } catch (err) {
        console.error('Errore durante l\'eliminazione dell\'articolo:', err);
        res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'articolo' });
    }
});


app.get('/articoli/categoria/:categoria',authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    const categoria = req.params.categoria;

    try {
        const result = await database.collection('articoli').find({ categoria: categoria }).toArray();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante il recupero degli articoli per categoria' });
    }
});

app.get('/carrelli',authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }
    try {
        const result = await database.collection('carrelli').find({}).toArray();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante il recupero dei carrelli' });
    }
});

app.post('/articoli',authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }
    try {
        const {
            Id_art,
            nome_prodotto,
            descrizione_prodotto,
            categoria,
            marca,
            prezzo,
            quantità,
            stato,
            sconto,
            origine,
            urlImg,
            fornitore,
            allergeni,
            ingredienti,
            rating,
            scaffale,
            corsia
        } = req.body;

        await database.collection('articoli').insertOne({
            Id_art, nome_prodotto, descrizione_prodotto, categoria, marca, prezzo,
            quantità, stato, sconto, origine, urlImg, fornitore, allergeni,
            ingredienti, rating, scaffale, corsia
        });

        res.status(201).json({ message: 'Articolo inserito correttamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante l\'inserimento dell\'articolo' });
    }
});

app.put('/aggiungiArticolo/:id_carrello',authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    try {
        const carrelloId = req.params.id_carrello;
        const objectId = new ObjectId(carrelloId);
        const articolo = req.body;

        const result = await database.collection('carrelli').updateOne(
            { _id: objectId },
            { $addToSet: { articoli: articolo } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Carrello non trovato' });
        }

        res.status(200).json({ message: 'Articolo aggiunto al carrello' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante l\'aggiunta dell\'articolo al carrello' });
    }
});

app.put('/svuotacarrello/:id_carrello',authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    try {
        const carrelloId = req.params.id_carrello;
        const objectId = new ObjectId(carrelloId);

        const result = await database.collection('carrelli').updateOne(
            { _id: objectId },
            { $set: { articoli: [] } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Carrello non trovato' });
        }

        res.status(200).json({ message: 'Carrello svuotato correttamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante lo svuotamento del carrello' });
    }
});

//<---------------------------------token-payload------------------------------------------------------->

app.get('/carrello/utente', authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    try {
        const username = req.user.username;

        const utente = await database.collection('utenti').findOne({ username });
        if (!utente) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        const carrello = await database.collection('carrelli').findOne({ 
            _id: new ObjectId(utente.id_carrello)
        });
        if (!carrello) {
            return res.status(404).json({ message: 'Carrello non trovato' });
        }

        res.status(200).json({ articoli: carrello.articoli });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante il recupero del carrello utente' });
    }
});

app.put('/carrello/utente/aggiungi', authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    try {
        const username = req.user.username;
        const articolo = req.body;

        const utente = await database.collection('utenti').findOne({ username });
        if (!utente) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        const result = await database.collection('carrelli').updateOne(
            { _id: new ObjectId(utente.id_carrello) }, 
            { $addToSet: { articoli: articolo } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Carrello non trovato' });
        }

        res.status(200).json({ message: 'Articolo aggiunto correttamente al carrello' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante l\'aggiunta dell\'articolo al carrello' });
    }
});


app.put('/carrello/utente/svuota', authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    try {
        const username = req.user.username;
        console.log('Username:', username);

        const utente = await database.collection('utenti').findOne({ username });
        if (!utente) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        // Check if id_carrello exists
        if (!utente.id_carrello) {
            return res.status(500).json({ message: 'ID carrello mancante per l\'utente' });
        }

        console.log('id_carrello raw:', utente.id_carrello);
        console.log('id_carrello type:', typeof utente.id_carrello);
        console.log('id_carrello instanceof ObjectId:', utente.id_carrello instanceof ObjectId);

        let carrelloObjectId;
        
        // Handle different types of id_carrello
        if (utente.id_carrello instanceof ObjectId) {
            // It's already an ObjectId, use it directly
            carrelloObjectId = utente.id_carrello;
        } else if (typeof utente.id_carrello === 'string') {
            // Validate if it's a valid ObjectId string before converting
            if (ObjectId.isValid(utente.id_carrello)) {
                carrelloObjectId = new ObjectId(utente.id_carrello);
            } else {
                console.error('Invalid ObjectId string:', utente.id_carrello);
                return res.status(500).json({ message: 'ID carrello non valido' });
            }
        } else {
            console.error('id_carrello has unexpected type:', typeof utente.id_carrello, utente.id_carrello);
            return res.status(500).json({ message: 'Formato ID carrello non supportato' });
        }

        console.log('carrelloObjectId finale:', carrelloObjectId);

        const result = await database.collection('carrelli').updateOne(
            { _id: carrelloObjectId },
            { $set: { articoli: [] } }
        );

        console.log('Risultato update:', result);

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Carrello non trovato' });
        }

        res.status(200).json({ message: 'Carrello svuotato correttamente' });
    } catch (err) {
        console.error('Errore completo:', err);
        console.error('Stack trace:', err.stack);
        res.status(500).json({ message: 'Errore durante lo svuotamento del carrello: ' + err.message });
    }
});


app.put('/rimuoviArticolo/utente/:id_articolo', authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database non connesso' });
    }

    try {
        const username = req.user.username;
        const idArticolo = req.params.id_articolo;

        const utente = await database.collection('utenti').findOne({ username });
        if (!utente) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }

        const result = await database.collection('carrelli').updateOne(
            { _id: new ObjectId(utente.id_carrello) },
            { $pull: { articoli: { Id_art: parseInt(idArticolo) } } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Carrello non trovato' });
        }

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'Articolo non trovato nel carrello' });
        }

        res.status(200).json({ message: 'Articolo rimosso correttamente dal carrello' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore durante la rimozione dell\'articolo dal carrello' });
    }
});

//<-----------------------------ricerca---------------------------------------------------->

app.get('/articoli/ricerca/:termine',authToken, async (req, res) => {
    if (!database) {
        return res.status(500).json({ message: 'Database is not connected' });
    }

    const termine = req.params.termine;

    try {
        const result = await database.collection('articoli').find({
            $or: [
                { nome_prodotto: { $regex: termine, $options: 'i' } },
                { descrizione_prodotto: { $regex: termine, $options: 'i' } },
                { marca: { $regex: termine, $options: 'i' } },
                { categoria: { $regex: termine, $options: 'i' } },
                { ingredienti: { $regex: termine, $options: 'i' } }
            ]
        }).toArray();
        
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error searching articoli' });
    }
});

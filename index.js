// Dipendenze del progetto
const express=require('express');//importo il framework Express
const app=express();
const fs = require('fs'); //importo il modulo per la gestione del File System
const morgan=require('morgan');  //importo il modulo per la gestione dei logger
const path = require('path'); //importo il modulo per la gestione dei percorsi delle cartelle e dei file
const helmet=require('helmet'); //importo il modulo per rendere il server web piu sicuro
const cors=require('cors');// Cors (Cross origin resource sharing, protocollo che permette il passaggio di dati tra applicazioni e domini diversi)
const cookieParser = require("cookie-parser");
const session = require('express-session');
const bodyParser = require('body-parser');//Per leggere i parametri POST occorre preventivamente installare il modulo body-parser
const bcrypt = require('bcrypt');
const saltRounds = 1;


//Sezione impostazione dell’app (app.set)app.set ('port',process.env.PORT || 3000); //imposta la porta in cui è in ascolto il server
app.set ('appName', 'Web Service'); //imposta il nome dell'applicazione web
app.set ('port',process.env.PORT || 3000); //imposta la porta in cui è in ascolto il server
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');


//Sezione Middleweare
//Middleweare Morgan: per la creazione di un logger: formati predefiniti (short, combined, common, tiny)
//oppure app.use(morgan(':method :url :status - :response-time ms', {stream: accessLogStream}));
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});
app.use(morgan('short', {stream: accessLogStream}));
//Middleweare sicurezza helmet
app.use(helmet());
//middleware sessioni
const oneMinute = 1000 * 60 
app.use(session({
	
    secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
    saveUninitialized:true,
    cookie: { maxAge: oneMinute },
    resave: false
}));
app.use(cookieParser());

app.use("/public",express.static("public"));

app.use(cors({
    origin: '*'
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'fiabe'
});
 
connection.connect();

//ROTTE

app.get("/", (req, res) => {
    console.log(req.session.userId);
});


//lista fiabe di un paese
app.get("/paese/:codice", (req, res) => {
    connection.query('SELECT id, titolo, descrizione FROM fiabe WHERE paese = "' + req.params.codice + '"', function (error, results, fields) {
        if (error) throw error;
        console.log('Result: ', results);
        res.render("fiabe", {results});
      });

});

//fiaba
app.post("/fiaba/:id", (req, res) => {
    connection.query('SELECT titolo, autore, fiaba FROM fiabe WHERE id = "' + req.params.id + '"', function (error, results, fields) {
        if (error) throw error;
        console.log('Result: ', results[0]);
        let fiaba = results[0];
        //res.render("fiaba", fiaba)
      });
});

//inserisci utente
app.get("/signup", (req, res) => {
    let dati = {
        mail: "",
        username: "",
        password: ""
    }
    res.render("signup", {dati});
});

app.post("/signup", (req, res) => {
    let {mail, username, password, password_check} = req.body;
    let invia = true;
    invia &= (mail.length > 0);
    invia &= (username.length > 0);
    invia &= (password.length > 0 && password == password_check);

    //controlla che la mail non sia già registrata
    connection.query('SELECT mail FROM utenti', async (error, results, fields) => {
        if (error) throw error;
        for(let row of results){
            if(row.mail == mail){
                invia = false;
                console.log("mail già usata");
            }
        }

        if(invia){
            const encryptedPassword = await bcrypt.hash(password, saltRounds);
            connection.query('INSERT INTO utenti (mail, username, password_hash) VALUES (?,?,?)', [mail, username, encryptedPassword], function (error, results, fields) {
                if (error) throw error;
                console.log("utente inserito");
                req.session.userId = results.insertId;
                req.session.auth = true;
                res.redirect("/");
              });
        }
        else{
            let dati = {
                mail: "",
                username: "",
                password: ""
            }
            res.render("signup", {dati});
        }
    });

    

});

app.get("/login", (req, res) => {
    dati = {
        "mail": "",
        "username": "",
        "password": ""
    };
    res.render("login");
});


app.post("/login", (req, res) => {
    let {mail, username, password} = req.body;
    let invia = true;
    invia &= (mail.length > 0);
    invia &= (username.length > 0);
    invia &= (password.length > 0);

    connection.query('SELECT id, password_hash FROM utenti WHERE mail = ? LIMIT 1', mail, async (error, result, fields) => {
        if(result.length > 0 && invia){
            let user = result[0];
            let auth = await bcrypt.compare(password, user.password_hash);
            if(auth){
                req.session.userId = user.id;
                req.session.auth = true;
            }
        }
        else{
            invia = false;
        }

        if(invia){
            res.redirect("/aggiungi");
        }
        else{
            dati = {
                "mail": mail,
                "username": username,
                "password": password
            };
            res.render("login", {dati});
        }
    });



});

app.get("/aggiungi", (req, res) => {
    if(req.session.auth){
        connection.query('SELECT * FROM countries', function (error, results, fields) {
            if (error) throw error;
            console.log(results);
            let dati = {
                "titolo": "",
                "descrizione": "",
                "fiaba": "",
                "autore": ""
            }
            let countries = [...results];
            res.render("aggiungi", {dati, countries});
        });
    }
    else{
        res.status(401);
        res.send("Not permitted");
    }
    
});

app.post("/aggiungi", (req, res) => {
    if(!req.session.auth){
        res.status(401);
        res.send("Not permitted");
    }
    else{
        let {titolo, descrizione, fiaba, autore, paese} = req.body;
        let valido = true;
        valido &= (titolo.lengh > 0);
        valido &= (descrizione.lengh > 0);
        valido &= (fiaba.lengh > 0);
        valido &= (autore.lengh > 0);
        valido &= (paese.lengh > 0);

        connection.query('INSERT INTO fiabe (titolo, descrizione, fiaba, autore, paese) VALUES (?, ?, ?, ?, ?)', [titolo, descrizione, fiaba, autore, paese], function (error, results, fields) {
            if (error) throw error;
            console.log("aggiunta");
        });

    }
    



});












//Middleweare che gestisce l’errore nel caso che nessuna route vada a buon fine
app.use("*",function (req,res,next){	
	res.status(404);
	res.send('Url non presente');
});

//Avvio del server su una porta specifica
const server=app.listen(app.get('port'),function(){
    console.log('Server in ascolto');
});
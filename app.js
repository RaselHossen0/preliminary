const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 8000;

app.use(bodyParser.json());

const db = new sqlite3.Database('train_service.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS User (
      user_id INTEGER PRIMARY KEY,
      user_name TEXT NOT NULL,
      balance INTEGER NOT NULL
  )`);

  // Create Station table
  db.run(`CREATE TABLE IF NOT EXISTS Station (
      station_id INTEGER PRIMARY KEY,
      station_name TEXT NOT NULL,
      longitude REAL NOT NULL,
      latitude REAL NOT NULL
  )`);

  // Create Train table
  db.run(`CREATE TABLE IF NOT EXISTS Train (
      train_id INTEGER PRIMARY KEY,
      train_name TEXT NOT NULL,
      capacity INTEGER NOT NULL
  )`);


  // Create Stops table
  db.run(`CREATE TABLE IF NOT EXISTS Stops (
    stop_id INTEGER PRIMARY KEY,
    train_id INTEGER,
    station_id INTEGER,
    arrival_time TEXT,
    departure_time TEXT,
    fare INTEGER,
    FOREIGN KEY(train_id) REFERENCES Train(train_id),
    FOREIGN KEY(station_id) REFERENCES Station(station_id)
)`);
});
app.post('/api/users', (req, res) => {
    const { user_id, user_name, balance } = req.body;

    // Insert user into the database
    db.run(`INSERT INTO User (user_id, user_name, balance) VALUES (?, ?, ?)`, 
    [user_id, user_name, balance], function(err) {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error adding user');
            return;
        }
        console.log(`User added with ID: ${user_id}`);
        res.status(201).json(req.body);
    });
});
app.post('/api/stations', (req, res) => {
  const { station_id, station_name, longitude, latitude } = req.body;

  // Insert station into the database
  db.run(`INSERT INTO Station (station_id, station_name, longitude, latitude) 
          VALUES (?, ?, ?, ?)`, [station_id, station_name, longitude, latitude], function(err) {
      if (err) {
          console.error(err);
          res.status(500).send('Error adding station');
      } else {
          console.log(`Station added with ID: ${station_id}`);
          res.status(201).json(req.body);
      }
  });
});

app.post('/api/trains', (req, res) => {
  const { train_id, train_name, capacity, stops } = req.body;

  // Insert train into the database
  db.run(`INSERT INTO Train (train_id, train_name, capacity) VALUES (?, ?, ?)`, 
  [train_id, train_name, capacity], function(err) {
      if (err) {
          console.log(err.message);
          res.status(500).send('Error adding train');
          return;
      }
      console.log(`Train added with ID: ${train_id}`);

      // Insert stops into the database
      stops.forEach(stop => {
          db.run(`INSERT INTO Stops (train_id, station_id, arrival_time, departure_time, fare) 
          VALUES (?, ?, ?, ?, ?)`, [train_id, stop.station_id, stop.arrival_time, stop.departure_time, stop.fare], function(err) {
              if (err) {
                  console.error(err.message);
                  res.status(500).send('Error adding stops');
                  return;
              }
              console.log(`Stop added for train ID ${train_id} at station ID ${stop.station_id}`);
          });
      });

      res.status(201).json(req.body);
  });
});
  
app.get('/api/stations/:station_id/trains', (req, res) => {
    const stationId = req.params.station_id;

    // Retrieve all trains that have a stop at the given station
    db.all(`SELECT Train.train_id, Stops.arrival_time, Stops.departure_time
            FROM Train
            INNER JOIN Stops ON Train.train_id = Stops.train_id
            WHERE Stops.station_id = ?
            ORDER BY 
                CASE 
                    WHEN Stops.departure_time IS NULL THEN 1
                    ELSE 0
                END,
                Stops.departure_time ASC,
                Stops.arrival_time ASC,
                Train.train_id ASC`, [stationId], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error retrieving trains');
            return;
        }
        if (rows.length === 0) {
            res.status(200).json({ station_id: stationId, trains: [] });
            return;
        }
        res.status(200).json({ station_id: stationId, trains: rows });
    });
});
app.get('/api/wallets/:wallet_id', (req, res) => {
    const walletId = req.params.wallet_id;

    // Check if wallet exists
    db.get(`SELECT * FROM User WHERE user_id = ?`, [walletId], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error retrieving wallet information');
            return;
        }

        if (!row) {
            res.status(404).json({ message: `Wallet with id: ${walletId} was not found` });
            return;
        }

        // Retrieve wallet balance and user information
        const walletBalance = row.balance;
        const user = {
            user_id: row.user_id,
            user_name: row.user_name
        };

        res.status(200).json({
            wallet_id: walletId,
            balance: walletBalance,
            wallet_user: user
        });
    });
});

// Endpoint for adding wallet balance
app.put('/api/wallets/:wallet_id', (req, res) => {
    const walletId = req.params.wallet_id;
    const rechargeAmount = req.body.recharge;

    // Check if wallet exists
    db.get(`SELECT * FROM User WHERE user_id = ?`, [walletId], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error retrieving wallet information');
            return;
        }

        if (!row) {
            res.status(404).json({ message: `Wallet with id: ${walletId} was not found` });
            return;
        }

        // Check if recharge amount is within the allowed range
        if (rechargeAmount < 100 || rechargeAmount > 10000) {
            res.status(400).json({ message: `Invalid amount: ${rechargeAmount}` });
            return;
        }

        // Update wallet balance
        const updatedBalance = row.balance + rechargeAmount;
        db.run(`UPDATE User SET balance = ? WHERE user_id = ?`, [updatedBalance, walletId], function(err) {
            if (err) {
                console.error(err.message);
                res.status(500).send('Error updating wallet balance');
                return;
            }

            // Retrieve updated wallet balance and user information
            const user = {
                user_id: row.user_id,
                user_name: row.user_name
            };

            res.status(200).json({
                wallet_id: walletId,
                balance: updatedBalance,
                wallet_user: user
            });
        });
    });
});
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

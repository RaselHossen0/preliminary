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
// Define the route handler for GET /api/stations
app.get('/api/stations', (req, res) => {
    // Query the database to retrieve all stations
    db.all('SELECT * FROM Station ORDER BY station_id ASC', (err, rows) => {
        if (err) {
            console.error('Error retrieving stations:', err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        // Prepare the response model
        const stations = rows.map(row => ({
            station_id: row.station_id,
            station_name: row.station_name,
            longitude: row.longitude,
            latitude: row.latitude
        }));

        // Return the list of stations
        res.status(200).json({ stations: stations });
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
// Purchase Ticket
// Purchase Ticket
app.post('/api/tickets', (req, res) => {
    const { wallet_id, time_after, station_from, station_to } = req.body;

    // Validate request body
    if (!wallet_id || !time_after || !station_from || !station_to) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Calculate ticket fare
    let totalFare = calculateTicketFare(station_from, station_to);

    // Check wallet balance
    db.get(`SELECT balance FROM User WHERE user_id = ?`, [wallet_id], (err, row) => {
        if (err) {
            console.error('Error retrieving wallet balance:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        const walletBalance = row ? row.balance : 0;

        // Check if wallet balance is sufficient
        if (walletBalance < totalFare) {
            const shortageAmount = totalFare - walletBalance;
            return res.status(402).json({ message: `Recharge amount: ${shortageAmount} to purchase the ticket` });
        }

        // Find available trains
        findAvailableTrains(station_from, station_to, time_after, (err, trains) => {
            if (err) {
                console.error('Error finding available trains:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }

            if (!trains.length) {
                return res.status(403).json({ message: `No ticket available for station: ${station_from} to station: ${station_to}` });
            }

            // Generate ticket details
            const ticket = {
                ticket_id: generateTicketId(),
                balance: walletBalance - totalFare,
                wallet_id: wallet_id,
                stations: generateStationsList(trains)
            };

            // TODO: Deduct fare from wallet balance and update database

            // Return ticket details
            res.status(201).json(ticket);
        });
    });
});

// Function to calculate ticket fare
function calculateTicketFare(station_from, station_to) {
    // Placeholder implementation for calculating fare based on stations
    return Math.abs(station_to - station_from) * 10; // Fare calculation logic can be more complex
}

// Function to find available trains
// Function to find available trains
function findAvailableTrains(station_from, station_to, time_after, callback) {
    const query = `
        SELECT DISTINCT t.train_id, s.departure_time
        FROM Train t
        JOIN Stops s ON t.train_id = s.train_id
        WHERE s.station_id >= ? AND s.station_id <= ?
            AND s.departure_time >= ?
    `;
    const params = [station_from, station_to, time_after];

    db.all(query, params, (err, rows) => {
        if (err) {
            callback(err);
            return;
        }

        const availableTrains = rows.map(row => ({
            train_id: row.train_id,
            departure_time: row.departure_time
        }));

        callback(null, availableTrains);
    });
}
db.run(`CREATE TABLE IF NOT EXISTS Ticket (
    ticket_id INTEGER PRIMARY KEY,
    wallet_id INTEGER NOT NULL,
    balance INTEGER NOT NULL,
    FOREIGN KEY(wallet_id) REFERENCES User(user_id)
)`);

// Function to generate ticket ID
function generateTicketID(callback) {
    db.get("SELECT MAX(ticket_id) AS max_id FROM Ticket", (err, row) => {
        if (err) {
            callback(err);
            return;
        }
        const maxID = row.max_id || 0;
        const ticketID = maxID + 1;
        callback(null, ticketID);
    });
}

// Function to generate list of stations in order of visits
function generateStationsList(trains, callback) {
    let stationsList = [];

    // Iterate through each train to fetch its stops
    let completed = 0;
    trains.forEach(train => {
        db.all('SELECT * FROM Stops WHERE train_id = ? ORDER BY departure_time ASC', [train.train_id], (err, stops) => {
            if (err) {
                callback(err, null);
                return;
            }
            
            // Add stops to the list
            stationsList = stationsList.concat(stops.map(stop => {
                return {
                    station_id: stop.station_id,
                    train_id: train.train_id,
                    arrival_time: stop.arrival_time,
                    departure_time: stop.departure_time
                };
            }));

            // Check if all trains have been processed
            completed++;
            if (completed === trains.length) {
                // Sort the stations list by departure time
                stationsList.sort((a, b) => {
                    if (a.departure_time < b.departure_time) return -1;
                    if (a.departure_time > b.departure_time) return 1;
                    return 0;
                });

                // Return the generated stations list
                callback(null, stationsList);
            }
        });
    });
}



app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

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

            // Generate ticket ID
            generateTicketID((err, ticketId) => {
                if (err) {
                    console.error('Error generating ticket ID:', err);
                    return res.status(500).json({ message: 'Internal server error' });
                }
                
                // Generate stations list
                generateStationsList(trains, (err, stations) => {
                    if (err) {
                        console.error('Error generating stations list:', err);
                        return res.status(500).json({ message: 'Internal server error' });
                    }

                    // Generate ticket details
                    const ticket = {
                        ticket_id: ticketId,
                        balance: walletBalance - totalFare,
                        wallet_id: wallet_id,
                        stations: stations
                    };

                    // Store ticket details in the database
                    db.run(`INSERT INTO Ticket (ticket_id, wallet_id, balance) VALUES (?, ?, ?)`, [ticketId, wallet_id, ticket.balance], (err) => {
                        if (err) {
                            console.error('Error storing ticket details:', err);
                            return res.status(500).json({ message: 'Internal server error' });
                        }
                        
                        // Return ticket details
                        res.status(201).json(ticket);
                    });
                });
            });
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
    let stationsMap = new Map(); // Use a map to store unique stations

    // Iterate through each train to fetch its stops
    let completed = 0;
    trains.forEach(train => {
        db.all('SELECT * FROM Stops WHERE train_id = ? ORDER BY departure_time ASC', [train.train_id], (err, stops) => {
            if (err) {
                callback(err, null);
                return;
            }

            // Add stops to the map
            stops.forEach(stop => {
                const key = `${stop.station_id}_${train.train_id}`; // Unique key for station and train combination
                if (!stationsMap.has(key)) {
                    stationsMap.set(key, {
                        station_id: stop.station_id,
                        train_id: train.train_id,
                        arrival_time: stop.arrival_time,
                        departure_time: stop.departure_time
                    });
                }
            });

            // Check if all trains have been processed
            completed++;
            if (completed === trains.length) {
                // Convert map values to array and sort by departure time
                const stationsList = Array.from(stationsMap.values()).sort((a, b) => {
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
// Function to calculate the time difference between two timestamps
function calculateTimeDifference(arrivalTime, departureTime) {
    if (!arrivalTime || !departureTime) {
        return 0; // If either arrivalTime or departureTime is not provided, return 0
    }

    // Parse arrival and departure times
    const arrival = parseTime(arrivalTime);
    const departure = parseTime(departureTime);

    // Calculate the time difference in minutes
    const minutesDiff = calculateMinutesDifference(arrival, departure);

    return minutesDiff;
}

// Function to parse time string in the format hh:mm and return an object with hours and minutes
function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
}

// Function to calculate the difference in minutes between two time objects
function calculateMinutesDifference(time1, time2) {
    const totalMinutes1 = time1.hours * 60 + time1.minutes;
    const totalMinutes2 = time2.hours * 60 + time2.minutes;
    return totalMinutes2 - totalMinutes1;
}

function fetchTrainNetworkData(callback) {
    // Query the database to retrieve the train network data
    db.all('SELECT * FROM Stops', (err, rows) => {
        if (err) {
            console.error('Error retrieving train network data:', err);
            callback(err, null);
            return;
        }

        // Prepare the train network data in the required format
        const trainNetwork = {};

        // Iterate through each row (stop) in the database result
        rows.forEach(row => {
            const { train_id, station_id, arrival_time, departure_time, fare } = row;

            // Initialize the train network entry if not already present
            if (!trainNetwork[station_id]) {
                trainNetwork[station_id] = {};
            }

            // Add the destination station and its details to the train network entry
            trainNetwork[station_id][train_id] = {
                cost: fare, // Assuming fare represents cost
                time: calculateTimeDifference(arrival_time, departure_time) // Calculate time difference between arrival and departure
            };
        });

        // Pass the train network data to the callback function
        callback(null, trainNetwork);
    });
}
function dijkstraFromDatabase(start, end, optimize, callback) {
    fetchTrainNetworkData((err, trainNetwork) => {
        if (err) {
            callback(err, null);
            return;
        }

        const queue = new PriorityQueue();
        const distances = {};
        const distance1 = {};
        const previous = {};
        let path = [];
        let smallest;

        // Build up initial state
        for (let vertex in trainNetwork) {
            if (vertex === start) {
                distances[vertex] = 0;
                distance1[vertex] = 0;
                queue.enqueue(vertex, 0); // Start with cost/time 0
            } else {
                distances[vertex] = Infinity;
                distance1[vertex] = Infinity;
                queue.enqueue(vertex, Infinity); // Other vertices have infinite cost/time initially
            }
            previous[vertex] = null;
        }

        while (!queue.isEmpty()) {
            smallest = queue.dequeue().element;
            if (smallest === end) {
                // Build path to return at end
                while (previous[smallest]) {
                    path.push(smallest);
                    smallest = previous[smallest];
                }
                break;
            }
            if (smallest || distances[smallest] !== Infinity) {
                for (let neighbor in trainNetwork[smallest]) {
                    // Find neighboring node
                    let nextNode = trainNetwork[smallest][neighbor];
                    // Calculate new distance to neighboring node based on requested optimization criterion
                    let candidate =
                        distances[smallest] +
                        (optimize === "cost" ? nextNode.cost : nextNode.time);
                    let nw =
                        distance1[smallest] +
                        (optimize === "cost" ? nextNode.time : nextNode.cost);
                    let nextNeighbor = neighbor;
                    if (candidate < distances[nextNeighbor]) {
                        // Updating new smallest distance to neighbor
                        distances[nextNeighbor] = candidate;
                        distance1[nextNeighbor] = nw;
                        // Updating previous - How we got to neighbor
                        previous[nextNeighbor] = smallest;
                        // Enqueue in priority queue with new priority based on requested criterion
                        queue.enqueue(nextNeighbor, candidate);
                    }
                }
            }
        }
        
        callback(null, {
            distance: distances[end],
            distance1: distance1[end],
            path: path.concat(start).reverse()
        });
    });
}
app.get("/api/routes", (req, res) => {
    const { from, to, optimize } = req.query;
    console.log(from, to, optimize);
    
    // Calculate optimal route using Dijkstra's algorithm with data from the database
    dijkstraFromDatabase(from, to, optimize, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error calculating optimal route' });
        }
        
        console.log(result);
        
        // Check if a route is found
        if (result.distance === Infinity || result.distance1 === Infinity) {
            // No route is available
            return res.status(403).json({
                message: `No routes available from station: ${from} to station: ${to}`,
            });
        }

        let totalTime = 0;
        let totalCost = 0;
        if (optimize === "cost") {
            totalCost = result.distance;
            totalTime = result.distance1;
        } else {
            totalTime = result.distance;
            totalCost = result.distance1;
        }

        // Generate response
        const response = {
            total_cost: totalCost, // Assuming distance represents cost
            total_time: totalTime, // Assuming distance represents time
            stations: result.path.map((station) => ({
                station_id: station,
                train_id: null, // Replace with actual train ID based on schedules
                arrival_time: null, // Arrival time is null for first station
                departure_time: null, // Departure time is null for last station
            })),
        };

        return res.status(201).json(response);
    });
});
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

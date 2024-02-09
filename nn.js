const express = require("express");
const app = express();
const PORT = 8001;

// Define the train network graph data
const graph = {
  1: {
    2: { cost: 5, time: 10 },
    3: { cost: 8, time: 15 },
  },
  2: {
    1: { cost: 5, time: 10 },
    4: { cost: 10, time: 20 },
  },
  3: {
    1: { cost: 8, time: 15 },
    4: { cost: 6, time: 12 },
  },
  4: {
    2: { cost: 10, time: 20 },
    3: { cost: 6, time: 12 },
    5: { cost: 4, time: 8 },
  },
  5: {
    4: { cost: 4, time: 8 },
  },
};

// Function to calculate optimal route using Dijkstra's algorithm based on cost or time
function dijkstra(graph, start, end, optimize) {
  const queue = new PriorityQueue();
  const distances = {};
  const distance1 = {};
  const previous = {};
  let path = [];
  let smallest;

  // Build up initial state
  for (let vertex in graph) {
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
    if (smallest  distances[smallest] !== Infinity) {
      for (let neighbor in graph[smallest]) {
        // Find neighboring node
        let nextNode = graph[smallest][neighbor];
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
  return {
    distance: distances[end],
    distance1: distance1[end],
    path: path.concat(start).reverse(),
  };
}

class PriorityQueue {
  constructor() {
    this.queue = [];
  }

  enqueue(element, priority) {
    this.queue.push({ element, priority });
    this.sort();
  }

  dequeue() {
    if (!this.isEmpty()) {
      return this.queue.shift();
    }
    return null;
  }

  sort() {
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}

// Define the route handler for /api/routes
app.get("/api/routes", (req, res) => {
  const { from, to, optimize } = req.query;
  console.log(from, to, optimize);
  // Calculate optimal route using Dijkstra's algorithm
  const result = dijkstra(graph, from, to, optimize);
  console.log(result);
  // Check if a route is found
  if (result.distance === Infinity  result.distance1 === Infinity) {
    // No route is available
    return res.status(403).json({
      message: No routes available from station: ${from} to station: ${to},
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

// Start the Express server
app.listen(PORT, () => {
  console.log(Server is running on port ${PORT});
});
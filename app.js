const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 8000;

app.use(bodyParser.json());

const db = new sqlite3.Database(':memory:'); 
// Create books table
db.run(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,
    title TEXT,
    author TEXT,
    genre TEXT,
    price REAL
  )
`);

// Add Books API
app.post('/api/books', (req, res) => {
  const { id, title, author, genre, price } = req.body;

  // Check if the ID already exists
  db.get('SELECT id FROM books WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (row) {
      return res.status(400).json({  });
    }

    // Insert the new book
    db.run(
      'INSERT INTO books (id, title, author, genre, price) VALUES (?, ?, ?, ?, ?)',
      [id, title, author, genre, price],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Internal Server Error' });
        }
       
        res.status(201).json({ id, title, author, genre, price });
      }
    );
  });
});
app.put('/api/books/:id', (req, res) => {
    const bookId = parseInt(req.params.id);
    const { title, author, genre, price } = req.body;
  
    // Checking if the book with the given ID exists
    db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, existingBook) => {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
  
      if (!existingBook) {
        return res.status(404).json({ message: `book with id: ${bookId} was not found` });
      }
  
      // Update the book details
      db.run(
        'UPDATE books SET title = ?, author = ?, genre = ?, price = ? WHERE id = ?',
        [title, author, genre, price, bookId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
          }
  
          // Fetch the updated book from the database
          db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, updatedBook) => {
            if (err) {
              return res.status(500).json({ error: 'Internal Server Error' });
            }
  
            res.status(200).json(updatedBook);
          });
        }
      );
    });
  });
  app.get('/api/books', (req, res) => {
    // Fetch all books from the database and sort by ID in ascending order
    db.all('SELECT * FROM books ORDER BY id ASC', (err, books) => {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
  
      // Return the list of books
      res.status(200).json({ books });
    });
  });
  app.get('/api/books', (req, res) => {
    const query = url.parse(req.url, true).query;
    const { title, author, genre, sort, order } = query;
  
    let sql = 'SELECT * FROM books';
  
    // Handle search criteria
    const searchCriteria = [];
    if (title) searchCriteria.push(`title = '${title}'`);
    if (author) searchCriteria.push(`author = '${author}'`);
    if (genre) searchCriteria.push(`genre = '${genre}'`);
  
    if (searchCriteria.length > 0) {
      sql += ` WHERE ${searchCriteria.join(' AND ')}`;
    }
  
    // Handle sorting
    if (sort) {
      const sortingOrder = order && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${sort} ${sortingOrder}, id ASC`;
    } else {
      sql += ' ORDER BY id ASC';
    }

  
    // Fetch books based on the constructed SQL query
    db.all(sql, (err, books) => {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      print(books);
  
      // Return the list of books
      res.status(200).json({ books });
    });
  });
  
  

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

# API Design

## REST Endpoints

The API follows RESTful conventions.

### Authentication

JWT-based authentication.

```javascript
router.post('/login', async (req, res) => {
  const token = jwt.sign({ userId }, secret);
  res.json({ token });
});
```

## Error Handling

Standard HTTP error codes are used.

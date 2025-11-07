const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Test server works!\n');
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`✓ Test server listening on port ${PORT}`);
  console.log(`✓ Access at: http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});


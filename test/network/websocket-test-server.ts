const port = 8123;

Deno.serve({ port }, (req) => {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected a WebSocket request", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => console.log("WebSocket connection opened");
  socket.onmessage = (event) => {
    console.log("Received:", event.data);
    socket.send(event.data); // Echo back
  };
  socket.onclose = () => console.log("WebSocket connection closed");
  socket.onerror = (err) => console.error("WebSocket error:", err);

  return response;
});

console.log(`WebSocket server running on ws://localhost:${port}`);

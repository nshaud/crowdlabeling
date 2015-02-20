// Init everything
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var app = require('express')();
var fs = require('fs');
// Start the server
var server = app.listen(8080);
// Init socket.io
var io = require('socket.io')(server);

// Root renders the layout
app.get('/', function(req, res) {
    res.render('layout.ejs', {content: "hello"});
});

// Renders the room
app.get('/room/:room/:image', function(req, res) {
    var data = { room : req.params.room, image_path : 'images/' + req.params.image, content : 'room', base_path : "http://" + req.headers.host + "/" };
    res.render('layout.ejs', data);
});

// Renders the image
app.get('/images/:image', function(req, res) {
    res.setHeader('Content-Type', 'image/png');
    var img = fs.readFileSync('images/' + req.params.image + '.png');
    res.end(img, 'binary');
});

// Else, send a 404 not found error
app.use(function(req, res, next){
    res.setHeader('Content-Type', 'text/html');
    res.send(404, 'Page not found');
});

// Broadcast chat messages
// TODO : restrict messages to people in the same room
io.sockets.on('connection', function(socket) {
    socket.room = "lobby";

    socket.on('chat_message', function(message) {
        socket.broadcast.to(socket.room).emit('chat_message', message);
        console.log('A client sent the following message : ' + message);
    });

    socket.on('join_room', function(room) {
        socket.room = room;
        socket.join(socket.room);
        socket.broadcast.to(socket.room).emit('chat_message', 'A user entered the room');
        console.log('A client entered the room : ' + socket.room);
    });

    socket.on('new_tag', function(tag) {
        console.log('A client added a new tag : ' + tag + ' in room ' + socket.room);
    });

    console.log('A new client has connected !');
});



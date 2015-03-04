// Init everything
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var express = require('express');
var app = express();
var fs = require('fs');
var favicon = require('serve-favicon');

app.use(favicon(__dirname + '/public/favicon.ico'));
// Start the server
var server = app.listen(8080);
// Init socket.io
var io = require('socket.io')(server);

var rooms = 0;

app.use('/public', express.static(__dirname + '/public'));
app.use('/styles', express.static(__dirname + '/styles'));
app.use('/scripts', express.static(__dirname + '/scripts'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));
app.use('/fonts', express.static(__dirname + '/bower_components/bootstrap/fonts'));

// Root renders the layout
app.get('/', function(req, res) {
    res.render('layout.ejs', {content: "welcome", rooms: rooms});
});

// Renders the room
app.get('/room/:room/:image', function(req, res) {
    var data = { 
        room : req.params.room, 
        image : req.params.image,
        image_path : 'images/' + req.params.image, 
        content : 'room', 
        base_path : "http://" + req.headers.host + "/" 
    };
    res.render('layout.ejs', data);
});

// Renders the image
app.get('/images/:image', function(req, res) {
    res.setHeader('Content-Type', 'image/png');
    
    var pathToImage = 'images/' + req.params.image;
    
    var img;
    if (fs.existsSync(pathToImage + '.png')) {
        img = fs.readFileSync(pathToImage + '.png');
    } else {
        img = fs.readFileSync(pathToImage + '.jpg');
    }
    res.end(img, 'binary');
});

// Else, send a 404 not found error
app.use(function(req, res, next){
    res.setHeader('Content-Type', 'text/html');
    res.send(404, 'Page not found');
});

var chatRooms = [];
var clients = {};

// Broadcast chat messages
io.sockets.on('connection', function(socket) {
    socket.room = "lobby";
    clients[socket.id] = socket;

    socket.on('chat_message', function(message) {
        socket.broadcast.to(socket.room).emit('chat_message', message);
        console.log('[' + socket.room + '] A client sent the following message : ' + message);
    });

    socket.on('join_room', function(room) {
        socket.room = room;
        socket.join(socket.room);

        if (!chatRooms[room]) {
            // this room does not exist, create room
            chatRooms[room] = new ChatRoom(room);
            console.log('[' + chatRooms[room].name + '] Room created.');
        }
        chatRooms[room].numberOfClients++;
        
        socket.broadcast.to(socket.room).emit('chat_event', 'A user entered the room');

        console.log('[' + socket.room + '] A client entered the room.');
        console.log('[' + socket.room + '] Number of clients : ' + chatRooms[room].numberOfClients);
    });

    socket.on('pass_intent', function(image){
        var next_image = image + 1;

        room = chatRooms[socket.room];
        room.passConfirmations++;
        console.log('[' + socket.room + '] A client wants to switch to the next image (' + next_image + ') ' + room.passConfirmations + ' users agree');
        if(room.passConfirmations == chatRooms[socket.room].numberOfClients){
            io.sockets.in(socket.room).emit('pass_confirm', next_image);
            console.log('[' + socket.room + '] Switching to image ' + next_image);
        } else {
            socket.broadcast.to(socket.room).emit('pass_intent', image);
        }
    });

    socket.on('pass_deny', function(){
        chatRooms[socket.room].passConfirmations = 0;
        io.sockets.in(socket.room).emit('pass_deny', '');
    });

    socket.on('tag_intent', function(tag) {

        console.log('[' + socket.room + '] A client wants to insert a new tag : ' + tag.label);
        
        tag = chatRooms[socket.room].addTag(tag.label, tag.position);
        tag.numberOfConfirmations++; // confirmation of the creator of the tag

        // send intent to the creator of the tag
        // this is used to send the tag id, created in the server
        clients[socket.id].emit('tag_intent_self', tag);
        // send intent to others in the room
        socket.broadcast.to(socket.room).emit('tag_intent', tag);

        // send confirmation of the user who wants to create the tag
        var data = {
            tag: tag,
            numberOfClients: chatRooms[socket.room].numberOfClients
        };
        io.sockets.in(socket.room).emit('tag_confirm', data);

        if (tag.numberOfConfirmations == chatRooms[socket.room].numberOfClients) {
            console.log('[' + socket.room + '] Tag creation : ' + tag.label);
            io.sockets.in(socket.room).emit('tag_creation', tag);
        }
    });

    socket.on('tag_confirm', function(id) {
        
        var tag = chatRooms[socket.room].getTag(id);
        tag.numberOfConfirmations++;

        var numberOfClients = chatRooms[socket.room].numberOfClients;

        console.log('[' + socket.room + '] A client confirmed the tag : ' + tag.label);
        console.log('[' + socket.room + '] Number of confirmations : ' + tag.numberOfConfirmations);
        console.log('[' + socket.room + '] Number of clients : ' + numberOfClients);

        var data = {
            tag: tag,
            numberOfClients: numberOfClients
        };
        io.sockets.in(socket.room).emit('tag_confirm', data);

        if (tag.numberOfConfirmations == numberOfClients) {
            console.log('[' + socket.room + '] Tag creation : ' + tag.label);
            io.sockets.in(socket.room).emit('tag_creation', tag);
        }
    });

    socket.on('tag_delete', function(id) {
        var tag = chatRooms[socket.room].getTag(id); 

        console.log('[' + socket.room + '] A client deleted the tag : ' + tag.label);
        io.sockets.in(socket.room).emit('tag_delete', tag);

        chatRooms[socket.room].removeTag(id);
    });

    socket.on('disconnect', function() {

        if (chatRooms[socket.room]) {
        
            chatRooms[socket.room].numberOfClients--;

            console.log('[' + socket.room + '] A client disconnected');
            console.log('[' + socket.room + '] Number of clients : ' + chatRooms[socket.room].numberOfClients);

            if (chatRooms[socket.room].numberOfClients === 0) {
                console.log('[' + chatRooms[socket.room].name + '] Room deleted.');
                delete chatRooms[socket.room];
                rooms = rooms - 1;
            }
        }
        
        delete clients[socket.id];
    });

    // console.log('A new client has connected !');
});

// Auxiliar classes

// Represents a chat room
function ChatRoom(name) {
    this.name = name;
    this.passConfirmations = 0;
    this.numberOfClients = 0;   
    this.tagIdCount = 0;        // used for generating ids for the tags. It should never be decremented !
    this.tags = [];             // list of tags used in the chat room
    rooms = rooms + 1;
}
ChatRoom.prototype.getTag = function (id) {
    for (var i = 0; i < this.tags.length; i++) {
        if (this.tags[i].id == id) {
            return this.tags[i];
        }
    }
};
ChatRoom.prototype.addTag = function (label, position) {
    var tag = new Tag(this.tagIdCount, label, position);
    this.tags.push(tag);
    this.tagIdCount++;
    return tag;
};
ChatRoom.prototype.removeTag = function (id) {
    for (var i = 0; i < this.tags.length; i++) {
        if (this.tags[i].id == id) {
            this.tags.splice(i, 1);
        }
    }
};

// Represents a tag
function Tag(id, label, position) {
    this.id = id;
    this.label = label;
    this.position = position;
    this.numberOfConfirmations = 0; 
}




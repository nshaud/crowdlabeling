# CrowdLabeling

A web-application for labeling images together.

## Install the dependencies

First, install node.js.

Then, install **express**, **ejs** and **socket.io** with **npm** :

    npm install express ejs socket.io

Start the node.js server

    node server.js

Access via browser to *http://localhost:8080*. Rooms are *http://localhost:8080/room/1/1* (first 1 is for the room number, second 1 is for the image number. Don't try an image number greater than 1 if you didn't add new images to the *images/* folder).

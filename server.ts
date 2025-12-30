import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer, {
        path: "/api/socket/io",
        addTrailingSlash: false,
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        // console.log("New client connected", socket.id);

        socket.on("join-room", (slug: string) => {
            socket.join(slug);
            // console.log(`Client ${socket.id} joined room ${slug}`);
        });

        socket.on("code-change", (data: { slug: string; newCode: string }) => {
            // Broadcast to everyone ELSE in the room
            socket.to(data.slug).emit("code-change", data.newCode);
        });

        socket.on("disconnect", () => {
            // console.log("Client disconnected", socket.id);
        });
    });

    httpServer.listen(port, () => {
        console.log(
            `> Ready on http://${hostname}:${port} as ${dev ? "development" : "production"
            }`
        );
    });
});

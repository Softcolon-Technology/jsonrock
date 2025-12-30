"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
    if (!socket) {
        // use undefined to connect to window.location (handles ngrok automatically)
        const url = process.env.NEXT_PUBLIC_SITE_URL || undefined;
        socket = io(url, {
            path: "/api/socket/io",
            addTrailingSlash: false,
            transports: ["websocket", "polling"], // Try websocket first if possible? No, defaults are fine usually but let's be explicit
            reconnection: true,
            reconnectionAttempts: 5,
        });
    }
    return socket;
};

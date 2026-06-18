import type { IncomingMessage } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { verifyAccessToken } from '../lib/tokens';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Set<WebSocket>;
}

const rooms = new Map<string, Room>();

function getRoom(projectId: string): Room {
  let room = rooms.get(projectId);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    room = { doc, awareness, conns: new Set() };
    rooms.set(projectId, room);

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      broadcast(room!, encoding.toUint8Array(encoder), origin as WebSocket | null);
    });
    awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changed = [...added, ...updated, ...removed];
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
      );
      broadcast(room!, encoding.toUint8Array(encoder), null);
    });
  }
  return room;
}

function broadcast(room: Room, data: Uint8Array, exclude: WebSocket | null): void {
  for (const conn of room.conns) {
    if (conn !== exclude && conn.readyState === WebSocket.OPEN) conn.send(data);
  }
}

/**
 * CRDT collaboration endpoint: ws://host/collab/<projectId>?token=<accessToken>
 * Auth: JWT + workspace membership (EDITOR+ writes; VIEWER read-only is enforced
 * client-side; server still requires membership).
 */
export function attachCollabServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/collab/')) return; // socket.io handles its own path
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const projectId = url.pathname.split('/')[2] ?? '';
      const token = url.searchParams.get('token') ?? '';
      const payload = verifyAccessToken(token);

      const allowed = await prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          workspace: { members: { some: { userId: payload.sub } } },
        },
        select: { id: true },
      });
      if (!allowed) {
        ws.close(4403, 'forbidden');
        return;
      }

      const room = getRoom(projectId);
      room.conns.add(ws);
      ws.binaryType = 'arraybuffer';

      // Initial handshake: sync step 1 + current awareness states.
      {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeSyncStep1(encoder, room.doc);
        ws.send(encoding.toUint8Array(encoder));
        const states = room.awareness.getStates();
        if (states.size > 0) {
          const awarenessEncoder = encoding.createEncoder();
          encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(
            awarenessEncoder,
            awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...states.keys()]),
          );
          ws.send(encoding.toUint8Array(awarenessEncoder));
        }
      }

      ws.on('message', (data: ArrayBuffer | Buffer) => {
        try {
          const decoder = decoding.createDecoder(new Uint8Array(data as ArrayBuffer));
          const messageType = decoding.readVarUint(decoder);
          if (messageType === MESSAGE_SYNC) {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_SYNC);
            syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
            if (encoding.length(encoder) > 1) ws.send(encoding.toUint8Array(encoder));
          } else if (messageType === MESSAGE_AWARENESS) {
            awarenessProtocol.applyAwarenessUpdate(
              room.awareness,
              decoding.readVarUint8Array(decoder),
              ws,
            );
          }
        } catch (err) {
          logger.warn('collab message error', { err: String(err) });
        }
      });

      ws.on('close', () => {
        room.conns.delete(ws);
        awarenessProtocol.removeAwarenessStates(
          room.awareness,
          [room.doc.clientID],
          null,
        );
        if (room.conns.size === 0) {
          // Free memory for idle rooms; doc state lives in project versions.
          room.doc.destroy();
          rooms.delete(projectId);
        }
      });
    } catch {
      ws.close(4401, 'unauthorized');
    }
  });
}

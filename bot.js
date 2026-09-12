const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const P = require('pino');

const MEU_NUMERO = "5588997321488@s.whatsapp.net"; // << TROCA AQUI, ex: 5588988887777@s.whatsapp.net

async function start(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, logger: P({level:'silent'}), printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', u => {
    if(u.connection==='open') console.log('CONECTADO 24/7!');
  });
  sock.ev.on('messages.upsert', async ({messages}) => {
    const msg = messages[0];
    if(!msg.message || msg.key.fromMe) return;
    if(msg.key.remoteJid!== MEU_NUMERO) return; // só você
    if(msg.key.remoteJid.endsWith('@g.us')) return; // ignora grupo

    const leg = msg.message.imageMessage?.caption || msg.message.extendedTextMessage?.text || "";
    if(!leg.toLowerCase().startsWith('!sticker')) return;

    const buff = await sock.downloadMediaMessage(msg);
    const webp = await sharp(buff).resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
    await sock.sendMessage(msg.key.remoteJid, { sticker: webp });
    console.log('figurinha feita!');
  });
}
start();
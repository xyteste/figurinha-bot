import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} from '@whiskeysockets/baileys';

import P from 'pino';
import sharp from 'sharp';
import fs from 'fs';

const OWNER_NUMBER = '5588997321488';

const CONFIG_FILE = './config.json';

const logger = P({
  level: 'silent'
});

// ==================================================
// CONFIGURAÇÃO PADRÃO
// ==================================================

let config = {
  autor: '',
  descricao: ''
};

// ==================================================
// CARREGAR CONFIGURAÇÃO
// ==================================================

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(
        fs.readFileSync(CONFIG_FILE, 'utf8')
      );

      config = {
        autor: saved.autor || '',
        descricao: saved.descricao || ''
      };
    }
  } catch (error) {
    console.error('Erro ao carregar config.json:', error);
  }
}

// ==================================================
// SALVAR CONFIGURAÇÃO
// ==================================================

function saveConfig() {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(config, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('Erro ao salvar config.json:', error);
  }
}

// ==================================================
// INICIAR BOT
// ==================================================

async function startBot() {
  loadConfig();

  const { state, saveCreds } =
    await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger,
    shouldSyncHistoryMessage: () => false
  });

  sock.ev.on('creds.update', saveCreds);

  // ==================================================
  // CONEXÃO
  // ==================================================

  sock.ev.on('connection.update', async (update) => {
    const {
      connection,
      lastDisconnect
    } = update;

    if (connection === 'open') {
      console.log('');
      console.log('================================');
      console.log('✅ BOT CONECTADO!');
      console.log('================================');
      console.log(`🔒 Proprietário: ${OWNER_NUMBER}`);
      console.log('📸 Comando: !sticker');
      console.log('');
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      const reconnect =
        statusCode !== DisconnectReason.loggedOut;

      console.log('');
      console.log('❌ Conexão encerrada.');

      if (reconnect) {
        console.log('🔄 Reconectando em 3 segundos...');

        setTimeout(() => {
          startBot();
        }, 3000);
      } else {
        console.log(
          '⚠️ Sessão encerrada. Será necessário conectar novamente.'
        );
      }
    }
  });

  // ==================================================
  // MENSAGENS
  // ==================================================

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const message of messages) {
      try {
        if (!message.message) {
          continue;
        }

        const jid = message.key.remoteJid;

        if (!jid) {
          continue;
        }

        // ==================================================
        // IGNORAR GRUPOS
        // ==================================================

        if (jid.endsWith('@g.us')) {
          continue;
        }

        // ==================================================
        // IDENTIFICAR REMETENTE
        // ==================================================

        const sender = message.key.fromMe
          ? OWNER_NUMBER
          : message.key.participant || jid;

        const senderNumber =
          sender
            ?.split('@')[0]
            ?.split(':')[0];

        // ==================================================
        // SEGURANÇA
        // SOMENTE O DONO PODE USAR
        // ==================================================

        if (senderNumber !== OWNER_NUMBER) {
          continue;
        }

        // ==================================================
        // TEXTO DA MENSAGEM
        // ==================================================

        const conversation =
          message.message.conversation ||
          message.message.extendedTextMessage?.text ||
          '';

        const text =
          conversation.trim();

        const lowerText =
          text.toLowerCase();

        // ==================================================
        // COMANDO !AUTOR
        // ==================================================

        if (lowerText === '!autor') {
          await sock.sendMessage(jid, {
            text:
              config.autor
                ? `✍️ Autor atual: ${config.autor}`
                : '✍️ Autor: desativado\n\nUse !autor Nome para definir.'
          });

          continue;
        }

        if (lowerText === '!autor off') {
          config.autor = '';

          saveConfig();

          await sock.sendMessage(jid, {
            text: '✅ Autor removido das figurinhas.'
          });

          continue;
        }

        if (lowerText.startsWith('!autor ')) {
          const newAuthor =
            text.substring(7).trim();

          if (!newAuthor) {
            await sock.sendMessage(jid, {
              text:
                '❌ Informe o nome do autor.\n\nExemplo:\n!autor Eric'
            });

            continue;
          }

          config.autor = newAuthor;

          saveConfig();

          await sock.sendMessage(jid, {
            text:
              `✅ Autor definido como: ${newAuthor}`
          });

          continue;
        }

        // ==================================================
        // COMANDO !DESCRICAO
        // ==================================================

        if (
          lowerText === '!descricao' ||
          lowerText === '!descrição'
        ) {
          await sock.sendMessage(jid, {
            text:
              config.descricao
                ? `📝 Descrição atual: ${config.descricao}`
                : '📝 Descrição: desativada\n\nUse !descricao texto para definir.'
          });

          continue;
        }

        if (
          lowerText === '!descricao off' ||
          lowerText === '!descrição off'
        ) {
          config.descricao = '';

          saveConfig();

          await sock.sendMessage(jid, {
            text: '✅ Descrição removida das figurinhas.'
          });

          continue;
        }

        if (
          lowerText.startsWith('!descricao ') ||
          lowerText.startsWith('!descrição ')
        ) {
          const prefix =
            lowerText.startsWith('!descrição ')
              ? 11
              : 11;

          const newDescription =
            text.substring(prefix).trim();

          if (!newDescription) {
            await sock.sendMessage(jid, {
              text:
                '❌ Informe uma descrição.\n\nExemplo:\n!descricao Minhas figurinhas'
            });

            continue;
          }

          config.descricao =
            newDescription;

          saveConfig();

          await sock.sendMessage(jid, {
            text:
              `✅ Descrição definida como: ${newDescription}`
          });

          continue;
        }

        // ==================================================
        // COMANDO !CONFIG
        // ==================================================

        if (lowerText === '!config') {
          const autor =
            config.autor || 'Desativado';

          const descricao =
            config.descricao || 'Desativada';

          await sock.sendMessage(jid, {
            text:
              `⚙️ CONFIGURAÇÃO ATUAL\n\n` +
              `✍️ Autor: ${autor}\n` +
              `📝 Descrição: ${descricao}\n\n` +
              `📸 Para criar figurinha:\n` +
              `Envie uma foto com !sticker`
          });

          continue;
        }

        // ==================================================
        // VERIFICAR IMAGEM
        // ==================================================

        const image =
          message.message.imageMessage;

        if (!image) {
          continue;
        }

        // ==================================================
        // VERIFICAR COMANDO !STICKER
        // ==================================================

        const caption =
          image.caption?.trim().toLowerCase();

        if (caption !== '!sticker') {
          continue;
        }

        console.log('');
        console.log('📸 Foto recebida.');
        console.log('🔄 Criando figurinha...');

        // ==================================================
        // BAIXAR IMAGEM
        // ==================================================

        const buffer =
          await downloadMediaMessage(
            message,
            'buffer',
            {},
            {
              logger,
              reuploadRequest:
                sock.updateMediaMessage
            }
          );

        // ==================================================
        // CONVERTER PARA WEBP
        // ==================================================

        const stickerBuffer =
          await sharp(buffer)
            .resize(512, 512, {
              fit: 'contain',
              background: {
                r: 0,
                g: 0,
                b: 0,
                alpha: 0
              }
            })
            .webp({
              quality: 90
            })
            .toBuffer();

        // ==================================================
        // ENVIAR FIGURINHA
        // ==================================================

        await sock.sendMessage(
          jid,
          {
            sticker: stickerBuffer,
            mimetype: 'image/webp',
            packname: config.descricao,
            author: config.autor
          },
          {
            quoted: message
          }
        );

        console.log('✅ Figurinha enviada!');
      } catch (error) {
        console.error(
          '❌ Erro ao processar mensagem:',
          error
        );
      }
    }
  });
}

// ==================================================
// INICIAR
// ==================================================

startBot().catch((error) => {
  console.error(
    '❌ Erro fatal:',
    error
  );
});          '⚠️ Sessão encerrada. Será necessário conectar novamente.'
        );
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const message of messages) {
      try {
        if (!message.message) continue;

        const jid = message.key.remoteJid;

        // Ignora grupos.
        if (jid?.endsWith('@g.us')) continue;

        // Número de quem enviou.
        const sender = message.key.fromMe
          ? OWNER_NUMBER
          : message.key.participant || jid;

        const senderNumber =
          sender?.split('@')[0]?.split(':')[0];

        // Somente o proprietário pode usar.
        if (senderNumber !== OWNER_NUMBER) continue;

        const image = message.message.imageMessage;

        // Só aceita imagens.
        if (!image) continue;

        const caption =
          image.caption?.trim().toLowerCase();

        // Comando obrigatório.
        if (caption !== '!sticker') continue;

        console.log('📸 Foto recebida...');

        const buffer = await downloadMediaMessage(
          message,
          'buffer',
          {},
          {
            logger,
            reuploadRequest: sock.updateMediaMessage
          }
        );

        console.log('🔄 Convertendo para figurinha...');

        const stickerBuffer = await sharp(buffer)
          .resize(512, 512, {
            fit: 'contain',
            background: {
              r: 0,
              g: 0,
              b: 0,
              alpha: 0
            }
          })
          .webp({
            quality: 90
          })
          .toBuffer();

        await sock.sendMessage(
          jid,
          {
            sticker: stickerBuffer,
            mimetype: 'image/webp',
            packname: STICKER_DESCRIPTION,
            author: STICKER_AUTHOR
          },
          {
            quoted: message
          }
        );

        console.log('✅ Figurinha enviada!');
      } catch (error) {
        console.error(
          '❌ Erro ao processar:',
          error
        );
      }
    }
  });
}

startBot().catch((error) => {
  console.error('❌ Erro fatal:', error);
});

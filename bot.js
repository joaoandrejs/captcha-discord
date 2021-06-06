const Discord = require("discord.js");
const client = new Discord.Client();

const config = require('./config.json')

let guildId = '845650285229113404'; // id do servidor

client.on('ready', () => {
  
  client.user.setActivity(`Captcha bot! | -help`);
  
  console.warn(`${client.user.username} (${client.user.id})
> Usúarios: ${client.users.cache.size}
> Servidores: ${client.guilds.cache.size}
https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=8`);
  
});

const db = require('quick.db');

let Cargo_Verificado = db.get(`Cargos/Verificado`) || '850761780275314728'; // Pega o ID do cargo verificado na DB, se não tiver ele pega o id entre ''
let Cargo_NãoVerificado = db.get(`Cargos/NãoVerificado`) ||'850761814207496222'; // Pega o ID do cargo não verificado na DB, se não tiver ele pega o id entre ''
let servidor = '845650285229113404'; // Id do servidor;

//  Função que gera um código aleatorio,
async function Captcha() {
  return Math.random().toString(36).slice(2, 8); // Gera um código aleatorio.
};

//  Função que fecha captcha
async function CloseCaptcha(user) {
  //Puxa o ticket do membro no servidor (se tiver)
  let Ticket = db.get(`tickets/${user.guild.id}/${user.id}/`) || 0;
  if (!Ticket) Ticket = 0;
  
  //Puxa o canal do membro (se tiver)
  let canal = db.get(`tickets/${user.guild.id}/${user.id}/canal`) || 0
  if (!canal || canal < 777) return;
  
  //Deleta o canal do membro
  let channel = user.guild.channels.cache.get(canal);
  channel.delete().catch(e => { });
  
  // Deleta todos as informaçẽs do captcha
  db.delete(`tickets/${user.guild.id}/${user.id}/`);
  db.delete(`tickets/${user.guild.id}/${canal.id}/canal`);
  db.delete(`tickets/${user.guild.id}/${user.id}/canal`)
};

//  Função que cria o captcha
async function CreateCaptcha(member) {
  // Fecha o captcha / Finaliza o captcha
  CloseCaptcha(member);
  
  // Código aleatorio que e criado
  let ReCaptcha = await Captcha();
  
  // Criando um novo canal
  member.guild.channels.create('🔐-Captcha-' + member.user.username, {
    type: 'text', // Tipo texto
  }).then(async canal => {
    
    // Alterando as permissões
    canal.createOverwrite(member, {
      SEND_MESSAGES: true,
      VIEW_CHANNEL: true
    })
    
    canal.createOverwrite(member.guild.id, {
      SEND_MESSAGES: false,
      VIEW_CHANNEL: false
    });
    
    // Cria o ticket na DB
    db.set(`tickets/${member.guild.id}/${member.id}/`, 1)
    db.set(`tickets/${member.guild.id}/${canal.id}/canal`, canal.id)
    db.set(`tickets/${member.guild.id}/${member.id}/canal`, canal.id)
    // Setando as tentativas
    db.set(`tickets/${member.guild.id}/${member.id}/tentativas`, 3)
    
    // Envia a mensagem
    await canal.send(member, { 
      embed: {
        description: `
Olá ${member} seja bem vindo ao sistema de captcha **${member.guild.name}**

Confirme o captcha abaixo para poder ter acesso aos outros canais do servidor e poder interagir com outros membros!

> \`${ReCaptcha}\`

*Você possui **60 segundos** para responder ou você será expulso.*
`,
        color: 'BLUE',
        timestamp: Date.now(),
        footer: {
          'icon_url': member.guild.iconURL({ dynamic: true }),
          'text': member.guild.name
        }
      }
    }).then(async msg => {
      
      // Faltando 15 segundos é emitido uma mensagem:
      setTimeout(() => canal.send(`⏰ **|** Você possui mais **15** segundos para responder.`), 45 *  1000);
      
      // Quando o tempo acabar é emitido uma mensagem:
      setTimeout(() => canal.send(`⏰ **|** O tempo para você se confirmar acabou.`), 60 * 1000);
      
      try {
        
        try {
          
          const filter = m => {
            if(m.author.bot) return; // Se for um bot não responder
            if(m.author.id === member.id && m.content === ReCaptcha) return true; // Se a mensagem não for igual o codigo não responde
            
            else {
              
              // Puxando as tentativas
              let tentativas = db.get(`tickets/${member.guild.id}/${member.id}/tentativas`)
              
              // Se as tentativas forem 0 será finalizado o ticket
              if (tentativas === 0) {
                
                // Dlay de 5 segundos:
                setTimeout(() => {
                  CloseCaptcha(member) // Fechar o ticket
                  member.kick().catch(e => { }); // Expulsa o usuário do servidor
                }, 5 * 1000) 
                
                // Mensagem enviada:
                m.channel.send(`❌ **|** Você você gastou todas as suas tentativas!`);
              } else {
                
                // Remove 1 da db
                db.subtract(`tickets/${member.guild.id}/${member.id}/tentativas`, 1)
                // Mensagem enviada:
                m.channel.send(`❌ **|** Você errou, você possui mais: ${tentativas} tentativas.`);
              }
              
              return false;
            }
          };
          
          // Coletor de mensagens
          const response = await msg.channel.awaitMessages(filter, { max: 1, time: 60 * 1000, errors: ['time']});
          
          if(response) {
            
            // Dlay de 5 segundos
            setTimeout(() => {
              FinishCaptcha(member) // Finaliza o captcha
            }, 5 * 1000)
            
            // Mensagem enviada:
            await msg.channel.send(`✅ **|** Você acertou!`);
          }  
        }
        catch(err) {
          
          // Dlay de 5 segundos
          setTimeout(() => {
            member.kick(); // Expulsa o membro
            CloseCaptcha(member) // Fecha o ticket
          }, 5 * 1000);
          
          // Mensagem enviada:
          await msg.channel.send(`❌ **|** O tempo acabou, você não conseguiu completar o captcha a tempo.`);
        }
      }
      catch(err) {
        //
      };
    })
    
  });
};

//  Função que finaliza o captcha
async function FinishCaptcha(member) {
  //Fecha o chat / Finzaliza o captcha
  CloseCaptcha(member);
  //Remove o cargo de não verificado
  await member.roles.remove(Cargo_NãoVerificado)
  //Adiciona o cargo de verificado
  await member.roles.add(Cargo_Verificado)
};

// Quando o usuario sair ele irá tentar fechar um ticket se tiver
client.on('guildMemberRemove', async member => {
  // Puxa o ticket (captcha) do usuário
  let Ticket = db.get(`tickets/${member.guild.id}/${member.id}/`) || 0;
  if (!Ticket) Ticket = 0;
  
  //Se o usuário tiver um ticket aberto ele irá fechar.
  if (Ticket > 0) {
    CloseCaptcha(member)
  };
});

// Quando o usuário entrar ele irá criar um novo captcha.
client.on('guildMemberAdd', async member => {
  member.roles.add(Cargo_NãoVerificado); // Adiciona o cargo de não verificado
  CreateCaptcha(member); // Cria o captch
});

// Evento message (Comandos)
client.on('message', async (message) => {
  
  let args = message.content.slice(config.prefixo.length).trim().split(/ +/g);
  let cmd = args.shift().toLowerCase();
  if (!message.content.startsWith(config.prefixo)) return;
  
  if (cmd === 'ajuda' || cmd === 'help') {
    let prefixo = config.prefixo;
    
    message.channel.send({
      embed: {
        description: `
${prefixo}eval
${prefixo}close/forceclose
${prefixo}r/restart
`,
        color: 'BLUE',
        timestamp: Date.now(),
        footer: {
          'icon_url': message.guild.iconURL({ dynamic: true }),
          'text': message.guild.name
        },
        "author": {
          "name": client.user.username,
          "icon_url": client.user.displayAvatarURL({ dynamic: true })
        },
      }
    })
  }
  
  if (cmd === 'eval') {
    
    if (message.author.id !== config.DONO)  return;
    
    function clean(text) {
      if (typeof(text) === "string")
          return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
      else
          return text;
    }
    
    let code = args.slice(0).join(' ');

    args = args.join(" ");
    
    try {
      
      var evaled = eval(args);
      if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
    
      const embed = new Discord.MessageEmbed()
      .setColor('BLUE')
      .setDEscription(`
**entrada**
\`\`\`${code}\`\`\`
**Saida**
\`\`\`js\n${clean(evaled)}\n\`\`\``)
      
      await message.channel.send(embed)
      
    } 
    catch (err) {

      const embed = new Discord.MessageEmbed()
      .setColor('BLUE')
      .setDEscription(`
**Entrada**
\`\`\`${code}\`\`\`
**Saida**
\`\`\`js\n${clean(err)}\n\`\`\`
`)
      message.channel.send(embed)
    }
  }
  
  if (cmd === 'close' || cmd === 'forceclose') {
    if (message.author.id !== config.DONO)  return;
    
    // Puxa um usuário:
    let user = message.guild.members.cache.get(args[0]) || message.mentions.members.first();
    if (!user) return message.channel.send(`❌ **|** Usuário não encontrado.`);
    
    //Puxa o ticket do membro no servidor (se tiver)
    let Ticket = db.get(`tickets/${message.guild.id}/${user.user.id}/`) || 0;
    if (!Ticket) Ticket = 0;
    
    //Verificando se o usuário possui um captcha aberto, se não é enviado uma mensagem
    if (Ticket < 1) {
      return message.channel.send(`❌ **|** Este usuário não possui um captcha aberto.`)
    }
    
    // Fechando o captcha
    CloseCaptcha(user)
    message.channel.send(`✅ **|** captcha fechado com sucesso!`)
  }
  
  if (cmd === 'r' || cmd === 'restart') {
    if (message.author.id !== config.DONO)  return;
    process.exit()
  }
})

// Logar o bot
client.login(config.TOKEN);

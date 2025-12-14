// Бот Тюлень Cards для GitHub Pages
// Полная версия для развертывания на GitHub

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const BOT_TOKEN = '8273781946:AAGuV4znNtNEHgCeDhRrCDQyPJKynzca2EQ';
const CHANNEL_USERNAME = '@SealCards';
const ADMIN_IDS = [8311080382];

// База данных в памяти (для демо-версии)
let usersDB = {};
let cardsDB = {};
let promocodesDB = {};

// Карты с редкостями
const CARDS_DATA = [
  // Здесь будут ваши карточки
];

// Редкости и шансы
const RARITY_MAP = {
  "common": "Обычная",
  "rare": "Редкая", 
  "epic": "Эпическая",
  "legendary": "Легендарная",
  "mythic": "Мифическая"
};

const DROP_RATES = {
  "Обычная": 0.70,
  "Редкая": 0.18,
  "Эпическая": 0.07,
  "Легендарная": 0.04,
  "Мифическая": 0.01
};

const RARITY_POINTS = {
  "Обычная": 1000,
  "Редкая": 2500,
  "Эпическая": 5000,
  "Легендарная": 15000,
  "Мифическая": 50000
};

const RARITY_COINS = {
  "Обычная": 3,
  "Редкая": 8,
  "Эпическая": 15,
  "Легендарная": 50,
  "Мифическая": 200
};

// Титлы
const TITLES = {
  0: "Новичок",
  5000: "Искатель тюленей",
  15000: "Знаток тюленей", 
  30000: "Эксперт тюленей",
  50000: "Мастер тюленей",
  100000: "Легенда тюленей"
};

// Функции для работы с пользователями
function getUser(userId, telegramUser = null) {
  const userIdStr = userId.toString();
  
  if (!usersDB[userIdStr]) {
    const displayName = telegramUser 
      ? (telegramUser.first_name || `User${userIdStr.slice(-4)}`)
      : `User${userIdStr.slice(-4)}`;
    
    usersDB[userIdStr] = {
      name: displayName,
      coins: 0,
      points: 3000,
      cards: [],
      last_card: 0,
      last_bonus: 0,
      favorite: null,
      title: "Новичок",
      registered: new Date().toISOString(),
      total_cards_collected: 0,
      bonus_attempts: 0,
      had_bonus: false,
      notified_unsubscribed: false,
      telegram_first_name: telegramUser?.first_name || null,
      telegram_last_name: telegramUser?.last_name || null,
      telegram_username: telegramUser?.username || null,
      used_promocodes: [],
      extra_attempts: 0
    };
  }
  
  return usersDB[userIdStr];
}

function updateUser(userId, updates) {
  const userIdStr = userId.toString();
  const user = getUser(userId);
  
  Object.assign(user, updates);
  usersDB[userIdStr] = user;
  
  return user;
}

function getTitle(points) {
  const sortedThresholds = Object.keys(TITLES).sort((a, b) => b - a);
  for (const threshold of sortedThresholds) {
    if (points >= parseInt(threshold)) {
      return TITLES[threshold];
    }
  }
  return "Новичок";
}

// Получение случайной карты
function getRandomCard() {
  const rarityRoll = Math.random();
  let cumulative = 0;
  let selectedRarity = "Обычная";
  
  for (const [rarity, chance] of Object.entries(DROP_RATES)) {
    cumulative += chance;
    if (rarityRoll <= cumulative) {
      selectedRarity = rarity;
      break;
    }
  }
  
  // В реальном боте здесь был бы выбор конкретной карты
  const cardName = `Тюлень-${Math.floor(Math.random() * 1000)}`;
  return {
    id: Math.floor(Math.random() * 1000000),
    name: cardName,
    rarity: selectedRarity,
    points: RARITY_POINTS[selectedRarity],
    coins: RARITY_COINS[selectedRarity]
  };
}

// Проверка подписки на канал
async function checkChannelSubscription(userId) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: CHANNEL_USERNAME,
        user_id: userId
      })
    });
    
    const data = await response.json();
    return data.result?.status === 'member' || 
           data.result?.status === 'administrator' || 
           data.result?.status === 'creator';
  } catch (error) {
    console.error('Ошибка проверки подписки:', error);
    return false;
  }
}

// Отправка сообщения
async function sendMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });
}

// Получение топа игроков
function getTopPlayers(limit = 10) {
  const users = Object.entries(usersDB);
  
  return users
    .map(([id, user]) => ({
      id: parseInt(id),
      name: user.name,
      points: user.points || 0,
      cards: new Set(user.cards || []).size,
      title: user.title || "Новичок"
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

// Обработчик запросов
async function handleRequest(request) {
  if (request.method === 'POST') {
    try {
      const update = await request.json();
      
      // Обработка команд
      if (update.message) {
        const chatId = update.message.chat.id;
        const userId = update.message.from.id;
        const text = update.message.text;
        const user = update.message.from;
        
        // Команда /start
        if (text === '/start') {
          const userData = getUser(userId, user);
          
          const welcomeMessage = `🦭 <b>Добро пожаловать в Тюлень Cards!</b>\n\n` +
            `Собирай уникальные карточки с тюленями, соревнуйся с другими игроками и стань лучшим коллекционером!\n\n` +
            `👤 <b>Ваш профиль:</b>\n` +
            `🎯 Очки: <b>${userData.points}</b>\n` +
            `🃏 Карты: <b>${new Set(userData.cards).size}</b>\n` +
            `💰 Монеты: <b>${userData.coins}</b>\n` +
            `🏆 Титул: <b>${userData.title}</b>\n\n` +
            `Используй команды:\n` +
            `/card - Получить карточку\n` +
            `/profile - Ваш профиль\n` +
            `/top - Топ игроков\n` +
            `/bonus - Бонус за подписку\n` +
            `/help - Помощь`;
          
          await sendMessage(chatId, welcomeMessage);
        }
        
        // Команда /card
        else if (text === '/card') {
          const userData = getUser(userId, user);
          const currentTime = Math.floor(Date.now() / 1000);
          
          // Проверка кулдауна (10 секунд для теста, в реальном боте 3600)
          if (currentTime - userData.last_card < 10) {
            const waitTime = 10 - (currentTime - userData.last_card);
            await sendMessage(chatId, `⏳ Подождите ${waitTime} секунд перед получением следующей карты!`);
            return new Response('OK');
          }
          
          // Получение карты
          const card = getRandomCard();
          const userCardsSet = new Set(userData.cards);
          const isNewCard = !userCardsSet.has(card.id);
          
          // Начисление наград
          let pointsEarned = isNewCard ? card.points : Math.floor(card.points / 2);
          let coinsEarned = card.coins;
          
          // Обновление данных пользователя
          const newCards = isNewCard ? [...userData.cards, card.id] : userData.cards;
          const newPoints = userData.points + pointsEarned;
          const newCoins = userData.coins + coinsEarned;
          
          updateUser(userId, {
            cards: newCards,
            points: newPoints,
            coins: newCoins,
            last_card: currentTime,
            total_cards_collected: userData.total_cards_collected + (isNewCard ? 1 : 0),
            title: getTitle(newPoints)
          });
          
          // Формирование сообщения
          const cardMessage = `✨ <b>${isNewCard ? 'Новая карточка!' : 'Карточка (дубликат)'}</b>\n\n` +
            `🐾 <b>${card.name}</b>\n` +
            `📊 Редкость: <b>${card.rarity}</b>\n` +
            `⭐ Очки: <b>+${pointsEarned}</b>\n` +
            `💰 Монеты: <b>+${coinsEarned}</b>\n\n` +
            `🎯 Статус: <b>${isNewCard ? 'Новая!' : 'Дубликат'}</b>\n` +
            `📈 Всего карт: <b>${new Set(newCards).size}</b>`;
          
          await sendMessage(chatId, cardMessage);
        }
        
        // Команда /profile
        else if (text === '/profile') {
          const userData = getUser(userId, user);
          const uniqueCards = new Set(userData.cards).size;
          
          const profileMessage = `👤 <b>Профиль игрока</b>\n\n` +
            `🎯 Имя: <b>${userData.name}</b>\n` +
            `🏆 Титул: <b>${userData.title}</b>\n` +
            `⭐ Очки: <b>${userData.points}</b>\n` +
            `🃏 Уникальных карт: <b>${uniqueCards}</b>\n` +
            `💰 Монеты: <b>${userData.coins}</b>\n` +
            `📊 Всего карт собрано: <b>${userData.total_cards_collected}</b>\n` +
            `🎁 Бонусных попыток: <b>${userData.extra_attempts}</b>\n\n` +
            `📅 Зарегистрирован: <b>${new Date(userData.registered).toLocaleDateString('ru-RU')}</b>`;
          
          await sendMessage(chatId, profileMessage);
        }
        
        // Команда /top
        else if (text === '/top') {
          const topPlayers = getTopPlayers(15);
          
          let topMessage = `🏆 <b>Топ 15 игроков</b>\n\n`;
          
          topPlayers.forEach((player, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            
            topMessage += `${medal} <b>${player.name}</b>\n` +
              `   ⭐ ${player.points} очков | 🃏 ${player.cards} карт\n`;
          });
          
          await sendMessage(chatId, topMessage);
        }
        
        // Команда /bonus
        else if (text === '/bonus') {
          const userData = getUser(userId, user);
          const currentTime = Math.floor(Date.now() / 1000);
          
          // Проверка подписки
          const isSubscribed = await checkChannelSubscription(userId);
          
          if (!isSubscribed) {
            const keyboard = {
              inline_keyboard: [[{
                text: "📢 Подписаться на канал",
                url: `https://t.me/SealCards`
              }]]
            };
            
            await sendMessage(
              chatId,
              `🎁 <b>Получи бонус за подписку!</b>\n\n` +
              `Подпишись на наш канал ${CHANNEL_USERNAME} и получи:\n` +
              `✅ +1000 очков\n` +
              `✅ +50 монет\n` +
              `✅ Дополнительную попытку\n\n` +
              `Бонус можно получать раз в 24 часа!`,
              keyboard
            );
            return new Response('OK');
          }
          
          // Проверка кулдауна бонуса (24 часа)
          if (currentTime - userData.last_bonus < 86400 && !userData.had_bonus) {
            const waitHours = Math.ceil((86400 - (currentTime - userData.last_bonus)) / 3600);
            await sendMessage(chatId, `⏳ Бонус можно получить через ${waitHours} часов!`);
            return new Response('OK');
          }
          
          // Выдача бонуса
          updateUser(userId, {
            points: userData.points + 1000,
            coins: userData.coins + 50,
            extra_attempts: userData.extra_attempts + 1,
            last_bonus: currentTime,
            had_bonus: true,
            bonus_attempts: userData.bonus_attempts + 1
          });
          
          await sendMessage(
            chatId,
            `🎉 <b>Бонус получен!</b>\n\n` +
            `✅ +1000 очков\n` +
            `✅ +50 монет\n` +
            `✅ +1 дополнительная попытка\n\n` +
            `Следующий бонус через 24 часа!\n` +
            `Спасибо за подписку! ❤️`
          );
        }
        
        // Команда /help
        else if (text === '/help') {
          const helpMessage = `🦭 <b>Тюлень Cards - Помощь</b>\n\n` +
            `<b>Основные команды:</b>\n` +
            `/start - Начать работу с ботом\n` +
            `/card - Получить случайную карточку\n` +
            `/profile - Посмотреть свой профиль\n` +
            `/top - Топ игроков\n` +
            `/bonus - Бонус за подписку на канал\n` +
            `/help - Эта справка\n\n` +
            `<b>Как играть:</b>\n` +
            `1. Используй /card чтобы получить карточку\n` +
            `2. Собирай уникальные карточки тюленей\n` +
            `3. Получай очки и монеты\n` +
            `4. Поднимайся в топе игроков\n\n` +
            `<b>Канал:</b> ${CHANNEL_USERNAME}\n` +
            `Подпишись и получай бонусы!`;
          
          await sendMessage(chatId, helpMessage);
        }
        
        // Команда /admin (только для админов)
        else if (text.startsWith('/admin') && ADMIN_IDS.includes(userId)) {
          const parts = text.split(' ');
          const command = parts[1];
          
          if (command === 'stats') {
            const totalUsers = Object.keys(usersDB).length;
            const totalCards = Object.values(usersDB).reduce((sum, user) => sum + (user.cards?.length || 0), 0);
            const uniqueCards = new Set(Object.values(usersDB).flatMap(user => user.cards || [])).size;
            const totalPoints = Object.values(usersDB).reduce((sum, user) => sum + (user.points || 0), 0);
            
            const statsMessage = `📊 <b>Статистика бота</b>\n\n` +
              `👥 Пользователей: <b>${totalUsers}</b>\n` +
              `🃏 Всего карт: <b>${totalCards}</b>\n` +
              `🎯 Уникальных карт: <b>${uniqueCards}</b>\n` +
              `⭐ Всего очков: <b>${totalPoints}</b>\n` +
              `💰 Всего монет: <b>${Object.values(usersDB).reduce((sum, user) => sum + (user.coins || 0), 0)}</b>`;
            
            await sendMessage(chatId, statsMessage);
          }
          
          else if (command === 'give' && parts.length === 4) {
            const targetId = parseInt(parts[2]);
            const amount = parseInt(parts[3]);
            
            if (isNaN(targetId) || isNaN(amount)) {
              await sendMessage(chatId, '❌ Неверный формат команды');
              return new Response('OK');
            }
            
            const targetUser = getUser(targetId);
            updateUser(targetId, {
              coins: (targetUser.coins || 0) + amount
            });
            
            await sendMessage(chatId, `✅ Начислено ${amount} монет пользователю ${targetUser.name}`);
          }
          
          else {
            await sendMessage(
              chatId,
              `🛠️ <b>Админ панель</b>\n\n` +
              `<b>Доступные команды:</b>\n` +
              `/admin stats - Статистика бота\n` +
              `/admin give [id] [amount] - Выдать монеты\n\n` +
              `<b>Всего пользователей:</b> ${Object.keys(usersDB).length}`
            );
          }
        }
      }
      
      // Обработка callback-запросов (кнопки)
      else if (update.callback_query) {
        const callback = update.callback_query;
        const chatId = callback.message.chat.id;
        const userId = callback.from.id;
        const data = callback.data;
        
        // Подтверждение получения callback
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callback_query_id: callback.id
          })
        });
        
        // Обработка callback данных
        if (data === 'get_bonus') {
          // Перенаправляем на команду /bonus
          const userData = getUser(userId, callback.from);
          const currentTime = Math.floor(Date.now() / 1000);
          
          const isSubscribed = await checkChannelSubscription(userId);
          
          if (!isSubscribed) {
            const keyboard = {
              inline_keyboard: [[{
                text: "📢 Подписаться на канал",
                url: `https://t.me/SealCards`
              }]]
            };
            
            await sendMessage(
              chatId,
              `🎁 <b>Сначала подпишись на канал!</b>\n\n` +
              `Подпишись на ${CHANNEL_USERNAME} чтобы получить бонус.`,
              keyboard
            );
          } else {
            // Проверка кулдауна
            if (currentTime - userData.last_bonus < 86400 && !userData.had_bonus) {
              const waitHours = Math.ceil((86400 - (currentTime - userData.last_bonus)) / 3600);
              await sendMessage(chatId, `⏳ Бонус можно получить через ${waitHours} часов!`);
            } else {
              // Выдача бонуса
              updateUser(userId, {
                points: userData.points + 1000,
                coins: userData.coins + 50,
                extra_attempts: userData.extra_attempts + 1,
                last_bonus: currentTime,
                had_bonus: true,
                bonus_attempts: userData.bonus_attempts + 1
              });
              
              await sendMessage(
                chatId,
                `🎉 <b>Бонус получен!</b>\n\n` +
                `✅ +1000 очков\n` +
                `✅ +50 монет\n` +
                `✅ +1 дополнительная попытка\n\n` +
                `Следующий бонус через 24 часа!`
              );
            }
          }
        }
      }
      
      return new Response('OK');
    } catch (error) {
      console.error('Ошибка обработки запроса:', error);
      return new Response('Error', { status: 500 });
    }
  }
  
  // GET запрос - отображаем информацию о боте
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Тюлень Cards Bot</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          color: white;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          margin-top: 50px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 {
          text-align: center;
          font-size: 2.5em;
          margin-bottom: 10px;
        }
        .subtitle {
          text-align: center;
          font-size: 1.2em;
          opacity: 0.9;
          margin-bottom: 30px;
        }
        .bot-card {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 15px;
          padding: 25px;
          margin: 20px 0;
        }
        .bot-name {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }
        .bot-name h2 {
          margin: 0;
          font-size: 1.8em;
        }
        .emoji {
          font-size: 2.5em;
        }
        .command {
          background: rgba(255, 255, 255, 0.2);
          padding: 8px 15px;
          border-radius: 10px;
          margin: 5px 0;
          font-family: monospace;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-top: 30px;
        }
        .feature {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 15px;
          text-align: center;
        }
        .feature-icon {
          font-size: 2.5em;
          margin-bottom: 15px;
        }
        .btn {
          display: inline-block;
          background: white;
          color: #764ba2;
          padding: 12px 30px;
          border-radius: 25px;
          text-decoration: none;
          font-weight: bold;
          margin-top: 20px;
          transition: transform 0.3s;
        }
        .btn:hover {
          transform: translateY(-2px);
        }
        .stats {
          display: flex;
          justify-content: space-around;
          margin-top: 30px;
          text-align: center;
        }
        .stat-item {
          padding: 20px;
        }
        .stat-number {
          font-size: 2em;
          font-weight: bold;
          display: block;
        }
        .stat-label {
          font-size: 0.9em;
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🦭 Тюлень Cards</h1>
        <div class="subtitle">Коллекционная карточная игра в Telegram</div>
        
        <div class="bot-card">
          <div class="bot-name">
            <div class="emoji">🦭</div>
            <h2>@SealsCards_bot</h2>
          </div>
          <p>Собирай уникальные карточки с тюленями, соревнуйся с другими игроками и становись лучшим коллекционером!</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://t.me/SealsCards_bot" class="btn" target="_blank">🚀 Начать играть</a>
          </div>
        </div>
        
        <div class="features">
          <div class="feature">
            <div class="feature-icon">🎯</div>
            <h3>Собирай карты</h3>
            <p>Коллекционируй карточки тюленей разных редкостей</p>
          </div>
          <div class="feature">
            <div class="feature-icon">🏆</div>
            <h3>Соревнуйся</h3>
            <p>Поднимайся в топе игроков и покажи свою коллекцию</p>
          </div>
          <div class="feature">
            <div class="feature-icon">🎁</div>
            <h3>Получай бонусы</h3>
            <p>Ежедневные награды за подписку на канал</p>
          </div>
        </div>
        
        <div class="bot-card">
          <h3>📋 Основные команды:</h3>
          <div class="command">/start - Начать игру</div>
          <div class="command">/card - Получить карточку</div>
          <div class="command">/profile - Ваш профиль</div>
          <div class="command">/top - Топ игроков</div>
          <div class="command">/bonus - Бонус за подписку</div>
          <div class="command">/help - Помощь по игре</div>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <span class="stat-number">${Object.keys(usersDB).length}</span>
            <span class="stat-label">Игроков онлайн</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${Object.values(usersDB).reduce((sum, user) => sum + (user.cards?.length || 0), 0)}</span>
            <span class="stat-label">Карт собрано</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${Object.values(usersDB).reduce((sum, user) => sum + (user.points || 0), 0)}</span>
            <span class="stat-label">Всего очков</span>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px; opacity: 0.7; font-size: 0.9em;">
          <p>🤖 Бот работает на GitHub Pages | 🔗 Канал: ${CHANNEL_USERNAME}</p>
        </div>
      </div>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8'
    }
  });
}
